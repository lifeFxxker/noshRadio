use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use tokio::io::AsyncWriteExt;

// ─── 版本比较 ─────────────────────────────────────────────────
fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let pa: Vec<u32> = a.trim_start_matches('v').split('.').map(|s| s.parse().unwrap_or(0)).collect();
    let pb: Vec<u32> = b.trim_start_matches('v').split('.').map(|s| s.parse().unwrap_or(0)).collect();
    for i in 0..3 {
        let va = pa.get(i).copied().unwrap_or(0);
        let vb = pb.get(i).copied().unwrap_or(0);
        if va != vb { return va.cmp(&vb); }
    }
    std::cmp::Ordering::Equal
}

// ─── Gitee API 数据结构 ──────────────────────────────────────
#[derive(Debug, Deserialize)]
struct GiteeRelease {
    tag_name: String,
    body: Option<String>,
    assets: Vec<GiteeAsset>,
}
#[derive(Debug, Deserialize)]
struct GiteeAsset {
    name: String,
    size: Option<u64>,
    browser_download_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub tag_name: String,
    pub release_notes: String,
    pub download_url: String,
    pub asset_name: String,
    pub asset_size: u64,
}

// ─── 系统信息 ─────────────────────────────────────────────────
#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub version: String,
    pub app_data_dir: String,
    pub resource_dir: String,
}

#[tauri::command]
pub fn get_system_info(app: tauri::AppHandle) -> Result<SystemInfo, String> {
    let platform = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let version = "1.0.1".to_string();

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let resource_dir = app
        .path()
        .resource_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(SystemInfo {
        platform,
        arch,
        version,
        app_data_dir,
        resource_dir,
    })
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub fn get_env(name: String) -> Result<String, String> {
    std::env::var(&name).map_err(|_| format!("环境变量 '{}' 未设置", name))
}

// ─── 更新检查：Gitee Release API ─────────────────────────────
const GITEE_OWNER: &str = "yangshengzhe";
const GITEE_REPO: &str = "nosh-radio";
const CURRENT_VERSION: &str = "1.0.1";

#[tauri::command]
pub async fn update_check() -> Result<Option<UpdateInfo>, String> {
    let url = format!(
        "https://gitee.com/api/v5/repos/{}/{}/releases/latest",
        GITEE_OWNER, GITEE_REPO
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Gitee API 返回状态码 {}", resp.status()));
    }

    let release: GiteeRelease = resp
        .json()
        .await
        .map_err(|e| format!("解析 Gitee 响应失败: {}", e))?;

    let latest_tag = release.tag_name.trim_start_matches('v');
    if compare_versions(latest_tag, CURRENT_VERSION) != std::cmp::Ordering::Greater {
        return Ok(None);
    }

    // 找到第一个 .exe 安装包（排除 .exe.blockmap）
    let asset = match release
        .assets
        .iter()
        .find(|a| a.name.ends_with(".exe") && !a.name.ends_with(".exe.blockmap"))
    {
        Some(a) => a,
        None => return Ok(None),
    };

    // 补全下载地址
    let download_url = match &asset.browser_download_url {
        Some(url) if url.starts_with("http") => url.clone(),
        Some(path) => format!("https://gitee.com{}", path),
        None => return Ok(None),
    };

    // Gitee API 不返回 asset.size，用 HEAD 请求获取真实文件大小
    let real_size = match asset.size {
        Some(s) if s > 0 => s,
        _ => {
            match client.head(&download_url).send().await {
                Ok(resp) => resp.content_length().unwrap_or(0),
                Err(_) => 0,
            }
        }
    };

    Ok(Some(UpdateInfo {
        version: release.tag_name.clone(),
        tag_name: release.tag_name,
        release_notes: release.body.unwrap_or_default(),
        download_url,
        asset_name: asset.name.clone(),
        asset_size: real_size,
    }))
}

// ─── 下载更新 ─────────────────────────────────────────────────
#[derive(Debug, Serialize)]
pub struct DownloadResult {
    pub path: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn update_download(
    app: tauri::AppHandle,
    url: String,
    asset_name: String,
) -> Result<DownloadResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Ok(DownloadResult {
            path: None,
            error: Some(format!("服务器返回状态码 {}", resp.status())),
        });
    }

    let total = resp.content_length().unwrap_or(0);
    if total > 0 && total < 1024 * 1024 {
        return Ok(DownloadResult {
            path: None,
            error: Some("安装包过小 ({:.1}MB)，可能不是有效的安装包".into()),
        });
    }

    let tmp_dir = std::env::temp_dir();
    let dest = tmp_dir.join(format!("noshRadio-update-{}", asset_name));
    let mut file = tokio::fs::File::create(&dest)
        .await
        .map_err(|e| format!("创建临时文件失败: {}", e))?;

    let mut downloaded: u64 = 0;

    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("下载中断: {}", e))?
    {
        downloaded += chunk.len() as u64;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("写入文件失败: {}", e))?;

        if total > 0 {
            let percent = (downloaded as f64 / total as f64 * 100.0) as u32;
            let _ = app.emit(
                "update-progress",
                serde_json::json!({
                    "percent": percent,
                    "bytes": downloaded,
                    "total": total,
                }),
            );
        }
    }

    file.flush().await.ok();
    let path_str = dest.to_string_lossy().to_string();

    // 最终验证
    match tokio::fs::metadata(&dest).await {
        Ok(meta) if meta.len() < 1024 * 1024 => {
            let _ = tokio::fs::remove_file(&dest).await;
            return Ok(DownloadResult {
                path: None,
                error: Some(format!(
                    "下载的文件异常 ({:.1}MB)，请重试",
                    meta.len() as f64 / 1048576.0
                )),
            });
        }
        Err(e) => {
            return Ok(DownloadResult {
                path: None,
                error: Some(format!("无法验证文件: {}", e)),
            });
        }
        _ => {}
    }

    Ok(DownloadResult {
        path: Some(path_str),
        error: None,
    })
}

// ─── 安装更新 ─────────────────────────────────────────────────
#[derive(Debug, Serialize)]
pub struct InstallResult {
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn update_install(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<InstallResult, String> {
    let path = std::path::Path::new(&file_path);

    if !path.exists() {
        return Ok(InstallResult {
            success: false,
            error: Some("安装包不存在，请重新下载".into()),
        });
    }

    let meta = match std::fs::metadata(path) {
        Ok(m) => m,
        Err(e) => {
            return Ok(InstallResult {
                success: false,
                error: Some(format!("无法读取安装包: {}", e)),
            })
        }
    };

    if meta.len() < 1024 * 1024 {
        return Ok(InstallResult {
            success: false,
            error: Some("安装包异常，文件可能已损坏".into()),
        });
    }

    // 静默启动安装程序（NSIS /S 参数）
    match std::process::Command::new(&file_path)
        .arg("/S")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(_child) => {
            // 短暂等待后关闭应用（安装程序会接管）
            std::thread::sleep(std::time::Duration::from_secs(2));
            app.exit(0);
            Ok(InstallResult {
                success: true,
                error: None,
            })
        }
        Err(e) => Ok(InstallResult {
            success: false,
            error: Some(format!("启动安装程序失败: {}", e)),
        }),
    }
}

/// 打开开发者工具（F12）
#[tauri::command]
pub fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
        Ok(())
    } else {
        Err("找不到主窗口".to_string())
    }
}

/// 诊断：检查运行环境（前端可通过此命令获取诊断信息）
#[tauri::command]
pub fn diagnose_backend(app: tauri::AppHandle) -> Vec<String> {
    let mut lines = Vec::new();

    // 1. Node.js 检查
    match std::process::Command::new("node")
        .arg("--version")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
    {
        Ok(out) if out.status.success() => {
            lines.push(format!("Node: {} ✓", String::from_utf8_lossy(&out.stdout).trim()));
        }
        Ok(_) => lines.push("Node: 未找到 (node --version 失败)".into()),
        Err(e) => lines.push(format!("Node: 不可用 - {}", e)),
    }

    // 2. 资源目录（检查所有可能的位置）
    match app.path().resource_dir() {
        Ok(dir) => {
            lines.push(format!("资源目录: {}", dir.display()));
            let candidates = [
                ("直接", dir.join("proxy-server.js")),
                ("_up_ 子目录", dir.join("_up_").join("proxy-server.js")),
            ];
            let mut found = false;
            for (label, path) in &candidates {
                if path.exists() {
                    lines.push(format!("proxy-server.js: 位于 {} → {}", label, path.display()));
                    lines.push(format!("  大小: {} bytes", std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)));
                    found = true;
                }
            }
            if !found {
                lines.push("proxy-server.js: 不存在 ✗ (已检查所有位置)".into());
            }
        }
        Err(e) => lines.push(format!("资源目录: 获取失败 - {}", e)),
    }

    // 3. 服务状态
    let state = app.state::<crate::commands::process_commands::ServiceManager>();
    let services = state.services.lock().map(|s| s.keys().cloned().collect::<Vec<_>>()).unwrap_or_default();
    if services.is_empty() {
        lines.push("运行中的服务: (无)".into());
    } else {
        lines.push(format!("运行中的服务: {}", services.join(", ")));
    }

    // 4. 异常信息（未运行的服务如果有错误记录，显示出来）
    let errors = state.last_errors.lock().map(|e| e.clone()).unwrap_or_default();
    for (svc_name, error_detail) in &errors {
        if !services.contains(svc_name) {
            lines.push(format!("⚠ {} 错误:", svc_name));
            for line in error_detail.lines() {
                lines.push(format!("   {}", line));
            }
        }
    }

    lines
}
