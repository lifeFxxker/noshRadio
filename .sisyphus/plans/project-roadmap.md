# NOSH Radio 路线图：合规重构与差异化发展

## TL;DR

> **核心问题**: 当前 Unblock 多源聚合绕过了音乐平台的防盗链和付费墙，存在法律风险
> **解决方案**: ① 主程序剥离 Unblock，回归纯网易云登录态播放器 ② Unblock 拆分为独立闭源插件，私域微信分发 ③ 发展 zero-risk 差异化功能（电台/节奏分析）
> **最终定位**: 合规的桌面音乐播放器 + 可选增强插件

---

## 一、项目现状对比（noshRadio vs Mineradio）

### 1.1 定位差异

| 维度 | Mineradio | noshRadio |
|------|-----------|-----------|
| 定位 | 沉浸式音乐播放器（电影镜头+粒子视觉+歌词舞台） | 多音源聚合桌面音乐播放器 |
| Stack | Electron + Three.js + NeteaseCloudMusicApi | Electron + Three.js + GSAP + Wired Elements |
| 音源 | 网易云 + QQ音乐 + 本地 | 网易云 + 酷狗 + Unblock + radio-browser |
| 前端架构 | 单页应用，服务端渲染+客户端渲染混合 | 单页应用（nosh-music-ai.html, 12K+行） |
| 后端架构 | 单进程 server.js（搜索/URL/代理/登录/更新/节拍分析一体） | 多进程（proxy + kugou + unblock + netease） |
| 登录态 | 网易云 + QQ音乐双平台扫码登录，cookie 文件持久化 | 网易云扫码登录，无持久化 |
| 合规 | 用户自持凭证，不跨源盗链 | 依赖 Unblock 做跨源解析 |
| Stars | 85 | 未公开 |

### 1.2 功能矩阵

| 功能 | Mineradio | noshRadio | 备注 |
|------|-----------|-----------|------|
| 网易云搜索播放 | ✓ | ✓ | 均有 |
| QQ音乐搜索播放 | ✓ | ✗ | Mineradio 独占 |
| 酷狗音乐 | ✗ | ✓ | noshRadio 独占 |
| Unblock 多源聚合 | ✗ | ✓ | noshRadio 独占但有风险 |
| radio-browser 在线电台 | ✗ | ✓ | **noshRadio 差异化** |
| 天气电台（Open-Meteo） | ✓ | ✗ | **值得借鉴** |
| 歌词舞台+桌面歌词 | ✓ | ✗ | Mineradio 核心体验 |
| 节奏分析（节拍图） | ✓（dj-analyzer.js） | ✗ | **值得借鉴** |
| AI 推荐引擎 | ✗ | ✓ | **noshRadio 差异化** |
| 3D 专辑封面滚筒 | ✓（Three.js） | ✓（Three.js） | 均有 |
| 登录 cookie 持久化 | ✓（文件） | ✗（内存） | 需改进 |
| 点播播客 | ✓ | ✓ | 均有 |
| 本地音乐 | ✓ | ✗ | Mineradio 独占 |
| 播放器模式切换 | ✓（simple/diy） | ✗ | **值得借鉴** |
| 自动更新检测 | ✓ | ✗ | **值得借鉴** |
| 桌面壁纸模式 | ✓ | ✗ | Mineradio 独占 |

### 1.3 可借鉴的具体实现

| 功能 | 文件 | 行数 | 可复用度 |
|------|------|------|----------|
| QQ音乐扫码登录 | `desktop/main.js` | ~200 | 中（需适配 noshRadio 进程模型） |
| 节奏分析引擎 | `dj-analyzer.js` | ~900 | 高（纯算法，无依赖） |
| 桌面歌词窗口 | `desktop/main.js` + `desktop-lyrics.html` | ~300 | 中（需适配） |
| 天气电台 | `server.js` 相关路由（Open-Meteo） | ~50 | 高（纯 API 调用） |
| 播放器模式切换 | `public/index.html`（simple/diy CSS） | ~200 | 高（纯 CSS + JS） |
| 自动更新 | `server.js` 更新模块 | ~400 | 低（耦合太紧） |

---

## 二、合规策略（核心决策）

### 2.1 风险总览

```
高风险 ───────────────────── 低风险
    Unblock多源解析
         │
         酷狗Server（无登录态）
              │
              网易云API（仅转发）
                   │
                   用户自持凭证登录
                        │
                        radio-browser 在线电台
                             │
                             CC协议/公有领域音乐
```

### 2.2 插件化方案

#### 架构图

```
┌─── 主程序（开源） ─────────────────────────────┐
│  noshRadio                                      │
│  ├─ 网易云扫码登录（用户自持凭证）                  │
│  ├─ radio-browser 全球电台                       │
│  ├─ 酷狗搜索播放（需用户登录/体验版降质）           │
│  ├─ 本地播放/收藏/歌单管理                        │
│  ├─ 3D专辑封面 + 可视化                          │
│  ├─ AI 推荐引擎                                  │
│  └─ 插件加载接口（抽象接口，无默认实现）            │
└──────────────────────────┬──────────────────────┘
                           │ 插件协议
                           ▼
┌─── 闭源插件（私域分发） ─────────────────────────┐
│  nosh-unblock-plugin                             │
│  ├─ @unblockneteasemusic/server 集成             │
│  ├─ 跨源解析（kugou/kuwo/bodian/pyncmd）         │
│  ├─ 音频代理（防盗链处理）                        │
│  └─ 须用户手动加载到插件目录                       │
└─────────────────────────────────────────────────┘
```

#### 分发模型

```
主程序 main.exe
   ↑ GitHub Releases 开源构建

插件包 nosh-unblock-plugin.zip
   ↑ 微信私聊发给需要的人
   ↑ 不在任何公开 registry
   ↑ 不开源，不 Git 管理
   ↑ 不提交到 main.exe 的自动安装
```

### 2.3 插件接口设计

```typescript
// 插件协议（主程序侧）
interface MusicPlugin {
  name: string;
  version: string;

  // 音源解析：给 songId/name/artist，返回可播放的 URL
  resolve(params: {
    songId: string;
    songName: string;
    artist: string;
    platform: string;  // 原始平台标识
  }): Promise<{
    url: string | null;
    picUrl?: string;
    source: string;
    quality?: string;
  }>;

  // 搜索增强（可选）
  search?(keyword: string): Promise<SearchResult[]>;
}
```

插件加载方式：`--plugin ./nosh-unblock-plugin.js` 启动参数 or 放到 `plugins/` 目录。

### 2.4 合规保障措施

| 措施 | 作用 |
|------|------|
| 主仓库零引用（代码/文档都不提插件存在） | 避开了 DMCA/律师函的直接指向 |
| 闭源 + 微信私发 | 断开公开分发链条，难以举证"主动提供" |
| 不自动安装 | 不构成"主程序教唆侵权" |
| 不盈利 | 避开刑事责任门槛（《刑法》第217条） |
| 插件接口通用化 | 可论证为"通用扩展能力，非专门用于侵权" |

### 2.5 三方案风险对比

| 方案 | 存活预期 | 功能完整性 | 维护成本 |
|------|----------|-----------|---------|
| A. 维持现状（一体式Unblock） | 随时可能被 DMCA | 最高 | 低 |
| B. 插件拆分（私域闭源） | 可长期存活 | 高（+微信分发步骤） | 中 |
| C. 纯用户自持凭证（无Unblock） | 最安全 | 受限（无会员=试听） | 低 |

---

## 三、音源架构重构

### 3.1 第一阶段：合规重构（P0）

**目标**: 将 Unblock 从主程序剥离，建立插件加载机制

```
Task 1.1: 定义插件接口协议
  文件: src/core/plugin-host.js（新建）
  内容:
  - PluginHost 类：加载/注册/调用插件
  - resolveSong(songId, songName, artist) 方法
  - 默认行为：无插件时返回 null，走回退逻辑

Task 1.2: 剥离 unblock-music-server.js 和 proxy-erver 中的 /api/resolve-url
  - 从 main.js 的 SERVICES 数组中移除 unblock-music
  - 从 proxy-server.js 移除 /api/resolve-url 和 /unblock/* 路由
  - 移除 @unblockneteasemusic/server 依赖

Task 1.3: 插件加载接入点
  - --plugin CLI 参数
  - plugins/ 目录自动扫描
  - 插件加载后自动注入 resolve 流程

Task 1.4: 构建插件包 nosh-unblock-plugin
  - 独立项目，不开源
  - 与插件接口协议对接
  - 仅编译后 zip 分发
```

### 3.2 第二阶段：统一 Provider 接口（P1）

**目标**: 统一各音源的搜索/播放接口

```typescript
interface MusicProvider {
  id: string;        // 'netease' | 'kugou' | ...
  name: string;      // '网易云音乐' | '酷狗音乐'
  requiresLogin: boolean;

  // 搜索
  search(keyword: string, page?: number): Promise<SearchResult[]>;

  // 获取播放 URL（核心）
  getPlayUrl(songId: string): Promise<{ url: string; quality: string } | null>;

  // 歌词/封面
  getLyric(songId: string): Promise<string | null>;
  getCover(songId: string): Promise<string | null>;
}
```

```
Task 2.1: 定义 Provider 接口 + 注册中心
Task 2.2: NeteaseProvider（封装现有网易云 API）
Task 2.3: KugouProvider（适配 kugou-provider.js）
```

### 3.3 第三阶段：差异化功能（P2）

**目标**: 发展零风险特色功能，形成产品壁垒

| 功能 | 风险 | 工作量 | 优先级 |
|------|------|--------|--------|
| radio-browser 深度整合（已有基础） | 零 | 低 | P0 |
| 播放器模式切换（simple/diy） | 零 | 低 | P1 |
| 天气电台（Open-Meteo → 播放列表） | 零 | 中 | P1 |
| 节奏分析节拍图（移植 dj-analyzer.js） | 零 | 高 | P2 |
| 桌面歌词窗口 | 零 | 中 | P2 |

---

## 四、后续路线图

```
Phase 0（当前）：完整记录对比 + 合规策略确认
  → 产出本文档
  → 决策是否执行插件化方案

Phase 1（P0）：合规重构
  └─ 定义插件接口 + 剥离 Unblock + 插件加载
  └─ 构建闭源插件包（仅编译产物分发）

Phase 2（P1）：音源架构统一
  └─ Provider 接口定义
  └─ NeteaseProvider / KugouProvider 适配
  └─ 登录 cookie 持久化（学习 Mineradio）

Phase 3（P2）：差异化功能
  └─ 电台深度整合（现存 radio-test.html 搬入主 UI）
  └─ 天气电台（Open-Meteo）
  └─ 播放器模式切换

Phase 4（远期）：视觉升级
  └─ 节奏分析节拍图（移植+适配）
  └─ 桌面歌词窗口
  └─ Mineradio 风格视觉效果优化
```

### 4.1 Phase 1 详细计划

#### 1.1 定义插件接口（半天）

文件: `src/core/plugin-host.js`
修改: `nosh-music-ai.html` 在 resolve 流程中插入插件调用点

```javascript
class PluginHost {
  constructor() {
    this.plugins = [];
  }

  loadPlugin(pluginPath) { /* 动态 require */ }
  async resolveSong(songId, name, artist) {
    for (const plugin of this.plugins) {
      const result = await plugin.resolve({ songId, songName: name, artist });
      if (result && result.url) return result;
    }
    return null;
  }
}
```

#### 1.2 剥离 Unblock（半天）

- 从 `main.js` 移除 `unblock-music` 服务定义
- 从 `proxy-server.js` 移除 `/api/resolve-url` 和 `/unblock/*` 路由（约 50 行）
- 卸载 `@unblockneteasemusic/server` 依赖
- 删除 `unblock-music-server.js`

#### 1.3 插件加载入口（半天）

- `preload.js` 暴露插件路径给渲染进程
- 或 Electron 启动参数传插件路径

#### 1.4 构建插件包（1天）

独立仓库 `nosh-unblock-plugin`（不开源）：
- 封装 `@unblockneteasemusic/server` 调用
- 暴露 `resolve({ songId, songName, artist })` 接口
- 编译为单文件 JS + 依赖打包（esbuild）

### 4.2 合规文档清单

| 文档 | 用途 |
|------|------|
| `PRIVACY.md` | 声明用户数据仅存本地（参照 Mineradio） |
| `README.md` 免责声明 | 第三方平台接入仅用于个人学习 |
| `LICENSE` | GPL-3.0（同 Mineradio） |
| `NOTICE.md` | 第三方依赖声明 |

---

## 五、Mineradio 值得入口即借鉴的点（低门槛速赢）

以下功能工作量小、风险为零、体验提升明显，可以优先做：

| 功能 | 实现参考 | 预估工作量 |
|------|---------|-----------|
| 登录态持久化（cookie存文件） | Mineradio `server.js` → `.cookie` 读写 | 2h |
| 播放器模式切换开关 | Mineradio `index.html` → `simple-mode` / `diy-mode` CSS | 3h |
| radio-browser 搬入主 UI | 已有 `radio-test.html`，移到 sprite-drawer 新 tab | 4h |
| 天气电台 | Open-Meteo API 调用 + mood → 歌单映射 | 4h |
| 服务端 cookie 携带网易云 API 请求 | Mineradio `server.js` 中所有 API 请求带 cookie | 2h |

---

## 六、定义完成

### Phase 1 完成标准

- [ ] `main.js` 不再启动 unblock-music 服务
- [ ] `proxy-server.js` 无 `/api/resolve-url` 和 `/unblock/*` 路由
- [ ] `package.json` 无 `@unblockneteasemusic/server` 依赖
- [ ] `src/core/plugin-host.js` 定义并可用
- [ ] 前端 resolve 流程接入插件调用
- [ ] 插件包可独立加载并生效
- [ ] 正常网易云歌曲播放不受影响
- [ ] `PRIVACY.md` + README 免责声明就位
- [ ] cookie 持久化实现

### 长期成功指标

- [ ] 主仓库可安全公开、长期维护
- [ ] 零版权/IP 投诉风险
- [ ] 差异化功能（电台/天气/节拍图）形成产品辨识度
