mod audio_proxy;
mod commands;

use commands::process_commands::ServiceManager;
use std::sync::Mutex;
use tauri::Manager;

pub struct AudioProxyState {
    pub port: u16,
    pub shutdown: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
}

#[tauri::command]
fn get_audio_proxy_url(state: tauri::State<AudioProxyState>) -> String {
    format!("http://127.0.0.1:{}", state.port)
}

/// 启动所有 Node.js 后端服务（net ease / kugou / proxy-server）
fn start_backend_services(app: &tauri::AppHandle) {
    let manager = app.state::<ServiceManager>();
    let plugins_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.join("plugins"))
        .unwrap_or_default();
    let data_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.join("data"))
        .unwrap_or_default();

    // 确保目录存在
    std::fs::create_dir_all(&plugins_dir).ok();
    std::fs::create_dir_all(&data_dir).ok();

    // 1. NeteaseCloudMusicApi (port 3000)
    if let Err(e) = commands::process_commands::spawn_service_with_env(
        app, &manager, "netease", &[],
    ) {
        eprintln!("[tauri] 启动 netease 服务失败: {}", e);
    }

    // 2. Kugou server (port 3001)
    if let Err(e) = commands::process_commands::spawn_service_with_env(
        app, &manager, "kugou", &[],
    ) {
        eprintln!("[tauri] 启动 kugou 服务失败: {}", e);
    }

    // 3. Proxy-server (port 8081) — 核心 API 网关
    let resource_dir = app.path().resource_dir().ok();
    let app_root = resource_dir
        .as_ref()
        .and_then(|p| p.to_str())
        .unwrap_or(".")
        .to_string();
    let source_plugin_path = plugins_dir.join("source-bridge").to_string_lossy().to_string();
    let data_dir_str = data_dir.to_string_lossy().to_string();

    let proxy_envs: &[(&str, String)] = &[
        ("PORT", "8081".into()),
        ("SOURCE_PLUGIN_PATH", source_plugin_path),
        ("APP_ROOT", app_root),
        ("DATA_DIR", data_dir_str),
    ];

    if let Err(e) = commands::process_commands::spawn_service_with_env(
        app, &manager, "proxy", proxy_envs,
    ) {
        eprintln!("[tauri] 启动 proxy-server 失败: {}", e);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ServiceManager::new())
        .setup(|app| {
            // 在 Tauri 的异步 runtime 上启动音频代理服务器
            match tauri::async_runtime::block_on(audio_proxy::start_audio_proxy()) {
                Ok((port, shutdown_tx)) => {
                    println!("[tauri] 音频代理服务器: http://127.0.0.1:{}", port);
                    app.manage(AudioProxyState {
                        port,
                        shutdown: Mutex::new(Some(shutdown_tx)),
                    });
                }
                Err(e) => {
                    eprintln!("[tauri] 音频代理启动失败: {}", e);
                    app.manage(AudioProxyState {
                        port: 0,
                        shutdown: Mutex::new(None),
                    });
                }
            }

            // 启动 Node.js 后端服务（netease / kugou / proxy-server）
            start_backend_services(app.handle());

            // 后台进程守护：每 15 秒检查一次，移除 crash 的进程记录
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(15));
                    if let Some(manager) = handle.try_state::<ServiceManager>() {
                        for name in &["netease", "kugou", "proxy"] {
                            manager.reap_dead(name);
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 音频代理
            get_audio_proxy_url,
            // 系统信息
            commands::system_commands::get_platform,
            commands::system_commands::get_env,
            commands::system_commands::get_system_info,
            commands::system_commands::update_check,
            commands::system_commands::update_download,
            commands::system_commands::update_install,
            commands::system_commands::open_devtools,
            // 文件读写
            commands::fs_commands::read_data_file,
            commands::fs_commands::write_data_file,
            commands::fs_commands::file_exists,
            commands::fs_commands::delete_data_file,
            // 进程管理
            commands::process_commands::spawn_service,
            commands::process_commands::stop_service,
            commands::process_commands::get_services_status,
            // 插件管理
            commands::plugin_commands::plugin_list,
            commands::plugin_commands::plugin_install,
            commands::plugin_commands::plugin_remove,
            commands::plugin_commands::plugin_status,
            // 诊断
            commands::system_commands::diagnose_backend,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // 窗口关闭时清理子进程
                if let Some(manager) = window.try_state::<commands::process_commands::ServiceManager>() {
                    if let Ok(mut services) = manager.services.lock() {
                        for (name, mut child) in services.drain() {
                            println!("[tauri] 清理子进程: {}", name);
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
