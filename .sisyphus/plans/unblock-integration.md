# UnblockNeteaseMusic 全量音源替换计划

## TL;DR

> **Quick Summary**: 将 UnblockNeteaseMusic 集成到 noshRadio 的歌曲 URL 解析链路中，作为所有歌曲的主要音源解析器。所有新搜索的歌曲都通过 unblock `match()` 跨音源搜索，自动选择最高码率/可用的 URL，替代当前仅依赖网易云 + 酷狗的方案。
>
> **Deliverables**:
> - `proxy-server.js` 新增 `/api/resolve-url` 端点（调用 unblock match）
> - `nosh-music-ai.html` 中 `resolveSongUrl()` 改为优先走 unblock 解析
> - `searchAndPlay()` 流程简化（移除不再需要的 `/netease/song/url` 调用）
> - 测试基础设施（`node:test`） + 集成测试
> - 旧的播放历史记录中的 URL 不受影响（保持原样）
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3

---

## Context

### Original Request
用户反馈网易云和酷狗音源太多 30 秒试听版本，希望改善音源质量。经过讨论，选择了 **方案 B（全量替换）**：所有新搜索歌曲都通过已安装的 `@unblockneteasemusic/server` 跨音源搜索（kuwo > kugou > migu > joox > pyncmd），直接获取可播放的高质量 URL。

### Interview Summary
**Key Discussions**:
- 方案选择：从 A（fallback 兜底）、B（全量替换）、C（运行时检测）中选择 B
- 旧历史记录：不重解析，保持现有 URL
- 测试策略：需要设置测试基础设施，Node.js 原生 `node:test`
- 技术验证：已实际测试 `match()` 函数可用，能返回 kuwo 源的高质量 MP3 URL

**Research Findings**:
- `@unblockneteasemusic/server` 的主入口是 `match(id, sources)` 函数，接受 Netease 歌曲 ID 和音源列表
- `match()` 内部先通过 Netease API 获取歌曲元数据，再在各源中匹配
- 已测试歌曲 185709（稻香）成功返回 kuwo 源 128kbps MP3 URL
- 当前 `/unblock/*` 路由已配置但从未被前端调用
- `proxy-server.js` 是纯 Node.js http server（无 Express）

### Self-Gap Analysis
**Identified Gaps** (addressed in plan):
- **Kugou 歌曲无 Netease ID** → 无法使用 `match()`，需保留现有 Kugou 解析路径
- **`/netease/song/detail` 仍需保留** → 用于获取封面图、时长、专辑名等 UI 数据
- **`match()` 可能超时或失败** → 需加 catch fallback 到 neteaseFallbackUrl
- **测试需要启动 unblock 服务器** → 测试前需确保 `unblock-music-server.js` 运行中
- **Node.js v24 原生测试** → 使用 `node:test` + `node:assert`，零外部依赖

---

## Work Objectives

### Core Objective
集成 UnblockNeteaseMusic 作为 noshRadio 的主要音源解析器，使新搜索的歌曲自动获取多源中最优质的播放 URL。

### Concrete Deliverables
- `proxy-server.js` 新增 `GET /api/resolve-url?id=X` 端点
- `nosh-music-ai.html` 中 `resolveSongUrl()` 重构为优先走 unblock
- `searchAndPlay()` 流程中移除不再需要的 `/netease/song/url` 调用
- `__tests__/proxy-server.test.js` 集成测试
- `package.json` 添加 `test` 脚本

### Definition of Done
- [ ] `curl "http://localhost:8081/api/resolve-url?id=185709"` 返回 `{"url":"http://...","source":"kuwo","br":128000}`
- [ ] 新搜索的歌曲播放 URL 来自 kuwo/kugou/migu 等多源
- [ ] 所有已有功能（播放、暂停、歌单、历史记录）正常工作
- [ ] `node --test __tests__/` 全部通过

### Must Have
- 新搜索的 Netease 歌曲通过 unblock match 解析 URL
- 失败时优雅 fallback 到 neteaseFallbackUrl
- Kugou 歌曲仍走 Kugou 解析路径
- `node --test` 绿色通过

### Must NOT Have (Guardrails)
- 不改动 `playFromHistory()` 和旧历史记录
- 不改动搜索逻辑（`searchNeteaseInto`、`searchKugouInto`）
- 不改动音频播放事件（`loadedmetadata`、`ended`、`error` 等）
- 不引入任何外部测试依赖（只用 `node:test`）
- 不修改 `unblock-music-server.js`

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO — 需新建
- **Automated tests**: YES (TDD — tests-after: 先实现后补测试)
- **Framework**: `node:test` (Node.js built-in, zero dependencies)
- **Test location**: `__tests__/proxy-server.test.js`

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **API/Backend**: Use Bash (curl) — Send requests, assert status + response JSON fields
- **Integration**: Start proxy server → make HTTP request → validate response

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Server-side — foundation):
├── Task 1: Add /api/resolve-url endpoint to proxy-server.js
└── Task 2: Set up test infrastructure + integration test

Wave 2 (Frontend — integration):
├── Task 3: Refactor resolveSongUrl() to use unblock first
├── Task 4: Simplify searchAndPlay() — remove /netease/song/url call
└── Task 5: Run full integration verification

Critical Path: Task 1 → Task 3 → Task 5
Max Concurrent: 2 (Wave 1)
```

---

## TODOs

- [ ] 1. Add `/api/resolve-url` endpoint to proxy-server.js

  **What to do**:
  - Import `@unblockneteasemusic/server` at the top of `proxy-server.js`:
    ```javascript
    const match = require('@unblockneteasemusic/server');
    ```
  - Add a new route handler BEFORE the CORS/static file section: `GET /api/resolve-url`
  - Route handler logic:
    1. Parse `id` from query params (`parsedUrl.query.id`)
    2. If no `id`, return `400 { success: false, error: "Missing id parameter" }`
    3. Try `await match(id, ['kugou', 'kuwo', 'bodian', 'migu', 'joox', 'pyncmd'])`
    4. On success, return `200 { success: true, url, source, br, size }`
    5. On error, return `200 { success: false, error: e.message, fallback: true }` (never 500 — let frontend decide fallback)
  - Add proper CORS headers (`Access-Control-Allow-Origin: *`)
  - Add `Content-Type: application/json` to the response
  - **Important**: The handler must catch ALL errors gracefully — the unblock match can time out or fail for various reasons
  - The handler should be synchronous/non-blocking (use async/await properly with the http server)

  **Must NOT do**:
  - Do NOT modify any existing routes
  - Do NOT remove the `/unblock/*` proxy route (keep as-is for future use)
  - Do NOT add any external npm packages
  - Do NOT add Express or any other framework
  - Do NOT change the behavior of the unblock server or its startup script

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Server-side Node.js modification with external module integration. Requires understanding of `@unblockneteasemusic/server` API, plain Node.js http routing, and error handling patterns.
  - **Skills**: none needed
  - **Skills Evaluated but Omitted**: All — no specific skill package matches this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3, Task 4, Task 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `proxy-server.js:67-82` — Existing `/netease` and `/kugou` proxy route patterns (follow the same structure)
  - `proxy-server.js:84-93` — CORS preflight handler pattern

  **API/Type References**:
  - `node_modules/@unblockneteasemusic/server/src/provider/match.js:61-135` — The `match(id, sources)` function signature and return type. Takes id (string/number), sources (string array), returns `{ url, source, br, size }`
  - `node_modules/@unblockneteasemusic/server/src/consts.js` — Available provider names. Use: `['kugou', 'kuwo', 'bodian', 'migu', 'joox', 'pyncmd']`

  **External References**:
  - Node.js HTTP server docs: https://nodejs.org/api/http.html#http_http_createserver_options_requestlistener

  **WHY Each Reference Matters**:
  - The existing proxy route handlers show the exact pattern for `res.writeHead()` with CORS headers and async operations
  - The match function signature tells you what params to pass and what to expect back. The return object has `.url`, `.source`, `.br`, `.size` fields
  - The consts file lists valid provider names — using invalid names will cause runtime errors

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Happy path — resolve a known song via unblock match
    Tool: Bash (curl)
    Preconditions: `unblock-music-server.js` is running (port 30489). `proxy-server.js` is running (port 8081).
    Steps:
      1. Run: `curl -s "http://localhost:8081/api/resolve-url?id=185709"`
      2. Parse the JSON response
    Expected Result: Response JSON has `success: true`, `url` is a non-empty string starting with `http`, and `source` is one of 'kugou', 'kuwo', 'bodian', 'migu', 'joox', 'pyncmd'
    Failure Indicators: Response has `success: false`, or `url` is empty/null, or request returns HTTP 500/502/404
    Evidence: .sisyphus/evidence/task-1-unblock-happy.json

  Scenario: Error handling — missing id parameter
    Tool: Bash (curl)
    Preconditions: proxy-server running
    Steps:
      1. Run: `curl -s "http://localhost:8081/api/resolve-url"`
      2. Check HTTP status code and response body
    Expected Result: HTTP status 400. Response JSON has `success: false` and `error` containing "missing" or "id parameter"
    Failure Indicators: Returns HTTP 200, or doesn't have error field, or server crashes
    Evidence: .sisyphus/evidence/task-1-unblock-missing-id.json

  Scenario: Error handling — non-existent song id
    Tool: Bash (curl)
    Preconditions: proxy-server running, unblock server running
    Steps:
      1. Run: `curl -s "http://localhost:8081/api/resolve-url?id=9999999999"`
      2. Check response
    Expected Result: Response JSON has `success: false`, `fallback: true`, and a descriptive `error` message. Server does NOT crash.
    Failure Indicators: Server throws uncaught exception, returns 500, or crashes
    Evidence: .sisyphus/evidence/task-1-unblock-nonexistent.json
  ```

  **Evidence to Capture**:
  - [ ] task-1-unblock-happy.json — Successful resolution
  - [ ] task-1-unblock-missing-id.json — Missing parameter handling
  - [ ] task-1-unblock-nonexistent.json — Error handling for bad ID

  **Commit**: YES
  - Message: `feat(proxy): add /api/resolve-url endpoint with unblock match integration`
  - Files: `proxy-server.js`
  - Pre-commit: N/A

---

- [ ] 2. Set up test infrastructure + integration test

  **What to do**:
  - Create `__tests__/` directory at project root (D:\工作\IDEA\noshRadio\__tests__\)
  - Create `__tests__/proxy-server.test.js` using `node:test` and `node:assert`:
    ```javascript
    const { describe, it, before, after } = require('node:test');
    const assert = require('node:assert');
    const http = require('http');
    ```
  - Write integration tests:
    1. **Test: resolve valid song ID** — `GET /api/resolve-url?id=185709`
       - Assert: HTTP 200, `success: true`, `url` is non-empty string starting with http
       - Assert: `source` is one of allowed sources
    2. **Test: resolve missing id** — `GET /api/resolve-url`
       - Assert: HTTP 400, `success: false`, `error` contains error description
    3. **Test: resolve non-existent id** — `GET /api/resolve-url?id=9999999999`
       - Assert: HTTP 200, `success: false`, `fallback: true`
    4. **Test: CORS headers present** — `GET /api/resolve-url?id=185709`
       - Assert: Response header `access-control-allow-origin` is `*`
  - Each test sends real HTTP requests to the running proxy server (localhost:8081)
  - Add test script to `package.json`:
    ```json
    "scripts": {
      "test": "node --test __tests__/"
    }
    ```
  - **Important**: These tests depend on the unblock server and proxy server already running. Document this pre-condition.

  **Must NOT do**:
  - Do NOT install any test frameworks (mocha, jest, vitest — use only node:test)
  - Do NOT mock or stub the network — tests should hit real servers
  - Do NOT add tests for the UI/frontend code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Well-defined task with clear patterns. Creating a test file with Node.js built-in test runner is straightforward.
  - **Skills**: none needed
  - **Skills Evaluated but Omitted**: All — task is simple and well-scoped

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1 (tests reference the /api/resolve-url endpoint)

  **References**:

  **Pattern References**:
  - Node.js test runner docs: https://nodejs.org/api/test.html
  - Node.js assert docs: https://nodejs.org/api/assert.html

  **WHY Each Reference Matters**:
  - The test runner docs show the `describe`/`it`/`before`/`after` API and how subtests work
  - The assert docs show available assertion methods

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: All tests pass
    Tool: Bash
    Preconditions: proxy-server.js running on port 8081, unblock-music-server.js running on port 30489
    Steps:
      1. Run: `node --test __tests__/proxy-server.test.js`
      2. Check exit code and test output
    Expected Result: Exit code 0. All 4 tests pass (✓). No failures or crashes.
    Failure Indicators: Any test fails, timeout, or the test runner crashes
    Evidence: .sisyphus/evidence/task-2-test-run.txt

  Scenario: Test failure — missing preconditions
    Tool: Bash
    Preconditions: Neither proxy-server nor unblock-server running
    Steps:
      1. Run: `node --test __tests__/proxy-server.test.js`
      2. Check output
    Expected Result: Tests fail gracefully with connection refused errors, not with uncaught exceptions
    Failure Indicators: Process crashes with unhandled rejection, or hangs forever
    Evidence: .sisyphus/evidence/task-2-test-offline.txt
  ```

  **Evidence to Capture**:
  - [ ] task-2-test-run.txt — Full test output showing all pass
  - [ ] task-2-test-offline.txt — Graceful failure when servers are down

  **Commit**: YES (group with Task 1)
  - Message: `test: add integration tests for /api/resolve-url endpoint`
  - Files: `__tests__/proxy-server.test.js`, `package.json`
  - Pre-commit: `node --test __tests__/proxy-server.test.js`

- [ ] 3. Refactor `resolveSongUrl()` to use unblock first

  **What to do**:
  - In `nosh-music-ai.html`, modify `resolveSongUrl()` (line 4919) to:
    1. For songs with `song._source === 'local'` (Netease songs), call `/api/resolve-url?id=${song.id}` FIRST:
       ```javascript
       if (song._source === 'local' || song.id) {
         try {
           const res = await fetch(`/api/resolve-url?id=${song.id}`);
           const data = await res.json();
           if (data.success && data.url) {
             return { url: data.url, source: data.source };
           }
         } catch (e) {
           console.log(`[resolveUrl] unblock失败: ${e.message}`);
         }
       }
       ```
    2. If unblock returns a valid URL → USE IT (skip Netease/Kugou fallbacks)
    3. If unblock fails (success: false or error) → fall back to neteaseFallbackUrl (existing logic)
    4. Keep existing Kugou path for `song._source === 'kugou'` songs unchanged
  - The key change: unblock becomes the FIRST priority for Netease songs, not a last resort

  **Must NOT do**:
  - Do NOT change `searchNeteaseInto()` or `searchKugouInto()` search logic
  - Do NOT change `playFromHistory()`
  - Do NOT remove the Kugou URL resolution path
  - Do NOT change audio event handlers
  - Do NOT touch any CSS or UI styling

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Modifying a critical code path in the frontend. Requires understanding of the full search→resolve→play flow and careful error handling to avoid breaking existing functionality.
  - **Skills**: none needed
  - **Skills Evaluated but Omitted**: All — this is a vanilla JS/HTML app, no framework-specific skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 4
  - **Blocked By**: Task 1 (needs the `/api/resolve-url` endpoint to exist)

  **References**:

  **Pattern References**:
  - `nosh-music-ai.html:4919-4941` — Current `resolveSongUrl()` function. The exact code to modify.
  - `nosh-music-ai.html:5084-5089` — Where `resolveSongUrl()` is called in the search loop. The call site stays the same; only the function internals change.

  **API/Type References**:
  - The new `/api/resolve-url` endpoint response format: `{ success: boolean, url?: string, source?: string, br?: number, error?: string }`

  **WHY Each Reference Matters**:
  - The resolveSongUrl function is the integration point. Read the current implementation to understand the exact flow before modifying
  - The call site shows how the return value is used downstream — must preserve the `{ url, source, albumImg }` return shape

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Netease song resolves through unblock endpoint
    Tool: Bash (curl to simulate frontend behavior) + Read (verify code)
    Preconditions: proxy-server running, unblock server running, user has made the code change
    Steps:
      1. Read `nosh-music-ai.html` around line 4919-4941 to verify the code change
      2. Search for `api/resolve-url` in the file to confirm it's called before the neteaseFallbackUrl check
      3. Run: `curl -s "http://localhost:8081/api/resolve-url?id=185709"` to confirm endpoint works
    Expected Result: Code shows `/api/resolve-url` as the first check for Netease songs. curl returns valid URL from kuwo/kugou/migu.
    Failure Indicators: resolveSongUrl still returns neteaseFallbackUrl without trying unblock first, or the function doesn't call the unblock endpoint
    Evidence: .sisyphus/evidence/task-3-code-verify.txt

  Scenario: Unblock fails — falls back to neteaseFallbackUrl
    Tool: Bash (curl) + Read (verify code)
    Preconditions: Code change made
    Steps:
      1. Read the resolveSongUrl function to verify there's a catch/fallback path
      2. Confirm that `if (data.success && data.url)` guard is present — if unblock returns success:false, the function falls through to neteaseFallbackUrl
    Expected Result: Code shows a try-catch around the unblock fetch, and if it fails/returns success:false, the function continues to the neteaseFallbackUrl check
    Failure Indicators: No fallback path — if unblock fails, the song gets no URL and is skipped
    Evidence: .sisyphus/evidence/task-3-fallback-verify.txt

  Scenario: Kugou songs still use Kugou URL resolution
    Tool: Read (verify code)
    Preconditions: Code change made
    Steps:
      1. Read the resolveSongUrl function
      2. Search for `_source === 'kugou'` — confirm the Kugou URL fetching block still exists and was not modified
    Expected Result: The `if (song._source === 'kugou')` block is still present with the KUGOU_API_BASE fetch, unchanged
    Failure Indicators: Kugou resolution path was removed or modified
    Evidence: .sisyphus/evidence/task-3-kugou-verify.txt
  ```

  **Evidence to Capture**:
  - [ ] task-3-code-verify.txt — Confirms unblock is first resolution path
  - [ ] task-3-fallback-verify.txt — Confirms fallback to neteaseFallbackUrl exists
  - [ ] task-3-kugou-verify.txt — Confirms Kugou path unchanged

  **Commit**: YES (with Task 4)
  - Message: `refactor(frontend): use /api/resolve-url as primary URL resolver`
  - Files: `nosh-music-ai.html`
  - Pre-commit: N/A (no test suite for frontend)

---

- [ ] 4. Simplify `searchAndPlay()` — remove `/netease/song/url` call

  **What to do**:
  - In `searchAndPlay()` (around line 5048-5064), the current code fetches both `/netease/song/url` and `/netease/song/detail` in parallel:
    ```javascript
    const [urlRes, detailRes] = await Promise.all([
      fetch(`${NETEASE_API_BASE}/song/url?id=${song.id}`),
      fetch(`${NETEASE_API_BASE}/song/detail?ids=${song.id}`)
    ]);
    ```
  - **Remove the `/netease/song/url` fetch** — it's no longer needed because `resolveSongUrl` now calls `/api/resolve-url` which handles URL resolution via unblock match
  - Keep the `/netease/song/detail` fetch — it provides `picUrl`, `duration`, and `albumName` which are still needed for UI display
  - Remove the `urlRes` variable and its processing (the `neteaseUrl` variable it populated)
  - Simplify the Promise.all to only fetch detail:
    ```javascript
    const detailRes = await fetch(`${NETEASE_API_BASE}/song/detail?ids=${song.id}`);
    ```
  - When calling `resolveSongUrl(song, neteaseUrl)`, pass empty string for `neteaseFallbackUrl` since we no longer have it:
    ```javascript
    const urlResult = await resolveSongUrl(song, '');
    ```
    Or better, since `resolveSongUrl` now calls unblock first, pass empty string so it always tries unblock.

  **Must NOT do**:
  - Do NOT remove the `/netease/song/detail` call (still needed for picUrl, duration, albumName)
  - Do NOT change the scoring/filtering logic (`getSongScore`, `isHighQualitySong`)
  - Do NOT change how Kugou songs are handled (they don't use this code path anyway since `song._source !== 'kugou'`)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Targeted code removal — remove one API call and simplify the Promise.all. Clear, well-scoped change.
  - **Skills**: none needed
  - **Skills Evaluated but Omitted**: All — straightforward deletion and simplification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 3 (resolveSongUrl must be refactored first since this task relies on URL resolution being handled by unblock)

  **References**:

  **Pattern References**:
  - `nosh-music-ai.html:5048-5064` — The exact code to modify. Lines showing `Promise.all([urlRes, detailRes])`
  - `nosh-music-ai.html:5057-5059` — The `neteaseUrl` population that will be removed
  - `nosh-music-ai.html:5085` — Where `neteaseUrl` is passed to `resolveSongUrl` — change this to empty string

  **WHY Each Reference Matters**:
  - Lines 5048-5054 show the exact Promise.all to simplify
  - Lines 5057-5059 show the neteaseUrl variable that will no longer be needed
  - Line 5085 shows the call site that needs the parameter change

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Verify /netease/song/url call is removed
    Tool: Grep
    Preconditions: Code change made
    Steps:
      1. Run: grep for `song/url` in `nosh-music-ai.html`
      2. Check the results — should only appear in `resolveSongUrl`'s unblock fetch path, NOT in the search loop
    Expected Result: The only remaining `/netease/song/url` or `song/url` reference is in old comments or non-search-loop code. The `Promise.all([urlRes, ...])` is gone.
    Failure Indicators: The old `/netease/song/url` fetch still exists in searchAndPlay
    Evidence: .sisyphus/evidence/task-4-verify-removal.txt

  Scenario: Verify /netease/song/detail call is preserved
    Tool: Grep
    Preconditions: Code change made
    Steps:
      1. Run: grep for `song/detail` in `nosh-music-ai.html`
      2. Check the results
    Expected Result: The `/netease/song/detail` fetch is still present in searchAndPlay (for picUrl, duration, albumName)
    Failure Indicators: The detail call was also removed
    Evidence: .sisyphus/evidence/task-4-detail-preserved.txt
  ```

  **Evidence to Capture**:
  - [ ] task-4-verify-removal.txt — Confirms song/url call removed
  - [ ] task-4-detail-preserved.txt — Confirms song/detail call preserved

  **Commit**: YES (with Task 3)
  - Message: `refactor(frontend): use /api/resolve-url as primary URL resolver`
  - Files: `nosh-music-ai.html`
  - Pre-commit: N/A

---

- [ ] 5. Run full integration verification

  **What to do**:
  - After all code changes are complete, run a comprehensive end-to-end verification:
    1. Start all servers: `node unblock-music-server.js` + `node proxy-server.js`
    2. Run tests: `node --test __tests__/`
    3. Manually verify the search→play flow:
       - Open `http://localhost:8081/` in browser
       - Search for a song (e.g., "七里香 周杰伦")
       - Open browser DevTools Console
       - Verify console shows `[search] ✓ 七里香 -> kuwo` (or kugou/migu — unblock source)
       - Verify the song plays with full duration (not 30s)
    4. Verify Kugou songs still work:
       - Check that Kugou search results still get URLs from the Kugou path
    5. Verify the `/api/resolve-url` endpoint directly:
       - `curl http://localhost:8081/api/resolve-url?id=185709` → valid URL
       - `curl http://localhost:8081/api/resolve-url?id=9999999999` → success:false, fallback:true

  **Must NOT do**:
  - Do NOT make any code changes during verification — this is a read-only verification task
  - Do NOT modify the test files

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: End-to-end verification across multiple components. Requires systematic testing and clear pass/fail documentation.
  - **Skills**: none needed
  - **Skills Evaluated but Omitted**: All — verification task, no specific skill needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Task 4)
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: Task 3, Task 4

  **References**:

  **Pattern References**:
  - All modified files (read final state of each)

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Full integration — search and play a song end-to-end
    Tool: Bash (curl to trigger search) + Playwright (browser)
    Preconditions: All 3 servers running (proxy:8081, netease:3000, unblock:30489). Code changes deployed.
    Steps:
      1. Run: `curl -s "http://localhost:8081/api/resolve-url?id=185709"` — verify unblock endpoint works
      2. Run: `node --test __tests__/` — verify all tests pass
      3. (Browser) Navigate to http://localhost:8081/
      4. (Browser) Type "七里香 周杰伦" in the search box and press Enter
      5. (Browser) Open DevTools Console, look for "[search] ✓" log lines
    Expected Result: Tests pass (exit 0). Unblock endpoint returns valid URL. Console shows songs resolved through unblock sources (kuwo/kugou/migu). Song plays with full duration.
    Failure Indicators: Tests fail. Console shows "[search] 无法获取任何播放URL". Song plays only 30 seconds.
    Evidence: .sisyphus/evidence/task-5-full-integration.txt

  Scenario: Kugou songs still work
    Tool: Bash (curl)
    Preconditions: Proxy server running
    Steps:
      1. Instead of hitting Kugou search directly, verify the Kugou URL resolution path exists in code
      2. Run: `grep -n "KUGOU_API_BASE" nosh-music-ai.html | grep "resolveSongUrl\|_source.*kugou"`
    Expected Result: The Kugou URL resolution path in resolveSongUrl is unchanged
    Failure Indicators: Kugou path was removed or modified
    Evidence: .sisyphus/evidence/task-5-kugou-intact.txt
  ```

  **Evidence to Capture**:
  - [ ] task-5-full-integration.txt — Full integration test results
  - [ ] task-5-kugou-intact.txt — Kugou path verification

  **Commit**: NO (verification only)
  - Message: N/A
  - Files: N/A

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `node --check proxy-server.js` + `node --test __tests__/`. Review all changed files for: try/catch swallows, console.log in prod paths, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (full search→play flow). Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1-2**: `feat(proxy): add /api/resolve-url endpoint with unblock match` + `test: add integration tests` — `proxy-server.js`, `__tests__/proxy-server.test.js`, `package.json`
- **3-4**: `refactor(frontend): use /api/resolve-url as primary URL resolver` — `nosh-music-ai.html`

---

## Success Criteria

### Verification Commands
```bash
# 1. Server-side endpoint works
curl -s "http://localhost:8081/api/resolve-url?id=185709" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(d);console.assert(j.success,'should succeed');console.assert(j.url.startsWith('http'),'should have url');console.log('PASS:',j.source,j.br)"

# 2. Tests pass
node --test __tests__/

# 3. Frontend still works — search and play a song
# (manual: search a song in the app, check console for resolve-unblock calls)
```

### Final Checklist
- [ ] `/api/resolve-url` returns valid URLs for real song IDs
- [ ] `/api/resolve-url` returns graceful errors for bad IDs
- [ ] `node --test __tests__/` all pass
- [ ] Frontend resolves URLs through unblock first
- [ ] Old history entries unaffected
- [ ] Kugou songs still work
- [ ] No regressions in play/pause/next/prev UI
