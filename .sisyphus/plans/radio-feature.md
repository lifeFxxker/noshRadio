# PLAN: 在线电台功能 (Online Radio)

## Goal
在 NOSH Radio 音乐平台中加入传统广播电台功能，支持浏览、搜索、收听全球电台（基于 radio-browser.info）。

## Scope (MVP)
- 浏览: 国内热门电台列表、按分类标签浏览
- 搜索: 按电台名称/城市/语言搜索
- 收听: 点击电台 → 通过现有播放器播放流
- UI 整合: 在 AI 聊天抽屉中新增「📻 电台」tab
- 播放器调整: 电台模式下隐藏进度条/切歌按钮，显示 LIVE 指示灯

## Out of Scope
- 收藏电台 / 订阅更新
- 电台收听历史
- 多音源聚合

---

## Phase 1 — 后端: radio-server.js (电台代理服务器)

Create a new Node.js server (`radio-server.js`) on port 3002 that:

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /stations/top` | 全球热门电台 (topclick) |
| `GET /stations/chinese` | 中国热门电台 |
| `GET /stations/search?q=xxx` | 搜索电台 (byname) |
| `GET /stations/bytag?tag=xxx` | 按分类标签筛选 |
| `GET /tags` | 分类标签列表 |
| `GET /countries` | 国家列表 |
| `GET /languages` | 语言列表 |
| `GET /proxy?url=xxx` | 流音频代理 (防盗链) |

All endpoints proxy to radio-browser.info API (`https://de1.api.radio-browser.info/json/...`), adding CORS headers. Filters out broken stations (`lastcheckok !== 1`).

### Proxy-server.js Update
Add route: `/radio/*` → proxy to `localhost:3002`

**Files**: `radio-server.js` (新), `proxy-server.js` (修改)

---

## Phase 2 — 前端: 电台 Tab 组件

### Sprite Drawer 改造
在聊天抽屉的 tab bar 中新增「📻 电台」tab:
```
sprite-tab-bar: [💬 聊天] [🎵 歌单] [📻 电台] ← new
```

### 电台面板 (sprite-radio)
在 `sprite-panel` 中新增 `tab-panel`:
- **顶部**: 搜索框 + 分类标签栏 (pop/rock/jazz/news/talk…)
- **列表**: 电台卡片列表（名称、标签、编码、国家）
- **状态**: "正在播放" 提示 + 停止按钮

### 数据流
1. 电台 tab 激活 → 加载中国热门电台
2. 点击电台 → 调用 `playRadio(station)` 函数
3. 搜索 / 筛选 → 重新渲染列表

**Files**: `nosh-music-ai.html` (修改)

---

## Phase 3 — 播放器适配

### 电台播放模式
- 新增 `playRadio(station)` 函数替代 `searchAndPlay`
- 直接设置 `audio.src = station.url_resolved || station.url`
- 通过 proxy 代理解决部分 CDN 防盗链

### UI 调整 (电台激活时)
| 组件 | 普通模式 | 电台模式 |
|------|---------|---------|
| 进度条 | 显示 + 可拖动 | 隐藏 |
| 上一曲/下一曲 | 启用 | 隐藏 |
| 播放按钮 | 启用 | 启用 |
| 音量控制 | 显示 | 显示 |
| LIVE 指示灯 | 灰色 "LIVE" | 红色闪烁 "LIVE" |
| 曲名/歌手 | 显示 | 显示电台名 + 标签 |

### 事件处理
- `audio.onerror` → 显示"流不可用"
- 电台切换时自动停止前一流
- 流播放中隐藏进度时间显示

**Files**: `nosh-music-ai.html` (修改)

---

## Phase 4 — 整合与打磨

- 电台模式与普通模式的切换逻辑
- 搜索防抖、加载状态
- 空状态提示
- 移动端适配
- 标签缓存（减少 API 请求）

## Decisions
- **HLS 处理**: 引入 hls.js (npm: `hls.js`)，通过 CDN `<script>` 引入。HLS 流用 hls.js 播放，MP3/AAC 直链用原生 Audio。
- **国内热门**: 按 radio-browser.info API 的 clickcount 降序排列，取 `countrycode=CN` 中 `lastcheckok=1` 的电台。

## Dependencies
- `hls.js` (~30KB, via CDN script tag) — 用于播放 HLS (m3u8) 电台流

## Test Strategy
手动验证 + Agent QA:
1. 打开电台 tab，验证国内电台加载
2. 搜索"音乐" "news" "北京" 等关键词
3. 点击播放，验证音频流播放
4. 验证进度条/切歌按钮隐藏
5. 切换到普通歌曲播放，验证进度条恢复
