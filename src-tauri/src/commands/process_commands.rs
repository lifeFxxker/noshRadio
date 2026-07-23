use std::collections::HashMap;
use std::ffi::OsStr;
use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Windows 隐藏子进程控制台窗口
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// 托管子进程的全局状态
pub struct ServiceManager {
    pub services: Mutex<HashMap<String, Child>>,
    /// 各服务最近一次启动错误（key=服务名）
    pub last_errors: Mutex<HashMap<String, String>>,
}

impl ServiceManager {
    pub fn new() -> Self {
        Self {
            services: Mutex::new(HashMap::new()),
            last_errors: Mutex::new(HashMap::new()),
        }
    }

    /// 清理已崩溃的进程并返回是否被清理
    pub fn reap_dead(&self, name: &str) -> bool {
        let mut services = match self.services.lock() {
            Ok(s) => s,
            Err(_) => return false,
        };
        if let Some(child) = services.get(name) {
            match child.try_wait() {
                Ok(Some(_)) => {
                    // 进程已退出，移除
                    services.remove(name);
                    return true;
                }
                _ => return false,
            }
        }
        false
    }
}

/// 定义需启动的后端服务
pub struct ServiceDef {
    pub name: &'static str,
    pub cwd: &'static str,
    pub entry: &'static str,
    pub args: &'static [&'static str],
}

pub const BACKEND_SERVICES: &[ServiceDef] = &[
    ServiceDef {
        name: "netease",
        cwd: "build/bundled",
        entry: "netease-server.js",
        args: &[],
    },
    ServiceDef {
        name: "kugou",
        cwd: "build/bundled",
        entry: "kugou-server.js",
        args: &[],
    },
    ServiceDef {
        name: "proxy",
        cwd: ".",
        entry: "proxy-server.js",
        args: &[],
    },
];

/// 启动一个后端 Node.js 服务
#[tauri::command]
pub fn spawn_service(
    app: tauri::AppHandle,
    state: State<ServiceManager>,
    name: String,
) -> Result<String, String> {
    // 将 State 转为 &ServiceManager 然后委托给 spawn_service_with_env
    let manager: &ServiceManager = &*state;
    // 先清理已崩溃的进程
    manager.reap_dead(&name);
    spawn_service_with_env(&app, manager, &name, &[])
}

/// 停止一个后端服务
#[tauri::command]
pub fn stop_service(
    state: State<ServiceManager>,
    name: String,
) -> Result<String, String> {
    let mut services = state.services.lock().map_err(|e| e.to_string())?;

    match services.remove(&name) {
        Some(mut child) => {
            // 先检查进程是否已死（kill 已死进程会报错）
            let already_dead = child.try_wait().ok().flatten().is_some();
            if !already_dead {
                let _ = child.kill();
                child.wait().ok();
            }
            Ok(format!("{} 已停止", name))
        }
        None => Err(format!("{} 未在运行", name)),
    }
}

/// 启动服务并支持额外环境变量
pub fn spawn_service_with_env(
    app: &tauri::AppHandle,
    manager: &ServiceManager,
    name: &str,
    extra_envs: &[(&str, String)],
) -> Result<String, String> {
    let def = BACKEND_SERVICES
        .iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("未知的服务: {}", name))?;

    // 防止重复启动
    {
        let services = manager.services.lock().map_err(|e| e.to_string())?;
        if services.contains_key(name) {
            return Ok(format!("{} 已在运行中", name));
        }
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("获取资源目录失败: {}", e))?;
    let mut cwd = resource_dir.join(def.cwd);

    // NSIS 安装结构：资源文件在 resource_dir/_up_/ 下
    // 而非直接放在 resource_dir/，自动检测并修正
    for alt_dir in [&resource_dir.join("_up_"), &resource_dir] {
        let entry_path = alt_dir.join(def.cwd).join(def.entry);
        if entry_path.exists() {
            cwd = alt_dir.join(def.cwd);
            break;
        }
    }

    let mut cmd = Command::new("node");
    cmd.arg(def.entry)
        .args(def.args)
        .current_dir(&cwd)
        .stdout(Stdio::null())
        .stderr(Stdio::piped()); // 改为 piped 以捕获错误输出

    // 隐藏子进程控制台窗口（仅 Windows）
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    // 注入额外环境变量
    for (key, val) in extra_envs {
        cmd.env(OsStr::new(key), OsStr::new(val));
    }

    let mut child = cmd.spawn().map_err(|e| {
        let err_msg = format!("启动 {} 失败: {}", name, e);
        if let Ok(mut errors) = manager.last_errors.lock() {
            errors.insert(name.to_string(), err_msg.clone());
        }
        err_msg
    })?;

    // 等待 800ms 检查进程是否存活（防止启动后立即崩溃）
    std::thread::sleep(Duration::from_millis(800));
    match child.try_wait() {
        Ok(Some(status)) => {
            // 捕获 stderr 以获取详细的失败原因
            let stderr_output = child.stderr.take()
                .map(|mut s| {
                    let mut buf = String::new();
                    s.read_to_string(&mut buf).ok();
                    buf
                })
                .unwrap_or_default()
                .trim()
                .to_string();

            // 检查是否是 EADDRINUSE（端口被上次运行的旧进程占用）
            // 此时服务实际可用，视为启动成功
            if stderr_output.contains("EADDRINUSE") {
                println!("[tauri] {} 端口已被占用，使用已有进程", name);
                if let Ok(mut errors) = manager.last_errors.lock() {
                    errors.remove(name);
                }
                return Ok(format!("{} 已运行中 (端口被占用，旧进程)", name));
            }

            let err_msg = format!(
                "{} 启动后立即退出 (exit code: {:?})。\nstderr: {}\n请确认已安装 Node.js 且资源文件完整。",
                name,
                status.code(),
                if stderr_output.is_empty() { "(无输出)" } else { &stderr_output }
            );

            // 记录错误供诊断使用
            if let Ok(mut errors) = manager.last_errors.lock() {
                errors.insert(name.to_string(), err_msg.clone());
            }

            return Err(err_msg);
        }
        Ok(None) => {
            // 启动成功，清除之前记录的该服务错误
            if let Ok(mut errors) = manager.last_errors.lock() {
                errors.remove(name);
            }
        }
        Err(e) => {
            let err_msg = format!("{} 进程检查失败: {}", name, e);
            if let Ok(mut errors) = manager.last_errors.lock() {
                errors.insert(name.to_string(), err_msg.clone());
            }
            return Err(err_msg);
        }
    }

    let pid = child.id();

    let mut services = manager.services.lock().map_err(|e| e.to_string())?;
    services.insert(name.to_string(), child);

    Ok(format!("{} 已启动 (PID={})", name, pid))
}

/// 查询所有服务状态
#[tauri::command]
pub fn get_services_status(state: State<ServiceManager>) -> Vec<String> {
    let mut status = Vec::new();
    let errors = state.last_errors.lock().map(|e| e.clone()).unwrap_or_default();

    for def in BACKEND_SERVICES {
        let running = state
            .services
            .lock()
            .map(|s| s.contains_key(def.name))
            .unwrap_or(false);
        if running {
            status.push(format!("{}: 运行中", def.name));
        } else if let Some(err) = errors.get(def.name) {
            // 显示错误的摘要（第一行）
            let first_line = err.lines().next().unwrap_or(err);
            status.push(format!("{}: 失败 - {}", def.name, first_line));
        } else {
            status.push(format!("{}: 已停止", def.name));
        }
    }

    status
}
