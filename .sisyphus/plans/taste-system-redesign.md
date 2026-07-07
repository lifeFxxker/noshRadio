# 品味系统重设计 — AI 对话驱动

## TL;DR

> **核心目标**: 将品味系统从"静态表单设置"改造为"AI 对话驱动"，用户通过与 NOSH AI 聊天来建设和修改音乐品味档案
>
> **交付物**:
> - AI 系统提示中加入品味管理指令，支持 `[[TASTE:...]]` 结构化标签
> - `sendToAI()` 函数拦截 `[[TASTE:...]]` 标签并执行品味数据更新
> - 新手引导弹窗移除，改由 AI 主动发起品味对话
> - Profile 弹窗改造为只读 NOSH 名片
> - 品味面板保留但弱化为"高级模式"
>
> **预估工作量**: Medium
> **并行执行**: YES - 3 waves
> **关键路径**: 解析器工具函数 → sendToAI 集成 → 全流程验证

---

## Context

### 原始请求
"重新思考品味系统：通过与 AI 对话来引导品味建设，并由 AI 分析品味后放在名片中显示。用户想改品味就与 AI 沟通修改。"

### 访谈决策摘要
- **品味更新机制**: `[[TASTE:...]]` 结构化标签，类似现有 `[[PLAY:...]]` 格式
- **新手引导**: 去掉旧弹窗，改由 AI 发起对话引导
- **品味面板**: 保留但弱化（标注"高级模式"）
- **Profile 弹窗**: 改造为只读名片，去掉编辑功能
- **测试策略**: 跳过自动化测试，浏览器验证
- **本期不做**: 动态品味卡片（听歌行为分析，后续再说）

### 现有系统关键位置
所有文件在 `D:\工作\IDEA\noshRadio\`：
- `nosh-music-ai.html` — 主应用 (~10437 行)
- `nosh-taste.js` — 存储层 (~427 行)

| 位置 | 行号 | 说明 |
|------|------|------|
| System Prompt | 5016-5028 | conversationHistory[0]，AI 角色定义 |
| sendToAI() | 5031-5083 | AI 请求发送与响应处理 |
| buildTasteContext() | 6019-6042 | HTML 版品味上下文构建 |
| renderNoshProfile() | 6921-6963 | Profile 弹窗渲染 |
| renderTastePanel() | 6976-7062 | 品味面板渲染 |
| Onboarding JS | 6764-6892 | 新手引导逻辑 |
| 自动打开引导 | 6870-6876 | window load 后检查 !isOnboarded |
| 风格/年代标签点击 | 7114+ | genre/dislike/era 标签切换 |
| removeTasteArtist() | 7075-7083 | 删除喜欢歌手 |
| 品味面板 HTML | 3260-3340 | 品味面板 DOM |
| Profile 弹窗 HTML | 3357-3432 | NOSH Profile DOM |
| Onboarding HTML | 3434-3477 | 新手引导弹窗 DOM |

---

## 工作目标

### 核心目标
将品味管理从 UI 操作升级为 AI Agent 能力：AI 在对话中理解用户的音乐偏好，通过 `[[TASTE:...]]` 标签自动更新品味数据，用户无需离开对话即可管理自己的音乐品味档案。

### 具体交付物
- [x] `[[TASTE:...]]` 标签解析器 + 品味更新执行函数
- [x] System Prompt 中新增"品味管理"能力说明
- [x] `sendToAI()` 集成 `[[TASTE:]]` 拦截逻辑
- [x] 旧 Onboarding 弹窗移除，AI 主动发起品味对话
- [x] Profile 弹窗 → 只读 NOSH 名片
- [x] 品味面板弱化 + 添加提示
- [ ] 全流程验证：AI 对话 → 品味更新 → 名片展示

### "必须做"
1. AI 必须能通过 `[[TASTE:...]]` 更新 `artists.loved` / `demographics.preferredGenres` / `demographics.favoriteEras`
2. 用户发送消息时必须携带最新的品味上下文（`buildTasteContext()`）
3. Profile 名片必须展示正确的品味数据（与 localStorage 一致）
4. `[[TASTE:...]]` 标签对用户完全不可见（从显示和 history 中都剥离）
5. 旧 Onboarding 弹窗不再自动弹出

### "绝对不能做"
1. ❌ 不能删除 `nosh-taste.js` 的现有数据操作函数（`saveUserProfile`、`updateStats` 等仍然使用）
2. ❌ 不能移除品味面板的编辑功能（保留但弱化）
3. ❌ 不改动 AI 的音乐推荐核心逻辑（`[[PLAY:]]` 相关不变）
4. ❌ 本期不做动态品味卡片
5. ❌ 不改动 nosh-taste.js 的数据结构（`DEFAULT_PROFILE`）

---

## Verification Strategy

### 测试决策
- **自动化测试**: 无（单页 HTML 应用，无测试框架）
- **验证方式**: Agent-Executed QA Scenarios（浏览器打开 → 交互验证）

### QA 策略
每项任务在浏览器中执行以下验证：
1. 打开 `nosh-music-ai.html`
2. 清空 localStorage 模拟新用户
3. 执行具体操作步骤
4. 用 `localStorage.getItem('noshUserProfile')` 验证数据变化
5. 截图/录屏作为证据

---

## Execution Strategy

### 并行执行波次

```
Wave 1 (基础组件，可并行):
├── Task 1: [[TASTE:]] 解析器 + 品味更新引擎 [quick]
├── Task 2: System Prompt 更新 — 品味管理能力 [writing]
└── Task 3: Onboarding 移除 + AI 对话引导 [unspecified-high]

Wave 2 (集成 + UI 改造):
├── Task 4: sendToAI() 集成 [[TASTE:]] 拦截 [quick]
├── Task 5: Profile 弹窗 → 只读 NOSH 名片 [visual-engineering]
└── Task 6: 品味面板弱化 + 提示添加 [visual-engineering]

Wave 3 (验证 + 修复):
├── Task 7: 全流程端到端验证 [unspecified-high]
└── Task 8: edge case 处理 + 容错 [unspecified-high]
```

---

## TODOs

- [ ] 1. 编写 `parseTasteTags()` + `executeTasteActions()` — [[TASTE:]] 解析引擎

  **What to do**:
  - 在 `nosh-music-ai.html` 中创建两个新函数（放在 sendToAI() 附近，约 line 5085）：
    1. `parseTasteTags(text)` — 用正则 `/\[\[TASTE:([^\]]+)\]\]/g` 匹配所有 `[[TASTE:...]]` 标签，返回 `[{ action, field, value, list }]` 数组
    2. `executeTasteActions(actions)` — 遍历 actions，调用 `nosh-taste.js` 的对应函数更新 profile
  - 支持的格式解析（正则须兼容 key=value 对，用逗号分隔）：
    - `[[TASTE:artist=周杰伦,action=add,list=loved]]` → 调 `addToLovedArtists()`
    - `[[TASTE:artist=周杰伦,action=remove,list=loved]]` → 调 `removeFromLovedArtists()`
    - `[[TASTE:genre=摇滚,action=add,list=preferred]]` → 调 `addPreferredGenre()`
    - `[[TASTE:genre=网络热歌,action=add,list=disliked]]` → 调 `addDislikedGenre()`
    - `[[TASTE:era=80年代,action=add]]` → 调 `addFavoriteEra()`
  - 所有新增函数放在 `nosh-taste.js` 中（存储层统一管理）
  - 在 `nosh-music-ai.html` 中导出 `stripTasteTags(text)` → 从文本中移除所有 `[[TASTE:...]]` 标签

  **新增工具函数（写到 nosh-taste.js 末尾）**:
  ```javascript
  function addToLovedArtists(artist) { ... }
  function removeFromLovedArtists(artist) { ... }
  function addPreferredGenre(genre) { ... }
  function addDislikedGenre(genre) { ... }
  function addFavoriteEra(era) { ... }
  ```

  **AI 回复中可能同时包含 PLAY 和 TASTE 标签**，两者互不冲突。

  **Must NOT do**:
  - 不要改变现有 `getProfile()` / `saveUserProfile()` 等函数的签名
  - 不要重构现有品味管理代码

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - Reason: 纯函数编写，逻辑清晰，不涉及 UI 改动
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: N/A

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:5031-5083` — sendToAI() 函数，解析器将在此集成
  - `nosh-taste.js:251-288` — updateArtistWeight() 和 updateStats()，品味更新模式参考
  - `nosh-taste.js:132-171` — DEFAULT_PROFILE，了解数据字段
  - `nosh-music-ai.html:5086-5093` — extractPlayCommand() 和 removePlayCommand()，类比 [[PLAY:]] 的解析模式

  **Acceptance Criteria**:
  - [ ] browse 打开 nosh-music-ai.html
  - [ ] 在 DevTools Console 执行以下测试：
    ```javascript
    // 测试解析
    const tags = parseTasteTags('[[TASTE:artist=周杰伦,action=add,list=loved]]');
    console.assert(tags.length === 1 && tags[0].field === 'artist');
    
    // 测试剥离
    const clean = stripTasteTags('好的[[TASTE:artist=周杰伦,action=add,list=loved]]已更新');
    console.assert(clean === '好的已更新');
    
    // 测试执行
    localStorage.removeItem('noshUserProfile'); // 重置
    executeTasteActions([{ field: 'artist', value: '周杰伦', action: 'add', list: 'loved' }]);
    const profile = JSON.parse(localStorage.getItem('noshUserProfile'));
    console.assert(profile.artists.loved.includes('周杰伦'));
    ```

  **Evidence to Capture**:
  - [ ] console 截图 `.sisyphus/evidence/task-1-parser-test.png`


- [ ] 2. 更新 System Prompt — 加入品味管理指令

  **What to do**:
  - 在 conversationHistory[0] 的 system prompt 末尾追加「品味管理」章节（line 5028 之后）
  - 内容：
  ```
  
  ## 品味管理
  
  你可以通过 [[TASTE:字段名=值,action=操作,list=列表名]] 格式修改用户的音乐品味档案。
  
  支持的字段和操作：
  - artist（歌手名）: action=add 或 remove, list=loved/skipped
  - genre（音乐风格）: action=add 或 remove, list=preferred/disliked
  - era（年代）: action=add
  
  使用场景：
  - 用户说"我喜欢XXX歌手" → [[TASTE:artist=XXX,action=add,list=loved]]
  - 用户说"我不喜欢XXX歌手" → [[TASTE:artist=XXX,action=remove,list=loved]]
  - 用户说"我喜欢听XXX风格" → [[TASTE:genre=XXX,action=add,list=preferred]]
  - 用户说"我不喜欢XXX风格" → [[TASTE:genre=XXX,action=add,list=disliked]]
  - 用户说"我喜欢XXX年代" → [[TASTE:era=XXX,action=add]]
  
  规则：
  1. 当用户提到具体音乐偏好时，用 [[TASTE:...]] 标签更新品味数据，并在回复中确认
  2. 可以同时添加多个标签，例如用户说「我喜欢周杰伦和林俊杰」→ [[TASTE:artist=周杰伦,action=add,list=loved]] [[TASTE:artist=林俊杰,action=add,list=loved]]
  3. 不要过度解读——用户说"这首歌好听"不代表喜欢这个歌手
  4. 用户明确表达偏好或厌恶时才更新品味档案
  5. 不要直接在消息中展示 [[TASTE:]] 标签——用户看不到它，它会被自动处理
  6. 如果用户说"帮我推荐点周杰伦的歌"，不要把它当作"我喜欢周杰伦"——除非用户明确说"我喜欢周杰伦"
  ```
  - 保持原有 system prompt 其他内容不变

  **Must NOT do**:
  - 不要删除或修改原有 system prompt 的音乐推荐 / PLAY 相关指令
  - 不要改变 system prompt 的语言风格

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - Reason: 纯文本修改，需要清晰准确的英文指令
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:5016-5028` — 当前 system prompt
  - `nosh-music-ai.html:5556-5581` — notifyAISearchFailed() 和 fetchAIRetry()，了解 AI 交互模式

  **Acceptance Criteria**:
  - [ ] 打开 nosh-music-ai.html
  - [ ] DevTools Console 执行: `console.log(conversationHistory[0].content)`
  - [ ] 确认包含「品味管理」章节，且所有指令正确
  - [ ] 确认原有 DJ/音乐推荐指令完整保留

  **Evidence to Capture**:
  - [ ] console 截图 `.sisyphus/evidence/task-2-system-prompt.png`


- [ ] 3. 移除旧 Onboarding 弹窗 + 实现 AI 主动品味引导

  **What to do**:
  **Part A — 移除旧 Onboarding 弹窗**:
  - 注释或删除 Onboarding HTML（line 3434-3477）
  - 注释或删除 Onboarding JS IIFE（line 6764-6892）
  - 特别删除自动弹出逻辑（line 6870-6876：window load 后检查 !isOnboarded）
  - 删除 `openOnboarding()` 函数（line 6880-6892）和 `window.openOnboarding` 导出
  - 删除 generatePlaylist() 函数（line 6813-6827）
  - 删除 CSS 中与 onboarding 相关的样式

  **Part B — AI 主动发起品味对话**:
  - 在页面加载后（约 line 6878 附近），如果 `!profile.isOnboarded`，AI 主动发一条消息：
    ```javascript
    // 替换原自动弹窗逻辑
    window.addEventListener('load', () => {
      setTimeout(() => {
        const profile = getProfile();
        if (!profile.isOnboarded) {
          // AI 主动发起品味对话
          const welcomeMsg = document.createElement('div');
          welcomeMsg.className = 'msg msg-ai';
          welcomeMsg.innerHTML = `<div class="msg-avatar">...</div><div class="msg-bubble">🎵 嗨！我是 NOSH，你的私人音乐向导。我还不了解你的音乐品味呢——你平时喜欢听什么类型的音乐？有没有特别喜欢的歌手？</div>`;
          chatMessages.appendChild(welcomeMsg);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }, 1500);
    });
    ```
  - 原有的 `renderHistory()` / `renderPlaylist()` / `updateControls()` 调用继续保留
  - 当 AI 通过 `[[TASTE:...]]` 设置了至少一个歌手或风格后，才设置 `profile.isOnboarded = true`

  **Must NOT do**:
  - 不要删除 `isOnboarded` 字段（仍用于判断是否首次对话）
  - 不要改动 `nosh-taste.js` 的 `DEFAULT_PROFILE` 结构
  - 不要移除 `generatePlaylist` 的所有引用——去除弹窗中对它的调用即可

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - Reason: 涉及 HTML/CSS/JS 三处修改，需要小心不要破坏现有结构
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 5, 6 (Profile modal and taste panel depend on knowing what's removed)
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:3434-3477` — Onboarding HTML DOM
  - `nosh-music-ai.html:6764-6892` — Onboarding JS IIFE
  - `nosh-music-ai.html:5016-5028` — System Prompt (for AI's proactive conversation style)
  - `nosh-music-ai.html:6442-6454` — Daily greeting message pattern（早上好的打招呼方式，参考如何让 AI 主动发消息）

  **Acceptance Criteria**:
  - [ ] 清除 localStorage 后刷新页面
  - [ ] 确认没有旧 Onboarding 弹窗弹出
  - [ ] 确认 AI 主动发了一条品味引导消息
  - [ ] 确认 delete 掉的函数没有导致 JS 报错（检查 Console）

  **Evidence to Capture**:
  - [ ] 页面截图 `.sisyphus/evidence/task-3-no-onboarding.png`
  - [ ] AI 消息截图 `.sisyphus/evidence/task-3-ai-greeting.png`


- [ ] 4. sendToAI() 集成 [[TASTE:]] 拦截

  **What to do**:
  - 在 `nosh-music-ai.html` 的 `sendToAI()` 函数中（约 line 5056-5073，获取 AI 回复后），添加 `[[TASTE:]]` 拦截逻辑：
    1. 获取 AI 原始回复文本 `aiResponse`
    2. 调用 `parseTasteTags(aiResponse)` 提取所有 `[[TASTE:...]]` 标签
    3. 如果有标签，调用 `executeTasteActions(parsedTags)` 执行品味更新
    4. 调用 `stripTasteTags(aiResponse)` 获取净文本
    5. 将净文本存入 `conversationHistory`（而非含标签的原始文本）
    6. 返回净文本
  - 添加成功后刷新 UI：如果有品味更新，重新渲染 Profile 和品味面板（但不需要主动打开它们）
  - 确保 `[[TASTE:]]` 和 `[[PLAY:]]` 标签共存时互不干扰

  **逻辑示意**:
  ```javascript
  // 在 sendToAI() 的 data.choices[0].message.content 处理处
  const rawResponse = data.choices[0].message.content;
  
  // 1. 解析并执行品味更新
  const tasteTags = parseTasteTags(rawResponse);
  if (tasteTags.length > 0) {
    executeTasteActions(tasteTags);
  }
  
  // 2. 剥离标签后存入 history 和返回
  const cleanedResponse = stripTasteTags(rawResponse);
  conversationHistory.push({ role: 'assistant', content: cleanedResponse });
  return cleanedResponse;
  ```

  **Must NOT do**:
  - 不要改变 `[[PLAY:]]` 的处理流程（保持现有 `extractPlayCommand` 和 `removePlayCommand` 逻辑）
  - AI 回复的空保护逻辑（line 5061）必须在剥离标签之前检查（防止标签被剥光后变成空字符串）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - Reason: 单函数修改，逻辑清晰，改动量小
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1 parser + Task 2 system prompt + Task 3)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1, Task 2, Task 3

  **References**:
  - `nosh-music-ai.html:5031-5083` — sendToAI() 完整函数
  - `nosh-music-ai.html:5056-5073` — AI 回复处理段（插入点）
  - Task 1 新增的 parseTasteTags(), executeTasteActions(), stripTasteTags()

  **Acceptance Criteria**:
  - [ ] 打开 nosh-music-ai.html
  - [ ] 在 DevTools 中 mock AI 回复：
    ```javascript
    // 模拟 AI 回复含 TASTE 标签
    const testResponse = '好的，已记住你喜欢周杰伦 [[TASTE:artist=周杰伦,action=add,list=loved]]';
    // 手动调用 sendToAI 处理逻辑... 或直接测试解析流程
    ```
  - [ ] 确认 localStorage 中 `noshUserProfile.artists.loved` 包含 "周杰伦"
  - [ ] 确认 conversationHistory 中最后一条 assistant 内容是 "好的，已记住你喜欢周杰伦"（无标签）
  - [ ] 多标签测试：回复含 `[[TASTE:artist=A,action=add,list=loved]][[TASTE:artist=B,action=add,list=loved]]` → 两个都执行成功

  **Evidence to Capture**:
  - [ ] localStorage 截图 `.sisyphus/evidence/task-4-profile-updated.png`
  - [ ] conversationHistory 截图 `.sisyphus/evidence/task-4-history-clean.png`


- [ ] 5. Profile 弹窗 → 只读 NOSH 名片

  **What to do**:
  - 修改 Profile 弹窗 HTML（line 3357-3432）：
    - 保留：个人信息（使用天数、品味完成度）、收听统计（plays/likes/skips）
    - 保留：喜欢的歌手、喜欢的风格、偏好的年代（展示区）
    - 移除/隐藏：所有编辑相关的 UI 元素（歌手输入框、风格/年代标签点击切换）
    - 添加：底部提示文字 "💬 想修改品味？和 NOSH 聊天吧"
  - 修改 `renderNoshProfile()` 函数（line 6921-6963）：
    - 确保 readOnly 显示正确（它已经是只读的，只是需要确认）
    - 确认 `getFavorites().length` 正确显示收藏数（沿用上次修复）
    - 确认 `isOnboarded` 和使用天数的显示
  - 移除引用旧 Onboarding 的入口按钮（如 "品味设置" 按钮 line 3268）

  **Must NOT do**:
  - 不要删除 `renderNoshProfile()` 函数（保留它渲染名片）
  - 不要改动 `closeNoshProfile()` / `openNoshProfile()` 
  - 不改动 Profile 弹窗的 CSS（样式不变，只改内容）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - Reason: 涉及 DOM 结构调整和 UI 展示优化
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 3 (onboarding removal, need to know what's removed)

  **References**:
  - `nosh-music-ai.html:3357-3432` — Profile 弹窗 HTML
  - `nosh-music-ai.html:6921-6963` — renderNoshProfile() 函数
  - `nosh-music-ai.html:3268` — 旧的"品味设置"按钮入口

  **Acceptance Criteria**:
  - [ ] 打开 nosh-music-ai.html
  - [ ] 点击 NOSH 精灵头像打开 Profile
  - [ ] 确认：使用天数、收听统计正常显示
  - [ ] 确认：喜欢的歌手/风格/年代显示当前品味数据
  - [ ] 确认：没有编辑输入框或可点击切换的标签
  - [ ] 确认：底部有 "💬 想修改品味？和 NOSH 聊天吧" 提示
  - [ ] 确认：已无"品味设置"入口按钮（或已改为仅打开品味面板）

  **Evidence to Capture**:
  - [ ] Profile 弹窗截图 `.sisyphus/evidence/task-5-profile-card.png`


- [ ] 6. 品味面板弱化 — 保留但标记为"高级模式"

  **What to do**:
  - 在品味面板顶部添加提示文字：`<div style="font-size:10px;color:var(--muted);margin-bottom:12px;">💡 想快速修改品味？和 NOSH 聊天更方便。这里提供手动编辑。</div>`
  - 保持品味面板的现有功能不变：
    - 喜欢的歌手：输入框 + 标签（可添加/删除）
    - 喜欢的风格：标签点击切换
    - 不喜欢的风格：标签点击切换
    - 偏好的年代：标签点击切换
  - 所有事件绑定保持不变（line 7095-7160+ 的标签点击和歌手输入逻辑不修改）
  - 品味面板仍然通过"品味设置"按钮打开（如果 Task 5 未删除该入口）
  - 如果是通过 toggle/menu 打开，保持现有入口

  **Must NOT do**:
  - 不要删除品味面板的编辑功能
  - 不要修改任何现有的标签点击事件处理函数
  - 不要改动品味面板的 saveTastePanel() 函数

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - Reason: UI 调整，添加提示文字
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 7
  - **Blocked By**: Task 3

  **References**:
  - `nosh-music-ai.html:3260-3340` — 品味面板 HTML
  - `nosh-music-ai.html:6976-7062` — renderTastePanel() 函数
  - `nosh-music-ai.html:7075-7083` — removeTasteArtist() 函数
  - `nosh-music-ai.html:7095-7160+` — 标签点击事件和歌手输入

  **Acceptance Criteria**:
  - [ ] 打开 nosh-music-ai.html
  - [ ] 打开品味面板
  - [ ] 确认顶部提示文字显示
  - [ ] 确认：歌手输入框可输入，回车后添加到列表
  - [ ] 确认：风格/年代标签可点击切换
  - [ ] 确认：保存按钮正常工作

  **Evidence to Capture**:
  - [ ] 品味面板截图 `.sisyphus/evidence/task-6-taste-panel.png`


- [ ] 7. 端到端全流程验证

  **What to do**:
  - 清理 localStorage 模拟全新用户
  - 执行完整的用户旅程：
    1. 新用户进入 → 无 Onboarding 弹窗 → AI 主动发品味引导消息
    2. 用户输入："我喜欢周杰伦和五月天"
    3. AI 回复确认（含 `[[TASTE:artist=周杰伦,action=add,list=loved]][[TASTE:artist=五月天,action=add,list=loved]]`）
    4. 验证：profile.artists.loved 包含两人，回复无标签
    5. 用户输入："平时听流行和摇滚比较多"
    6. AI 回复：`[[TASTE:genre=流行,action=add,list=preferred]][[TASTE:genre=摇滚,action=add,list=preferred]]`
    7. 验证：profile.demographics.preferredGenres 包含流行和摇滚
    8. 用户打开 NOSH Profile → 确认名片显示周杰伦、五月天、流行、摇滚
    9. 用户输入："我不喜欢周杰伦了"
    10. AI 回复：`[[TASTE:artist=周杰伦,action=remove,list=loved]]`
    11. 验证：周杰伦从 loved 移除
    12. 用户打开品味面板 → 确认编辑功能正常 + 提示文字显示

  - 对于每次验证失败，记录失败详情并修复
  - 测试容错：format 错误的 `[[TASTE:xxx]]` 不崩溃

  **Must NOT do**:
  - 不能修改线上数据——测试在 local 环境完成
  - 不能留下测试数据——测试完成后清理

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - Reason: 需要综合测试全流程，模拟用户交互
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all tasks in Wave 2)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 5, 6

  **References**:
  - All previous tasks
  - `nosh-music-ai.html` complete file

  **Acceptance Criteria**:
  - [ ] 11 步用户旅程全部通过
  - [ ] 每步 localStorage 数据验证通过

  **Evidence to Capture**:
  - [ ] 每步截图存到 `.sisyphus/evidence/task-7-step-{N}.png`
  - [ ] 最终 profile JSON 截图 `.sisyphus/evidence/task-7-final-profile.png`


- [ ] 8. Edge case 处理 + 容错

  **What to do**:
  - 处理以下边界情况：
    1. **空值标签**: `[[TASTE:]]` → 跳过，不崩溃
    2. **格式错误**: `[[TASTE:啥]]`、`[[TASTE:artist=,action=add]]` → 忽略该条，继续处理其他标签
    3. **字段不存在**: `[[TASTE:foo=bar,action=add]]` → 忽略，log warning
    4. **重复添加**: 已经 loved 的歌手再次 add → 去重，不重复添加
    5. **移除不存在的**: 从未添加过的歌手 remove → 静默成功，不报错
    6. **剥离后变空**: AI 回复只有 `[[TASTE:...]]` 标签 → 返回到默认 fallback 消息
    7. **特殊字符**: 歌手名含空格、引号 → 保持原样处理
  - 在 `executeTasteActions()` 中加入 try-catch 保护，单条失败不影响其他条
  - 在 `sendToAI()` 中，确保剥离标签后的空字符串被空回复保护机制拦截（line 5060-5063）

  **Must NOT do**:
  - 不要过度设计——每个错误保持最低成本的 graceful handling

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - Reason: 需要细致考虑各种边界情况
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 4 integration being done)
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: None
  - **Blocked By**: Task 4

  **References**:
  - `nosh-music-ai.html:5031-5083` — sendToAI() 函数
  - Task 1 新增的 parseTasteTags() 和 executeTasteActions()
  - `nosh-taste.js:251-288` — updateArtistWeight() 类似逻辑

  **Acceptance Criteria**:
  - [ ] DevTools Console 测试以下场景无报错：
    ```javascript
    parseTasteTags('[[TASTE:啥]]');  // 格式错误 → []
    parseTasteTags('[[TASTE:]]');    // 空标签 → []
    parseTasteTags('');              // 无标签 → []
    executeTasteActions([{ field: 'artist', value: '', action: 'add', list: 'loved' }]);  // 空值 → 忽略
    executeTasteActions([{ field: 'artist', value: '周杰伦', action: 'add', list: 'loved' }]);  // 重复添加 → 去重
    executeTasteActions([{ field: 'artist', value: '不存在的人', action: 'remove', list: 'loved' }]);  // 移除不存在 → 静默
    ```

  **Evidence to Capture**:
  - [ ] Console 截图 `.sisyphus/evidence/task-8-edge-cases.png`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Review all changes for: console.log left in prod, commented-out code, unused imports/vars. Check AI slop: over-commented, over-abstracted.
  Output: `Issues [N] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean localStorage. Execute EVERY QA scenario from EVERY task. Walk through: new user flow, taste update via AI, profile card display, error handling.
  Output: `Scenarios [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 compliance. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | VERDICT`

---

## Commit Strategy

Single commit at the end with all changes.

---

## Success Criteria

### 验收检查
```javascript
// 1. 新用户进入 → 没有旧弹窗，AI 主动打招呼
localStorage.clear(); location.reload();
// 预期: OnboardingModal 不显示，AI 发了 "聊聊你的品味" 之类的消息

// 2. 和 AI 说"我喜欢周杰伦" → 回复确认 + 数据更新
// 预期: localStorage.getItem('noshUserProfile') → artists.loved 包含 "周杰伦"

// 3. 打开 Profile → 看到最新品味数据
// 预期: 名片展示 "周杰伦" 在喜欢的歌手列表中

// 4. 和 AI 说"我不喜欢周杰伦了" → 从 loved 移除
// 预期: artists.loved 不再包含 "周杰伦"

// 5. conversationHistory 中没有 [[TASTE:]] 标签
// 预期: 纯文本对话历史
```

### 最终清单
- [ ] 新用户进入无 Onboarding 弹窗
- [ ] AI 主动发起品味对话
- [ ] `[[TASTE:artist=xxx,action=add,list=loved]]` 正常工作
- [ ] `[[TASTE:artist=xxx,action=remove,list=loved]]` 正常工作
- [ ] `[[TASTE:genre=xxx,action=add,list=preferred]]` 正常工作
- [ ] `[[TASTE:genre=xxx,action=add,list=disliked]]` 正常工作
- [ ] `[[TASTE:era=xxx,action=add]]` 正常工作
- [ ] 多条 `[[TASTE:]]` 在同一个 AI 回复中正确处理
- [ ] 格式错误的 `[[TASTE:]]` 不崩溃
- [ ] Profile 名片只读，无编辑控件
- [ ] 品味面板可访问但标注为"高级模式"
- [ ] conversationHistory 中无 `[[TASTE:]]` 残留
