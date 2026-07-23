/**
 * noshRadio — Electron 桌面主进程
 *
 * 启动所有后端服务，等待就绪后加载前端页面。
 * 关闭窗口时自动清理所有子进程。
 */
const { app, BrowserWindow, Menu, ipcMain, dialog, utilityProcess } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const updater = require('./updater');

// ─── 路径 ────────────────────────────────────────────────────
const APP_ROOT = __dirname;

// 用户数据目录下的插件目录（不会随应用更新而清除）
let PLUGINS_DIR;

const LOGS_DIR = path.join(app.getPath('userData'), 'logs');

// ─── 日志辅助 ─────────────────────────────────────────────────
function ensureLogDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function logFile(name) {
  return path.join(LOGS_DIR, `${name}.log`);
}

function writeLog(name, msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile(name), line);
}

// ─── 插件管理 ─────────────────────────────────────────────────
function getPluginsDir() {
  if (!PLUGINS_DIR) {
    PLUGINS_DIR = path.join(app.getPath('userData'), 'plugins');
  }
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }
  return PLUGINS_DIR;
}

/** 返回已安装的插件名列表 */
function getInstalledPlugins() {
  const dir = getPluginsDir();
  try {
    return fs.readdirSync(dir).filter(name => {
      const manifestPath = path.join(dir, name, 'manifest.json');
      return fs.existsSync(manifestPath);
    });
  } catch {
    return [];
  }
}

/** 检查某个插件是否已安装 */
function isPluginInstalled(name) {
  return getInstalledPlugins().includes(name);
}

/** 获取插件目录的完整路径 */
function getPluginPath(name) {
  return path.join(getPluginsDir(), name);
}

// ─── 服务定义 ─────────────────────────────────────────────────
// NeteaseCloudMusicApi 作为 npm 依赖安装在 node_modules 下
// 注意：打包后 app.asar.unpacked/node_modules/NeteaseCloudMusicApi/
function neteaseCwd() {
  return path.join(APP_ROOT, 'node_modules', 'NeteaseCloudMusicApi');
}

const SERVICES = [
  {
    name: 'proxy-server',
    script: 'proxy-server.js',
    port: 8081,
    cwd: APP_ROOT,
  },
  {
    name: 'netease-api',
    script: 'app.js',
    port: 3000,
    cwd: neteaseCwd(),
  },
  {
    name: 'kugou-server',
    script: 'kugou-server.js',
    port: 3001,
    cwd: APP_ROOT,
  },
];

const children = [];

/** 强制杀死占用指定端口的进程（防止旧进程残留导致 EADDRINUSE） */
function killPort(port) {
  try {
    const stdout = execSync(`netstat -ano | findstr "LISTENING" | findstr ":${port} "`, { timeout: 3000, encoding: 'utf8' });
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try {
          process.kill(parseInt(pid), 'SIGKILL');
          writeLog('main', `[KILL] port=${port} pid=${pid}`);
        } catch (_) {
          // 可能已经结束
        }
      }
    }
  } catch (_) {
    // netstat 找不到监听进程 = 端口空闲
  }
}

// ─── 进程管理 ─────────────────────────────────────────────────
function startService(svc) {
  ensureLogDir();

  // 启动前先清理残留进程
  killPort(svc.port);
  writeLog('main', `[BOOT] Starting ${svc.name} (port=${svc.port}) ...`);

  // 为 proxy-server 注入插件路径（即使插件不存在也传空，proxy-server 自己处理）
  const envOverrides = {
    ...process.env,
    PORT: String(svc.port),
  };
  if (svc.name === 'proxy-server') {
    envOverrides.SOURCE_PLUGIN_PATH = getPluginPath('source-bridge');
    // 传 app 根目录（打包后 proxy 解压到 asar.unpacked，但静态文件在 asar 内）
    envOverrides.APP_ROOT = APP_ROOT;
    // 可写数据目录
    envOverrides.DATA_DIR = path.join(app.getPath('userData'), 'data');
  }

  // utilityProcess.fork() 脚本路径（打包后 asarUnpack 的文件在 app.asar.unpacked/ 下）
  // 直接用 ASAR 路径 fork 会失败，必须用实际文件系统路径
  let child;
  if (app.isPackaged) {
    const scriptRelPath = path.relative(APP_ROOT, path.join(svc.cwd, svc.script));
    const unpackedRoot = path.join(process.resourcesPath, 'app.asar.unpacked');
    const scriptPath = path.join(unpackedRoot, scriptRelPath);
    const unpackedCwd = path.join(unpackedRoot, path.relative(APP_ROOT, svc.cwd));
    child = utilityProcess.fork(
      fs.existsSync(scriptPath) ? scriptPath : path.join(svc.cwd, svc.script),
      [],
      {
        serviceName: svc.name,
        cwd: fs.existsSync(unpackedCwd) ? unpackedCwd : svc.cwd,
        env: envOverrides,
        stdio: 'pipe',
      },
    );
  } else {
    child = utilityProcess.fork(
      path.join(svc.cwd, svc.script),
      [],
      {
        serviceName: svc.name,
        cwd: svc.cwd,
        env: envOverrides,
        stdio: 'pipe',
      },
    );
  }

  const outStream = fs.createWriteStream(logFile(svc.name), { flags: 'a' });
  const errStream = fs.createWriteStream(logFile(`${svc.name}-err`), { flags: 'a' });

  child.stdout.pipe(outStream);
  child.stderr.pipe(errStream);

  child.on('exit', (code) => {
    writeLog(svc.name, `[EXIT] code=${code}`);
    outStream.end();
    errStream.end();
  });

  children.push(child);
  writeLog(svc.name, `[START] pid=${child.pid} port=${svc.port}`);
  return child;
}

function killAll() {
  for (const child of children) {
    try {
      // utilityProcess 自带 .kill()（Windows 上也是强杀进程树）
      if (typeof child.kill === 'function') {
        child.kill();
      } else {
        // fallback：旧 spawn 进程
        spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], {
          windowsHide: true,
          stdio: 'ignore',
        });
      }
    } catch (_) {
      // 忽略 kill 失败
    }
  }
  children.length = 0;
}

// ─── 健康检查 ─────────────────────────────────────────────────
function waitForPort(port, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for port ${port}`));
        return;
      }
      const req = http.get(`http://localhost:${port}/`, (res) => {
        resolve();
      });
      req.on('error', () => {
        setTimeout(check, 500);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(check, 500);
      });
    }
    check();
  });
}

// ─── IPC：插件安装/卸载 ──────────────────────────────────────
function setupIPC() {
  // 获取插件状态
  ipcMain.handle('plugin:status', (_, name) => {
    return { installed: isPluginInstalled(name) };
  });

  // 导入并安装插件 ZIP
  ipcMain.handle('plugin:install', async (_, name) => {
    const result = await dialog.showOpenDialog({
      title: `导入插件 - ${name}`,
      filters: [{ name: '插件包', extensions: ['zip'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }
    const zipPath = result.filePaths[0];
    const targetDir = path.join(getPluginsDir(), name);

    try {
      // 删除旧版本（如果存在）
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      // 创建目标目录
      fs.mkdirSync(targetDir, { recursive: true });

      // 解压 ZIP（使用 PowerShell 的 Expand-Archive，Windows 自带）
      const psCmd = `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`;
      const exitCode = await new Promise((resolve, reject) => {
        const ps = spawn('powershell', ['-NoProfile', '-Command', psCmd], {
          stdio: 'inherit',
          shell: true,
          windowsHide: true,
        });
        ps.on('error', (err) => {
          writeLog('main', `[PLUGIN] spawn 失败: ${name} - ${err.message}`);
          reject(err);
        });
        ps.on('close', (code) => resolve(code));
      });

      if (exitCode !== 0) {
        writeLog('main', `[PLUGIN] 解压失败: ${name}, code=${exitCode}`);
        return { success: false, error: `解压失败 (code=${exitCode})` };
      }

      writeLog('main', `[PLUGIN] 安装成功: ${name}`);
      return { success: true, path: targetDir };
    } catch (e) {
      writeLog('main', `[PLUGIN] 安装失败: ${name} - ${e.message}`);
      return { success: false, error: e.message };
    }
  });

  // 卸载插件
  ipcMain.handle('plugin:remove', async (_, name) => {
    const targetDir = path.join(getPluginsDir(), name);
    try {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        writeLog('main', `[PLUGIN] 卸载成功: ${name}`);
      }
      return { success: true };
    } catch (e) {
      writeLog('main', `[PLUGIN] 卸载失败: ${name} - ${e.message}`);
      return { success: false, error: e.message };
    }
  });

  // 获取所有已安装插件信息
  ipcMain.handle('plugin:list', async () => {
    const plugins = getInstalledPlugins();
    const result = [];
    for (const name of plugins) {
      const manifestPath = path.join(getPluginsDir(), name, 'manifest.json');
      let manifest = null;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch {}
      result.push({ name, manifest });
    }
    return result;
  });

  // 窗口控制（原有）
  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });
  ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // ─── 自动升级 ──────────────────────────────────────────────
  const appVersion = app.getVersion();

  // 检查更新
  ipcMain.handle('update:check', async () => {
    writeLog('main', '[UPDATE] Checking for updates...');
    const info = await updater.checkForUpdate(appVersion);
    if (info) {
      writeLog('main', `[UPDATE] Found: v${info.version}`);
    } else {
      writeLog('main', '[UPDATE] No update available');
    }
    return info; // 返回给渲染进程
  });

  // 下载更新（带进度推送）
  let downloadAbort = false;

  ipcMain.handle('update:download', async () => {
    downloadAbort = false;
    const info = await updater.checkForUpdate(appVersion);
    if (!info) return { error: 'no update' };

    writeLog('main', `[UPDATE] Downloading ${info.assetName}...`);
    try {
      const destPath = await updater.downloadUpdate(info, (progress) => {
        mainWindow?.webContents.send('update:download-progress', progress);
      });
      writeLog('main', `[UPDATE] Downloaded to ${destPath}`);
      return { success: true, path: destPath };
    } catch (e) {
      writeLog('main', `[UPDATE] Download failed: ${e.message}`);
      return { error: e.message };
    }
  });

  // 执行安装
  ipcMain.handle('update:install', async () => {
    const tmpDir = process.env.TEMP || '.';
    // 找最新下载的文件
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('noshRadio-update-'));
    if (!files.length) return { error: 'no downloaded installer found' };
    const latest = files.sort().reverse()[0];
    const exePath = path.join(tmpDir, latest);

    writeLog('main', `[UPDATE] Installing ${exePath}`);
    const result = updater.installUpdate(exePath);
    if (!result.success) {
      writeLog('main', `[UPDATE] 安装启动失败: ${result.error}`);
      return { error: result.error };
    }
    // 延迟退出，让安装器有机会启动
    setTimeout(() => app.quit(), 1000);
    return { success: true };
  });
}

// ─── Electron ────────────────────────────────────────────────
// Windows 任务栏 AppUserModelID
if (process.platform === 'win32') {
  app.setAppUserModelId('com.noshradio.app');
}
let mainWindow = null;

async function createWindow() {
  // 先写一条启动日志
  ensureLogDir();
  writeLog('main', `[BOOT] noshRadio starting — isPackaged=${app.isPackaged}`);
  writeLog('main', `[BOOT] APP_ROOT=${APP_ROOT}`);
  writeLog('main', `[BOOT] LOGS_DIR=${LOGS_DIR}`);
  writeLog('main', `[BOOT] Plugins: ${getInstalledPlugins().join(', ') || '(none)'}`);

  // 1. 注册 IPC
  setupIPC();

  // 2. 启动所有服务
  for (const svc of SERVICES) {
    startService(svc);
  }

  // 3. 等待 proxy-server 就绪（前端入口）
  writeLog('main', '[BOOT] Waiting for proxy-server:8081 ...');
  try {
    await waitForPort(8081, 45000);
  } catch (e) {
    writeLog('main', `[BOOT] FATAL: ${e.message}`);
    // 仍然尝试创建窗口，显示错误页面
  }
  writeLog('main', '[BOOT] proxy-server ready');

  // 4. 去掉菜单栏
  Menu.setApplicationMenu(null);

  // 5. 创建浏览器窗口（无原生标题栏）
  const iconPath = path.join(__dirname, 'release', '.icon-ico', 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'noshRadio',
    icon: fs.existsSync(iconPath) ? iconPath : path.join(__dirname, 'build', 'icon.png'),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // 等 ready-to-show 再显示
  });

  // 通知渲染进程最大化状态变化
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', false);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL('http://localhost:8081/');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 6. 后台静默检查更新（不阻塞启动）
  setTimeout(() => {
    updater.checkForUpdate(app.getVersion()).then((info) => {
      if (info && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:available', info);
        writeLog('main', `[UPDATE] Notified renderer: v${info.version}`);
      }
    }).catch(() => {
      // 静默失败，不影响用户
    });
  }, 5000); // 启动 5 秒后再检查，避免影响首屏加载
}

// ─── 安全策略 ─────────────────────────────────────────────────
app.on('web-contents-created', (_, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault());
});

// 开发工具快捷键
ipcMain.on('devtools:open', () => {
  if (mainWindow) mainWindow.webContents.openDevTools({ mode: 'bottom' });
});

// ─── 生命周期 ─────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  killAll();
  app.quit();
});

app.on('before-quit', () => {
  killAll();
});

app.on('will-quit', () => {
  killAll();
});

process.on('exit', () => {
  killAll();
});
