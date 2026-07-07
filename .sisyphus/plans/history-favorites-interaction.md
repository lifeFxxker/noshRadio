# History ↔ Favorites Interaction

## TL;DR

> **Quick Summary**: 为 noshRadio 新增独立收藏列表功能：在 AlbumGallery 3D 专辑墙内增加「全部历史/我的收藏」切换模式，支持独立收藏数据存储、❤️角标标识、淡入淡出切换动效。
>
> **Deliverables**:
> - `nosh-taste.js`: 新增 `getFavorites/saveFavorites/addFavoriteSong/removeFavoriteSong/isFavorite` 5个函数
> - `nosh-music-ai.html`: 历史列表❤️按钮同步到独立收藏列表
> - `nosh-music-ai.html`: AlbumGallery 新增 `extractFavorites()` 方法
> - `nosh-music-ai.html`: 专辑墙右上角浮动切换按钮
> - `nosh-music-ai.html`: 已收藏专辑卡片 ❤️ 角标
> - `nosh-music-ai.html`: 淡入淡出 + entry burst 切换动效
> - `nosh-music-ai.html`: 已有数据迁移（`liked: true` → `noshFavorites`）
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Data Layer → Gallery Changes → Switch Logic

---

## Context

### Original Request
为 noshRadio 设计 History↔Favorites 交互，新增独立收藏列表，在 AlbumGallery 3D 专辑墙中支持全部/收藏切换。

### Interview Summary
**Key Decisions**:
- **入口**: 专辑墙内右上角浮动切换按钮（无新导航 tab）
- **数据模型**: 独立 `localStorage` key `noshFavorites`
- **切换动效**: 淡出 + 新专辑从中心 burst 飞出
- **收藏标识**: 已收藏专辑卡片右上角 ❤️ 角标
- **空状态**: 「去听歌收藏吧」温馨提示
- **验证方式**: 手动测试 + Agent-Executed QA (Playwright)

**Research Findings**:
- `nosh-taste.js` 已提供 `getPlayHistory/savePlayHistory` 模式 → 新函数遵循相同模式
- AlbumGallery.extractAlbums() 从 history 提取专辑列表 → extractFavorites() 类似逻辑但源为 favorites
- 收藏操作现有 history 中的 `song.liked` 属性 → 需要双向同步（向后兼容）

---

## Work Objectives

### Core Objective
在 AlbumGallery 3D 专辑墙中增加独立收藏支持，实现全部历史/我的收藏两种模式的切换。

### Concrete Deliverables
- `nosh-taste.js`: 5个新数据函数
- `nosh-music-ai.html`: 历史列表❤️同步逻辑
- `nosh-music-ai.html`: AlbumGallery.extractFavorites()
- `nosh-music-ai.html`: 右上角切换按钮 + ❤️角标 + 切换动效 + 空状态

### Definition of Done
- [ ] nosh-taste.js 新增的 5 个函数可正常读写 localStorage
- [ ] 历史列表点击❤️ → 歌曲加入独立收藏列表
- [ ] 进入专辑墙后右上角显示切换按钮
- [ ] 点击切换 → 专辑墙淡出 → 收藏专辑 burst 进入
- [ ] 全部模式下已收藏专辑显示 ❤️ 角标
- [ ] 无收藏时显示空状态提示
- [ ] 已有 liked 歌曲自动迁移到收藏列表

### Must Have
- 独立收藏数据与 history 数据解耦
- 切换动效与现有进入专辑墙动效视觉一致
- 收藏专辑的封面/歌手信息正确显示
- 切换按钮清晰指示当前模式

### Must NOT Have (Guardrails)
- 不改动底部导航（不新增 tab）
- 不改动首页播放器卡片
- 不改动专辑弹窗 `openAlbumSongsModal`
- 不引入外部依赖或框架
- 不破坏现有播放/历史/收藏统计逻辑

---

## Verification Strategy

> **Manual Test + Agent-Executed QA** (Playwright for browser verification)

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None (manual verification)
- **Agent-Executed QA**: YES — Playwright browser automation

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Playwright — Navigate, click, assert DOM content, screenshot
- **Storage**: Execute JavaScript in browser console to verify localStorage
- **Each scenario**: exact selectors, concrete test data, expected results

---

## Execution Strategy

```
Wave 1 (Data Layer — can run in parallel):
├── Task 1: nosh-taste.js — Favorites CRUD functions
├── Task 2: nosh-music-ai.html — Data migration on page load
└── Task 3: nosh-music-ai.html — History ❤️ button sync

Wave 2 (Gallery Changes — depends on Wave 1, can run in parallel):
├── Task 4: nosh-music-ai.html — AlbumGallery.extractFavorites()
├── Task 5: nosh-music-ai.html — Toggle button UI + state
├── Task 6: nosh-music-ai.html — ❤️ badge on album cards
├── Task 7: nosh-music-ai.html — Switch mode + transition logic
└── Task 8: nosh-music-ai.html — Empty favorites state

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle — read)
├── Task F2: Manual QA via Playwright
└── Task F3: Scope fidelity check (deep — read)

Critical Path: Task 1 → Task 4 → Task 5/7 → Task F1-F3 → user ok
Max Concurrent: 3 (Wave 1)
```

---

## TODOs

- [ ] 1. nosh-taste.js — 新增收藏列表 CRUD 函数

  **What to do**:
  - 在 `nosh-taste.js` 中新增 5 个函数，遵循现有 `getPlayHistory/savePlayHistory` 的 try-catch-localStorage 模式：
  - `getFavorites()`: 从 `localStorage` 读取 `noshFavorites`，返回 `song[]`，失败返回 `[]`
  - `saveFavorites(favorites)`: 将 `favorites` 数组写入 `localStorage` 的 `noshFavorites` key
  - `addFavoriteSong(song)`: 读取当前列表 → 按 `song.id` 去重（如已存在则跳过） → unshift → 保存
  - `removeFavoriteSong(songId)`: 读取当前列表 → filter 移除 → 保存
  - `isFavorite(songId)`: 读取当前列表 → 返回 `some(s => s.id === songId)`

  **Must NOT do**:
  - 不修改现有 `getPlayHistory/savePlayHistory` 的存储 key
  - 不使用外部依赖
  - 不添加 UI 逻辑（纯数据层）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, with Tasks 2, 3)
  - **Blocks**: Tasks 2, 3, 4, 5, 6, 7, 8
  - **Blocked By**: None

  **References**:
  - `nosh-taste.js:13-24` — `getPlayHistory/savePlayHistory` 的模式（try-catch-localStorage）
  - `nosh-taste.js:20-23` — `savePlayHistory` 的写入模式

  **Acceptance Criteria**:
  - [ ] `getFavorites()` 返回当前 localStorage 中 `noshFavorites` 的解析结果
  - [ ] `addFavoriteSong(song)` 将歌曲添加到列表头部，重复 ID 不添加
  - [ ] `removeFavoriteSong(id)` 正确移除指定 ID 的歌曲
  - [ ] `isFavorite(id)` 返回正确的 boolean
  - [ ] 所有函数有 try-catch 保护

  **QA Scenarios**:
  ```
  Scenario: Verify add/remove favorites
    Tool: Bash (bun) or Browser console
    Preconditions: nosh-taste.js loaded, localStorage empty
    Steps:
      1. Call addFavoriteSong({id:1, name:'test', artist:'tester'})
      2. Assert getFavorites().length === 1
      3. Assert isFavorite(1) === true
      4. Call removeFavoriteSong(1)
      5. Assert getFavorites().length === 0
      6. Assert isFavorite(1) === false
    Expected Result: CRUD 操作正确读写 localStorage
    Evidence: .sisyphus/evidence/task-1-crud.txt

  Scenario: Verify duplicate prevention
    Tool: Bash (bun) or Browser console
    Preconditions: Empty favorites list
    Steps:
      1. addFavoriteSong({id:42, name:'dup'})
      2. addFavoriteSong({id:42, name:'dup'})
      3. Assert getFavorites().length === 1
    Expected Result: 重复 ID 不会被添加两次
    Evidence: .sisyphus/evidence/task-1-dedup.txt
  ```

  **Evidence to Capture**:
  - `task-1-crud.txt`: console output showing correct CRUD
  - `task-1-dedup.txt`: console output showing dedup

  **Commit**: YES (groups with 2-3)
  - Message: `feat(data): add favorites CRUD functions to nosh-taste.js`
  - Files: `nosh-taste.js`

---

- [ ] 2. nosh-music-ai.html — 数据迁移：已有 liked 歌曲 → 收藏列表

  **What to do**:
  - 在 `nosh-music-ai.html` 页面加载脚本中找到合适位置（靠近 `loadLoginState()` 和 `renderHistory()` 的初始化区域，约 line 3294-3333）
  - 新增一个函数 `migrateLikedToFavorites()`:
    1. 先检查 `noshFavorites` 在 localStorage 中是否存在且非空（已迁移过则跳过）
    2. 调用 `getPlayHistory()` 获取历史
    3. 找到所有 `song.liked === true` 的歌曲
    4. 对每首歌调用 `addFavoriteSong(song)`（新函数来自 Task 1）
    5. 注意：`addFavoriteSong` 会去重
  - 在页面初始化阶段调用 `migrateLikedToFavorites()`（放在 `renderHistory()` 之前或之后）

  **Must NOT do**:
  - 不修改 history 数据
  - 不重复迁移（有 guard 检查）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, with Tasks 1, 3)
  - **Blocks**: None (仅初始化触发)
  - **Blocked By**: Task 1 (依赖 `addFavoriteSong`)

  **References**:
  - `nosh-taste.js:13-18` — `getPlayHistory()` 读取模式
  - `nosh-music-ai.html:3294-3333` — 页面初始化区域（`loadLoginState()` → `renderHistory()`）
  - `nosh-music-ai.html:3435` — `song.liked` 属性已在现有 history 中使用

  **Acceptance Criteria**:
  - [ ] 已有 `liked: true` 的歌曲在页面加载后出现在 `noshFavorites` 中
  - [ ] 已 `liked: false` 或未标记的不迁移
  - [ ] 首次迁移后不再重复迁移

  **QA Scenarios**:
  ```
  Scenario: Verify migration on page load
    Tool: Playwright
    Preconditions: localStorage has noshPlaylist_history with liked=true songs
    Steps:
      1. Inject test history data with some liked=true songs
      2. Reload page
      3. Execute: JSON.parse(localStorage.getItem('noshFavorites'))
      4. Verify liked songs are in favorites list
    Expected Result: Only liked=true songs migrated to favorites
    Evidence: .sisyphus/evidence/task-2-migration.txt
  ```

  **Evidence to Capture**:
  - `task-2-migration.txt`: localStorage content after migration

  **Commit**: YES (groups with 1)
  - Message: `feat(data): migrate existing liked songs to independent favorites list`
  - Files: `nosh-music-ai.html`

---

- [ ] 3. nosh-music-ai.html — 历史列表 ❤️ 按钮同步到收藏列表

  **What to do**:
  - 修改 `renderHistory()` 函数（约 line 3405-3443）中的 ❤️/🤍 按钮点击处理逻辑（约 line 3429-3441）
  - 当前行为（line 3430-3439）：
    ```
    song.liked = !song.liked;
    btn.textContent = song.liked ? '❤️' : '🤍';
    btn.classList.toggle('liked', song.liked);
    if (typeof trackLike === 'function') trackLike(song);
    savePlayHistory(playHistory);
    ```
  - 改为：
    ```
    const wasLiked = song.liked;
    song.liked = !wasLiked;
    btn.textContent = song.liked ? '❤️' : '🤍';
    btn.classList.toggle('liked', song.liked);
    if (typeof trackLike === 'function') trackLike(song);
    // 同步独立收藏列表
    if (song.liked) {
      addFavoriteSong(song);
    } else {
      removeFavoriteSong(song.id);
    }
    savePlayHistory(playHistory);
    ```
  - 同时在页面初始化时，`renderHistory()` 中的 ❤️ 状态显示也要基于 `isFavorite(song.id)` 而非仅 `song.liked`（可选，向后兼容保留 `song.liked` 也可）

  **Must NOT do**:
  - 不改变 ❤️/🤍 按钮的 UI 样式
  - 不改变 `trackLike` 的调用逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, with Tasks 1, 2)
  - **Blocks**: None
  - **Blocked By**: Task 1 (依赖 `addFavoriteSong/removeFavoriteSong`)

  **References**:
  - `nosh-music-ai.html:3429-3441` — 现有 ❤️ 按钮点击事件处理
  - `nosh-music-ai.html:3405-3443` — `renderHistory()` 完整函数

  **Acceptance Criteria**:
  - [ ] 点击 ❤️ → `addFavoriteSong(song)` 被调用
  - [ ] 点击 🤍 → `removeFavoriteSong(song.id)` 被调用
  - [ ] `trackLike(song)` 仍然被调用
  - [ ] history 中的 `song.liked` 属性仍然同步更新

  **QA Scenarios**:
  ```
  Scenario: Verify like button syncs to favorites
    Tool: Playwright
    Preconditions: Page loaded with some play history visible
    Steps:
      1. Click 🤍 button on a history item
      2. Execute: isFavorite(songId) in console
      3. Assert returns true
      4. Click the same ❤️ button again
      5. Execute: isFavorite(songId) in console
      6. Assert returns false
    Expected Result: Like button toggles independent favorites list correctly
    Evidence: .sisyphus/evidence/task-3-sync.txt
  ```

  **Evidence to Capture**:
  - `task-3-sync.txt`: console output showing isFavorite results after toggles

  **Commit**: YES (groups with 1, 2)
  - Message: `feat(ui): sync history like button with independent favorites list`
  - Files: `nosh-music-ai.html`

---

- [ ] 4. nosh-music-ai.html — AlbumGallery 新增 `extractFavorites()` 方法

  **What to do**:
  - 在 `AlbumGallery` 对象（约 line 8053-8361）中新增 `extractFavorites()` 方法
  - 逻辑与 `extractAlbums()`（line 8092-8115）类似，但源数据不同：
    ```javascript
    extractFavorites() {
      const favorites = getFavorites();
      if (!favorites || favorites.length === 0) return [];
      const albumMap = new Map();
      favorites.forEach(song => {
        if (!song.picUrl) return;
        const albumName = (song.album && song.album.name) || '';
        const normalizedPic = (song.picUrl || '').split('?')[0];
        const key = albumName ? (albumName + '|' + (song.artist || '')) : normalizedPic;
        if (!albumMap.has(key)) {
          albumMap.set(key, {
            picUrl: song.picUrl,
            name: albumName || song.name,
            displayName: albumName || song.name,
            artist: song.artist,
            songs: [song],
            isFavorite: true  // 标记为收藏专辑
          });
        } else {
          albumMap.get(key).songs.push(song);
        }
      });
      return Array.from(albumMap.values());
    }
    ```
  - 注意：album 对象增加 `isFavorite: true` 标记，后续 ❤️ 角标渲染用

  **Must NOT do**:
  - 不修改现有 `extractAlbums()` 方法
  - 不修改 AlbumGallery 的其他逻辑（除新增方法外）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, with Tasks 5, 6)
  - **Blocks**: Tasks 5, 7
  - **Blocked By**: Task 1 (依赖 `getFavorites`)

  **References**:
  - `nosh-music-ai.html:8092-8115` — `extractAlbums()` 完整实现（复制其去重逻辑）
  - `nosh-music-ai.html:8053-8361` — AlbumGallery 完整对象

  **Acceptance Criteria**:
  - [ ] `extractFavorites()` 返回按专辑去重后的歌曲列表
  - [ ] 返回的每个 album 对象有 `isFavorite: true` 标记
  - [ ] 无收藏时返回空数组
  - [ ] 去重逻辑与 `extractAlbums()` 一致

  **QA Scenarios**:
  ```
  Scenario: Verify extractFavorites returns correct albums
    Tool: Playwright (browser console)
    Preconditions: Some songs added to favorites
    Steps:
      1. Execute: AlbumGallery.extractFavorites()
      2. Assert returns array of albums
      3. Assert each album has isFavorite: true
      4. Assert albums are deduplicated by name+artist
    Expected Result: Correct album list with isFavorite flag
    Evidence: .sisyphus/evidence/task-4-extract.txt

  Scenario: Verify extractFavorites empty state
    Tool: Playwright (browser console)
    Preconditions: No songs in favorites
    Steps:
      1. Execute: AlbumGallery.extractFavorites()
      2. Assert returns []
    Expected Result: Empty array when no favorites
    Evidence: .sisyphus/evidence/task-4-empty.txt
  ```

  **Evidence to Capture**:
  - `task-4-extract.txt`: console output showing extracted albums
  - `task-4-empty.txt`: console output showing empty array

  **Commit**: YES (groups with 5, 6)
  - Message: `feat(gallery): add extractFavorites method to AlbumGallery`
  - Files: `nosh-music-ai.html`

---

- [ ] 5. nosh-music-ai.html — 专辑墙右上角浮动切换按钮 + 状态管理

  **What to do**:
  - 在 AlbumGallery 对象中新增状态变量：
    ```javascript
    mode: 'all', // 'all' | 'favorites'
    toggleBtn: null,
    ```
  - 新增 `createToggleButton()` 方法
  - 在 `start()` 中调用，在 `stop()` 中移除
  - 新增 CSS 样式(`.gallery-toggle-btn`)

  **Must NOT do**:
  - 不添加除切换按钮外的其他 UI 元素

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, with Tasks 4, 6)
  - **Blocks**: Tasks 7
  - **Blocked By**: None

  **References**:
  - `nosh-music-ai.html:2598-2605` — 底部导航按钮样式
  - `nosh-music-ai.html:8072-8079` — `AlbumGallery.init()`
  - `nosh-music-ai.html:8344-8360` — `AlbumGallery.stop()`

  **Acceptance Criteria**:
  - [ ] 进入专辑墙后右上角显示切换按钮
  - [ ] 按钮文字正确反映当前模式
  - [ ] 离开专辑墙时按钮被正确移除

  **QA Scenarios**:
  ```
  Scenario: Toggle button appears in gallery
    Tool: Playwright
    Preconditions: Navigate to playlist tab
    Steps:
      1. Click navPlaylist, wait for gallery
      2. Assert .gallery-toggle-btn exists
      3. Assert button text matches current mode
    Expected Result: Toggle button visible in top-right
    Evidence: .sisyphus/evidence/task-5-button.png

  Scenario: Toggle button removed on exit
    Tool: Playwright
    Steps:
      1. Click navHome, wait for transition
      2. Assert .gallery-toggle-btn does NOT exist
    Evidence: .sisyphus/evidence/task-5-removed.png
  ```

  **Commit**: YES (groups with 4, 6)
  - Message: `feat(gallery): add mode toggle button to AlbumGallery`
  - Files: `nosh-music-ai.html`

---

- [ ] 6. nosh-music-ai.html — 收藏专辑卡片 ❤️ 角标

  **What to do**:
  - 修改 `extractAlbums()` 方法：开头预加载 `favSet = new Set(getFavorites().map(s => s.id))`
  - 在每次创建 album 对象时设置 `isFavorite: favSet.has(song.id)`
  - 在 `start()` 卡片创建循环中添加 ❤️ 角标 `<span class="gallery-fav-badge">`
  - 角标 CSS: `position:absolute;top:4px;right:4px;font-size:14px;z-index:2`

  **Must NOT do**:
  - 不修改卡片的基本布局和 transform
  - 不破坏 entry burst 动画

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, with Tasks 4, 5)
  - **Blocked By**: Task 1

  **References**:
  - `nosh-music-ai.html:8092-8115` — `extractAlbums()`
  - `nosh-music-ai.html:8167-8204` — 卡片创建循环

  **Acceptance Criteria**:
  - [ ] 全部模式已收藏专辑显示 ❤️ 角标
  - [ ] 收藏模式所有专辑显示 ❤️ 角标

  **QA Scenarios**:
  ```
  Scenario: Badge in all mode
    Tool: Playwright
    Preconditions: Mixed favorites/non-favorites
    Steps: Navigate to gallery, screenshot
    Expected: Only favorited albums show ❤️
    Evidence: .sisyphus/evidence/task-6-badge-all.png

  Scenario: Badge in favorites mode
    Tool: Playwright
    Steps: Switch to favorites mode, screenshot
    Expected: All cards show ❤️
    Evidence: .sisyphus/evidence/task-6-badge-fav.png
  ```

  **Commit**: YES (groups with 4, 5)
  - Message: `feat(gallery): add heart badge on favorited album cards`
  - Files: `nosh-music-ai.html`

---

- [ ] 7. nosh-music-ai.html — 切换模式逻辑 + 淡入淡出动效

  **What to do**:
  - 新增 `toggleMode()`: 切换 `this.mode` → 调用对应的 `extractAlbums()`/`extractFavorites()` → 更新按钮文字和 info panel → 调用 `transitionTo(albums)`
  - 新增 `transitionTo(albums)`: 停止动画 → 卡片淡出(opacity→0, scale→0.8, 300ms) → 清空 carousel → 调用 `this.start(albums)` 触发 entry burst
  - 使用 `_startVersion` guard 防止快速切换竞态

  **Must NOT do**:
  - 不修改首次进入专辑墙的动效

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Blocked By**: Tasks 4, 5

  **References**:
  - `nosh-music-ai.html:8580-8596` — gallery 启动动效
  - `nosh-music-ai.html:8336-8342` — `collapseTo()`
  - `nosh-music-ai.html:8117-8224` — `start()` 方法

  **Acceptance Criteria**:
  - [ ] 点击切换 → 淡出 → burst 进入
  - [ ] info panel 标题更新
  - [ ] 快速切换不崩溃

  **QA Scenarios**:
  ```
  Scenario: Mode switch transition
    Tool: Playwright
    Steps: toggle → wait → assert button text + panel title
    Evidence: .sisyphus/evidence/task-7-switch.png

  Scenario: Rapid toggle
    Tool: Playwright
    Steps: toggle 3x rapidly → wait 1s → assert not crashed
    Evidence: .sisyphus/evidence/task-7-rapid.txt
  ```

  **Commit**: YES (groups with 4-6)
  - Message: `feat(gallery): implement mode switching with fade+burst`
  - Files: `nosh-music-ai.html`

---

- [ ] 8. nosh-music-ai.html — 空收藏状态处理

  **What to do**:
  - 新增 `showEmptyState(mode)` 方法：收藏模式空时显示「还没有收藏的专辑」提示
  - 修改 `start()` 中空数据分支，收藏模式调用 `showEmptyState('favorites')`
  - 新增 `.gallery-empty-state` CSS

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Blocked By**: Task 5

  **References**: `nosh-music-ai.html:8124-8127`

  **Acceptance Criteria**:
  - [ ] 收藏模式无收藏时显示空状态
  - [ ] 切回全部模式正常显示

  **QA Scenarios**:
  ```
  Scenario: Empty favorites
    Tool: Playwright
    Preconditions: No favorites
    Steps: toggle to favorites → screenshot → toggle back
    Evidence: .sisyphus/evidence/task-8-empty.png
  ```

  **Commit**: YES (groups with 4-7)
  - Message: `feat(gallery): add empty state for favorites mode`
  - Files: `nosh-music-ai.html`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. Verify:
  - `nosh-taste.js` has all 5 new CRUD functions
  - History ❤️ button syncs to both favorites list and song.liked
  - Data migration runs on page load
  - AlbumGallery has `extractFavorites()`, `toggleMode()`, `transitionTo()`, `showEmptyState()`
  - Toggle button exists in gallery
  - ❤️ badge renders on favorited album cards
  - Switch transition works correctly
  - Empty state displayed for no favorites
  **VERDICT**: APPROVE/REJECT

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Check for: console.log left in prod code, commented-out code, unused imports. Verify `localStorage` operations have try-catch. Check `_startVersion` guard is used for async safety.
  **VERDICT**: PASS/FAIL

- [ ] F3. **Manual QA via Playwright** — `unspecified-high`
  Start from clean localStorage. Execute ALL QA scenarios from all 8 tasks. Test cross-feature integration:
  - Like a song in history → verify in favorites list
  - Switch to favorites mode → verify gallery shows favorited albums
  - Unlike all songs → switch to favorites → verify empty state
  Save screenshots to `.sisyphus/evidence/final-qa/`.
  **VERDICT**: APPROVE/REJECT

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify nothing beyond spec was built, nothing in spec was missed. Check no cross-contamination (Task N modifying unrelated code).
  **VERDICT**: CLEAN/ISSUES

---

## Commit Strategy

| Commits | Message | Files |
|---------|---------|-------|
| 1 | `feat(data): add favorites CRUD functions to nosh-taste.js` | `nosh-taste.js` |
| 1 (amend) | `feat(data): migrate existing liked songs + sync button` | `nosh-music-ai.html` |
| 2 | `feat(gallery): add extractFavorites, toggle button, badges, switching, empty state` | `nosh-music-ai.html` |

---

## Success Criteria

### Final Checklist
- [ ] `nosh-taste.js` 新增 5 个收藏 CRUD 函数
- [ ] 历史列表 ❤️ 同步到独立收藏列表
- [ ] 已有 liked 歌曲页面加载时自动迁移
- [ ] `AlbumGallery.extractFavorites()` 正确提取收藏专辑
- [ ] 专辑墙右上角显示切换按钮
- [ ] 已收藏专辑卡片有 ❤️ 角标
- [ ] 切换动效流畅（淡出→burst 进入）
- [ ] 无收藏时显示空状态提示
- [ ] 多次快速切换不崩溃
