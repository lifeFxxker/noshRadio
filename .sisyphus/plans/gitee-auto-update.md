# Gitee Release 在线升级方案

## 目标
通过 Gitee Releases 实现 noshRadio 桌面端的在线自动升级，用户无感检查、不中断播放、一键更新。

## 方案选型
**方案 A — 自定义更新模块（不依赖 electron-updater）**
- 单文件 HTML/JS 渲染进程，无需引入复杂 provider 体系
- 完全控制下载/进度/安装流程
- 适配 Gitee API v5

## 架构

```
updater.js (主进程模块)
   ├─ checkForUpdate()       → Gitee API 获取最新 Release
   ├─ downloadUpdate()       → HTTP 流式下载+进度上报
   └─ installUpdate()        → spawn 安装器 + app.quit()

main.js
   └─ ipcMain.handle('update:*') → 桥接 updater.js

preload.js
   └─ noshElectron.update.*      → 暴露给渲染进程

nosh-music-ai.html
   ├─ 启动时静默检查更新
   ├─ 有更新时弹出通知
   └─ 下载进度条 + 安装按钮
```

## 用户体验流程

### 阶段 1：启动时静默检查
- 后台请求 Gitee API `/repos/{owner}/{repo}/releases/latest`
- 版本比较（semver）
- 无更新/网络超时 → 静默结束，不干扰用户

### 阶段 2：通知（不中断播放）
右下角卡片通知，现有 toast 系统扩展：
```
┌──────────────────────────────┐
│ 🔄 新版本 v1.0.1 可用        │
│ 包含 bug 修复和性能优化       │
│                              │
│     [忽略]    [下载更新]      │
└──────────────────────────────┘
```
- 忽略 → 关闭，下次启动仍检查
- 下载更新 → 进入阶段 3

### 阶段 3：后台下载（音乐继续播放）
同卡片变进度条，用户正常使用：
```
┌──────────────────────────────┐
│ 🔄 正在下载更新...           │
│ ████████████░░░░░░░ 68%     │
│ 12.5 MB / 18.3 MB           │
│                              │
│     [后台下载]               │
└──────────────────────────────┘
```
- 下载失败 → 显示"下载失败，重试？"
- 下载完成 → 按钮变为"立即安装"

### 阶段 4：安装重启
```
┌──────────────────────────────┐
│ ✅ 更新已就绪                │
│ v1.0.1 已下载完成，安装需重启 │
│                              │
│    [稍后再说]   [立即安装]   │
└──────────────────────────────┘
```
- 立即安装 → spawn 安装器 → app.quit()
- 稍后再说 → 右上角小蓝点提示（不碍眼）

## 数据流

```
启动 → checkForUpdate() → Gitee API v5
  ├─ 无更新 → 静默结束
  └─ 有更新 → renderer 收到 update:available
                └─ 用户点"下载" → downloadUpdate()
                                      ├─ 进度 → update:progress → 进度条
                                      └─ 完成 → update:downloaded
                                                     └─ 点"安装" → installUpdate()
                                                                       ├─ spawn 安装器
                                                                       └─ app.quit()
```

## 涉及代码改动

| 文件 | 改动类型 | 内容 |
|------|----------|------|
| `updater.js` | **新增** | 检查/下载/安装逻辑，Gitee API 调用 |
| `main.js` | 修改 | 引入 updater，注册 IPC handler |
| `preload.js` | 修改 | 暴露 `noshElectron.update` API |
| `nosh-music-ai.html` | 修改 | 更新 UI（通知卡片、进度条、安装按钮） |
| `package.json` | 修改 | 添加 `update.owner`/`update.repo` 字段 |

## Gitee 侧准备工作

1. 创建 Gitee 仓库（可 private）专放 Release
2. 每次发版创建 Release，Tag 命名 `v1.0.0`（semver）
3. 上传 `noshRadio Setup x.x.x.exe` + `*.exe.blockmap`
4. 按需生成 Personal Access Token（私有仓库时需要）

## 后续可加分体验

- 安装器 `/S` 静默参数 + 安装后自动启动
- 展开显示 Release body 更新日志
- 设置页面添加"检查更新"按钮
- 自动下载模式：检测到更新后台下好，只弹"已就绪"

## 文件清单
- `.sisyphus/plans/gitee-auto-update.md` — 本计划文件
