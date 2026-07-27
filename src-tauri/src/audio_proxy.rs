use axum::{
    body::Body,
    extract::Query,
    http::{HeaderMap, HeaderValue, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio::sync::oneshot;

/// 查询参数
#[derive(Deserialize)]
pub struct ProxyParams {
    url: String,
}

/// 通过 reqwest 转发 HTTP 请求（保留原始响应头和 body）
async fn handle_proxy(
    Query(params): Query<ProxyParams>,
    headers: HeaderMap,
) -> Result<Response<Body>, (StatusCode, String)> {
    let url = &params.url;

    // 安全：只允许 http/https
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err((StatusCode::BAD_REQUEST, "仅允许 http/https URL".into()));
    }

    let client = reqwest::Client::builder()
        .no_proxy()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("HTTP client 初始化失败: {}", e),
            )
        })?;

    // 转发浏览器请求的 Range header（音频播放必需，CDN 防盗链检查）
    let mut req_builder = client.get(url).header("Referer", "https://music.163.com/");
    if let Some(range) = headers.get("range") {
        req_builder = req_builder.header("range", range);
    }

    let resp = req_builder.send().await.map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            format!("请求目标失败: {}", e),
        )
    })?;

    let status = resp.status();
    let headers = resp.headers().clone();
    let body = Body::from_stream(resp.bytes_stream());

    // 构建响应，转发关键头
    let mut response_headers = HeaderMap::new();
    for key in &[
        "content-type",
        "content-length",
        "accept-ranges",
        "content-range",
    ] {
        if let Some(val) = headers.get(*key) {
            response_headers.insert(*key, val.clone());
        }
    }

    // CORS
    response_headers.insert("access-control-allow-origin", HeaderValue::from_static("*"));

    let mut response_builder = Response::builder().status(status);
    for (key, val) in response_headers.iter() {
        response_builder = response_builder.header(key, val);
    }

    Ok(response_builder
        .body(body)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("构建响应失败: {}", e),
            )
        })?)
}

/// 健康检查
async fn ping() -> &'static str {
    "pong"
}

/// 启动音频代理服务器，返回 (端口, shutdown_sender)
/// 注意：调用方需负责在活跃的 tokio runtime 上执行此函数
pub async fn start_audio_proxy() -> Result<(u16, oneshot::Sender<()>), String> {
    let app = Router::new()
        .route("/api/audio-proxy", get(handle_proxy))
        .route("/api/ping", get(ping));

    // 绑定到随机端口
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("绑定端口失败: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("获取端口失败: {}", e))?
        .port();

    let (tx, rx) = oneshot::channel::<()>();

    // 在调用方的 runtime 上 spawn（lib.rs 使用 tauri::async_runtime::spawn）
    let handle = tokio::runtime::Handle::current();
    handle.spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                rx.await.ok();
            })
            .await
            .ok();
    });

    Ok((port, tx))
}
