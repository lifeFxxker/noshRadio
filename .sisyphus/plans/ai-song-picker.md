# AI 多首歌推荐选择器 (Chat Picker)

## TL;DR

> **Quick Summary**: 在聊天框中实现AI一次推荐多首歌、用户点选播放的功能。新增 `[[PICK:歌名1|歌手1,歌名2|歌手2]]` AI指令格式，在聊天气泡内展示歌曲卡片列表，支持播放、收藏、"下一首播放"操作。
>
> **Deliverables**:
> - `[[PICK:...]]` AI命令解析器
> - 聊天内歌曲选择卡片 UI 组件
> - 多首歌并行搜索与状态展示
> - 收藏切换、"下一首播放"操作
> - 更新AI系统提示词
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: 解析器 → 聊天卡片UI → 集成搜索 → 操作按钮 → 系统提示词

---

## Context

### Original Request
用户说"推荐几首摇滚歌"，AI会直接选一首播放，没有给用户选择的机会。需要AI一次推荐多首并弹窗让用户选。

### Interview Summary
**Key Decisions**:
- AI返回格式：`[[PICK:歌名1|歌手1,歌名2|歌手2,...]]`
- 选择器出现在聊天区域内（聊天气泡形式），不是独立弹窗
- 每首歌操作：播放、收藏、下一首播放
- 用户选一首后只播那首，其余不处理

---

## Work Objectives

### Core Objective
在聊天框内实现多首歌推荐选择功能，让用户可以从AI推荐的多个歌曲中自由选择播放。

### Concrete Deliverables
- `extractPickCommand(text)` — 解析 `[[PICK:...]]` 为歌曲列表
- 聊天气泡内歌曲卡片列表 UI
- 并行搜索所有推荐歌曲并展示状态
- 三个操作按钮：播放、收藏、下一首播放
- 更新 AI system prompt

### Definition of Done
- [ ] AI 回复 `[[PICK:歌名1|歌手1,歌名2|歌手2]]` 后，聊天框展示带歌曲列表的AI气泡
- [ ] 每首歌显示：歌名、歌手、3个操作按钮
- [ ] 点击播放→立即播放该歌
- [ ] 点击收藏→切换收藏状态
- [ ] 点击下一首播放→插入到当前播放队列的下一首位置
- [ ] 系统提示词已更新，AI知道何时用`[[PICK:...]]`和`[[PLAY:...]]`

### Must NOT Have (Guardrails)
- 不改动现有 `[[PLAY:...]]` 单首播放逻辑
- 不改动聊天消息区基本结构（`msg-ai` → `msg-avatar` + 内容区）
- 不引入额外外部依赖

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO (single HTML file, no test framework)
- **Automated tests**: None
- **Verification**: Agent-executed QA via browser (Playwright)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Parallel - foundation):
├── Task 1: [[PICK:...]] 命令解析器
├── Task 2: 歌曲卡片列表 UI 样式
└── Task 3: 系统提示词更新

Wave 2 (Parallel - core logic):
├── Task 4: sendMessage() 中集成事件循环（解析→UI→搜索）
├── Task 5: 操作按钮逻辑（播放+收藏+下一首）
└── Task 6: 搜索集成与状态展示
```

---

## TODOs

- [ ] 1. `[[PICK:...]]` 命令解析器

  **What to do**:
  - 创建 `extractPickCommand(text)` 函数，解析 `[[PICK:歌名1|歌手1,歌名2|歌手2]]` 格式
  - 返回 `[{ songName, artist }, ...]` 数组
  - 支持中文逗号和英文逗号分隔
  - 空保护：如果没有有效歌曲项返回 `null`
  - 紧接 `extractPickCommand` 之后写（位置：行5152 `extractPlayCommand` 函数之后）

  **Must NOT do**:
  - 不修改现有的 `extractPlayCommand`
  - 不需要验证歌曲是否存在（搜索阶段再做）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:5152-5156` — `extractPlayCommand` 的解析模式（参考其正则+返回结构）

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 解析格式正确的多首推荐
    Tool: Bash (node REPL)
    Preconditions: 在浏览器控制台测试
    Steps:
      1. 调用 extractPickCommand("给你推荐几首：[[PICK:海阔天空|Beyond,光辉岁月|Beyond,真的爱你|Beyond]]")
      2. 检查返回数组
    Expected Result: [{songName:"海阔天空",artist:"Beyond"},{songName:"光辉岁月",artist:"Beyond"},{songName:"真的爱你",artist:"Beyond"}]
    Evidence: .sisyphus/evidence/task-1-parse-success.txt

  Scenario: 没有 PICK 命令时返回 null
    Tool: Bash (node REPL)
    Preconditions: 同上
    Steps:
      1. 调用 extractPickCommand("这首歌不错")
    Expected Result: null
    Evidence: .sisyphus/evidence/task-1-parse-null.txt
  ```

  **Commit**: YES (groups with 2,3)
  - Message: `feat(ai): add [[PICK:]] command parser and chat picker UI`

- [ ] 2. 歌曲卡片列表 UI 样式

  **What to do**:
  - 在 CSS 区域新增 `.song-picker-card` 样式（放在 `.msg-bubble` 样式附近，约行 1798 之后）
  - 卡片容器：`.song-picker-card` — 在 `msg-ai` 消息中替代 `msg-bubble` 使用
  - 列表头部：显示 "为你推荐了 N 首歌" 文字
  - 每个歌曲项：`.song-picker-item`
    - 左侧：歌名（粗体）+ 歌手名（小字）
    - 右侧：3个操作图标按钮（播放▶️、收藏🤍/❤️、下一首⏭️）
  - 每个操作按钮有 hover 效果和点击状态
  - 搜索中状态：歌曲项显示灰色/骨架屏和 "搜索中..."
  - 搜索失败状态：歌曲项显示 "未找到" 灰色文字，操作按钮禁用

  **Must NOT do**:
  - 不改变现有 `.msg-bubble`、`.msg-ai` 等基础样式
  - 不使用外部字体/图标库 — 用 unicode/纯 SVG

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:1798` — `.msg-bubble` 聊天气泡样式（参考风格）
  - `nosh-music-ai.html:10234-10250` — `album-songs-modal` 歌曲列表项样式（参考布局）

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 渲染歌曲卡片列表
    Tool: Playwright
    Preconditions: 页面加载完成，打开聊天面板
    Steps:
      1. 用JS在chatMessages中创建一个 .song-picker-card 元素（含3个歌曲项）
      2. 检查每个歌曲项是否包含歌名、歌手、3个按钮
    Expected Result: 卡片正确渲染，每个操作按钮可见
    Evidence: .sisyphus/evidence/task-2-render.png

  Scenario: 搜索中状态显示
    Tool: Playwright
    Preconditions: 同上
    Steps:
      1. 在某个歌曲项添加 .searching 类
      2. 检查是否显示"搜索中..."和禁用样式
    Expected Result: 显示搜索中状态
    Evidence: .sisyphus/evidence/task-2-loading.png
  ```

- [ ] 3. 更新 AI 系统提示词

  **What to do**:
  - 在系统提示词（行 4780-4811）添加新的推荐格式说明
  - 内容：
    - 介绍 `[[PICK:歌名1|歌手1,歌名2|歌手2,歌名3|歌手3]]` 格式
    - 使用场景：用户说"推荐几首"、"来几首XX风格的"、"有什么好歌推荐"等需要多选的情况
    - 单首推荐继续用 `[[PLAY:xxx|xxx]]`
    - 多首推荐一次不要超过5首
    - 推荐后每首歌都将被搜索，建议推荐有版权的知名歌曲

  **Must NOT do**:
  - 不删除或修改现有的 `[[PLAY:...]]`、`[[BUBBLE]]`、`[[TASTE:...]]` 规则
  - 不改变AI身份设定

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:4780-4811` — 当前系统提示词全文

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 验证提示词包含 PICK 格式说明
    Tool: Bash (grep)
    Preconditions: 文件已修改
    Steps:
      1. grep "\[\[PICK" nosh-music-ai.html
    Expected Result: 找到至少一行包含 [[PICK: 的提示词
    Evidence: .sisyphus/evidence/task-3-prompt.txt
  ```

  **Commit**: YES (groups with 1,2)
  - Message: `feat(ai): add [[PICK:]] command parser and chat picker UI`

- [ ] 4. `sendMessage()` 中集成 `[[PICK:...]]` 事件循环

  **What to do**:
  - 在 `sendMessage()` 函数（行 5162）的AI响应处理循环中（行 5196-5249），在检查 `extractPlayCommand` 之前，先检查 `extractPickCommand`
  - 如果检测到 `[[PICK:...]]`：
    1. 创建 `.song-picker-card` 元素（调用渲染函数）
    2. 每个歌曲项初始为"搜索中..."状态
    3. 对每首歌并行调用 `searchAndPlay(songName, artist, { noPlay: true })` — 只搜索不播放
    4. 搜索完成后更新对应歌曲项的状态：
       - 找到 → 显示歌名+歌手，启用操作按钮，存储搜索结果数据到 data 属性
       - 未找到 → 显示"未找到"，禁用按钮
    5. 如果所有歌曲都搜索失败，显示 "没有找到可播放的歌曲" 提示
  - 创建辅助函数 `renderSongPicker(pickItems)` 返回 DOM 元素
  - 创建辅助函数 `updateSongPickerItem(el, result)` 更新单个歌曲项状态

  **Must NOT do**:
  - 不阻塞现有的 `[[PLAY:...]]` 处理路径
  - 不在搜索完成前启用操作按钮
  - 不用全局变量污染（用局部变量或 `window._` 前缀）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (depends on Task 1, 2)
  - **Blocks**: None
  - **Blocked By**: Task 1, Task 2

  **References**:
  - `nosh-music-ai.html:5162-5250` — `sendMessage()` 整体流程
  - `nosh-music-ai.html:5196-5243` — 现有 AI 气泡处理循环
  - `nosh-music-ai.html:5718-6002` — `searchAndPlay` 函数（用于搜索单首歌）
  - `nosh-music-ai.html:5532-5600` — `showSongSelection` 现有选歌逻辑（参考搜索回调模式）

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: AI回复含 PICK 命令，显示歌曲列表
    Tool: Playwright
    Preconditions: 聊天面板打开，AI已配置
    Steps:
      1. 在聊天输入框输入"推荐几首摇滚歌"
      2. 等待AI响应
      3. 检查聊天区域是否出现 .song-picker-card 元素
      4. 等待搜索完成，检查歌曲项是否显示歌名
    Expected Result: 显示歌曲卡片列表，搜索完成后每首显示歌名
    Evidence: .sisyphus/evidence/task-4-picker-display.png

  Scenario: 所有歌曲搜索失败
    Tool: Playwright
    Preconditions: 同上
    Steps:
      1. 模拟 AI 返回含非常见歌曲的 [[PICK:...]]
      2. 等待搜索完成
    Expected Result: 显示"没有找到可播放的歌曲"提示
    Evidence: .sisyphus/evidence/task-4-all-failed.png
  ```

  **Commit**: YES (groups with 5,6)
  - Message: `feat(ai): integrate song picker with search and actions`

- [ ] 5. 操作按钮逻辑（播放 + 收藏 + 下一首）

  **What to do**:
  - **播放按钮** (▶️): 点击后执行与 `playAlbumSong` 相同的逻辑（行 10258-10265）：
    1. 调用 `addToHistory(songData)` 
    2. 调用 `playFromHistory(0)` 播放
    3. 可选的移除 picker 或保留（保留作为记录）
  - **收藏按钮** (🤍/❤️): 点击切换：
    1. 调用 `toggleSongFavorite(el)` 逻辑（行 10298-10315）或直接调用
    2. 切换图标状态
  - **下一首播放** (⏭️): 
    1. 获取当前播放索引 `currentPlaylistIndex`
    2. 在 playlist 中 `currentPlaylistIndex + 1` 位置插入该歌曲
    3. 调用 `renderPlaylist()` 刷新歌单UI
    4. 显示短暂"已加入下一首"提示（用 toast 或临时文字）

  **Must NOT do**:
  - 播放时不清除当前 playlist（除非用户明确要求）
  - "下一首播放"不立即播放，只是插入队列

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (same as Task 4)
  - **Blocks**: None
  - **Blocked By**: Task 4 (操作按钮需要是 song-picker-item 的一部分)

  **References**:
  - `nosh-music-ai.html:10258-10265` — `playAlbumSong` 调用模式
  - `nosh-music-ai.html:10298-10315` — `toggleSongFavorite` 收藏逻辑
  - `nosh-music-ai.html:5984-5986` — `addToHistory` + `playFromHistory` 播放模式
  - `nosh-music-ai.html` playlist 相关函数（搜索 `addSongToPlaylist`）

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 点击播放按钮播放歌曲
    Tool: Playwright
    Preconditions: 搜索已完成，歌曲已就绪
    Steps:
      1. 点击第一首歌的 ▶️ 按钮
      2. 检查播放器卡片是否显示该歌曲
    Expected Result: 歌曲开始播放，播放器卡片更新
    Evidence: .sisyphus/evidence/task-5-play.png

  Scenario: 点击收藏按钮切换状态
    Tool: Playwright
    Preconditions: 同上
    Steps:
      1. 点击某首歌的收藏按钮（🤍）
      2. 检查按钮变为 ❤️
      3. 再次点击变为 🤍
    Expected Result: 收藏状态正确切换
    Evidence: .sisyphus/evidence/task-5-fav.gif

  Scenario: 点击"下一首播放"
    Tool: Playwright
    Preconditions: playlist 中已有歌曲在播放
    Steps:
      1. 点击某首歌的 ⏭️ 按钮
      2. 切换到歌单tab检查 playlist 中该歌在当前位置之后
    Expected Result: 歌曲插入到播放列表的下一首位置
    Evidence: .sisyphus/evidence/task-5-next.png
  ```

- [ ] 6. 搜索集成与状态展示（细化 Task 4 的搜索部分）

  **What to do**:
  - 在 `sendMessage()` 的 `[[PICK:...]]` 处理中，实现并行搜索逻辑：
  ```javascript
  // 伪代码
  const pickItems = extractPickCommand(bubbleText);
  if (pickItems) {
    const cardEl = renderSongPicker(pickItems);
    // 显示在聊天中
    chatMessages.appendChild(cardEl);
    
    // 并行搜索所有歌
    const results = await Promise.allSettled(
      pickItems.map(item => 
        searchAndPlay(item.songName, item.artist, { noPlay: true })
          .then(r => ({ index: i, result: r }))
          .catch(e => ({ index: i, result: null, error: e }))
      )
    );
    
    // 逐个更新搜索结果
    for (const r of results) {
      updateSongPickerItem(cardEl, r.index, r.result);
    }
  }
  ```
  - 搜索中和搜索完成的状态样式已在 Task 2 中定义
  - 搜索完成后，将搜索结果数据存储在 DOM 元素的 `dataset` 中，供操作按钮使用

  **Must NOT do**:
  - 不在搜索中使用 `_pendingSongCandidates`（那是单曲多源的逻辑）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (with Task 4, 5)
  - **Blocks**: None
  - **Blocked By**: Task 1, Task 2

  **References**:
  - `nosh-music-ai.html:5718-6002` — `searchAndPlay` 完整搜索逻辑
  - `nosh-music-ai.html:5957-5979` — 当歌名+歌手明确时的直接播放路径
  - `nosh-music-ai.html:5990-6002` — `songSelectionCallback` 回调模式（参考）

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 多首歌并行搜索并显示结果
    Tool: Playwright
    Preconditions: 搜索已触发
    Steps:
      1. 发送含 [[PICK:...]] 的消息
      2. 观察歌曲项从"搜索中..."变为歌名
    Expected Result: 搜索完成后，每首找到的歌显示歌名+歌手，未找到的显示"未找到"
    Evidence: .sisyphus/evidence/task-6-search-results.png
  ```

  **Commit**: YES (groups with 4,5)
  - Message: `feat(ai): integrate song picker with search and actions`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
- [ ] F2. **Code Quality Review** — `unspecified-high`
- [ ] F3. **Real Manual QA** — `unspecified-high` + `playwright`
- [ ] F4. **Scope Fidelity Check** — `deep`

---

## Commit Strategy

- 单个 commit: `feat(ai): add multi-song picker with [[PICK:]] command`
- 文件: `nosh-music-ai.html`

---

## Success Criteria

### Final Checklist
- [ ] `[[PICK:歌名1|歌手1,歌名2|歌手2]]` 正确解析
- [ ] 聊天框内显示歌曲卡片列表
- [ ] 每首歌播放/收藏/下一首按钮可点击
- [ ] AI 提示词已更新
- [ ] 现有 `[[PLAY:...]]` 不受影响
