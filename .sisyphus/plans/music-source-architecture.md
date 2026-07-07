# 音源架构改进计划

## 背景

对比分析了三个项目的音源方案：

| 项目 | 方案 | 特点 |
|------|------|------|
| **AuraPlayer** | B站视频 → 下载转MP3 → 本地播放 | 离线可用，B站合集多但无单曲粒度 |
| **落雪音乐(lx-music)** | 6平台聚合 + 第三方API中转播放URL | 在线播放，架构清晰，有源切换层 |
| **noshRadio (现有)** | 酷狗/网易云/咪咕 Provider 直调API | 已有多平台支持，但缺少统一抽象层 |

**结论**：落雪的 Provider 架构 + API源切换机制 最值得借鉴。noshRadio 已有 kugou-provider.js / NeteaseCloudMusicApi / migu-music-api 基础。

---

## 目标

建立统一音源抽象层，将现有散落的 Provider 整合为可切换、可扩展的架构。

---

## 阶段 1 — 音源抽象层

### 1.1 定义统一 Provider 接口

创建 `src/core/provider.ts` (或 `.js`)，规定每个 Provider 必须实现的接口：

```typescript
interface MusicProvider {
  id: string;          // 'kugou' | 'netease' | 'migu' | ...
  name: string;        // '酷狗音乐' | '网易云音乐' | ...
  supportedQualities: Quality[];  // ['128k', '320k', 'flac']

  // 搜索
  search(keyword: string, page?: number, pageSize?: number): Promise<SearchResult>;

  // 获取播放URL（核心）
  getPlayUrl(songId: string, quality: Quality): Promise<string>;

  // 获取歌词
  getLyric(songId: string): Promise<LyricResult | null>;

  // 获取封面
  getCover(songId: string): Promise<string | null>;
}
```

### 1.2 改造现有 Provider

将现有的各 provider 适配到统一接口：

| 现有文件 | 改造目标 |
|----------|----------|
| `kugou-provider.js` | 适配 `MusicProvider`，保持搜索/播放URL逻辑 |
| `NeteaseCloudMusicApi/` | 封装为 `NeteaseProvider`，统一通过后端API调用 |
| `migu-music-api` (package) | 封装为 `MiguProvider` 适配层 |

### 1.3 音源注册与切换

创建 `src/core/provider-registry.ts`：

```typescript
class ProviderRegistry {
  private providers: Map<string, MusicProvider> = new Map();
  private activeSource: string = 'kugou';

  register(provider: MusicProvider): void;
  setActive(id: string): void;
  getActive(): MusicProvider;
  getProvider(id: string): MusicProvider;
  getAll(): MusicProvider[];
}
```

### 1.4 播放URL获取策略（借鉴落雪）

落雪的做法：搜索由各Provider自己做，播放URL通过第三方API中转获取。

针对 noshRadio 的方案：
- **方案 A（推荐）**：在后端（Express/Node）加一个统一的音源代理层 `/api/play-url`，各 Provider 在前端只负责搜索，播放URL统一走后端中转签名
- **方案 B（快速）**：保持当前前端直调 pattern，只在代码层面做接口统一

> **推荐方案 A**，原因：前端 `<audio>` 直接播放各平台流媒体URL存在 CORS/防盗链风险，后端统一代理更可控

---

## 阶段 2 — 后端音源代理（可选但推荐）

### 2.1 统一代理端点

```
POST /api/play-url
  Body: { provider: 'kugou', songId: '...', quality: '320k' }
  Response: { url: '...', expires: timestamp }
```

### 2.2 实现要点
- 缓存播放URL（各平台URL有过期时间，通常几小时到几天）
- 失败自动降级（320k 拿不到 → 尝试 128k）
- 跨源切换（当前源播放失败 → 自动尝试其他源找同歌曲）

---

## 阶段 3 — 前端改造

### 3.1 数据层
- `Track` 类型增加 `provider` 字段标识来源
- 播放列表支持跨源混合
- 播放时通过 `ProviderRegistry.getActive().getPlayUrl()` 获取URL

### 3.2 UI层
- 播放界面显示当前音源标识
- 设置页面增加"默认音源"下拉选择（酷狗/网易/咪咕/自动）
- 源切换后的结果缓存/状态保持

### 3.3 自动源切换
当前源某首歌无法播放时：
1. 自动尝试其他注册的 Provider 搜索同歌曲名+歌手
2. 找到可播放版本 → 无缝切换播放
3. 在界面短暂提示"已切换到XX源"

---

## 阶段 4 — 搜索聚合（可选增强）

### 4.1 聚合搜索
同时搜索所有已注册 Provider，合并去重后返回：

```
搜索"孙燕姿"
  ├── 酷狗 → 返回50条
  ├── 网易 → 返回30条
  └── 咪咕 → 返回40条
  ↓
合并去重（按 歌名+歌手 去重）
  ↓
返回带 source 标签的混合结果列表
```

### 4.2 播放优先级
搜索结果中同一首歌出现在多个源时，按用户设置的优先级选择：`用户偏好 > 音质优先 > 响应速度优先`

---

## 实施路线

| 阶段 | 内容 | 工作量 | 优先级 |
|------|------|--------|--------|
| **1.1-1.3** | 定义接口 + 改造现有 Provider + 注册中心 | 3-4天 | P0 |
| **1.4 / 2** | 后端音源代理端点 | 2-3天 | P1 |
| **3** | 前端UI改造（设置、源显示、状态管理） | 2天 | P1 |
| **4** | 聚合搜索 + 自动源切换 | 2-3天 | P2 |

### 第一阶段（MVP，建议先做）
1. 定义 `MusicProvider` 接口
2. 将现有 `kugou-provider.js` 适配到接口
3. 创建 `ProviderRegistry` 并在播放流程中接入
4. 其他 Provider 后续逐步适配

这样不破坏现有功能，可以增量替换。
