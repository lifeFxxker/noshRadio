# noshRadio

**多音源聚合桌面音乐播放器** — 在一个统一界面中搜索、播放和发现来自多个音源的音乐。

基于 Tauri（Rust）构建。内置 AI 品味系统、Bilibili 视频集成和插件支持。

仅个人学习使用，严禁商用或大范围传播。

<img width="450" height="260" alt="image" src="https://github.com/user-attachments/assets/5762cc6a-f360-4e2c-aa32-6b8905c90b48" />
<img width="450" height="260" alt="image" src="https://github.com/user-attachments/assets/f6748583-5c6f-40ae-aeda-2fa2ed368fb8" />
<img width="450" height="260" alt="image" src="https://github.com/user-attachments/assets/6a817a4d-3efe-4c53-bf40-79af2f3432b3" />
<img width="450" height="260" alt="42baf9c1-1233-4291-9762-a547c6befd22" src="https://github.com/user-attachments/assets/8a1f15b6-83b2-4d61-bfc3-ce6976b030f5" />
<img width="450" height="260" alt="image" src="https://github.com/user-attachments/assets/a4151f8e-926e-47db-9cf4-3624b5a96953" />
<img width="450" height="260" alt="image" src="https://github.com/user-attachments/assets/ed62d65b-b56b-4ede-b861-6603af817f0a" />
<img width="450" height="260" alt="image" src="https://github.com/user-attachments/assets/32d0b4b2-7268-4f43-8c78-c239cb33bb16" />
<img width="420" height="150" alt="image" src="https://github.com/user-attachments/assets/0cb48675-d09a-42f0-a8fb-cc4a858071cb" />

## 功能特性

- **多音源搜索** — 聚合多个音乐提供商的搜索结果
- **统一播放** — 无论音源来自哪里，统一解析并播放
- **AI 品味系统** — 通过听歌习惯学习你的偏好
- **Bilibili 集成** — 搜索、播放和浏览 B站视频弹幕
- **插件系统** — 通过自定义音源提供者扩展功能
- **跨音源解析** — 音源间自动回退，提高可用性
- **音频 CDN 代理** — 处理防盗链 Referer，确保稳定播放
- **扫码登录** — 通过二维码导入你的歌单
- **自动更新** — 检查 GitHub Release 获取新版本

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri (Rust) |
| 前端 | 原生 HTML/JS, Wired Elements (手绘风格 UI) |
| 后端 | Node.js HTTP 代理, Express |
| 构建工具 | esbuild, Vite |
| 音频代理 | Rust (Tauri) |
| 依赖库 | GSAP (动画), Three.js (可视化), Protobuf (弹幕) |

## 快速开始

### 环境要求

- Node.js 18+
- npm
- Rust 工具链（Tauri 需要）

### 安装依赖

```bash
npm install
```

### 运行（开发模式）

```bash
npm run dev
```

### 打包

```bash
npm run build:tauri
```

## 项目结构

```
noshRadio/
├── proxy-server.js          # HTTP 代理（API/音频）
├── kugou-provider.js        # 音源提供者
├── kugou-server.js          # 音源服务
├── source-server.js         # 跨音源 URL 解析
├── updater.js               # 自动更新模块
├── dev-server.js            # 开发服务器（Tauri）
├── nosh-music-ai.html       # 主前端页面
├── nosh-taste.js            # 品味系统
├── nosh-persist.js          # 数据持久化层
├── src-tauri/               # Tauri Rust 源码（音频代理、配置）
│   ├── src/
│   └── tauri.conf.json
├── web/                     # 前端发布目录
├── plugins/                 # 插件系统
│   └── source-bridge/       # 音源插件桥接
├── build/                   # 构建脚本
├── lib/                     # 前端库
├── fonts/                   # UI 字体
└── scripts/                 # 工具脚本
```

## 架构

```
浏览器/窗口
    │
    ▼
proxy-server.js (port 8081)
    │
    ├── /netease/*  →  NeteaseCloudMusicApi (port 3000)
    ├── /kugou/*    →  Kugou Server (port 3001)
    ├── /api/bili/* →  Bilibili WBI-signed API
    ├── /api/audio-proxy  →  CDN 音频代理（带 Referer 头）
    └── /source/*   →  插件音源桥接 (port 30489)
```

## 许可证

MIT
