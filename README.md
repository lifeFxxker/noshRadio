<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a>
</p>

# noshRadio

**Multi-source desktop music player** — search, stream, and discover music across multiple providers in one unified interface.

Built with Tauri (Rust). Features an AI-powered taste system, Bilibili video integration, and plugin support.

## Features

- **Multi-source search** — aggregate results from multiple music providers
- **Unified playback** — resolve and play songs regardless of source
- **AI taste system** — learns your preferences through listening habits
- **Bilibili integration** — search, play, and browse Bilibili video danmaku
- **Plugin system** — extend with custom source providers
- **Cross-source URL resolution** — fallback across providers for better availability
- **Audio CDN proxy** — handles anti-leech referer headers for reliable streaming
- **Scan-to-login** — import your playlists via QR code
- **Auto-updater** — checks GitHub releases for new versions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri (Rust) |
| Frontend | Vanilla HTML/JS, Wired Elements (hand-drawn UI) |
| Backend | Node.js HTTP proxy, Express |
| Build | esbuild, Vite |
| Audio Proxy | Rust (Tauri) |
| Dependencies | GSAP (animations), Three.js (visualizations), Protobuf (danmaku) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Rust toolchain (for Tauri)

### Install

```bash
npm install
```

### Run (development)

```bash
npm run dev
```

### Build

```bash
npm run build:tauri
```

## Project Structure

```
noshRadio/
├── proxy-server.js          # HTTP proxy for API/audio
├── kugou-provider.js        # Music source provider
├── kugou-server.js          # Music source server
├── source-server.js         # Cross-source URL resolver
├── updater.js               # Auto-update module
├── dev-server.js            # Dev server (Tauri)
├── nosh-music-ai.html       # Main frontend
├── nosh-taste.js            # Taste/profile system
├── nosh-persist.js          # Data persistence layer
├── src-tauri/               # Tauri Rust source (audio proxy, config)
│   ├── src/
│   └── tauri.conf.json
├── web/                     # Frontend output
├── plugins/                 # Plugin system
│   └── source-bridge/       # Source plugin bridge
├── build/                   # Build scripts
├── lib/                     # Frontend libraries
├── fonts/                   # UI fonts
└── scripts/                 # Utility scripts
```

## Architecture

```
Browser/Window
    │
    ▼
proxy-server.js (port 8081)
    │
    ├── /netease/*  →  NeteaseCloudMusicApi (port 3000)
    ├── /kugou/*    →  Kugou Server (port 3001)
    ├── /api/bili/* →  Bilibili WBI-signed API
    ├── /api/audio-proxy  →  CDN audio with Referer headers
    └── /source/*   →  Plugin source bridge (port 30489)
```

## License

MIT
