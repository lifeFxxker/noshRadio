# 视觉特效移植计划 — Mineradio → noshRadio

## 目标

将 Mineradio 的沉浸式视觉系统移植到 noshRadio，围绕"音乐驱动视觉"核心体验，实现粒子系统、电影镜头、歌词舞台、3D 歌单架等效果。

## 现状

**noshRadio 已有资产：**
- `lib/three.min.js` — Three.js r128+（WebGL 3D 渲染）
- `lib/gsap.min.js` — GSAP（高性能动画引擎）
- 单 HTML 文件架构（`nosh-music-ai.html`）
- 已有 kugou 音源代理 + NeteaseCloudMusicApi 后端

**Mineradio 核心视觉架构：**
- `dj-analyzer.js` — 离线 BPM/节拍检测（Node.js 端，解码 MP3 → 滤波 → 能量分析 → beat grid）
- Canvas 2D 粒子系统 + 电影镜头（缩放/平移/震动同步节拍）
- CSS 3D 歌单架 + 歌词舞台
- 多视觉模式（Emily/Default/播客模式）

---

## Phase 1 — 音频分析管线（基础）

将 Mineradio 的 beat detection 移植到 noshRadio 前端。

### 1.1 Web Audio API 实时频谱分析

**文件：** `lib/audio-analyzer.js`

```
AudioContext → AnalyserNode → getByteFrequencyData / getByteTimeDomainData
  → freqData (Uint8Array, 128 bins)
  → 低频频谱能量 (bassMeter)
  → 中频能量 (midMeter)  
  → 高频能量 (trebleMeter)
  → 峰值检测 (beatTrigger)
```

**核心逻辑：**
- 创建 `AudioContext` 连接到 `<audio>` 元素（`MediaElementAudioSourceNode`）
- AnalyserNode 以 256/512 fftSize 运行
- 每秒 60fps 读取频谱数据
- 三频段能量追踪：低频(0-200Hz)、中频(200-2000Hz)、高频(2000Hz+)
- 简单过零检测做 beat trigger（能量突变检测）
- 暴露 `onBeat(callback)` 和 `getSpectrum()` API

**复杂度：** ⭐ — 约 100 行 JS，纯前端，无新依赖

### 1.2 频谱可视化（Waveform + Frequency Bars）

**文件：** `nosh-music-ai.html`（新增 `#visualizer` Canvas）

- 覆盖在播放器背景的 Canvas
- 两种可视化模式：
  - **频率柱状图**：128 条竖线，左低右高，高度随对应频率能量变化
  - **波形图**：音频时域波形，居中镜像
- 半透明叠加层（不影响 UI 操作）
- GSAP 动画使柱子过渡平滑（非生硬跳跃）

**复杂度：** ⭐⭐ — Canvas 2D 渲染 + GSAP 动画

---

## Phase 2 — 粒子视觉系统（核心视觉）

### 2.1 粒子系统引擎

**文件：** `lib/particle-system.js`

```
Particle {
  x, y, z        // 位置
  vx, vy, vz     // 速度
  size           // 大小  
  color          // 颜色
  alpha, life    // 生命周期
  shape          // 圆形/星形/发光点
}

ParticleSystem {
  pool: Particle[]       // 对象池
  emitter: {x, y, rate}  // 发射器
  update(bass, mid, treble, beat)
  render(ctx, time)
}
```

**核心行为：**
- 粒子从底部/中心/自定义点位发射
- 速度/大小/颜色受音乐参数调制：
  - 低频（鼓点）→ 粒子爆射 + 变大 + 暖色
  - 中频（人声）→ 粒子漂浮 + 渐变色
  - 高频（镲片）→ 粒子闪烁 + 细小

- Beat 触发时：所有粒子向外爆发（震动效果）
- 粒子使用对象池管理（避免 GC）
- Canvas 2D 渲染，半透明合成

**参考 Mineradio：** Mineradio 的粒子系统也是 Canvas 2D，通过低频能量调制粒子爆发节奏，配合 camera shake 形成"电影镜头感"。

**复杂度：** ⭐⭐⭐ — ~200 行，纯 Canvas 2D

### 2.2 粒子主题（多种视觉风格）

- **银河模式**：深色背景 + 星点粒子 + 飘渺星云
  - 颜色：蓝-紫-白渐变
  - 粒子：小圆点，缓速漂移
  - 低频触发时：星点闪烁变亮

- **火焰模式**：暖色粒子从底部升起
  - 颜色：红-橙-黄渐变
  - 粒子：偏大，上升轨迹
  - 低频触发时：火焰爆燃

- **极光模式**：流动色彩条
  - 使用多个半透明色带波动
  - 使用正弦波 + 频谱能量驱动

**实现方式：** 统一的 `ParticleSystem` + 不同配置的 `emitter`/`colorPalette`/`behavior` 参数

---

## Phase 3 — 电影镜头系统（节奏同步视觉）

### 3.1 Camera Controller

**文件：** `nosh-music-ai.html`（内联 CSS + JS）

```
CameraState {
  zoom: 1.0        // 缩放
  panX, panY: 0    // 平移
  rotate: 0        // 旋转角
  shakeX, shakeY: 0 // 震动
}
```

**使用 GSAP 实现节奏同步动画：**

```
onBeat(kick):
  // 强度 = 当前 beat 的 impact 值 (0~1)
  zoom: 1.0 → 1.0 + impact * 0.08  (80ms 回弹)
  shake: impact * 4px (随机方向, 120ms 衰减)
  pan: 轻微偏移方向 (依赖 combo 类型)

onDownbeat (每4拍):
  // 强拍相机运动
  rotate: ±1.5deg 摇摆
  zoom: 1.0 → 1.12 急推
```

**通过 GSAP 的 `timeline` 实现：**
```js
gsap.timeline()
  .to(camera, { zoom: 1.12, duration: 0.06, ease: 'power2.out' })
  .to(camera, { zoom: 1.0, duration: 0.35, ease: 'elastic.out(1, 0.4)' })
```

**与 particle system 协同：**
- 相机变换应用到 `#visualizer` Canvas 的父容器
- 缩放使用 CSS `transform: scale()`
- 震动使用 `transform: translate()`
- 使得整个视觉层（粒子 + 频谱）统一步调

**复杂度：** ⭐⭐ — GSAP 驱动，无新依赖

### 3.2 视觉模式切换

三种模式，通过按钮 / 快捷键切换：

| 模式 | 粒子 | 相机 | 频谱 | 歌词 |
|------|------|------|------|------|
| **纯净** (Pure) | 关闭 | 关闭 | 简约波形 | 有 |
| **舞台** (Stage) | 银河粒子 | 节奏缩放 | 频率柱 | 有（居中）|
| **沉浸** (Immersive) | 火焰/极光 | 全镜头动画 | 大频谱 | 浮动歌词 |

**实现：** 状态机管理模式切换，切换时 GSAP 过渡动画

---

## Phase 4 — 歌词舞台

### 4.1 LRC 歌词解析与同步

- 从 NeteaseCloudMusicApi `/lyric` 接口获取歌词
- 解析 LRC 格式为 `{time, text}[]` 数组
- 在 `<audio>` `timeupdate` 事件中驱动歌词高亮

### 4.2 歌词舞台渲染

- **双行模式**：当前行居中大字体 + 前一行淡出 + 后一行淡入
- **浮动模式**：歌词以粒子/浮动方式散落（沉浸模式）
- **卡拉OK模式**：歌词逐字变色跟随进度

**参考 Mineradio：** Mineradio 的歌词舞台有"自定义歌词"和"歌词位置与视觉控制"，也做到粒子舞台同步。

**复杂度：** ⭐⭐

---

## Phase 5 — 3D 歌单架（Three.js）

### 5.1 3D 场景初始化

**文件：** `lib/playlist-3d.js`

- Three.js 场景、相机、光源
- 半透明背景（透过 3D 场景看到背后的粒子系统）
- 轨道控制（鼠标拖拽旋转）

### 5.2 歌单架渲染

- 每张专辑封面作为平面纹理贴在 3D 卡片上
- 卡片排列成 U 形/弧形歌单架
- 当前播放卡片高亮 + 轻微凸起
- 翻页/滚动动画

### 5.3 节奏同步

- 当前播放卡片随 beat 轻微脉冲（`scale: 1.0 ⟷ 1.03`）
- 背景环境光随频谱能量变化颜色

**复杂度：** ⭐⭐⭐ — Three.js 已有，无需新依赖

---

## Phase 6 — 天气电台 UI

### 6.1 天气数据集成

- 通过现有 proxy-server 调用 Open-Meteo API
- 获取：温度、天气代码（晴/阴/雨/雪）、风速

### 6.2 天气主题视觉

根据天气动态切换粒子主题：

| 天气 | 视觉主题 |
|------|----------|
| ☀️ 晴 | 金色粒子 + 暖色光晕 |
| ☁️ 阴 | 灰色散射粒子 + 柔和 |
| 🌧 雨 | 蓝色下落粒子线条 |
| ❄️ 雪 | 白色轻柔飘落粒子 |
| ⛈ 雷雨 | 深色粒子 + 频闪（低频触发） |

### 6.3 天气电台入口

- 首页天气卡片：当前位置 + 温度 + 天气图标
- 点击进入天气电台模式（根据天气 mood 生成播放队列）

**复杂度：** ⭐⭐

---

## Phase 7 — 性能优化

### 7.1 Canvas 渲染优化

- 粒子系统使用 `requestAnimationFrame`（非 setInterval）
- 离屏 Canvas（`OffscreenCanvas`）渲染粒子层
- 视口外暂停渲染（窗口不可见时）

### 7.2 对象池

- 粒子对象池管理：`ParticleSystem.pool`
- 避免高频 `new`/`delete` 带来的 GC pause

### 7.3 分辨率自适应

- 根据 `devicePixelRatio` 缩放 Canvas
- 移动端/小窗口降低粒子数量

---

## 实施路径图

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 5 ──→ Phase 4 ──→ Phase 6
(基础管线)  (核心视觉)  (镜头系统)  (3D歌单架)  (歌词舞台)  (天气UI)
                                                    ↑

建议从 Phase 1 → 2 → 3 作为 MVP，体验节奏驱动的视觉系统，
然后按优先级推进 5 / 4 / 6。
```

## 文件清单

| 文件 | 内容 | 新增/修改 |
|------|------|-----------|
| `lib/audio-analyzer.js` | Web Audio API 频谱分析 + beat detection | 新增 |
| `lib/particle-system.js` | Canvas 2D 粒子引擎 + 多主题 | 新增 |
| `lib/playlist-3d.js` | Three.js 3D 歌单架 | 新增 |
| `nosh-music-ai.html` | 新增视觉层 Canvas + 模式切换 + 歌词舞台 + 相机系统 | 修改（大幅） |
| `package.json` | 无新依赖（已有 Three.js + GSAP）| 不变 |

## 技术关键点

1. **音频源连接**：`<audio>` 元素需设置 `crossOrigin="anonymous"`，通过 `MediaElementAudioSourceNode` 连接到 AnalyserNode
2. **Beat detection**：Mineradio 用服务端离线分析（全量解码 MP3），noshRadio 用前端实时分析。前者更精确但复杂，后者够用且简单
3. **GSAP vs requestAnimationFrame**：GSAP 用于相机动画（timeline/回弹），rAF 用于粒子渲染循环
4. **Canvas 分层**：粒子层在底层，UI 在上层（通过 CSS `z-index` + `pointer-events: none`）
