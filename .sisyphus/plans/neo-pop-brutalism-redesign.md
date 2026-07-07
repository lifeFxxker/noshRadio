# NOSH RADIO — 新波普粗野主义视觉改造

## TL;DR

> **Quick Summary**: 将 NOSH RADIO 从暗黑像素风改造为新波普粗野主义（Neo Pop Brutalism），保留 Press Start 2P 像素字体作为 accent，加粗黑框、零圆角、荧光高饱和色块、超大排版。
>
> **Deliverables**: 完整的 CSS 变量体系重构 + 10 个 UI 模块逐个改造 + 像素元素保留。
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 个并行 Wave
> **Critical Path**: Wave 1 (CSS 变量) → Wave 2 (组件改造) → Wave 3 (QA)

---

## Context

### Design Philosophy
新波普粗野主义 = 粗野主义（Brutalism）的 raw/unpolished + 波普艺术（Pop Art）的高饱和/玩世不恭。

**核心设计语言**:
- **粗框**: 4-8px solid black borders, zero border-radius
- **高对比**: 纯黑/纯白底 + 荧光色块冲击
- **超大排版**: 巨大标题字，字体重量拉到最重
- **保留像素**: Press Start 2P 作为 accent 字体（NOSH logo, LIVE 标签, 小字号信息）
- **极端简洁**: 去毛玻璃、去渐变、去阴影，用纯色替代
- **波普图形**: 斜条纹 overlay、半调圆点、星爆、大感叹号

### Design Decisions
- **保留**: Press Start 2P 像素体（NOSH 品牌字、小号标签、「LIVE」标、loading 画面）
- **保留（不改动）**: wired-elements 手绘组件（wired-button, wired-fab 等全部保持原样）
- **新增主力字体**: Bebas Neue / Archivo Black（谷歌字体，香港 CDN 可加载）
- **丢弃**: 噪声纹理（noise SVG）、glitch 动画效果、圆角、渐变进度条、毛玻璃
- **新增**: 斜条纹 CSS 背景、纯色块面板、halftone 装饰

### Color Palette
```css
/* 新波普粗野主义色板 */
--black:   #000000;
--white:   #ffffff;
--pink:    #ff1493;    /* 荧光粉 — 主色 */
--yellow:  #ccff00;    /* 镭射黄 — 辅色 */
--cyan:    #00f0ff;    /* 电光蓝 — 点缀 */
--gray:    #e0e0e0;    /* 浅灰 — 次要背景 */
--dark:    #1a1a1a;    /* 深灰 — hover / 暗色面 */
```

---

## Work Objectives

### Core Objective
将整个页面的视觉语言从暗黑像素/蒸汽波迁移为新波普粗野主义，保留像素字体作为风格元素。

### Concrete Deliverables
- [ ] CSS 变量体系全部替换（颜色、字体、间距、边框）
- [ ] 10+ UI 模块逐个完成粗野主义改造（wired-elements 手绘组件保持不动）
- [ ] Google Fonts（Bebas Neue）加载集成
- [ ] 新增波普图形元素（halftone、条纹）
- [ ] 所有改动在一个文件中（nosh-music-ai.html）

### Definition of Done
- [ ] CSS 零圆角、4px+ 粗黑框、高对比荧光色
- [ ] Press Start 2P 保留在关键位置
- [ ] Bebas Neue 用于标题/数字/大字号
- [ ] 进度条/按钮/卡片/聊天框/弹窗全部改造
- [ ] 3D 封面墙不受影响
- [ ] 亮/暗主题模式正常切换

### Must Have
- 保留 Press Start 2P 像素字体
- 零圆角（radius: 0）
- 所有边框改为至少 3px solid black
- 荧光色作为主要强调色
- 聊天气泡、按钮、弹窗风格一致

### Must NOT Have
- 不删改 3D 封面墙逻辑
- 不改动 JS 功能逻辑（仅 CSS + HTML class 调整）
- 不引入 JQuery 或 UI 框架
- 不改动后端/API 调用
- **不改动 wired-elements 手绘组件**（wired-button, wired-fab, wired-slider, wired-dialog 等）— 它们的 SVG 手绘风格保留，不做粗框化改造

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Prep — 1 task): 字体加载 + CSS 变量替换 + 全局 reset
└── Task 0: 新增 Google Fonts (Bebas Neue), 替换 :root CSS 变量

Wave 1 (Core UI — 4 parallel tasks, independent modules):
├── Task 1: Topbar + Loading Screen + Hero
├── Task 2: Player Card + 播放控制
├── Task 3: 聊天面板（Chat/Sprite）+ AI 气泡 + 弹窗
├── Task 4: 波普图形元素（halftone, stripes, starburst）

Wave 2 (Secondary UI — 2 parallel tasks):
├── Task 5: 歌单/历史面板 + 设置面板 + 导航按钮
├── Task 6: 3D 封面墙周边 UI + 背景 + 微交互

Wave Final (QA — 1 task):
└── Task 7: 全页面视觉 QA + Playwright 截图验证
```

### Task Details

---

- [ ] 0. 字体加载 + CSS 变量替换 + 全局 reset

  **What to do**:
  - 在 `<head>` 中添加 Google Fonts 加载（Bebas Neue, Archivo Black）
  - 替换 `:root` 中的 CSS 变量:

  ```css
  :root {
    /* 色板 */
    --bg: #000000;
    --surface: #ffffff;
    --surface-2: #e0e0e0;
    --fg: #000000;
    --muted: #666666;
    --border: #000000;
    --accent: #ff1493;      /* 荧光粉 */
    --accent2: #ccff00;     /* 镭射黄 */
    --accent3: #00f0ff;     /* 电光蓝 */
    --shadow: none;

    /* 动效 — 保留缓动函数 */
    --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);

    /* 字体 — Bebas Neue 主力，Press Start 2P 保留 */
    --font-display: 'Bebas Neue', sans-serif;
    --font-pixel: 'Press Start 2P', monospace;
    --font-body: 'Archivo Black', 'Bebas Neue', sans-serif;
    --font-mono: 'Courier New', monospace;

    /* 间距 — 零圆角 */
    --radius: 0px;
    --radius-sm: 0px;
    --border-w: 3px;

    /* 等比缩放变量 — 保留不动 */
    --scale: 1vmin;
    /* ... 保留所有现有 scale 变量 */
  }
  ```

  - Light theme 同样改造:
  ```css
  :root.light {
    --bg: #f0f0f0;
    --surface: #ffffff;
    --surface-2: #e0e0e0;
    --fg: #000000;
    --muted: #888888;
    --border: #000000;
    --accent: #ff1493;
    --accent2: #ccff00;
    --accent3: #00f0ff;
    --shadow: none;
  }
  ```

  - 全局 reset 调整:
    - `* { border-radius: 0 !important; }`（强制覆盖所有 rounded）
    - 移除 noise 背景图（`body::before` 中的 SVG filter）
    - 移除 `transition` 中的 color/background 渐变（粗野主义不需要）

  - 在 CSS 亮色主题覆盖区删除多余的 `--ease-*` 重复定义

  **Must NOT do**:
  - 不要删除现有 scale 变量（布局依赖）
  - 不要改动 `@font-face` 中的 Press Start 2P（保留）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-design`
  - Reason: 需要做全局视觉设计决策

  **Parallelization**:
  - **Parallel Group**: Wave 0 (alone — blocks everything)
  - **Blocks**: All tasks
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:176-231` — 现有 `:root` CSS 变量
  - `nosh-music-ai.html:232-250` — 亮色主题变量
  - `nosh-music-ai.html:265-276` — noise 纹理（移除）
  - `nosh-music-ai.html:252-263` — 全局 reset

  **Acceptance Criteria**:
  - [ ] Press Start 2P 仍然可用
  - [ ] Bebas Neue 已加载并应用于标题元素
  - [ ] 所有 `border-radius` 为 0
  - [ ] 所有边框为 3px solid black
  - [ ] 荧光粉 `#ff1493` 可见于强调元素
  - [ ] 噪声背景已移除
  - [ ] 亮色主题切换正常

  **QA**:
  - Playwright 截图对比 light/dark 主题
  - `getComputedStyle(el).borderRadius` 验证为零
  - 检查 Google Fonts 是否已加载（document.fonts.ready）

  **Commit**: YES
  - `style(root): migrate CSS variables to Neo Pop Brutalism palette`

---

- [ ] 1. Topbar + Loading Screen + Hero 改造

  **What to do**:
  - **Loading screen**:
    - "RADIO" 或 "NOSH" 超大 Bebas Neue 字体砸在屏幕中央
    - 去掉 loading-pulse 动画（用简单的 opacity 闪烁或不动）
    - Loading bar: 纯黑轨道（4px high）+ 荧光粉色填充
    - 去掉百分比数字动画，换为 "LOADING..." 像素小字
  - **Topbar**:
    - "NOSH" 文字改用 Bebas Neue 或保留 Press Start 2P（取决于设计判断，推荐 Bebas Neue 配合粗野主义）
    - 背景纯黑，用 4px 下边框 black
    - right 区域的 LIVE badge → 粗黑框 + 荧光粉文字
    - 按钮（主题切换、背景切换）→ 粗框方形，hover 变纯色填充
  - **Hero**:
    - Hero 标题用超大的 Bebas Neue（clamp(40px, 8vw, 100px)）
    - 背景超大衬底字符保留但改颜色为荧光色（10% opacity 的荧光粉/黄）
    - 去掉 glitch 动画（粗野主义不要 glitch）
    - 律动柱（viz bars）保留但加粗到 6px wide，直角

  **Must NOT do**:
  - 不改变 topbar height / z-index
  - 不改变 DOM 结构（只改 class 和 style）

  **Parallelization**:
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Depends On**: Task 0

  **References**:
  - `nosh-music-ai.html:287-361` — Loading screen
  - `nosh-music-ai.html:363-440` — Hero
  - `nosh-music-ai.html:442-521` — Topbar

  **Commit**: YES
  - `style(topbar): brutalist restyle of topbar, loading, hero`

---

- [ ] 2. Player Card + 播放控制改造

  **What to do**:
  - **Player card**:
    - 背景改纯白（dark mode 下）或纯浅灰
    - 6px 纯黑实线边框，零圆角
    - 去掉 box-shadow
    - 歌曲名用 Bebas Neue 粗体
    - 歌手名用 Press Start 2P 小字（保留像素感）
  - **Progress bar**:
    - 轨道 8px 高，纯黑底
    - 进度填充用荧光粉/黄（保持现有颜色变量即可）
    - 去掉圆角，直角
    - 圆形拖拽头改为方形或菱形
  - **控制按钮**（播放/暂停/下一首等）:
    - 放大 20%，粗边框
    - 背景纯色块，hover 变荧光色
  - **音量控制**:
    - 方形滑块，粗框
    - 音量图标放大
  - **专辑封面**:
    - 6px 黑框，零圆角
    - 去掉阴影

  **Must NOT do**:
  - 不改动 audio 播放逻辑
  - 不改动 progress 更新逻辑

  **Parallelization**:
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Depends On**: Task 0

  **References**:
  - `nosh-music-ai.html:634-750` — Player card section
  - Progress bar / control buttons area

  **Commit**: YES
  - `style(player): brutalist restyle of player card and controls`

---

- [ ] 3. 聊天面板 + AI 气泡 + 弹窗改造

  **What to do**:
  - **聊天面板整体**:
    - 面板边框 4px solid black，零圆角
    - 背景纯白
    - 标题区域用 Bebas Neue + 4px 下边框
  - **气泡**:
    - 用户气泡: 荧光粉底 + 黑字 + 3px 黑框
    - AI 气泡: 白底 + 黑字 + 3px 黑框
    - 去掉圆角，全部直角
    - 用粗的左侧/右侧 border 替代圆角聊天气泡尾（或者不要尾巴，纯方块）
  - **发送按钮**: （保留 wired-fab 手绘风格不变，不改动）
  - **输入框**:
    - 3px 黑框，白底，Press Start 2P 小字 placeholder
  - **弹窗**（song selection / playlist end dialog）:
    - 纯白面板 + 6px 黑框
    - 按钮黑底白字或荧光底黑字
    - 去掉阴影，去掉圆角
  - **选项按钮**（Task 3 from daily-playlist-recommend plan）:
    - 如果还未实现，按新风格实现：黑框白底 / 荧光底

  **Must NOT do**:
  - 不改变聊天逻辑（send / receive / history）

  **Parallelization**:
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Depends On**: Task 0

  **References**:
  - Chat panel CSS region（约 lines 2400-2750）
  - Chat bubbles CSS
  - `showSongSelection()` at line 4953
  - `createOptionButtons()` / `showPlaylistEndDialog()` from daily-playlist plan

  **Commit**: YES
  - `style(chat): brutalist restyle of chat panel, bubbles, dialogs`

---

- [ ] 4. 波普图形元素（halftone, stripes, starburst）

  **What to do**:
  - **Halftone 纹理**: CSS 伪元素或 canvas 生成半调圆点图案，作为背景装饰
  - **斜条纹 overlay**: 用 CSS 线性渐变生成对角斜纹（45deg, black/transparent 交替）
  - **Starburst 图形**: 纯 CSS 或 SVG 实现的星爆图形（四角星/八芒星），作为视觉点缀
  - **大感叹号标记**: 在关键位置（如 "LIVE" 旁边、推荐消息旁）用超大 "!" 字符
  - 将这些装饰元素应用到:
    - 背景层（低 opacity 斜条纹）
    - 按钮 hover 状态（halftone 填充）
    - 弹窗/卡片角标（starburst）
  - 所有图形使用 CSS 纯代码实现，零图片依赖

  **Must NOT do**:
  - 不引入外部 SVG 文件或图片
  - 不降低页面性能（CSS only, no canvas animation）

  **Parallelization**:
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Depends On**: Task 0

  **References**:
  - 现有 noise 纹理 CSS pattern（替换它）
  - 流行 halftone CSS 实现（radial-gradient 阵列）

  **Commit**: YES (groups with any Wave 1 task)
  - `style(pop): add halftone, stripes and starburst graphic elements`

---

- [ ] 5. 歌单/历史面板 + 设置面板 + 导航按钮改造

  **What to do**:
  - **歌单/历史面板**:
    - 面板边框 4px black
    - 列表项: 下边框 2px black，hover 时荧光黄背景
    - 当前播放项: 荧光粉左侧粗 border（4px）
    - 字体: 歌名 Bebas Neue，歌手 Press Start 2P 小字
  - **设置面板**（taste panel / genre chips）:
    - 面板整体与弹窗风格一致（6px 黑框，零圆角）
    - Chip/tag **如果用了 wired-button 则保留不动**，否则: 2px 黑框，白底，选中变荧光粉底 + 白字
    - font-family 用 Press Start 2P 保持像素感
  - **导航按钮**（右侧 sprite toggle, 歌单 toggle 等，**非 wired-elements 的部分**）:
    - 放大到 48-56px
    - 4px 黑框方形
    - 激活态荧光底
  - **整个面板的标题头**: Bebas Neue 巨型字，4px 下边框

  **Must NOT do**:
  - 不改变面板展开/收起逻辑
  - 不改动 taste/genre chip 的点击逻辑

  **Parallelization**:
  - **Parallel Group**: Wave 2 (with Task 6)
  - **Depends On**: Task 0

  **References**:
  - History panel CSS（lines 1000-1100）
  - Taste panel（genre chips section）
  - Navigation buttons CSS

  **Commit**: YES
  - `style(panels): brutalist restyle of playlists, settings, navigation`

---

- [ ] 6. 3D 封面墙周边 UI + 背景 + 微交互

  **What to do**:
  - 3D 封面墙容器保留不动只改相邻 UI
  - **背景**:
    - 替换 ASCII canvas / 蓝色气雾 canvas 为纯色或 halftone 叠加
    - 可以用纯黑底 + 低 opacity 斜条纹
  - **微交互**:
    - hover 效果统一改为: 3px black outline + 背景变荧光色
    - 点击效果: 瞬间缩小 + 边框变粗
    - 去掉 smooth shadow / glow 效果
  - **全屏背景 toggle** 保持功能但按钮风格统一

  **Must NOT do**:
  - 不改变 3D vortex 的 JS 计算逻辑
  - 不改变 WebGL fluid canvas（如果决定保留）

  **Parallelization**:
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Depends On**: Task 0

  **References**:
  - Background canvas: lines 526-531
  - 3D vortex CSS container
  - Fluid waves background

  **Commit**: YES (groups with 5)
  - `style(background): brutalist background and micro-interactions`

---

- [ ] 7. 全页面视觉 QA

  **What to do**:
  - 使用 Playwright 进行视觉回归验证
  - **截图清单**:
    1. 全页面默认状态（dark theme）
    2. 全页面亮色主题
    3. Loading screen
    4. 播放中状态（有歌曲）
    5. 聊天框展开
    6. 歌单面板展开
    7. 设置面板展开
    8. 弹窗（song selection / playlist end）
    9. 移动端视口（375px width）
  - **检查点**:
    - [ ] 零圆角（querySelectorAll 检查 borderRadius !== 0px）
    - [ ] 所有边框颜色为 #000
    - [ ] 边框宽度 >= 3px
    - [ ] 荧光色出现在强调位置
    - [ ] Press Start 2P 在 logo 和小字标签上
    - [ ] Bebas Neue 在标题/大字号上
    - [ ] 噪声纹理已移除
    - [ ] 3D 封面墙不受影响
    - [ ] 播放功能正常
    - [ ] 亮暗主题切换
  - **截图保存** 到 `.sisyphus/evidence/neo-pop-brutalism/`

  **Must NOT do**:
  - 不改动任何功能代码

  **Parallelization**:
  - **Parallel Group**: Wave Final
  - **Depends On**: All tasks

  **Evidence to Capture**:
  - 9 张截图 + 1 份检查清单报告

  **Commit**: NO (QA only)

---

## Final Verification

- [ ] F1. **Style Compliance Audit** — `visual-engineering`
  Read the plan end-to-end. Verify: zero radius everywhere, border width >= 3px black, fluorescent colors used, pixel font preserved, Bebas Neue loaded, noise removed.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT`

- [ ] F2. **Functional Integrity Check** — `quick`
  Confirm no JS logic was altered. Spot-check: play, pause, next, chat send, theme toggle, 3D vortex rotation.
  Output: `Functions [N/N tested] | VERDICT`

---

## Commit Strategy

```
1. style(root): migrate CSS variables to Neo Pop Brutalism palette
2. style(topbar): brutalist restyle of topbar, loading, hero
3. style(player): brutalist restyle of player card and controls
4. style(chat): brutalist restyle of chat panel, bubbles, dialogs
5. style(pop): add halftone, stripes and starburst graphic elements
6. style(panels): brutalist restyle of playlists, settings, navigation
7. style(background): brutalist background and micro-interactions
```

---

## Success Criteria

- [ ] 所有 UI 模块完成粗野主义改造
- [ ] 荧光色 + 粗黑框 + 像素字体混搭成立
- [ ] 亮暗主题均正常
- [ ] 所有功能完好
- [ ] Playwright 截图验证通过
