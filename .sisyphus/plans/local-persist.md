# 数据持久化：localStorage → 本地文件

## TL;DR

> **Quick Summary**: 利用现有的 proxy-server.js (Node.js 后端) 提供文件读写 API，将浏览器 localStorage 中的用户数据同步保存到本地磁盘 JSON 文件，浏览器清缓存不再丢失数据。
>
> **Deliverables**:
> - proxy-server.js 新增 `POST /api/data/save` + `GET /api/data/load` 两个端点
> - 前端适配层 `nosh-persist.js`（server 可用时优先读 server，回退 localStorage）
> - nosh-taste.js 全线迁移到 `nosh-persist.js`
> - 启动时服务端恢复机制（localStorage 为空但 server 有数据时自动恢复）
>
> **Estimated Effort**: Short（～半天）
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 (后端 API) → Task 2 (前端适配层) → Task 4-6 (nosh-taste.js 迁移)

---

## Context

### Original Request
现在数据存在浏览器 localStorage 中，动不动被清掉，需要持久化到本地文件。

### Interview Summary
**Key Decisions**:
- 方案：扩展已有 proxy-server.js，加 API 接口，数据存本地 JSON 文件
- 不引入数据库，纯文件存储
- 架构：写时双写 localStorage + server；加载时优先读 server（数据更新），回退 localStorage

**Data to Migrate**:
| localStorage key | 用途 |
|---|---|
| noshUserProfile | 用户品味信息 |
| noshFavorites | 收藏列表 |
| noshPlaylist | 播放队列 |
| noshPlaylist_history | 播放历史 |
| noshSettings | 设置 |
| noshAnonymousId | 匿名 ID |

---

## Work Objectives

### Core Objective
用户数据不再依赖浏览器 localStorage，通过 proxy-server 持久化到本地磁盘文件。

### Concrete Deliverables
- proxy-server.js 新增 2 个 API 端点（save/load）
- `nosh-persist.js` 轻量适配层（～80 行）
- `nosh-taste.js` 全部读写函数迁移到适配层
- 数据文件存储在 `<project>/data/*.json`

### Definition of Done
- [ ] 启动 noshRadio（`start.bat`），在无 localStorage 数据的浏览器中打开，用户数据从本地文件恢复
- [ ] 添加/修改品味信息后刷新页面，数据不丢失
- [ ] 关闭浏览器 → 清空浏览器数据 → 重新打开 noshRadio，用户数据仍在

### Must Have
- localStorage 写的代码同步写一份到 server
- 页面加载时如果 localStorage 为空，尝试从 server 恢复
- server 不可用时（未启动等），纯 localStorage 模式仍能正常工作（降级）

### Must NOT Have
- 不引入数据库（SQLite 等）
- 不改动 proxy-server.js 现有的代理和静态服务逻辑
- 不修改 nosh-music-ai.html 中的 UI/交互逻辑

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None（手动验证）
- **Agent-Executed QA**: YES — 通过 tmux 启动/停止 proxy-server，curl 验证 API，浏览器验证数据恢复

### QA Policy
每个 task 执行后，agent 用 curl 验证 API 响应，用文件系统验证 JSON 文件写入，用浏览器页面验证数据恢复。

---

## Execution Strategy

```
Wave 1 (Start Immediately - 2 tasks, parallel):
├── Task 1: proxy-server.js 新增 save/load API 端点 [quick]
└── Task 2: 创建 nosh-persist.js 适配层 [quick]

Wave 2 (After Wave 1 - 4 tasks, parallel):
├── Task 3: nosh-taste.js 迁移 getUserProfile/saveUserProfile [quick]
├── Task 4: nosh-taste.js 迁移 getFavorites/saveFavorites [quick]
├── Task 5: nosh-taste.js 迁移 getPlaylist/savePlaylist [quick]
└── Task 6: nosh-taste.js 迁移 playHistory + settings [quick]

Wave F (Final - 跨任务验证):
├── Task F1: 全链路验证 — 启动服务、清缓存、数据恢复 [quick]
└── Task F2: 降级验证 — 关闭 server，localStorage 独立工作 [quick]

Critical Path: Task 1 → Task 2 → Task 3-6 (in parallel)
Max Concurrent: 4 (Wave 2)
```

---

## TODOs

- [ ] 1. proxy-server.js 新增 save/load API 端点

  **What to do**:
  - 在 `api/resolve-url` 和 `api/audio-proxy` 块之后，添加两个新端点：
    - `POST /api/data/save` — 接收 JSON body `{ key: string, data: any }`，写入 `./data/{key}.json`
    - `GET /api/data/load` — 接收 query `?key=xxx`，返回 `./data/{key}.json` 的内容（JSON）
  - 用 `fs.mkdirSync` 确保 `./data/` 目录存在
  - 写入时用 `JSON.stringify(data, null, 2)` 让文件可读
  - CORS headers 保持一致（`Access-Control-Allow-Origin: *`）
  - `.gitignore` 添加 `data/` 目录

  **Must NOT do**:
  - 不改动已有的代理路由和静态文件路由
  - 不在 server 层做数据校验（由前端保证）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 单一文件新增两个端点，逻辑简单
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: N/A

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3-6
  - **Blocked By**: None

  **References**:
  - proxy-server.js:106-155 — 现有 API 端点的写法（`/api/resolve-url`）做参考

  **Acceptance Criteria**:

  ```
  Scenario: Save data to server
    Tool: Bash (curl)
    Preconditions: proxy-server.js 已在运行
    Steps:
      1. curl -X POST http://localhost:8081/api/data/save -H "Content-Type: application/json" -d '{"key":"test","data":{"hello":"world"}}'
      2. Verify response: {"success":true}
      3. Check file exists: Test-Path "data/test.json"
      4. Read file content: Get-Content "data/test.json" | ConvertFrom-Json
    Expected Result: data/test.json 内容为 {"hello":"world"}，缩进格式化
    Evidence: .sisyphus/evidence/task-1-save.json

  Scenario: Load data from server
    Tool: Bash (curl)
    Preconditions: data/test.json 存在且包含 {"hello":"world"}
    Steps:
      1. curl http://localhost:8081/api/data/load?key=test
      2. Verify response: {"success":true,"data":{"hello":"world"}}
    Expected Result: 返回保存的数据
    Evidence: .sisyphus/evidence/task-1-load.json

  Scenario: Load non-existent key
    Tool: Bash (curl)
    Preconditions: data/nonexist.json 不存在
    Steps:
      1. curl http://localhost:8081/api/data/load?key=nonexist
      2. Verify response: {"success":false,"error":"not found"}
    Expected Result: 返回 404，不报错
    Evidence: .sisyphus/evidence/task-1-load-miss.json
  ```

  **Evidence to Capture**:
  - [ ] task-1-save.json — POST 响应
  - [ ] task-1-load.json — GET 响应
  - [ ] task-1-load-miss.json — 不存在 key 的响应

  **Commit**: YES
  - Message: `feat(server): add save/load data API endpoints for local persistence`
  - Files: `proxy-server.js`

- [ ] 2. 创建 nosh-persist.js 适配层

  **What to do**:
  - 新建 `nosh-persist.js`，提供统一的数据读写接口：
    ```js
    // 写：双写 localStorage + server（fire-and-forget，不阻塞）
    async function persistData(key, data) { ... }
    
    // 读：优先从 localStorage（同步快），可选从 server 拉取最新
    async function loadData(key) { ... }
    
    // 启动时恢复：localStorage 空但 server 有 → 拉回 localStorage
    async function restoreFromServer() { ... }
    ```
  - 核心逻辑：
    - `persistData(key, data)`:
      1. `localStorage.setItem(key, JSON.stringify(data))`（同步，立即生效）
      2. `fetch('/api/data/save', { method:'POST', body: JSON.stringify({key, data}) })`（异步，不 await/不阻塞）
    - `loadData(key)`:
      1. 先读 localStorage（同步）
      2. 可选参数 `forceServer` 强制从 server 读
    - `restoreFromServer()`:
      1. 遍历 STORAGE_KEYS + `noshFavorites`
      2. 对每个 key，若 localStorage 中不存在，尝试 `GET /api/data/load`
      3. 成功则写入 localStorage
  - server 不可用时（fetch 失败/超时 1s），静默降级，不抛异常
  - 写入 `nosh-music-ai.html` 的 `<head>` 中（在 `nosh-taste.js` 之前加载）

  **Must NOT do**:
  - 不在数据读写上加复杂校验
  - 不依赖 server 响应来继续前端逻辑（fire-and-forget）
  - 不导入外部库（纯原生 JS）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 单文件，逻辑简单
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3-6
  - **Blocked By**: None

  **References**:
  - nosh-taste.js:4-10 — STORAGE_KEYS 常量定义
  - nosh-taste.js:73-78 — saveUserProfile 的现有 localStorage 模式

  **Acceptance Criteria**:

  ```
  Scenario: persistData 写双份
    Tool: Bash (curl + dev-browser)
    Preconditions: proxy-server 运行中
    Steps:
      1. 在浏览器 console 执行 persistData('testKey', {foo:'bar'})
      2. 刷新页面
      3. console 执行 JSON.parse(localStorage.getItem('testKey'))
      4. curl http://localhost:8081/api/data/load?key=testKey
    Expected Result: localStorage 和 server 都有 {"foo":"bar"}
    Evidence: .sisyphus/evidence/task-2-dual-write.txt

  Scenario: server 降级（server 不可用时仍然写入 localStorage）
    Tool: Bash
    Preconditions: proxy-server 未启动
    Steps:
      1. 在无 server 环境下打开页面
      2. 执行 persistData('offlineKey', {offline:true})
      3. 读取 localStorage.getItem('offlineKey')
    Expected Result: localStorage 有数据，无报错
    Evidence: .sisyphus/evidence/task-2-degrade.txt
  
  Scenario: restoreFromServer 数据恢复
    Tool: Bash (curl + dev-browser)
    Preconditions: server 有数据（通过 curl POST 写入），localStorage 为空
    Steps:
      1. 打开新浏览器页面（localStorage 为空）
      2. 页面加载后执行 restoreFromServer()
      3. 检查 localStorage 中对应 key
    Expected Result: localStorage 恢复了 server 中的数据
    Evidence: .sisyphus/evidence/task-2-restore.txt
  ```

  **Evidence to Capture**:
  - [ ] task-2-dual-write.txt — 双写验证
  - [ ] task-2-degrade.txt — 降级验证
  - [ ] task-2-restore.txt — 恢复验证

  **Commit**: YES
  - Message: `feat(persist): add nosh-persist.js hybrid storage layer`
  - Files: `nosh-persist.js`, `nosh-music-ai.html`

- [ ] 3. nosh-taste.js 迁移 getUserProfile/saveUserProfile

  **What to do**:
  - 替换 `saveUserProfile(profile)` 中的 localStorage 写为 `persistData(STORAGE_KEYS.USER_PROFILE, profile)`
  - 替换 `getUserProfile()` 中的 localStorage 读为可选 `loadData()`
  - 添加 `window.addEventListener('load', () => restoreFromServer())` 触发恢复（确保所有 key 都恢复）

  **Must NOT do**:
  - 不改动 profile 的数据结构
  - 不改动其他函数

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4, 5, 6)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 1, Task 2

  **References**:
  - nosh-taste.js:73-78 — saveUserProfile
  - nosh-taste.js:173-179 — getUserProfile / initUserProfile

  **Acceptance Criteria**:
  - [ ] 在品味面板添加喜欢歌手 → 刷新页面 → 数据仍在
  - [ ] 清空 localStorage → 刷新页面 → 从 server 恢复数据

  **Commit**: YES
  - Message: `refactor(taste): migrate UserProfile to nosh-persist.js`
  - Files: `nosh-taste.js`

- [ ] 4. nosh-taste.js 迁移 getFavorites/saveFavorites

  **What to do**:
  - 修改 `getFavorites()`：本地 localStorage 读优先，server 作为 fallback
  - 修改收藏相关函数（添加/移除收藏）：写操作后调用 `persistData('noshFavorites', favorites)`

  **Must NOT do**:
  - 不改动收藏的 UI 交互逻辑

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3, 5, 6)
  - **Parallel Group**: Wave 2
  - **Blocked By**: Task 1, Task 2

  **References**:
  - nosh-taste.js:26-65 — getFavorites / toggleFavorite / isFavorite

  **Acceptance Criteria**:
  - [ ] 收藏一首歌 → 刷新页面 → 收藏仍在
  - [ ] 取消收藏 → 刷新 → 收藏消失

  **Commit**: YES
  - Message: `refactor(taste): migrate Favorites to nosh-persist.js`
  - Files: `nosh-taste.js`

- [ ] 5. nosh-taste.js 迁移 getPlaylist/savePlaylist/playHistory

  **What to do**:
  - 修改播放队列的读写函数，同上模式
  - 修改播放历史的读写函数

  **Must NOT do**:
  - 不改动播放逻辑

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3, 4, 6)
  - **Parallel Group**: Wave 2
  - **Blocked By**: Task 1, Task 2

  **References**:
  - nosh-taste.js 搜索 `getPlaylist` / `savePlaylist` / `getPlayHistory` / `savePlayHistory`

  **Acceptance Criteria**:
  - [ ] 添加歌曲到播放队列 → 刷新 → 队列仍在
  - [ ] 播放历史在刷新后保留

  **Commit**: YES
  - Message: `refactor(taste): migrate Playlist and PlayHistory to nosh-persist.js`
  - Files: `nosh-taste.js`

- [ ] 6. nosh-taste.js 迁移 settings + anonymousId

  **What to do**:
  - 修改 settings 和 anonymousId 的读写函数

  **Must NOT do**:
  - 不改动设置的结构

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3, 4, 5)
  - **Parallel Group**: Wave 2
  - **Blocked By**: Task 1, Task 2

  **Acceptance Criteria**:
  - [ ] 设置项在刷新后保留
  - [ ] anonymousId 在清 localStorage 后从 server 恢复

  **Commit**: YES
  - Message: `refactor(taste): migrate Settings and AnonymousId to nosh-persist.js`
  - Files: `nosh-taste.js`

---

## Final Verification Wave

- [ ] F1. **全链路验证** — 启动 proxy-server → 无痕浏览器打开 noshRadio → 添加品味信息 → 刷新页面 → 数据仍在 → 清浏览器数据 → 刷新 → 数据从 server 恢复
- [ ] F2. **降级验证** — 关闭 proxy-server → 打开 noshRadio → 正常使用（localStorage 模式） → 数据仍能保存

---

## Commit Strategy

1. `feat(server): add save/load data API endpoints for local persistence`
2. `feat(persist): add nosh-persist.js hybrid storage layer`
3. `refactor(taste): migrate UserProfile to nosh-persist.js`
4. `refactor(taste): migrate Favorites to nosh-persist.js`
5. `refactor(taste): migrate Playlist and PlayHistory to nosh-persist.js`
6. `refactor(taste): migrate Settings and AnonymousId to nosh-persist.js`

---

## Success Criteria

### Verification Commands
```bash
# 检查 API 可用
curl -X POST http://localhost:8081/api/data/save -H "Content-Type: application/json" -d '{"key":"test","data":"ok"}'
curl http://localhost:8081/api/data/load?key=test

# 检查数据文件
Get-ChildItem data/*.json

# 全链路：清空 localStorage 后验证数据恢复
# 浏览器 DevTools → Application → Local Storage → 清空 → 刷新 → 数据应恢复
```

### Final Checklist
- [ ] 浏览器清缓存后用户数据不丢失
- [ ] server 未启动时前端正常降级
- [ ] 所有存储 key 都被覆盖迁移
- [ ] 数据文件在 `data/*.json` 可读
