# NOSH Radio 多音源集成计划

## TL;DR

> **目标**: 解决孙燕姿等歌手歌曲无法播放的问题
> **方案**: 集成 @unblockneteasemusic/server 多音源代理服务
> **效果**: 当网易云返回灰色歌曲时，自动切换到咪咕/酷我/JOOX等音源

## Context

### 原始问题
- NOSH Radio 集成了网易云、酷狗音源
- 孙燕姿等歌手的歌曲在开源项目 AlgerMusicPlayer 能播放，但 NOSH Radio 搜不到且无法播放

### 根因分析
| NOSH Radio | AlgerMusicPlayer |
|-----------|------------------|
| 网易云灰色 → 酷狗搜不到 → 失败 | 网易云灰色 → 自动尝试咪咕/酷我/JOOX → 成功 |
| 2个音源 | 4+个音源自动切换 |

### UnblockNeteaseMusic 支持的音源
- **migu** (咪咕音乐)
- **kugou** (酷狗音乐)
- **kuwo** (酷我音乐)
- **pyncmd** (JOOX)

## Work Objectives

### 核心目标
- 集成 @unblockneteasemusic/server 作为多音源代理
- 当前端播放失败时，自动切换到备用音源

### 具体交付物
1. `unblock-music-server.js` - UnblockNeteaseMusic 服务启动脚本
2. 修改 `proxy-server.js` - 添加 /unblock/* 路由
3. 修改 `nosh-music-ai.html` - 添加多音源 fallback 逻辑

### 定义完成
- [ ] 孙燕姿《绿光》能播放
- [ ] 网易云灰色歌曲自动切换到其他音源
- [ ] 不影响现有正常歌曲的播放

## Execution Strategy

### Wave 1: 服务搭建 (并行)
├── Task 1.1: 安装 @unblockneteasemusic/server 依赖
├── Task 1.2: 创建 unblock-music-server.js 启动脚本
├── Task 1.3: 配置服务端口和音源参数
└── Task 1.4: 启动测试验证服务正常

### Wave 2: 代理层集成 (依赖 Wave 1)
├── Task 2.1: 修改 proxy-server.js 添加 /unblock/* 路由
└── Task 2.2: 测试代理是否正常工作

### Wave 3: 前端Fallback逻辑 (依赖 Wave 2)
├── Task 3.1: 在 nosh-music-ai.html 添加多音源切换逻辑
└── Task 3.2: 实现当网易云/酷狗失败时调用 UnblockNeteaseMusic

### Wave 4: 验证测试
└── Task 4.1: 测试孙燕姿歌曲是否能播放

## TODOs

- [ ] 1. **安装依赖** - 在项目中安装 @unblockneteasemusic/server

  **What to do**:
  - 在项目根目录运行: `npm install @unblockneteasemusic/server`
  - 或在 NeteaseCloudMusicApi 同级目录创建 unblock 服务

  **QA Scenarios**:
  ```
  Scenario: 依赖安装成功
    Bash: npm list @unblockneteasemusic/server
    Expected: 显示已安装版本
  ```

- [ ] 2. **创建服务启动脚本** - 创建 unblock-music-server.js

  **What to do**:
  - 创建 `unblock-music-server.js`:
    ```javascript
    const match = require('@unblockneteasemusic/server');
    const port = process.env.UNBLOCK_PORT || 30489;

    // 启动服务
    match(port, ['migu', 'kugou', 'kuwo', 'pyncmd']);
    console.log(`UnblockNeteaseMusic running on port ${port}`);
    ```

  **QA Scenarios**:
  ```
  Scenario: 服务启动成功
    Bash: node unblock-music-server.js &
    Expected: 显示 "running on port 30489"

  Scenario: 服务健康检查
    Bash: curl http://localhost:30489/
    Expected: 返回服务信息
  ```

- [ ] 3. **修改 proxy-server.js** - 添加 UnblockNeteaseMusic 路由

  **What to do**:
  - 在 proxy-server.js 添加:
    ```javascript
    // 代理 /unblock/* 请求到 UnblockNeteaseMusic
    if (parsedUrl.pathname.startsWith('/unblock')) {
      proxyRequest(req, res, 'localhost', 30489, '/unblock');
      return;
    }
    ```

  **QA Scenarios**:
  ```
  Scenario: 代理路由正常
    Bash: curl http://localhost:8081/unblock/song/1407554603
    Expected: 返回歌曲播放URL(JSON格式)
  ```

- [ ] 4. **前端添加 Fallback 逻辑** - 修改 nosh-music-ai.html

  **What to do**:
  - 找到当前播放 URL 获取逻辑
  - 添加 fallback：当网易云/酷狗返回空 URL 时，调用 /unblock API
  - 示例伪代码:
    ```javascript
    async function getPlayUrl(songId, source) {
      // 先尝试原音源
      let url = await originalGetUrl(songId, source);

      // 如果URL为空，尝试UnblockNeteaseMusic
      if (!url) {
        url = await fetch(`/unblock/song/${songId}`)
          .then(r => r.json())
          .then(data => data.url);
      }
      return url;
    }
    ```

  **References**:
  - `nosh-music-ai.html:3129` - 当前 song._source 判断逻辑
  - `nosh-music-ai.html:3310` - platform 选择逻辑

  **QA Scenarios**:
  ```
  Scenario: 网易云灰色歌曲自动切换
    步骤:
      1. 搜索 "孙燕姿 绿光"
      2. 播放歌曲
      3. 验证URL来自备用音源(咪咕/酷我等)
    Expected: 能正常播放，URL不是空值

  Scenario: 正常歌曲不受影响
    步骤:
      1. 搜索 "周杰伦 晴天"
      2. 播放歌曲
      3. 验证URL来自网易云
    Expected: 正常播放，不走fallback
  ```

- [ ] 5. **测试孙燕姿歌曲** - 验证集成效果

  **What to do**:
  - 测试歌曲: 孙燕姿《绿光》《逆光》《遇见》《天黑黑》
  - 验证能搜到且能播放

  **QA Scenarios**:
  ```
  Scenario: 孙燕姿 - 绿光
    Tool: curl
    步骤: curl http://localhost:8081/unblock/song/1407554603
    Expected: 返回包含 url 字段的 JSON

  Scenario: 完整播放测试
    步骤:
      1. 启动所有服务
      2. 打开 nosh-music-ai.html
      3. 搜索 "孙燕姿 绿光"
      4. 点击播放
    Expected: 能听到歌曲，进度条走动
  ```

## Final Verification Wave

- [ ] F1. **功能验证** - `oracle`
  验证孙燕姿歌曲《绿光》能否播放

- [ ] F2. **回归测试** - `unspecified-high`
  验证周杰伦等正常歌曲不受影响

## Commit Strategy

- 1: `feat(music): add multi-source fallback with UnblockNeteaseMusic`
  - Files: unblock-music-server.js, proxy-server.js, nosh-music-ai.html

## Success Criteria

### 验证命令
```bash
# 1. 服务启动
node unblock-music-server.js

# 2. API测试
curl http://localhost:30489/song/1407554603

# 3. 代理测试
curl http://localhost:8081/unblock/song/1407554603
```

### 验收标准
- [ ] UnblockNeteaseMusic 服务正常启动
- [ ] 代理路由 /unblock/* 正常工作
- [ ] 孙燕姿《绿光》能搜到且能播放
- [ ] 现有歌曲播放不受影响