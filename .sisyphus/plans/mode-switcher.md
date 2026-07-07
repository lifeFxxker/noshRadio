# 模式切换：音乐 / 电台 / Live

## TL;DR

> **目标**：在现有 NOSH 音乐播放器中增加"电台模式"（实时电台 + 主播电台）和"Live 模式"，并通过顶部导航栏统一切换三种模式。
>
> **核心交互**：顶部 `[音乐] [电台] [Live]` 分段控件切换主模式；电台模式内部再用 `[实时电台] [主播电台]` 切换子类型。三种模式共用同一个 `<audio>`，播放互斥。
>
> **交付物**：改造后的 `nosh-music-ai.html`，集成两个调研文件（`radio-test.html`、`netease-dj-test.html`）的功能。
>
> **Estimated Effort**：Medium
> **Parallel Execution**：YES - 3 个 wave
> **Critical Path**：UI 框架改造 → 实时电台接入 → 主播电台接入 → 播放互斥与集成测试

---

## Context

### Original Request
用户希望：
1. 在现有听歌模式基础上加入**电台模式**（使用之前调研好的电台源替换歌曲播放）
2. 加入 **Live 模式**（实时对话功能）
3. 设计三种模式之间的切换方式

### Interview Summary
**已确认决策**：
- 模式切换入口放在**顶部 topbar**，使用分段控件：`[音乐] [电台] [Live]`
- 电台模式内部再分两个子类型：
  - **实时电台**：`radio-test.html` 能力（Radio Browser API，流播放）
  - **主播电台**：`netease-dj-test.html` 能力（网易云 DJ 电台，节目点播）
- **Live 模式**复用现有实时对话能力，不新建对话系统
- **音频互斥**：新模式开始播放时，自动暂停旧模式音频
- **状态不持久化**：刷新页面默认回到音乐模式
- **两个子电台类型都要**

### Research Findings
- `radio-test.html` 已验证可用接口：
  - `GET /radio/stations/byname/:name?limit=N`
  - `GET /radio/stations/topclick/:count?limit=N`
- `netease-dj-test.html` 已验证可用接口：
  - `GET /netease/dj/recommend/type?type=ID&limit=N`
  - `GET /netease/dj/radio/hot?cateId=ID&limit=N`
  - `GET /netease/dj/program?rid=ID&limit=N`
  - `GET /netease/song/url/v1?id=ID&level=standard`
- 主应用 `nosh-music-ai.html` 已具备：音频播放、播放历史、歌单、AI 聊天、Live 入口

---

## Work Objectives

### Core Objective
在 `nosh-music-ai.html` 中实现稳定、互不干扰的音乐/电台/Live 三种模式切换体验，电台模式完整接入已调研的实时电台和网易云主播电台能力。

### Concrete Deliverables
- 顶部 `[音乐] [电台] [Live]` 分段控件
- 电台模式下的 `[实时电台] [主播电台]` 子标签
- 实时电台：分类/搜索/随机 + 电台卡片列表 + 播放
- 主播电台：分类 → 电台卡片 → 节目列表 → 播放
- 三种模式音频互斥逻辑
- Live 模式入口迁移/保留

### Definition of Done
- [ ] 点击顶部标签可在三种模式间切换
- [ ] 电台模式内可切换实时电台 / 主播电台
- [ ] 电台能正常播放，且播放电台时音乐自动暂停
- [ ] 播放音乐时电台自动暂停
- [ ] Live 模式可正常进入和对话
- [ ] 刷新后默认回到音乐模式

### Must Have
- 三种模式切换 UI
- 实时电台完整功能
- 主播电台完整功能
- 音频互斥播放

### Must NOT Have (Guardrails)
- 不新增后端服务，只复用现有 `/radio` 和 `/netease` 接口
- 不改动现有音乐模式的搜索/播放核心逻辑（只在外层包装）
- 不做模式状态持久化
- 不新建 Live 对话系统，只迁移/保留现有入口
- 不引入新依赖（保持单文件 HTML 为主）

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**：NO（当前没有针对这些模式的单元测试框架）
- **Automated tests**：NO
- **Framework**：none
- **Agent-Executed QA**：MANDATORY - 所有任务必须通过浏览器/Playwright 直接验证

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/mode-switcher/`.

- **Frontend/UI**：Playwright - navigate, click tabs, assert visible panels, verify audio state
- **API/Backend**：Bash (curl) - call `/radio/*` and `/netease/dj/*` endpoints, assert JSON fields
- **Audio behavior**：Playwright + JS evaluation - check `audio.paused` state after mode switches

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - UI framework + mode state):
├── T1: Add topbar segmented control [Music | Radio | Live]
├── T2: Add radio sub-tabs [实时电台 | 主播电台]
├── T3: Implement mode state manager and content area switching
└── T4: Implement audio mutex helper (pause others on play)

Wave 2 (Radio implementations - parallel):
├── T5: Port real-time radio (radio-test.html) into main app
├── T6: Port NetEase DJ radio (netease-dj-test.html) into main app
└── T7: Wire radio sub-tabs to show correct radio view

Wave 3 (Integration + Live + Polish):
├── T8: Preserve/relocate existing Live mode entry
├── T9: Ensure music mode still works after refactor
├── T10: Keyboard/shortcut and visual feedback for active mode
└── T11: Cross-mode smoke test and evidence capture

Wave FINAL (Review):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA across all modes
└── F4: Scope fidelity check
```

### Dependency Matrix
- **T1, T2, T3, T4**：无依赖，可并行
- **T5**：依赖 T3, T4
- **T6**：依赖 T3, T4
- **T7**：依赖 T2, T5, T6
- **T8**：依赖 T1, T3
- **T9**：依赖 T1-T4
- **T10**：依赖 T1-T3
- **T11**：依赖 T1-T10
- **F1-F4**：依赖 T1-T11

### Agent Dispatch Summary
- **Wave 1**：`visual-engineering` or `quick` for UI, `quick` for state manager
- **Wave 2**：`unspecified-high` for radio porting
- **Wave 3**：`unspecified-high` for integration, `visual-engineering` for polish
- **FINAL**：`oracle`, `unspecified-high`, `deep`

---

## TODOs

- [ ] 1. 顶部模式分段控件

  **What to do**:
  - 在 `topbar` 的 `NOSH` 标题右侧插入分段控件 `[音乐] [电台] [Live]`
  - 使用与现有 Wired 元素/像素风格一致的样式
  - 当前激活模式高亮显示
  - 点击切换 `currentMode` 状态

  **Must NOT do**:
  - 不要改变现有 topbar 高度或破坏移动端布局
  - 不要为 Live 新建入口，只保留/迁移现有入口

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI 改造、CSS 布局、视觉一致性
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T3, T8
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:3015-3029` - 现有 topbar 结构
  - `nosh-music-ai.html:3031` - `main.content` 开始位置
  - 现有 `.topbar-right` 样式作为参考

  **Acceptance Criteria**:
  - [ ] 刷新页面后顶部显示 `[音乐] [电台] [Live]`
  - [ ] 点击不同标签切换激活高亮
  - [ ] 默认激活"音乐"

  **QA Scenarios**:
  ```
  Scenario: 默认显示音乐模式
    Tool: Playwright
    Preconditions: 页面已刷新
    Steps:
      1. 打开 http://localhost:8081/nosh-music-ai.html
      2. 等待页面加载完成
      3. 截图顶部导航栏
    Expected Result: 可见 [音乐] [电台] [Live]，"音乐"为激活态
    Evidence: .sisyphus/evidence/mode-switcher/task-1-default-music.png

  Scenario: 切换到电台模式
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 点击顶部 "电台" 标签
      2. 等待 500ms
      3. 截图并检查 active class
    Expected Result: "电台"高亮，内容区切换到电台视图
    Evidence: .sisyphus/evidence/mode-switcher/task-1-switch-radio.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add topbar mode switcher`
  - Files: `nosh-music-ai.html`

---

- [ ] 2. 电台模式子标签

  **What to do**:
  - 在电台模式内容区顶部添加二级分段控件 `[实时电台] [主播电台]`
  - 子标签只在 `currentMode === 'radio'` 时显示
  - 切换时更新 `radioSubMode` 状态（`'live-radio'` / `'dj-radio'`）

  **Must NOT do**:
  - 不要让子标签影响音乐/Live 模式
  - 不要在音乐/Live 模式下显示子标签

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI 控件和条件渲染

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T7
  - **Blocked By**: None

  **References**:
  - `radio-test.html:86-94` - 分类/搜索栏布局参考
  - `netease-dj-test.html:92` - 分类栏布局参考

  **Acceptance Criteria**:
  - [ ] 切换到电台模式后显示 `[实时电台] [主播电台]`
  - [ ] 默认选中"实时电台"
  - [ ] 切换到音乐/Live 模式时子标签隐藏

  **QA Scenarios**:
  ```
  Scenario: 电台模式显示子标签
    Tool: Playwright
    Preconditions: 当前在电台模式
    Steps:
      1. 点击顶部 "电台"
      2. 检查子标签存在
    Expected Result: 可见 [实时电台] [主播电台]，"实时电台"激活
    Evidence: .sisyphus/evidence/mode-switcher/task-2-radio-subtabs.png

  Scenario: 子标签不影响其他模式
    Tool: Playwright
    Preconditions: 当前在电台模式
    Steps:
      1. 点击顶部 "音乐"
      2. 检查子标签不存在
    Expected Result: 音乐模式下无电台子标签
    Evidence: .sisyphus/evidence/mode-switcher/task-2-no-subtabs-in-music.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add radio sub-tabs`
  - Files: `nosh-music-ai.html`

---

- [ ] 3. 模式状态管理与内容区切换

  **What to do**:
  - 新增全局状态：`currentMode`（`'music'|'radio'|'live'`）和 `radioSubMode`（`'live-radio'|'dj-radio'`）
  - 为三种模式准备独立的内容容器：
    - `#musicView`：包裹现有播放器+聊天/推荐区域
    - `#radioView`：电台内容区
    - `#liveView`：实时对话区（复用现有）
  - 根据 `currentMode` 显示/隐藏对应容器
  - 刷新时重置为 `music`

  **Must NOT do**:
  - 不要把原有 DOM 结构破坏，只做容器包裹
  - 不要持久化到 localStorage

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 状态切换和 DOM 显示隐藏逻辑

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T5, T6, T8, T9
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:3031-3050` - `main.content` 结构
  - `nosh-music-ai.html` 现有 JS 状态管理风格（搜索全局变量）

  **Acceptance Criteria**:
  - [ ] 切换模式时只有对应视图可见
  - [ ] 音乐视图保留现有全部功能
  - [ ] 刷新后默认回到音乐视图

  **QA Scenarios**:
  ```
  Scenario: 模式切换只显示一个视图
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 分别点击 音乐/电台/Live
      2. 检查各 `#musicView`, `#radioView`, `#liveView` 的 display 样式
    Expected Result: 每次只有一个视图 display 不为 none
    Evidence: .sisyphus/evidence/mode-switcher/task-3-view-visibility.json

  Scenario: 刷新回到音乐模式
    Tool: Playwright
    Preconditions: 当前在电台模式
    Steps:
      1. 点击 "电台"
      2. 刷新页面
      3. 检查激活标签
    Expected Result: 刷新后 "音乐" 激活
    Evidence: .sisyphus/evidence/mode-switcher/task-3-refresh-default.png
  ```

  **Commit**: YES
  - Message: `feat(state): add mode state manager and view switching`
  - Files: `nosh-music-ai.html`

---

- [ ] 4. 音频互斥播放助手

  **What to do**:
  - 封装 `playAudio(url, mode)` 和 `pauseAudio(mode)` 两个辅助函数
  - `playAudio` 内部：
    1. 如果当前有音频在播放且 `currentPlayingMode !== mode`，先暂停
    2. 设置 `currentPlayingMode = mode`
    3. 设置 `audio.src = url` 并播放
  - 监听 `audio` 的 `play`/`pause` 事件，更新 `currentPlayingMode`
  - 模式切换时如果新不是播放模式则不自动暂停（保持后台）？→ **必须互斥：新模式播放时暂停旧模式**

  **Must NOT do**:
  - 不要创建多个 audio 元素
  - 不要让模式切换本身强制静音后台（只有新播放触发暂停）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 需要理解现有 audio 生命周期并谨慎改造

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T5, T6, T9
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html` 全局 `audio` 元素和播放控制逻辑
  - `radio-test.html:287-323` - 电台播放逻辑参考

  **Acceptance Criteria**:
  - [ ] 音乐播放时调用电台播放，音乐 audio 暂停
  - [ ] 电台播放时调用音乐播放，电台流暂停
  - [ ] `currentPlayingMode` 正确跟踪当前播放源

  **QA Scenarios**:
  ```
  Scenario: 电台播放暂停音乐
    Tool: Playwright
    Preconditions: 音乐正在播放
    Steps:
      1. 播放一首歌
      2. 切换到电台模式
      3. 点击一个电台播放
      4. 检查 audio.paused
    Expected Result: 原音乐暂停，audio.src 变为电台流
    Evidence: .sisyphus/evidence/mode-switcher/task-4-radio-pauses-music.json

  Scenario: 音乐播放暂停电台
    Tool: Playwright
    Preconditions: 电台正在播放
    Steps:
      1. 播放一个电台
      2. 切回音乐模式
      3. 点击一首歌播放
      4. 检查 audio.paused 和 src
    Expected Result: 电台流暂停，audio.src 变为歌曲 URL
    Evidence: .sisyphus/evidence/mode-switcher/task-4-music-pauses-radio.json
  ```

  **Commit**: YES
  - Message: `feat(audio): implement cross-mode audio mutex`
  - Files: `nosh-music-ai.html`

---

- [ ] 5. 实时电台功能接入

  **What to do**:
  - 将 `radio-test.html` 完整逻辑移植到 `#radioView` 的"实时电台"子视图
  - 保留：分类标签、搜索框、随机按钮、电台卡片列表、底部播放器
  - 使用 `/radio/stations/byname/:name` 和 `/radio/stations/topclick/:count`
  - 调用 T4 的 `playAudio(url, 'radio')` 播放电台流

  **Must NOT do**:
  - 不要修改后端 `/radio` 路由
  - 不要改变 radio-test.html 的 UI 配色主题（可适配主应用暗色）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 功能完整移植和集成

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T7
  - **Blocked By**: T3, T4

  **References**:
  - `radio-test.html:112-350` - 完整实时电台 JS 逻辑
  - `radio-test.html:82-110` - 实时电台 HTML 结构

  **Acceptance Criteria**:
  - [ ] 实时电台分类标签可点击加载
  - [ ] 搜索电台可用
  - [ ] 点击卡片播放电台流
  - [ ] 正在播放的卡片高亮

  **QA Scenarios**:
  ```
  Scenario: 分类加载实时电台
    Tool: Playwright
    Preconditions: 在电台模式 → 实时电台
    Steps:
      1. 点击 "音乐广播" 分类
      2. 等待加载
      3. 截图列表
    Expected Result: 出现多个电台卡片
    Evidence: .sisyphus/evidence/mode-switcher/task-5-live-radio-category.png

  Scenario: 播放实时电台
    Tool: Playwright
    Preconditions: 实时电台列表已加载
    Steps:
      1. 点击第一个电台卡片
      2. 等待 3 秒
      3. 检查 audio.paused 为 false
    Expected Result: 电台开始播放，卡片高亮
    Evidence: .sisyphus/evidence/mode-switcher/task-5-play-live-radio.json
  ```

  **Commit**: YES
  - Message: `feat(radio): integrate real-time radio`
  - Files: `nosh-music-ai.html`

---

- [ ] 6. 主播电台功能接入

  **What to do**:
  - 将 `netease-dj-test.html` 完整逻辑移植到 `#radioView` 的"主播电台"子视图
  - 保留：分类标签、电台卡片、节目列表、返回按钮、底部播放器
  - 使用 `/netease/dj/*` 系列接口
  - 节目播放时调用 T4 的 `playAudio(audioUrl, 'radio')`

  **Must NOT do**:
  - 不要修改后端 `/netease` 路由
  - 不要混用实时电台和主播电台的状态变量

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 多层级 UI（分类→电台→节目）移植

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T7
  - **Blocked By**: T3, T4

  **References**:
  - `netease-dj-test.html:104-361` - 完整主播电台 JS 逻辑
  - `netease-dj-test.html:86-103` - 主播电台 HTML 结构

  **Acceptance Criteria**:
  - [ ] 主播电台分类可点击加载电台列表
  - [ ] 点击电台进入节目列表
  - [ ] 点击节目播放
  - [ ] 返回按钮可回到电台列表

  **QA Scenarios**:
  ```
  Scenario: 浏览主播电台分类
    Tool: Playwright
    Preconditions: 在电台模式 → 主播电台
    Steps:
      1. 点击 "脱口秀" 分类
      2. 等待加载
      3. 截图
    Expected Result: 出现电台卡片列表
    Evidence: .sisyphus/evidence/mode-switcher/task-6-dj-category.png

  Scenario: 播放主播节目
    Tool: Playwright
    Preconditions: 主播电台列表已加载
    Steps:
      1. 点击第一个电台卡片
      2. 点击第一个节目
      3. 等待 3 秒
      4. 检查 audio.paused 为 false
    Expected Result: 节目开始播放
    Evidence: .sisyphus/evidence/mode-switcher/task-6-play-dj-program.json
  ```

  **Commit**: YES
  - Message: `feat(radio): integrate netease DJ radio`
  - Files: `nosh-music-ai.html`

---

- [ ] 7. 子标签与电台视图绑定

  **What to do**:
  - 将 T2 的子标签状态与 T5/T6 的视图绑定
  - 点击"实时电台"显示实时电台容器并隐藏主播电台容器
  - 点击"主播电台"反之
  - 默认显示实时电台

  **Must NOT do**:
  - 不要让两个子视图同时渲染造成资源浪费（可只显示/隐藏）

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: T11
  - **Blocked By**: T2, T5, T6

  **References**:
  - T2 和 T5/T6 的输出

  **Acceptance Criteria**:
  - [ ] 子标签切换正确显示对应视图
  - [ ] 默认显示实时电台

  **QA Scenarios**:
  ```
  Scenario: 子标签切换电台视图
    Tool: Playwright
    Preconditions: 在电台模式
    Steps:
      1. 点击 "主播电台"
      2. 截图
      3. 点击 "实时电台"
      4. 截图
    Expected Result: 内容区对应切换
    Evidence: .sisyphus/evidence/mode-switcher/task-7-subtab-switch.png
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(radio): wire radio sub-tabs to views`
  - Files: `nosh-music-ai.html`

---

- [ ] 8. 保留/迁移 Live 模式入口

  **What to do**:
  - 找到现有 Live 实时对话的入口和实现
  - 在 `currentMode === 'live'` 时显示 Live 视图
  - 确保 Live 模式的对话功能完整可用
  - 如果 Live 入口现在是独立按钮，考虑是否保留原入口或统一到新标签

  **Must NOT do**:
  - 不要重写 Live 对话逻辑
  - 不要让 Live 入口消失

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T11
  - **Blocked By**: T1, T3

  **References**:
  - `nosh-music-ai.html` 中 Live 相关代码（搜索 live、realtime、conversation）

  **Acceptance Criteria**:
  - [ ] 点击顶部 "Live" 切换到 Live 视图
  - [ ] Live 视图能发起/继续实时对话
  - [ ] 从 Live 切回音乐后音频状态正确

  **QA Scenarios**:
  ```
  Scenario: 进入 Live 模式
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 点击顶部 "Live"
      2. 检查 Live 对话区域可见
    Expected Result: Live 视图显示，对话输入框可用
    Evidence: .sisyphus/evidence/mode-switcher/task-8-live-view.png
  ```

  **Commit**: YES
  - Message: `feat(live): preserve live mode entry in mode switcher`
  - Files: `nosh-music-ai.html`

---

- [ ] 9. 音乐模式兼容性回归

  **What to do**:
  - 验证模式切换框架没有破坏现有音乐功能
  - 测试：搜索歌曲、播放歌曲、暂停、下一首、历史、收藏、AI 推荐
  - 确保音乐播放仍使用 T4 的音频互斥逻辑

  **Must NOT do**:
  - 不要改变音乐模式的搜索和播放核心逻辑

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T11
  - **Blocked By**: T1-T4

  **References**:
  - `nosh-music-ai.html` 现有音乐播放测试路径

  **Acceptance Criteria**:
  - [ ] 音乐模式搜索歌曲可用
  - [ ] 点击推荐歌曲可播放
  - [ ] 播放/暂停/下一首正常

  **QA Scenarios**:
  ```
  Scenario: 音乐模式播放推荐歌曲
    Tool: Playwright
    Preconditions: 在音乐模式
    Steps:
      1. 点击一首推荐歌曲的播放按钮
      2. 等待 3 秒
      3. 检查 audio.paused 为 false
    Expected Result: 歌曲正常播放
    Evidence: .sisyphus/evidence/mode-switcher/task-9-music-playback.json
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `fix(music): ensure music mode compatibility after refactor`
  - Files: `nosh-music-ai.html`

---

- [ ] 10. 模式切换视觉反馈与快捷操作

  **What to do**:
  - 为激活模式添加明确的视觉反馈（高亮、下划线、背景色等）
  - 为电台子标签添加激活态样式
  - （可选）添加键盘快捷键：`Ctrl/Cmd+1` 音乐，`Ctrl/Cmd+2` 电台，`Ctrl/Cmd+3` Live
  - 确保移动端的触摸区域足够大

  **Must NOT do**:
  - 不要过度设计动画影响性能

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T11
  - **Blocked By**: T1-T3

  **References**:
  - 现有 CSS 变量和 Wired 风格

  **Acceptance Criteria**:
  - [ ] 激活标签视觉明显
  - [ ] 移动端可点击
  - [ ] 键盘快捷键可用（如果实现）

  **QA Scenarios**:
  ```
  Scenario: 激活态视觉正确
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 点击 "电台"
      2. 截图
    Expected Result: "电台"标签有明显高亮
    Evidence: .sisyphus/evidence/mode-switcher/task-10-active-visual.png
  ```

  **Commit**: YES
  - Message: `style(ui): mode switcher visual feedback`
  - Files: `nosh-music-ai.html`

---

- [ ] 11. 跨模式冒烟测试与证据汇总

  **What to do**:
  - 按顺序执行所有 QA scenario
  - 捕获截图/JSON 证据
  - 验证音频互斥在所有组合下正确
  - 验证刷新后回到音乐模式

  **Must NOT do**:
  - 不要跳过失败场景

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: F1-F4
  - **Blocked By**: T1-T10

  **Acceptance Criteria**:
  - [ ] 所有 QA scenario 证据文件存在
  - [ ] 未发现 P0/P1 问题

  **QA Scenarios**:
  ```
  Scenario: 完整模式切换流程
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 音乐模式播放一首歌
      2. 切换到电台 → 实时电台 → 播放一个电台
      3. 切换到主播电台 → 播放一个节目
      4. 切换到 Live
      5. 切换回音乐
      6. 刷新页面
    Expected Result: 每次切换音频互斥正确，刷新后默认音乐模式
    Evidence: .sisyphus/evidence/mode-switcher/task-11-full-flow.json
  ```

  **Commit**: NO（仅测试证据）

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read plan end-to-end. Verify each "Must Have" exists and each "Must NOT Have" is absent. Check evidence files exist.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Review changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports, AI slop patterns.
  Output: `Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Execute every QA scenario from every task. Test mode switching, radio playback, audio mutex, Live entry, refresh behavior. Save evidence to `.sisyphus/evidence/mode-switcher/final-qa/`.
  Output: `Scenarios [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Compare diff against plan. Verify no scope creep and no missing requirements.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

建议每个 wave 结束后提交一次：
- Wave 1：`feat(ui): add mode switcher framework`
- Wave 2：`feat(radio): integrate real-time and netease DJ radio`
- Wave 3：`feat(live): preserve live entry and cross-mode integration`

---

## Success Criteria

### Verification Commands
```bash
# 验证电台 API 可用
curl "http://localhost:8081/radio/stations/topclick/10?limit=5"
curl "http://localhost:8081/netease/dj/recommend/type?type=8&limit=5"

# 验证主播电台节目接口
curl "http://localhost:8081/netease/dj/program?rid=793045445&limit=5"
```

### Final Checklist
- [ ] 顶部 `[音乐] [电台] [Live]` 可见且可点击
- [ ] 电台模式内 `[实时电台] [主播电台]` 可切换
- [ ] 实时电台能搜索、分类、播放
- [ ] 主播电台能浏览分类、电台、节目并播放
- [ ] 音乐播放时切到电台播放，音乐暂停
- [ ] 电台播放时切到音乐播放，电台暂停
- [ ] Live 模式入口可正常进入
- [ ] 刷新后默认显示音乐模式
