# 每日歌单推荐 & 播完重推

## TL;DR

> **Quick Summary**: 为 NOSH RADIO 增加每日首次进入时 AI 主动歌单推荐（通过聊天框交互），以及歌单全部播完后的弹窗重推功能。
>
> **Deliverables**:
> - localStorage 每日日期标记，控制推荐频次
> - 像素小人右上角红色角标（未读消息提示）
> - AI 消息下方可点击选择按钮组件
> - 每日进入 AI 主动询问→选择→推荐完整流程
> - 歌单播完弹窗→选择→推荐完整流程
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 4 → Task 6

---

## Context

### Original Request
为音乐平台增加智能歌单推荐策略：每天第一次进入时自动推荐（通过聊天框交互），以及当前歌单全部播放完后自动触发新一轮推荐。

### Interview Summary
**Key Decisions**:
- **每日进入**: AI 主动在聊天框询问 + 像素小人右上角色标 + AI 消息下放可点击选项（"来一份"/"先不听"）
- **播完重推**: 弹窗让用户选（"生成新歌单"/"算了"），生成全新歌单，非追加
- **待确认**: 角标是否现在做、AI 询问时机（加载完立即 vs 等动画结束）

**Research Findings**:
- 所有逻辑在 `nosh-music-ai.html`（~9500行）单文件中
- 已有 `initPlaylist()` 仅空歌单触发一次
- 已有 `audio.addEventListener('ended')` 处理歌曲结束
- 已有 `showSongSelection()` 弹窗模式可供参考

---

## Work Objectives

### Core Objective
实现每日首次进入 AI 主动歌单推荐 + 歌单播完重推，全通过聊天框交互完成。

### Concrete Deliverables
- 日期检测逻辑（localStorage `noshLastRecommendDate`）
- 像素小人角标（红色圆点）
- 可点击选项按钮（AI 消息下方）
- 播完弹窗（手绘像素风格）
- 每日进入完整流程
- 播完触发完整流程

### Definition of Done
- [ ] 每天第一次打开页面 → AI 聊天框主动发消息询问
- [ ] 像素小人显示未读角标
- [ ] 点击"来一份"→ 清空旧歌单 → AI 推荐 10 首 → 自动播第一首
- [ ] 点击"先不听"→ 角标消失，当天不再弹
- [ ] 歌单最后一首播完 → 弹出选择对话框
- [ ] 点击"生成新歌单"→ 同推荐流程
- [ ] 所有 UI 风格与现有手绘像素风一致

### Must Have
- 每日检测不能误判（跨日期正确）
- 角标可清除（点开聊天即消失）
- 播完弹窗不阻塞其他交互

### Must NOT Have (Guardrails)
- 不引入新依赖库
- 不改动现有 3D 封面墙逻辑
- 不改动现有播放引擎（audio 相关）
- 不改动现有品味系统（nosh-taste.js）

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (browser-only JavaScript in HTML)
- **Automated tests**: No unit tests
- **QA**: Playwright browser automation

### QA Policy
All QA scenarios use Playwright to:
- Navigate to `http://localhost:8081/`
- Interact with chat, dialog, badge elements
- Verify localStorage state
- Capture screenshots as evidence

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — 3 parallel UI/logic modules):
├── Task 1: 日期检测 + localStorage 标记逻辑
├── Task 2: 像素小人角标（CSS + DOM + 显隐逻辑）
└── Task 3: 选项按钮组件 + 播完弹窗组件

Wave 2 (Core flows — 2 parallel integrations):
├── Task 4: 每日进入推荐完整流程（AI消息→按钮→推荐→播放）
├── Task 5: 歌单播完推荐流程（检测结束→弹窗→推荐→播放）
└── Task 6: 角标与聊天交互联动（显隐、清除、点击跳转）

Wave FINAL (QA — 1 task):
└── Task 7: 全流程集成验证
```

---

## TODOs

- [ ] 1. 日期检测 + localStorage 标记逻辑

  **What to do**:
  - 在 `nosh-music-ai.html` 中添加 `noshLastRecommendDate` 的 localStorage 工具函数
  - 页面加载时检查：今天日期 vs `lastRecommendDate`
  - 如果不同 → 设标志位 `window._isNewDay = true` 并更新 `lastRecommendDate` 为今天
  - 如果相同 → 设 `window._isNewDay = false`
  - 日期格式：`"2026-05-26"`（YYYY-MM-DD）
  - 在 `DOMContentLoaded` 中已有的初始化逻辑中调用

  **Must NOT do**:
  - 不用复杂的日期库，纯 `new Date().toISOString().split('T')[0]`
  - 不改动现有 initPlaylist 逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: 纯 JavaScript 逻辑，10-20 行代码，无外部依赖

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:3677` — `playHistory` 和 `getPlayHistory()` 所在位置（localStorage 工具函数的风格参考）
  - `nosh-music-ai.html:4678` — `initPlaylist()` 入口（页面加载后调用位置参考）
  - `nosh-music-ai.html:6485` — `DOMContentLoaded` 内 `initPlaylist()` 调用位置

  **Acceptance Criteria**:
  - [ ] localStorage.getItem('noshLastRecommendDate') 可读
  - [ ] 首次打开（无值）→ `_isNewDay = true`
  - [ ] 同一天再次刷新 → `_isNewDay = false`
  - [ ] 修改系统日期到明天后刷新 → `_isNewDay = true`

  **QA Scenarios**:
  ```
  Scenario: 首次进入自动标记日期
    Tool: Playwright
    Preconditions: 清除 localStorage 的 noshLastRecommendDate
    Steps:
      1. 打开 http://localhost:8081/
      2. Playwright 执行: await page.evaluate(() => localStorage.getItem('noshLastRecommendDate'))
    Expected Result: 返回今天日期的字符串，格式 "2026-05-26"
    Evidence: .sisyphus/evidence/task-1-date-set.txt

  Scenario: 同天再次进入不重复标记
    Tool: Playwright
    Preconditions: localStorage 已存有今天的日期
    Steps:
      1. 打开 http://localhost:8081/
      2. Playwright 执行: page.evaluate(() => window._isNewDay)
    Expected Result: `_isNewDay` 为 false
    Evidence: .sisyphus/evidence/task-1-not-newday.txt
  ```

  **Evidence to Capture**:
  - [ ] localStorage 日期值截图
  - [ ] `_isNewDay` 布尔值验证

  **Commit**: YES
  - Message: `feat(playlist): add daily date tracking for playlist recommendation`
  - Files: `nosh-music-ai.html`

---

- [ ] 2. 像素小人角标（CSS + DOM + 显隐逻辑）

  **What to do**:
  - 在像素小人（`.chat-avatar`）的 DOM 结构中添加角标容器
  - 如果用户头像在 `<img>` 标签里，在父容器上加 `.badge-dot` 元素
  - CSS 样式：红色圆点（12px），右上角定位，z-index 高于头像
  - 默认隐藏（`display: none`）
  - 提供 `showAvatarBadge()` / `hideAvatarBadge()` 两个函数
  - 角标元素应该有 `id="avatarBadge"` 便于选中

  **Must NOT do**:
  - 不要修改像素小人本身的样式或布局
  - 不要改变现有 `.chat-avatar` 的结构（只在其父容器上加元素）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - Reason: 涉及 CSS 定位、像素风格、DOM 操作

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:4597` — `.chat-avatar` class 所在位置（头像 DOM 结构参考）
  - `nosh-music-ai.html:4765` — 聊天头像在消息中的使用模式
  - 现有 CSS 变量：`var(--accent, #e60012)`（红色系）

  **Acceptance Criteria**:
  - [ ] 角标元素存在于 DOM 中
  - [ ] 默认隐藏
  - [ ] `showAvatarBadge()` 后可见
  - [ ] `hideAvatarBadge()` 后隐藏
  - [ ] 角标定位在像素小人右上角

  **QA Scenarios**:
  ```
  Scenario: 角标默认隐藏
    Tool: Playwright
    Preconditions: 页面加载完成
    Steps:
      1. const badge = page.locator('#avatarBadge')
      2. await expect(badge).toBeHidden()
    Expected Result: 角标不可见
    Evidence: .sisyphus/evidence/task-2-badge-hidden.png

  Scenario: showAvatarBadge 后角标显示
    Tool: Playwright
    Preconditions: 页面加载完成
    Steps:
      1. await page.evaluate(() => showAvatarBadge())
      2. const badge = page.locator('#avatarBadge')
      3. await expect(badge).toBeVisible()
    Expected Result: 角标可见，红色圆点，在头像右上角
    Evidence: .sisyphus/evidence/task-2-badge-visible.png
  ```

  **Evidence to Capture**:
  - [ ] 角标隐藏截图
  - [ ] 角标显示截图

  **Commit**: YES (groups with 3)
  - Message: `feat(ui): add avatar badge component for unread notifications`
  - Files: `nosh-music-ai.html`

---

- [ ] 3. 选项按钮组件 + 播完弹窗组件

  **What to do**:
  - 创建 `createOptionButtons(container, options, callback)` 函数
    - `options`: `[{label: "来一份", action: "accept"}, {label: "先不听", action: "dismiss"}]`
    - 渲染为一行手绘风格按钮（使用 `<wired-button>` 或模拟像素样式）
    - 点击后触发 `callback(action)`
    - 按钮容器有 `class="option-buttons"`
  - 创建 `showPlaylistEndDialog()` 函数
    - 弹出手绘风格对话框（类似 `showSongSelection`）
    - 内容："歌单已播完，是否生成新的推荐？"
    - 两个按钮：「生成新歌单」和「算了」
    - 点击后触发回调
  - 确保按钮/弹窗与现有 UI 风格一致（`var(--fg, #2d1b00)` 等 CSS 变量）

  **Must NOT do**:
  - 按钮不要用标准 HTML button，保持 wired-elements 或像素风格
  - 弹窗不阻塞页面滚动

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - Reason: UI 组件设计，需要匹配手绘像素风格

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:4953` — `showSongSelection()` 弹窗参考（现有实现）
  - `nosh-music-ai.html:2641` — `.chat-send wired-button` CSS 样式参考
  - `nosh-music-ai.html:4628` — AI 消息气泡 `createAIMessage()` 参考

  **Acceptance Criteria**:
  - [ ] `createOptionButtons()` 在容器中渲染出手绘风格按钮
  - [ ] 点击按钮触发对应回调
  - [ ] `showPlaylistEndDialog()` 显示手绘风格弹窗
  - [ ] 弹窗按钮可点击并触发回调
  - [ ] 弹窗可关闭

  **QA Scenarios**:
  ```
  Scenario: 选项按钮渲染和点击
    Tool: Playwright
    Preconditions: 页面加载完成
    Steps:
      1. await page.evaluate(() => {
           const div = document.createElement('div');
           div.id = 'test-options';
           document.body.appendChild(div);
           window.optionResult = null;
           createOptionButtons(div, [
             {label: '来一份', action: 'accept'},
             {label: '先不听', action: 'dismiss'}
           ], (action) => { window.optionResult = action; });
         })
      2. const btn = page.locator('#test-options wired-button').first()
      3. await btn.click()
      4. const result = await page.evaluate(() => window.optionResult)
    Expected Result: result === 'accept'
    Evidence: .sisyphus/evidence/task-3-option-buttons.txt

  Scenario: 播完弹窗显示和点击
    Tool: Playwright
    Preconditions: 页面加载完成
    Steps:
      1. await page.evaluate(() => {
           window.dialogResult = null;
           showPlaylistEndDialog((action) => { window.dialogResult = action; });
         })
    Expected Result: 弹窗显示，文字 "歌单已播完，是否生成新的推荐？"
    Evidence: .sisyphus/evidence/task-3-dialog.png
  ```

  **Evidence to Capture**:
  - [ ] 选项按钮截图
  - [ ] 弹窗截图
  - [ ] 回调结果日志

  **Commit**: YES (groups with 2)
  - Message: `feat(ui): add option buttons and playlist-end dialog components`
  - Files: `nosh-music-ai.html`

---

- [ ] 4. 每日进入推荐完整流程

  **What to do**:
  - 在 `DOMContentLoaded` 初始化中或 `showWelcomeMessages()` 后调用
  - 检查 `window._isNewDay`（由 Task 1 设置）
  - 如果 `_isNewDay === false` → 跳过
  - 如果 `_isNewDay === true`:
    1. 调用 `showAvatarBadge()`（由 Task 2）
    2. 在聊天框追加 AI 消息："早上好！今天是新的一天，要不要给你生成一份今日歌单？"
    3. 消息下方调用 `createOptionButtons()` 渲染「来一份」「先不听」
    4. 点击「来一份」:
       - 调用 `clearPlaylist()` 清空旧歌单
       - 调用 `sendToAI('请给我推荐10首歌曲...')` 
       - 解析 `[[PLAY:xxx]]` 命令
       - 逐个调用 `searchAndPlay(..., {addToPlaylist: true})`
       - 播放第一首歌
       - 更新歌单渲染
    5. 点击「先不听」:
       - 调用 `hideAvatarBadge()`
       - 当天不再显示（已通过日期标记控制）
  - 推迟 AI 消息发送时机：等待页面加载完成 + 3D 封面墙初始化后（约 2-3s 延迟），或在 `showWelcomeMessages()` 完成后

  **Must NOT do**:
  - 不要重复现有 `initPlaylist()` 的逻辑（可以复用 `sendToAI()` 和 `searchAndPlay()`）
  - 不修改现有 `initPlaylist` 的触发条件

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - Reason: 需要串联 Task 1-3 的组件，理解 AI 聊天、歌单、搜索播放几个子系统

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1, 2, 3)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - `nosh-music-ai.html:4678` — `initPlaylist()` 的 AI 推荐逻辑（复用模式）
  - `nosh-music-ai.html:4513` — `sendToAI()` 函数
  - `nosh-music-ai.html:5139` — `searchAndPlay()` 函数
  - `nosh-music-ai.html:4680-4685` — profile.isOnboarded 检查（品味设置完成才推荐）

  **Acceptance Criteria**:
  - [ ] 新的一天首次进入 → AI 在聊天框发消息
  - [ ] 像素小人显示角标
  - [ ] 点击「来一份」→ 清空旧歌单 → AI 推荐 10 首 → 播第一首
  - [ ] 点击「先不听」→ 角标消失
  - [ ] 同天刷新不再询问

  **QA Scenarios**:
  ```
  Scenario: 每日进入 AI 主动询问
    Tool: Playwright
    Preconditions: 清除 localStorage（模拟新的一天）
    Steps:
      1. 打开 http://localhost:8081/
      2. 等待 5s（3D 动画 + AI 响应）
      3. 查看聊天框是否出现 AI 的消息气泡
    Expected Result: 聊天框存在包含 "今日歌单" 文字的 AI 消息
    Evidence: .sisyphus/evidence/task-4-daily-greeting.png

  Scenario: 点击「来一份」触发推荐
    Tool: Playwright
    Preconditions: 同上，AI 已发出询问
    Steps:
      1. 点击「来一份」按钮
      2. 等待 AI 推荐完成（约 15-30s）
      3. 检查歌单是否已有歌曲
    Expected Result: 歌单列表不为空，正在播放第一首
    Evidence: .sisyphus/evidence/task-4-recommend-result.png

  Scenario: 同天刷新不再询问
    Tool: Playwright
    Preconditions: 已有今天的 lastRecommendDate
    Steps:
      1. 打开 http://localhost:8081/
      2. 等待 5s
      3. 检查是否出现新的 AI 询问消息
    Expected Result: 没有新的每日询问消息
    Evidence: .sisyphus/evidence/task-4-skip-same-day.txt
  ```

  **Evidence to Capture**:
  - [ ] AI 询问消息截图
  - [ ] 推荐完成后歌单截图
  - [ ] 同天跳过的控制台日志

  **Commit**: YES
  - Message: `feat(playlist): implement daily auto-recommend flow via AI chat`
  - Files: `nosh-music-ai.html`

---

- [ ] 5. 歌单播完推荐流程

  **What to do**:
  - 修改 `audio.addEventListener('ended', ...)` 中的逻辑
  - 在歌单模式（`currentPlaylistIndex >= 0`）下，检测是否最后一首播完（`nextIdx >= pl.songs.length`）
  - 如果是最后一首播完（且 `loopMode !== 'loop'`），不要直接 `window.isPlaying = false`
    - 改为调用 `showPlaylistEndDialog()`（由 Task 3）
    - 用户点击「生成新歌单」:
      - 调用 `clearPlaylist()` 清空
      - 调用 `sendToAI('请给我推荐10首歌曲...')` 获取新推荐
      - 逐个添加并自动播放第一首
    - 用户点击「算了」:
      - 恢复现有行为（`window.isPlaying = false`）
  - 确保 `loopMode === 'loop'` 时仍然循环播放旧歌单，不弹窗
  - 确保 `loopMode === 'one'` 时单曲循环，不弹窗

  **Must NOT do**:
  - 不改动 `loopMode === 'one'` 的逻辑
  - 不改动 `loopMode === 'loop'` 的逻辑
  - 不改动 `loopMode === 'shuffle'` 的逻辑

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - Reason: 需要理解 audio ended 事件、歌单模式、循环模式的完整交互链路

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 3)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:
  - `nosh-music-ai.html:5896` — `audio.addEventListener('ended', ...)` 当前实现
  - `nosh-music-ai.html:5915-5924` — `loopMode === 'loop'` 循环逻辑
  - `nosh-music-ai.html:5897-5901` — `loopMode === 'one'` 单曲循环
  - `nosh-music-ai.html:4147` — `playNext()` 函数（参考）
  - `nosh-music-ai.html:4678` — `initPlaylist()` 推荐逻辑（复用）

  **Acceptance Criteria**:
  - [ ] 歌单最后一首播完 → 弹出「歌单已播完，是否生成新的推荐？」
  - [ ] 点击「生成新歌单」→ 清空 → AI 推荐 10 首 → 播第一首
  - [ ] 点击「算了」→ 播放停止
  - [ ] `loopMode === 'one'` 时单曲循环不受影响
  - [ ] `loopMode === 'loop'` 时循环不受影响

  **QA Scenarios**:
  ```
  Scenario: 歌单播完弹窗
    Tool: Playwright
    Preconditions: 歌单中有 2 首歌，播放到第二首最后 2s
    Steps:
      1. 等待第二首歌播放到接近结束
      2. 检查弹窗是否出现
    Expected Result: 弹窗显示 "歌单已播完，是否生成新的推荐？"
    Evidence: .sisyphus/evidence/task-5-dialog.png

  Scenario: 点击「生成新歌单」
    Tool: Playwright
    Preconditions: 弹窗已显示
    Steps:
      1. 点击「生成新歌单」按钮
      2. 等待 AI 推荐完成
      3. 检查歌单是否被刷新
    Expected Result: 旧歌单被清空，新推荐歌曲出现，正在播放
    Evidence: .sisyphus/evidence/task-5-new-playlist.png

  Scenario: loopMode='loop' 时不受影响
    Tool: Playwright
    Preconditions: loopMode='loop'，歌单有 2 首歌
    Steps:
      1. 等待第二首歌结束
      2. 检查是否回到第一首播放
    Expected Result: 回到第一首继续循环，不弹窗
    Evidence: .sisyphus/evidence/task-5-loop-mode.txt
  ```

  **Evidence to Capture**:
  - [ ] 弹窗截图
  - [ ] 新歌单结果截图
  - [ ] 循环模式控制台日志

  **Commit**: YES
  - Message: `feat(playlist): add playlist-end dialog and auto-recommend flow`
  - Files: `nosh-music-ai.html`

---

- [ ] 6. 角标与聊天交互联动

  **What to do**:
  - 当角标显示时（有新消息），点击像素小人头像或聊天按钮 → 角标消失
  - 在聊天框打开/聚焦时自动调用 `hideAvatarBadge()`
  - 每日推荐流程完成后（用户点击"来一份"或"先不听"后）自动隐藏角标
  - 确保多个角标触发源不会冲突（如同时有每日推荐和播完推荐）

  **Must NOT do**:
  - 不改变聊天框的正常交互行为

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - Reason: 理解交互联动逻辑，需要处理多个触发源

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 2, 4)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Tasks 2, 4

  **References**:
  - `nosh-music-ai.html:5560` — 聊天框事件绑定区域
  - `nosh-music-ai.html:4597` — `.chat-avatar` 头像点击相关
  - Task 2 的 `showAvatarBadge()` / `hideAvatarBadge()`

  **Acceptance Criteria**:
  - [ ] 每日推荐完成后角标消失
  - [ ] 点击聊天头像或打开聊天框时角标消失
  - [ ] 播完弹窗出现时角标状态正确

  **QA Scenarios**:
  ```
  Scenario: 点击聊天后角标消失
    Tool: Playwright
    Preconditions: 角标已显示（模拟新一天）
    Steps:
      1. 点击聊天输入框
      2. 检查角标状态
    Expected Result: 角标隐藏
    Evidence: .sisyphus/evidence/task-6-badge-cleared.png
  ```

  **Evidence to Capture**:
  - [ ] 角标状态变化截图
  - [ ] 控制台日志

  **Commit**: YES (groups with 4, 5)
  - Message: `feat(ui): wire avatar badge with chat interaction`
  - Files: `nosh-music-ai.html`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Review all changed code for: console.log debug leftovers, commented-out code, unused functions. Check CSS consistency with existing pixel style.
  Output: `Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: daily flow → button click → AI recommend → play → song ends → dialog → new recommend. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built.
  Output: `Tasks [N/N compliant] | Scope creep [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **1**: `feat(playlist): add daily date tracking for playlist recommendation` - nosh-music-ai.html
- **2, 3**: `feat(ui): add avatar badge, option buttons and dialog components` - nosh-music-ai.html
- **4, 5, 6**: `feat(playlist): implement daily and playlist-end recommendation flows` - nosh-music-ai.html

---

## Success Criteria

### Final Checklist
- [ ] 每日首次进入 AI 主动询问 → 选择 → 推荐 → 播放
- [ ] 像素角标正确显示和清除
- [ ] 歌单播完弹窗 → 选择 → 重推 → 播放
- [ ] 循环模式不受影响
- [ ] 同天刷新不重复询问
