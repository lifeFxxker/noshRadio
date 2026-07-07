# Electron 桌面打包方案

## 目标
将 noshRadio 打包为 Electron 桌面应用，双击 exe 一键启动，自动拉起所有后端服务，开箱即听。

## 当前架构

```
proxy-server.js :8081        ← 静态文件服务 + API 代理
  ├─ / → nosh-music-ai.html
  ├─ /netease/*  → localhost:3000  (NeteaseCloudMusicApi)
  ├─ /kugou/*    → localhost:3001  (kugou-server.js)
  └─ /unblock/*  → localhost:30489 (unblock-music-server.js)
```

## 实现方案

### Electron 主进程 (`main.js`)
- 启动时依次 spawn 4 个子进程（proxy / netease / unblock / kugou）
- 用 `portfinder` 或轮询方式等待服务就绪
- 创建 BrowserWindow 加载 `http://localhost:8081`
- 关闭窗口时 kill 所有子进程 + app.quit()
- stdout/stderr 重定向到日志文件（不弹出 cmd 窗口）

### 前置条件
- 所有后端服务以 `child_process.spawn` 运行，`windowsHide: true` 隐藏命令行窗口
- 日志写入 `%USERPROFILE%/.noshradio/logs/`
- 数据目录 `data/` 保持在工作目录

### 打包 (electron-builder)
- 目标: `nsis` (Windows 安装包/exe)
- extraResources: 打包整个项目（含 node_modules）
- 工作目录设为 `process.resourcesPath` 以支持 portable

## 实施步骤

1. 创建 `main.js` — Electron 主进程
2. 创建 `preload.js` — 安全检查
3. 更新 `package.json` — 依赖 + 脚本
4. 添加 `electron-builder.yml` — 打包配置
5. 本地运行验证
6. 打包验证
