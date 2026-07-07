# Radio Integration — 电台功能整合与品味推荐

## TL;DR

> **Quick Summary**: 在 NOSH RADIO 主应用（nosh-music-ai.html）中整合实时广播和网易云点播电台功能，扩展现有品味系统做本地化推荐，在 sprite-drawer 中新增「📻 电台」tab，播放器卡片适配电台模式。
>
> **Deliverables**:
> - nosh-taste.js 扩展：电台偏好追踪 + 推荐引擎
> - nosh-music-ai.html 新增：📻 电台 tab + 电台浏览 + 播放器适配
> - 实时广播分类浏览 + 网易云点播分类浏览 + 为你推荐模块
>
> **Estimated Effort**: Medium (~500 行新代码 + ~100 行适配)
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Taste 扩展 → 电台 tab 面板 → 推荐引擎

---

## Context

### Original Request
用户已有两个测试页（radio-test.html 实时广播、netease-dj-test.html 网易云点播），需要整合进主应用，且电台推荐要基于用户偏好（类似现有的音乐 taste 推荐），不需要 AI 推荐。

### Interview Summary
**Key Discussions**:
- 电台数据源：radio-browser.info（实时广播）+ NeteaseCloudMusicApi（点播播客）两者都要
- 推荐引擎：本地 tag 相似度运算，不依赖 AI
- 整合方式：sprite-drawer 新增第3个 tab「📻 电台」
- 跳过 Momus 审查，跳过自动化测试
- 收藏电台：不在 MVP 范围内

### Metis Review
Metis 因提供商临时故障未完成，由 Prometheus 自检。关键已覆盖：架构清晰、无歧义。

## Work Objectives

### Core Objective
将实时广播和网易云点播电台整合进主应用，口味推荐基于用户收听行为（tag/语言/国家偏好）。

### Concrete Deliverables
- `nosh-taste.js` — 新增 radioProfile 段 + trackRadioPlay() + rankRadioByTaste()
- `nosh-music-ai.html` — 新增 📻 电台 tab 面板 + 播放器 radioMode

### Definition of Done
- [ ] 打开 http://localhost:8081/，右下角 sprite-drawer 有 📻 电台 tab
- [ ] 点击电台 tab，显示「为你推荐」(如果有历史) + 实时广播分类 + 网易云点播分类
- [ ] 点击分类加载电台列表，点击电台播放
- [ ] 电台模式下播放器隐藏进度条/切歌按钮，显示 LIVE 指示灯
- [ ] 播放几次电台后，「为你推荐」出现相似标签的电台

### Must Have
- 两个数据源都能在电台 tab 中浏览和播放
- 推荐基于本地 tag 权重计算（非 AI）
- 播放器在电台模式下适配
- 与现有音乐播放不冲突（radioMode 隔离）

### Must NOT Have (Guardrails)
- 不依赖 AI 做推荐
- 不修改 proxy-server.js / NeteaseCloudMusicApi
- 不添加自动化测试
- 不与现有 playlist/chat tab 冲突

---

## Verification Strategy

> **Agent-Executed QA only** — 手动验证 + 浏览器操作验证

### Test Decision
- **Infrastructure exists**: YES（已有代理服务器和 API）
- **Automated tests**: NO
- **Agent-Executed QA**: ALWAYS — 每个任务附带 QA 场景

### QA Policy
每个任务执行后，代理通过 Playwright 打开页面，点击元素，验证功能。

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — 3 tasks parallel):
├── Task 1: nosh-taste.js — 电台偏好追踪 [quick]
├── Task 2: HTML — 电台 tab + 面板骨架 [quick]
└── Task 3: CSS — 电台面板 + 电台播放器模式样式 [quick]

Wave 2 (Core UI — 2 tasks parallel):
├── Task 4: JS — 电台 tab 切换 + radioMode + 实时广播浏览 [unspecified-high]
└── Task 5: JS — 网易云点播浏览（分类/电台/节目/播放）[unspecified-high]

Wave 3 (Recommendation + Player — 2 tasks parallel):
├── Task 6: JS — 推荐引擎 rankRadioByTaste + 为你推荐模块 [unspecified-high]
└── Task 7: JS — 播放器卡片 radioMode 适配 [visual-engineering]

Wave FINAL (Review — 2 parallel):
├── Task F1: End-to-end test — 浏览、搜索、播放、推荐
└── Task F2: Code review — 确保不影响现有功能
```

### Dependency Matrix
- **1**: None → 6
- **2**: None → 4, 5
- **3**: None → 4, 5
- **4**: 2, 3 → 7
- **5**: 2, 3 → (独立)
- **6**: 1, 4, 5 → (独立)
- **7**: 4 → (独立)
- **F1**: 1~7 → Done
- **F2**: 1~7 → Done

### Agent Dispatch Summary
- **Wave 1 (3 agents)**: T1 → `quick`, T2 → `quick`, T3 → `quick`
- **Wave 2 (2 agents)**: T4 → `unspecified-high`, T5 → `unspecified-high`
- **Wave 3 (2 agents)**: T6 → `unspecified-high`, T7 → `visual-engineering`
- **Final (2 agents)**: F1 → `unspecified-high`, F2 → `unspecified-high`

---

## TODOs

- [ ] 1. 扩展 nosh-taste.js：电台偏好追踪

  **What to do**:
  - 在 DEFAULT_PROFILE 中新增 `radioProfile` 段
  - 实现 `trackRadioPlay(station)` — 记录电台标签权重、语言、国家
  - 实现 `getRadioProfile()` — 获取电台偏好配置
  - 电台偏好结构：
    ```js
    radioProfile: {
      preferredTags: {},       // { "talk": 5, "news": 3, "music": 1 }
      preferredLangs: {},      // { "chinese": 10 }
      preferredCountries: {},  // { "CN": 8 }
      playedStations: [],      // stationuuid 列表（用于去重）
      totalPlays: 0,
    }
    ```
  - tag 权重更新：每次播放 +1，重量级播放（>2分钟）额外 +1
  - 提供 `clearRadioHistory()` 重置函数

  **Must NOT do**:
  - 不修改现有音乐品味相关代码
  - 不删除现有功能

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:
  - `nosh-taste.js:132-171` — DEFAULT_PROFILE 结构，按相同模式新增 radioProfile
  - `nosh-taste.js:292-309` — trackPlay/trackSkip/trackLike 模式，按相同模式写 trackRadioPlay
  - `nosh-taste.js:342-384` — rankByTaste 排名模式，供 Task 6 参考

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 电台播放记录写入 localStorage
    Tool: Browser console
    Preconditions: 打开 http://localhost:8081/，已加载 nosh-taste.js
    Steps:
      1. 在控制台执行：trackRadioPlay({ name:"Test", tags:"talk,news", language:"chinese", countrycode:"CN", stationuuid:"test-123" })
      2. 执行：const p = getProfile(); console.log(p.radioProfile);
    Expected Result: radioProfile.preferredTags 包含 { talk:1, news:1 }，playedStations 包含 "test-123"
    Evidence: 控制台截图 .sisyphus/evidence/task-1-radio-profile.png
  ```

  **Evidence to Capture**:
  - [ ] 控制台输出验证 radioProfile 结构

  **Commit**: YES (groups with task 2, 3)
  - Message: `feat(taste): add radio preference tracking`
  - Files: `nosh-taste.js`

---

- [ ] 2. HTML — 电台 tab + 面板骨架

  **What to do**:
  - 在 sprite-tab-bar 中添加第3个 tab 按钮：`<button class="sprite-tab-btn" data-tab="radio">📻 电台</button>`
  - 在 sprite-tab-content 中添加第3个面板 `<div class="tab-panel sprite-radio" id="spriteRadio">`
  - 面板骨架包含：
    ```
    ├── 分段选择器：[📡 实时广播] [🎤 网易点播]
    ├── 推荐区域（初始隐藏）
    │   └── "为你推荐" 标题 + 推荐电台列表容器
    ├── 实时广播内容（默认显示）
    │   ├── 顶部搜索框 + 搜索按钮
    │   ├── 分类标签区（新闻综合/交通广播/文艺广播/中国之声/全球热门）
    │   └── 电台卡片列表容器
    └── 网易点播内容（初始隐藏）
        ├── 分类标签区（脱口秀/相声曲艺/娱乐/情感/知识/人文历史）
        ├── 电台列表容器
        └── 节目列表容器（初始隐藏）
    ```
  - 关键元素 ID：
    - `#radioSegmentBar` 分段选择器容器
    - `#radioRecommendSection` 推荐区
    - `#radioLiveContent` 实时广播内容
    - `#radioDjContent` 网易点播内容
    - `#radioStationList` 电台卡片列表
    - `#radioDjPrograms` 网易节目列表
    - `#radioLiveCategories` 实时广播分类标签
    - `#radioDjCategories` 网易点播分类标签
    - `#radioSearchInput` 搜索输入框
    - `#radioSearchBtn` 搜索按钮

  **Must NOT do**:
  - 不修改已有 tab 面板（chatMessagesSprite / spritePlaylist）
  - 不修改 sprite-tab-bar 已有按钮
  - 内容留空由 JS 动态填充

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:3024-3030` — 现有 tab 结构，按相同模式加第3个
  - `nosh-music-ai.html:3028-3030` — tab-panel 结构
  - `netease-dj-test.html` — 网易云点播 UI 参考
  - `radio-test.html` — 实时广播 UI 参考

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 电台 tab 按钮可见且可点击
    Tool: Playwright
    Preconditions: 打开 http://localhost:8081/
    Steps:
      1. 滚动到右下角 sprite-drawer
      2. 查找元素：button.sprite-tab-btn[data-tab="radio"]
      3. 点击该按钮
    Expected Result: 按钮存在，文字包含 "📻"，点击后 radio 面板显示
    Evidence: .sisyphus/evidence/task-2-radio-tab.png
  ```

  **Evidence to Capture**:
  - [ ] 截图显示 📻 tab 按钮存在
  - [ ] 点击后 radio 面板可见

  **Commit**: YES (groups with task 1, 3)

---

- [ ] 3. CSS — 电台面板 + 电台播放器模式样式

  **What to do**:
  - 新增 radio 面板样式（参考现有 tab-panel 样式模式）
    - `.sprite-radio` — 面板主容器（与 `.sprite-messages` / `.sprite-playlist` 同级）
    - `.radio-segment` — 分段选择器样式
    - `.radio-segment-btn` — 分段按钮（活跃态下划线高亮）
    - `.radio-content` — 内容区（flex column，overflow-y: auto）
    - `.radio-categories` — 分类标签区（flex wrap gap）
    - `.radio-cat-btn` — 分类按钮（chip 样式，活跃态粉色填充）
    - `.radio-search-row` — 搜索行
    - `.radio-station-list` — 电台卡片网格
    - `.radio-station-card` — 电台卡片（与 radio-test.html 风格一致）
    - `.radio-station-card.playing` — 播放中高亮
    - `.radio-program-item` — 网易节目列表项
    - `.radio-rec-section` — "为你推荐"区域
    - `.radio-rec-title` — 推荐区域标题
  - 电台播放器模式样式
    - `.player-card.radio-mode` — 电台模式下播放器卡片
    - `.player-card.radio-mode .progress-wrap` → `display:none`
    - `.player-card.radio-mode .ctrl-btn#prevBtn` → `display:none`
    - `.player-card.radio-mode .ctrl-btn#nextBtn` → `display:none`
    - `.player-card.radio-mode .loop-btn` → `display:none`
    - `.player-card.radio-mode .shuffle-btn` → `display:none`
    - `.player-card.radio-mode #playerLikeBtn` → `display:none`
    - `.live-badge.radio-active .live-dot` → 闪烁动画（红色呼吸效果）
  - Live 指示灯闪烁动画
    ```css
    .live-dot.radio-active {
      animation: radio-pulse 1.5s infinite;
    }
    @keyframes radio-pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 6px #ff3366; }
      50% { opacity: 0.3; box-shadow: 0 0 2px #ff336644; }
    }
    ```
  - 所有样式放在现有 CSS 末尾，按注释分区

  **Must NOT do**:
  - 不修改现有播放器样式
  - 不修改现有 tab 样式
  - 不添加冗余覆盖

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:1678-1735` — 现有 tab 按钮/面板样式
  - `nosh-music-ai.html:634-700` — player-card 样式
  - `nosh-music-ai.html:1050-1060` — 现有 collapsing 动画
  - `radio-test.html` — 电台卡片 UI 参考风格

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 电台模式下进度条隐藏
    Tool: Playwright + Browser console
    Preconditions: 打开 http://localhost:8081/
    Steps:
      1. 在控制台执行：document.querySelector('.player-card').classList.add('radio-mode')
      2. 检查 progress-wrap 是否 display: none
    Expected Result: .progress-wrap 显示为 display: none
    Evidence: .sisyphus/evidence/task-3-radio-mode.png
  ```

  **Evidence to Capture**:
  - [ ] 截图验证 radio-mode 生效

  **Commit**: YES (groups with task 1, 2)

---

- [ ] 4. JS — 电台 tab 切换 + radioMode 管理 + 实时广播浏览

  **What to do**:
  - 在 `tabPanels` 对象中注册 `radio: document.getElementById('spriteRadio')`
  - 在 tab 切换逻辑中处理 radio tab：显示输入框？radio tab 有自己的搜索框，所以隐藏 chat 输入框
  - 新增 radioMode 状态变量和切换函数：
    ```js
    let radioMode = false;
    function setRadioMode(enabled) {
      radioMode = enabled;
      document.querySelector('.player-card').classList.toggle('radio-mode', enabled);
      document.getElementById('liveDot').classList.toggle('radio-active', enabled);
      document.getElementById('liveLabel').textContent = enabled ? 'LIVE' : '';
    }
    ```
  - 实时广播核心逻辑（参考 radio-test.html 重构成适合嵌入 tab 的版本）：
    - 分类定义（新闻综合/交通广播/文艺广播/中国之声/全球热门）
    - `searchChineseCategory(keyword)` — 按关键词搜索 CN 电台（调用 `/radio/stations/byname/...`）
    - `loadGlobalHot()` — 加载全球热门（调用 `/radio/stations/topclick/...`）
    - `doRadioSearch(query)` — 搜索电台
    - `renderRadioStations(stations)` — 渲染电台卡片列表
    - `playRadioStation(station)` — 播放电台（设置 audio.src → 触发 radioMode）
    - 过滤逻辑：过滤空名称、lastcheckok=1、去重（按 url_resolved）
  - 当从电台 tab 点击播放时：
    - 调用 `setRadioMode(true)`
    - 设置 `audio.src` 为 stream URL
    - 更新播放器标题为电台名
    - 调用 `trackRadioPlay(station)`（从 Task 1）
  - 点击实时广播 segment 按钮时：
    - 显示 `#radioLiveContent`，隐藏 `#radioDjContent`
    - 更新 segment 按钮活跃状态
  - 分类点击：切换活跃状态、加载对应分类电台
  - 搜索框：回车或点击搜索按钮触发搜索

  **Must NOT do**:
  - 不修改现有 tab 切换逻辑核心
  - 不修改网易点播功能（Task 5 处理）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Tasks 6, 7
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `nosh-music-ai.html:5956-5972` — 现有 tab 切换逻辑
  - `radio-test.html` — 完整实时广播功能参考
  - `proxy-server.js:82-98` — /radio/ 代理路由

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 实时广播分类加载并播放
    Tool: Playwright
    Preconditions: 打开 http://localhost:8081/，切换到 📻 电台 tab
    Steps:
      1. 点击 segment 按钮「📡 实时广播」
      2. 点击「新闻综合」分类标签
      3. 等待电台列表加载完成（可见 station card）
      4. 点击第一个电台卡片
    Expected Result: 电台列表加载，点击播放后播放器卡片进入 radio-mode（进度条隐藏、LIVE 闪烁）
    Evidence: .sisyphus/evidence/task-4-live-browse.png
  ```

  **Evidence to Capture**:
  - [ ] 截图显示电台列表
  - [ ] 截图显示播放中 radio-mode

  **Commit**: YES
  - Message: `feat(radio): add live radio browsing and radio mode toggle`
  - Files: `nosh-music-ai.html`

---

- [ ] 5. JS — 网易云点播浏览

  **What to do**:
  - 参考 `netease-dj-test.html` 实现嵌入 tab 的版本：
  - 点击「🎤 网易点播」segment 按钮时：
    - 显示 `#radioDjContent`，隐藏 `#radioLiveContent`
    - 自动加载网易云 DJ 分类列表
  - 分类接口：`fetch('/netease/dj/catelist')` 返回分类列表
  - 渲染分类标签（chip 样式），点击后加载该分类下的热门电台
  - 电台列表接口：`fetch('/netease/dj/recommend?type=${categoryId}')` 或 `fetch('/netease/dj/hot?type=${categoryId}')`
  - 点击电台 → 加载节目列表 → 显示 `#radioDjPrograms`
  - 节目列表接口：`fetch('/netease/dj/program?rid=${radioId}&limit=30')`
  - 节目列表包含：节目名、播放次数、时长、创建时间
  - 点击节目 → 获取音频 URL → 播放
  - 音频获取：`fetch('/netease/song/url?id=${programId}')` → 取 `data[0].url`
  - 播放时触发 radioMode（DJ 点播也是独立音频流，同样用 radioMode）
  - 支持从节目列表返回电台列表（面包屑或返回按钮）

  **Must NOT do**:
  - 不修改实时广播功能
  - 不处理 VIP 付费节目（跳过无 URL 的节目）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `netease-dj-test.html` — 完整网易点播功能参考
  - `nosh-music-ai.html:3028-3030` — tab-panel 结构
  - `proxy-server.js:70-72` — /netease/ 代理路由

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 网易点播分类浏览并播放
    Tool: Playwright
    Preconditions: 打开 http://localhost:8081/，切换到 📻 电台 tab
    Steps:
      1. 点击 segment 按钮「🎤 网易点播」
      2. 等待分类标签加载完成
      3. 点击「脱口秀」分类
      4. 等待电台列表加载
      5. 点击第一个电台 → 等待节目列表出现
      6. 点击第一个节目
    Expected Result: 能浏览分类和电台列表，点击节目触发 radioMode 播放
    Evidence: .sisyphus/evidence/task-5-dj-browse.png
  ```

  **Evidence to Capture**:
  - [ ] 截图显示分类列表
  - [ ] 截图显示节目列表
  - [ ] 截图显示播放中 radio-mode

  **Commit**: YES
  - Message: `feat(radio): add NetEase DJ podcast browsing`
  - Files: `nosh-music-ai.html`

---

- [ ] 6. JS — 推荐引擎 + 为你推荐模块

  **What to do**:
  - 实现 `rankRadioByTaste(stations, profile)`：
    ```js
    function rankRadioByTaste(stations, profile) {
      const rp = profile.radioProfile || { preferredTags:{}, preferredLangs:{}, preferredCountries:{}, playedStations:[] };
      return stations.map(s => {
        let score = 0;
        const tags = (s.tags || '').split(',').map(t => t.trim().toLowerCase());
        // tag 匹配
        Object.entries(rp.preferredTags).forEach(([tag, weight]) => {
          if (tags.includes(tag)) score += weight * 2;
        });
        // 语言匹配
        const lang = (s.language || '').toLowerCase();
        if (rp.preferredLangs[lang]) score += 15;
        // 国家匹配
        const cc = (s.countrycode || '').toLowerCase();
        if (rp.preferredCountries[cc]) score += 10;
        // 已播放过 → 多样性降权
        if (rp.playedStations.includes(s.stationuuid)) score -= 25;
        // 探索噪声
        score += Math.random() * 5;
        return { station: s, score };
      }).sort((a, b) => b.score - a.score);
    }
    ```
  - 实现 `buildRadioRecommendations(maxCount=20)`：
    - 从 profile 中获取播放历史
    - 如果历史为空 → 返回 `null`（隐藏「为你推荐」区域）
    - 如果有历史 → 获取候选池（从多个分类搜索 + 全球热门混合）
    - 执行 rankRadioByTaste → 取 Top N → 返回结果
  - 在 JS 中新增 `renderRecommendations()`：
    - 填充 `#radioRecommendSection` 内容
    - 显示推荐卡片（与 station card 同风格）
    - 支持点击播放
  - 在 tab 切换到 radio 时自动调用 `buildRadioRecommendations()`
  - 播放历史少的用户：推荐区域不显示，不影响正常浏览
  - 推荐卡片右下角标注推荐理由（如 "你听过类似：新闻"）

  **Must NOT do**:
  - 不调用外部 AI API
  - 不修改现有 rankByTaste 音乐推荐

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Task F1
  - **Blocked By**: Tasks 1, 4, 5

  **References**:
  - `nosh-taste.js:342-384` — rankByTaste 模式参考
  - `nosh-taste.js:132-171` — DEFAULT_PROFILE 结构，radioProfile 段已由 Task 1 添加

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 有收听历史后出现「为你推荐」
    Tool: Playwright + Browser console
    Preconditions: 打开 http://localhost:8081/
    Steps:
      1. 在控制台执行模拟收听：
         trackRadioPlay({ name:"央广新闻", tags:"news,talk", language:"chinese", countrycode:"CN", stationuuid:"rec1" })
         trackRadioPlay({ name:"交通广播", tags:"talk,traffic", language:"chinese", countrycode:"CN", stationuuid:"rec2" })
      2. 切换到 📻 电台 tab
      3. 观察页面顶部是否有「为你推荐」区域
      4. 推荐列表应包含与 news/talk/traffic 相关标签的电台
    Expected Result: 「为你推荐」区域出现，推荐内容与收听历史标签相关
    Evidence: .sisyphus/evidence/task-6-recommendation.png
  ```

  **Evidence to Capture**:
  - [ ] 截图显示「为你推荐」区域
  - [ ] 推荐内容合理

  **Commit**: YES
  - Message: `feat(radio): add taste-based radio recommendation engine`
  - Files: `nosh-music-ai.html`, `nosh-taste.js`

---

- [ ] 7. JS — 播放器卡片 radioMode 适配

  **What to do**:
  - `setRadioMode(true)` 完整实现：
    - 添加 `radio-mode` class 到 `.player-card`（CSS 已隐藏对应元素）
    - 隐藏进度条相关 DOM（除了 CSS 隐藏，额外通过 JS 确保干净）
    - 直播 dot 激活闪烁
    - 修改 `#liveLabel` 文字为 "LIVE"
    - 如果正在播放电台，设置 `homepageUrl` 可选点击跳转
  - `setRadioMode(false)` 恢复：
    - 移除 class
    - 恢复进度条显示
    - 恢复切歌按钮
    - LIVE 标签恢复默认
  - 播放器 title/artist 显示电台名和国家
    - 电台播放时，`radioName` 显示电台名，`radioDesc` 显示 "国家 · 码率"
  - 当从音乐播放切到电台时：
    - 停止当前音乐（audio.pause）
    - 清除进度条
    - 设置 radioMode
  - 当从电台切回音乐时（用户点击歌单 tab 播放音乐）：
    - 设置 radioMode = false
    - 恢复正常音乐播放
  - 监听 audio error：电台流失败时，显示错误提示，不破坏播放器状态
  - 音乐播放时若用户切到电台 tab 并点击播放 → 自动切换 radioMode

  **Must NOT do**:
  - 不修改现有音乐播放核心逻辑
  - 不在 radioMode 下隐藏音量控制

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: Task F1
  - **Blocked By**: Task 4

  **References**:
  - `nosh-music-ai.html:2934-2996` — 播放器卡片 HTML 结构
  - `nosh-music-ai.html:2955-2963` — 进度条区（radioMode 时隐藏）
  - `nosh-music-ai.html:2964-2976` — 控制按钮区（radioMode 时隐藏 prev/next）

  **Acceptance Criteria**:

  **QA Scenarios**:
  ```
  Scenario: 音乐播放 → 播放电台 → 切换模式
    Tool: Playwright
    Preconditions: 打开 http://localhost:8081/
    Steps:
      1. 确认当前不在 radio-mode（进度条可见）
      2. 切换到 📻 电台 tab → 点击实时广播 → 点击一个电台
      3. 观察 UI 变化
    Expected Result:
      - 进度条隐藏
      - prev/next 按钮隐藏
      - LIVE 标签闪烁
      - 音量条保留
      - 电台名显示
    Evidence: .sisyphus/evidence/task-7-player-mode.png

  Scenario: 电台播放 → 切回音乐
    Tool: Playwright
    Preconditions: 电台正在播放，radio-mode 活跃
    Steps:
      1. 切换到 🎵 歌单 tab
      2. 点击歌单中的一首歌播放
    Expected Result:
      - radio-mode 关闭
      - 进度条恢复
      - 切歌按钮恢复
      - LIVE 标签恢复正常
    Evidence: .sisyphus/evidence/task-7-back-to-music.png
  ```

  **Evidence to Capture**:
  - [ ] 电台模式截图
  - [ ] 切回音乐模式截图

  **Commit**: YES
  - Message: `feat(player): add radio mode to player card`
  - Files: `nosh-music-ai.html`

---

## Final Verification Wave

- [ ] F1. **End-to-End 功能测试** — `unspecified-high`
  - 打开 http://localhost:8081/
  - 验证 📻 电台 tab 可见可点击
  - 验证实时广播分类加载和播放
  - 验证网易点播分类浏览和播放
  - 验证 radio-mode 切换（进度条隐藏/恢复）
  - 验证「为你推荐」在有播放历史后出现
  - 验证 music → radio → music 切换不崩
  - 截图留存：`.sisyphus/evidence/final-qa/`
  - Output: `Scenarios [N/N pass] | VERDICT: APPROVE/REJECT`

- [ ] F2. **代码质量检查** — `unspecified-high`
  - 确认不影响现有音乐播放
  - 确认不重复 $ 选择器
  - 确认 radioMode 切换干净
  - 确认无死代码/无用 CSS

---

## Commit Strategy

- **Task 1, 2, 3** (Wave 1): `feat(taste): add radio preference tracking + radio tab HTML/CSS`
  - Files: `nosh-taste.js`, `nosh-music-ai.html`
- **Task 4** (Wave 2): `feat(radio): add live radio browsing and radio mode toggle`
  - Files: `nosh-music-ai.html`
- **Task 5** (Wave 2): `feat(radio): add NetEase DJ podcast browsing`
  - Files: `nosh-music-ai.html`
- **Task 6** (Wave 3): `feat(radio): add taste-based radio recommendation engine`
  - Files: `nosh-music-ai.html`, `nosh-taste.js`
- **Task 7** (Wave 3): `feat(player): add radio mode to player card`
  - Files: `nosh-music-ai.html`

---

## Success Criteria

### Final Checklist
- [ ] 📻 电台 tab 在 sprite-drawer 中存在
- [ ] 实时广播可浏览分类/搜索/播放
- [ ] 网易点播可浏览分类/电台/节目/播放
- [ ] radio-mode 正确切换播放器 UI
- [ ] 有收听历史后出现「为你推荐」
- [ ] 推荐内容与历史标签相关
- [ ] 音乐和电台切换不冲突
