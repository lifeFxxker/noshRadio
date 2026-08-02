use std::path::PathBuf;
use std::fs::File;
use std::io::Cursor;
use serde::Serialize;
use tauri::Manager;

/// 插件下载返回结构
#[derive(Debug, Serialize)]
pub struct PluginRemoteInstallResult {
    pub success: bool,
    pub canceled: bool,
    pub error: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PluginInfo {
    pub name: String,
    pub version: String,
    pub manifest: Option<serde_json::Value>,
}

/// 获取插件目录
fn get_plugins_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    path.push("plugins");
    std::fs::create_dir_all(&path).map_err(|e| format!("创建插件目录失败: {}", e))?;
    Ok(path)
}

/// 从 manifest.json 中提取版本号
fn read_plugin_manifest(plugin_dir: &PathBuf) -> Option<serde_json::Value> {
    let manifest_path = plugin_dir.join("manifest.json");
    if manifest_path.exists() {
        std::fs::read_to_string(&manifest_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
    } else {
        None
    }
}

fn get_plugin_version(manifest: &Option<serde_json::Value>) -> String {
    manifest
        .as_ref()
        .and_then(|m| m.get("version").and_then(|v| v.as_str()))
        .unwrap_or("0.0.0")
        .to_string()
}

/// 列出已安装的插件
#[tauri::command]
pub fn plugin_list(app: tauri::AppHandle) -> Result<Vec<PluginInfo>, String> {
    let plugins_dir = get_plugins_dir(&app)?;

    let entries = match std::fs::read_dir(&plugins_dir) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()),
    };

    let mut plugins = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("读取插件目录失败: {}", e))?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        let manifest = read_plugin_manifest(&path);
        let version = get_plugin_version(&manifest);

        // 只列出包含 manifest.json 的有效插件
        if manifest.is_some() {
            plugins.push(PluginInfo {
                name,
                version,
                manifest,
            });
        }
    }

    Ok(plugins)
}

/// 从 ZIP 文件解压到目标目录
/// 从 ZIP 数据解压到目标目录
fn extract_zip_from_data(data: &[u8], target: &PathBuf) -> Result<(), String> {
    let cursor = Cursor::new(data);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("读取 ZIP 数据失败: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("读取 ZIP 条目失败: {}", e))?;
        let out_path = target.join(entry.name());

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|e| format!("创建目录失败: {}", e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
            }
            let mut outfile = File::create(&out_path).map_err(|e| format!("创建文件失败: {}", e))?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| format!("写入文件失败: {}", e))?;
        }
    }

    Ok(())
}

/// 解压后验证 manifest.json，处理 ZIP 内单层目录的情况
fn finalize_plugin_extract(target: &PathBuf) -> Result<(), String> {
    if target.join("manifest.json").exists() {
        return Ok(());
    }
    // 如果 ZIP 内的文件没有 manifest.json，可能 ZIP 内有一层目录
    let entries: Vec<_> = std::fs::read_dir(target)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .collect();
    if entries.len() == 1 && entries[0].path().is_dir() {
        let inner = entries[0].path();
        let temp = target.with_extension("_tmp");
        std::fs::rename(target, &temp).map_err(|e| format!("重命名失败: {}", e))?;
        std::fs::rename(&temp.join(inner.file_name().unwrap()), target).map_err(|e| format!("移动内容失败: {}", e))?;
        let _ = std::fs::remove_dir(&temp);
    }
    if !target.join("manifest.json").exists() {
        let _ = std::fs::remove_dir_all(target);
        return Err("ZIP 文件中未找到 manifest.json，不是有效的插件包".to_string());
    }
    Ok(())
}

/// 安装插件
///
/// 两种模式：
/// 1. zip_data = Some(vec) → 从前端传入的 ZIP 字节数组解压安装
/// 2. zip_data = null → 从项目内置目录复制（快速路径）
#[tauri::command]
pub fn plugin_install(app: tauri::AppHandle, name: String, zip_data: Option<Vec<u8>>) -> Result<serde_json::Value, String> {
    let plugins_dir = get_plugins_dir(&app)?;
    let target = plugins_dir.join(&name);

    // 如果已安装且有新 ZIP 数据则覆盖，否则报错
    if target.exists() {
        if zip_data.is_some() {
            std::fs::remove_dir_all(&target).map_err(|e| format!("删除旧版本失败: {}", e))?;
        } else {
            return Ok(serde_json::json!({
                "success": false,
                "canceled": false,
                "error": format!("插件 '{}' 已安装", name)
            }));
        }
    }

    // 模式 1：从 ZIP 字节数据安装
    if let Some(data) = zip_data {
        std::fs::create_dir_all(&target).map_err(|e| format!("创建插件目录失败: {}", e))?;
        extract_zip_from_data(&data, &target)?;
        match finalize_plugin_extract(&target) {
            Ok(_) => {},
            Err(e) => {
                return Ok(serde_json::json!({
                    "success": false,
                    "canceled": true,
                    "error": e
                }));
            }
        }
        return Ok(serde_json::json!({
            "success": true,
            "canceled": false
        }));
    }

    // 模式 2：从内置目录复制
    let mut source: Option<PathBuf> = None;

    // 打包后的资源目录 (<bundle>/plugins/<name>/)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("plugins").join(&name);
        if p.join("manifest.json").exists() { source = Some(p); }
    }

    // 开发模式：从项目根目录 (<project>/plugins/<name>/)
    if source.is_none() {
        if let Ok(cwd) = std::env::current_dir() {
            let candidate = if cwd.ends_with("src-tauri") {
                cwd.parent().unwrap().join("plugins").join(&name)
            } else {
                cwd.join("plugins").join(&name)
            };
            if candidate.join("manifest.json").exists() { source = Some(candidate); }
        }
    }

    // 开发模式：从可执行文件所在目录的父目录
    if source.is_none() {
        if let Ok(exe) = std::env::current_exe() {
            let candidate = exe.parent()
                .and_then(|p| p.parent())
                .map(|p| p.join("plugins").join(&name))
                .unwrap_or_default();
            if candidate.join("manifest.json").exists() { source = Some(candidate); }
        }
    }

    let source = match source {
        Some(p) => p,
        None => {
            return Ok(serde_json::json!({
                "success": false,
                "canceled": true,
                "error": format!("内置插件 '{}' 不存在，请使用 ZIP 文件安装", name)
            }));
        }
    };

    fn copy_dir(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
        std::fs::create_dir_all(dst)?;
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            if file_type.is_dir() {
                copy_dir(&src_path, &dst_path)?;
            } else {
                std::fs::copy(&src_path, &dst_path)?;
            }
        }
        Ok(())
    }

    copy_dir(&source, &target).map_err(|e| format!("复制插件失败: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "canceled": false
    }))
}

/// 卸载插件
#[tauri::command]
pub fn plugin_remove(app: tauri::AppHandle, name: String) -> Result<serde_json::Value, String> {
    let plugins_dir = get_plugins_dir(&app)?;
    let target = plugins_dir.join(&name);

    if !target.exists() {
        return Ok(serde_json::json!({
            "success": false,
            "error": format!("插件 '{}' 未安装", name)
        }));
    }

    std::fs::remove_dir_all(&target).map_err(|e| format!("删除插件失败: {}", e))?;

    Ok(serde_json::json!({
        "success": true
    }))
}

/// 查询插件状态
#[tauri::command]
pub fn plugin_status(app: tauri::AppHandle, name: String) -> Result<serde_json::Value, String> {
    let plugins_dir = get_plugins_dir(&app)?;
    let plugin_path = plugins_dir.join(&name);

    if !plugin_path.exists() {
        return Ok(serde_json::json!({
            "installed": false,
            "name": name,
            "version": "0.0.0"
        }));
    }

    let manifest = read_plugin_manifest(&plugin_path);
    let version = get_plugin_version(&manifest);

    Ok(serde_json::json!({
        "installed": true,
        "name": name,
        "version": version,
        "manifest": manifest
    }))
}

/// 远程安装插件：从 URL 下载 ZIP 并安装（绕过浏览器 CORS 限制）
///
/// 使用 rust 原生 HTTP 客户端（reqwest）下载，不受 WebView CORS 约束。
/// 下载成功后将 ZIP 字节直接交给 plugin_install 的解压安装逻辑。
#[tauri::command]
pub async fn plugin_install_remote(
    app: tauri::AppHandle,
    name: String,
    url: String,
) -> Result<PluginRemoteInstallResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .user_agent("noshRadio/1.0.1")
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Ok(PluginRemoteInstallResult {
            success: false,
            canceled: false,
            error: Some(format!("服务器返回状态码 {}", resp.status())),
            version: None,
        });
    }

    let total = resp.content_length().unwrap_or(0);
    // ZIP 通常小于 1MB，这里仅做最小合理性校验（至少 100 字节）
    if total > 0 && total < 100 {
        return Ok(PluginRemoteInstallResult {
            success: false,
            canceled: false,
            error: Some(format!("下载的文件过小 ({} bytes)，可能不是有效的插件包", total)),
            version: None,
        });
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取下载数据失败: {}", e))?;

    if bytes.is_empty() {
        return Ok(PluginRemoteInstallResult {
            success: false,
            canceled: false,
            error: Some("下载内容为空".into()),
            version: None,
        });
    }

    // 交给现有的解压安装逻辑
    match plugin_install(app, name, Some(bytes.to_vec())) {
        Ok(json) => {
            let success = json.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
            let canceled = json.get("canceled").and_then(|v| v.as_bool()).unwrap_or(false);
            let error = json.get("error").and_then(|v| v.as_str()).map(|s| s.to_string());
            Ok(PluginRemoteInstallResult {
                success,
                canceled,
                error,
                version: None,
            })
        }
        Err(e) => Ok(PluginRemoteInstallResult {
            success: false,
            canceled: false,
            error: Some(e),
            version: None,
        }),
    }
}
