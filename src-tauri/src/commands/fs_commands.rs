use std::path::PathBuf;
use tauri::Manager;


/// 获取应用数据目录
fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))
}

/// 从应用数据目录读取文件
#[tauri::command]
pub fn read_data_file(app: tauri::AppHandle, relative_path: String) -> Result<String, String> {
    let mut full_path = get_data_dir(&app)?;
    full_path.push(&relative_path);

    // 安全检查：禁止 path traversal
    if !full_path.starts_with(get_data_dir(&app)?) {
        return Err("非法路径".into());
    }

    std::fs::read_to_string(&full_path)
        .map_err(|e| format!("读取文件失败: {}", e))
}

/// 写入文件到应用数据目录
#[tauri::command]
pub fn write_data_file(
    app: tauri::AppHandle,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let mut full_path = get_data_dir(&app)?;
    full_path.push(&relative_path);

    if !full_path.starts_with(get_data_dir(&app)?) {
        return Err("非法路径".into());
    }

    // 确保父目录存在
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    std::fs::write(&full_path, &content)
        .map_err(|e| format!("写入文件失败: {}", e))
}

/// 检查文件是否存在
#[tauri::command]
pub fn file_exists(app: tauri::AppHandle, relative_path: String) -> bool {
    let mut full_path = match get_data_dir(&app) {
        Ok(p) => p,
        Err(_) => return false,
    };
    full_path.push(&relative_path);
    full_path.exists()
}

/// 删除文件
#[tauri::command]
pub fn delete_data_file(app: tauri::AppHandle, relative_path: String) -> Result<(), String> {
    let mut full_path = get_data_dir(&app)?;
    full_path.push(&relative_path);

    if !full_path.starts_with(get_data_dir(&app)?) {
        return Err("非法路径".into());
    }

    if full_path.is_file() {
        std::fs::remove_file(&full_path).map_err(|e| format!("删除文件失败: {}", e))
    } else if full_path.is_dir() {
        std::fs::remove_dir_all(&full_path).map_err(|e| format!("删除目录失败: {}", e))
    } else {
        Ok(())
    }
}
