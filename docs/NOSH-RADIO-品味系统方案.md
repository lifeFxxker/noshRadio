# NOSH RADIO 用户品味系统与智能歌单方案

> 创建时间：2026-05-07
> 项目：NOSH RADIO 音乐电台

---

## 一、核心目标

1. **首次访问时**：AI 通过对话了解用户品味，生成一份完整的个性化歌单（10-20首）
2. **持续学习**：通过用户的播放、跳过、点赞等行为不断更新品味画像
3. **持久化**：下次访问时 AI 记得用户的风格和偏好
4. **推荐进化**：越听越懂你，推荐越来越精准

---

## 二、数据存储方案

### 2.1 推荐方案：localStorage

**原因**：
- 项目已是纯前端 HTML，无需任何后端
- 已有的登录状态也在用 localStorage，技术统一
- MVP 阶段快速验证最重要
- 用户画像数据量很小（几KB）

**存储 Keys**：
```javascript
noshUserProfile      // 用户品味画像
noshPlaylist         // 当前播放歌单
noshListeningHistory // 听歌历史
noshSettings         // 用户设置
```

### 2.2 localStorage 容量
- 每个域名的 localStorage 限制约 **5MB**
- 用户画像数据预计 < 100KB，足够使用

### 2.3 进阶方案（未来可升级）

| 方案 | 容量 | 跨设备 | 适用场景 |
|------|------|--------|----------|
| localStorage | ~5MB | ❌ 仅本浏览器 | 单设备 MVP |
| IndexedDB | ~50MB+ | ❌ 仅本浏览器 | 大量数据 |
| Firebase/Supabase | 无限制 | ✅ 多设备 | 多设备同步 |

**设计原则**：数据结构抽象好，存储层可插拔。今天用 localStorage，明天换 Firebase 只需改存储函数，不影响业务逻辑。

---

## 三、数据架构设计

### 3.1 用户品味画像 (User Taste Profile)

```javascript
// localStorage key: 'noshUserProfile'
{
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,

  // 人口统计学偏好（用户主动选择）
  demographics: {
    preferredGenres: ['jazz', 'lofi'],      // 喜欢的风格
    dislikedGenres: ['hiphop', 'metal'],   // 不喜欢的风格
    favoriteEras: ['80s', '90s'],          // 喜欢的年代
    moodPreferences: ['calm', 'focus'],    // 场景偏好
  },

  // 艺术家偏好（从行为推断）
  artists: {
    loved: ['周杰伦', '披头士'],            // 明确喜欢
    liked: ['林俊杰', '王菲'],              // 比较喜欢
    neutral: ['五月天'],                    // 中立
    skipped: ['XXX']                        // 跳过/不喜欢
  },

  // 音乐特征向量（雷达图）
  features: {
    energy: 0.7,        // 0-1 能量感
    tempo: 0.5,         // 0-1 节拍快慢
    mood: 0.6,          // 0-1 欢快-悲伤
    vocals: 0.8,         // 0-1 器乐-人声
    complexity: 0.4,   // 0-1 简单-复杂
  },

  // 听歌历史（用于学习）
  listeningHistory: [
    { songId: 'xxx', artist: 'xxx', timestamp: xxx, action: 'play|skip|like|dislike' }
  ],

  // 统计摘要
  stats: {
    totalPlays: 120,
    totalLikes: 35,
    totalSkips: 12,
    favoriteHour: 22,        // 最常听歌的时间段
    recentlyPlayed: ['song1', 'song2', 'song3'], // 最近播放
  },

  // AI对话记忆（关键！）
  aiMemory: [
    { role: 'user', content: '我喜欢周杰伦和古典音乐' },
    { role: 'assistant', content: '好的，我已经记录了你的品味偏好' }
  ]
}
```

### 3.2 歌单数据结构 (Playlist)

```javascript
// localStorage key: 'noshPlaylist'
{
  id: 'uuid',
  name: '为你量身定制的NOSH歌单',
  description: '根据你的品味生成的个性化歌单',
  createdAt: timestamp,
  updatedAt: timestamp,
  isDefault: true,  // 是否是当前默认播放的歌单

  songs: [
    {
      id: 'netease_123456',
      name: '晴天',
      artist: '周杰伦',
      album: '叶惠美',
      duration: 267,
      picUrl: 'https://...',
      url: 'https://...',        // 播放URL
      source: 'netease',
      addedReason: '你喜欢周杰伦，这首歌很符合你的复古情怀偏好',
      tags: ['pop', '90s', 'romantic'],
      playCount: 0,
      liked: false,
    }
  ],

  // 歌单生成时的品味依据
  tasteSnapshot: {
    topGenres: ['pop', 'jazz'],
    topArtists: ['周杰伦', '披头士'],
    targetMood: 'calm',
  }
}
```

---

## 四、首次访问：引导式品味探测

### 4.1 AI 引导对话流程

```
┌─────────────────────────────────────────────────────────┐
│                    首次访问引导                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  AI: "我是NOSH，你的专属音乐向导。在开始之前，           │
│       我想更好地了解你，这样我就能为你打造一份           │
│       真正属于你的歌单。"                                │
│                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 🎵 音乐风格  │ │ 🎤 歌手偏好  │ │ ☕ 收听场景  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                         │
│  用户可以选择或直接用自然语言描述：                      │
│  "我喜欢周杰伦、林俊杰，平时工作的时候听"                 │
│                                                         │
│  AI 追问（如果信息不足）：                               │
│  - "有没有特别不喜欢的风格？"                           │
│  - "你更偏好中文还是英文歌曲？"                         │
│  - "有什么特定的年代偏好？"                             │
│                                                         │
│  收集足够信息后：                                        │
│  AI: "明白了！你喜欢华语流行，偏好抒情和复古风格。       │
│       让我为你生成一份专属歌单..."                       │
│                                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│  生成完整歌单（10-20首）                                 │
│  显示歌单详情，让用户确认或调整                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│                                                         │
│  AI: "你的专属歌单已准备好了！这是为你精选的15首歌曲，   │
│       每首都是我根据你的品味精心挑选的。"                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 品味探测问题库

```javascript
const tasteQuestions = [
  // 风格探测
  { q: "你平时喜欢什么类型的音乐？", options: ["流行", "摇滚", "爵士", "古典", "电子", "民谣", "R&B", "嘻哈"] },
  { q: "有没有特别不喜欢的音乐类型？", options: ["重金属", "朋克", "说唱", "乡村"] },
  { q: "更偏好哪个年代的歌曲？", options: ["80年代", "90年代", "2000年代", "2010以后", "不限制"] },

  // 艺术家探测
  { q: "你最喜欢哪位歌手或乐队？", freeText: true },
  { q: "有没有什么歌手是你特别不喜欢的？", freeText: true },

  // 场景探测
  { q: "通常在什么场景下听音乐？", options: ["工作/学习", "运动健身", "休息放松", "通勤路上", "睡前"] },
  { q: "你现在的心情如何？", options: ["开心", "平静", "忧郁", "兴奋", "疲惫"] },

  // 语言偏好
  { q: "偏好什么语言的歌曲？", options: ["中文", "英文", "日文", "韩文", "无所谓"] },
];
```

---

## 五、持续学习机制

### 5.1 行为信号采集

| 行为 | 信号强度 | 记录方式 |
|------|---------|---------|
| 完整播放一首歌 | +3 | 自动记录 |
| 播放且点赞 | +5 | 手动标记 |
| 播放后跳过 | -1 | 自动记录 |
| 立即切歌 | -3 | 强负面信号 |
| 收藏到歌单 | +4 | 手动 |
| 搜索并播放某歌手 | +2 | 自动推断 |

### 5.2 品味更新算法

```javascript
function updateTasteFromAction(song, action) {
  const profile = getUserProfile();

  // 1. 更新艺术家偏好
  const artistWeight = action === 'play' ? 1 : action === 'like' ? 2 : -1;
  updateArtistPreference(song.artist, artistWeight);

  // 2. 更新风格标签
  song.tags.forEach(tag => {
    updateTagPreference(tag, action === 'play' ? 0.5 : action === 'like' ? 1 : -0.5);
  });

  // 3. 更新时间统计
  profile.stats.totalPlays++;
  if (action === 'like') profile.stats.totalLikes++;
  if (action === 'skip') profile.stats.totalSkips++;
  profile.stats.recentlyPlayed = [song.id, ...profile.stats.recentlyPlayed.slice(0, 9)];

  // 4. 更新时间特征（如果是同一首歌播放超过50%，更新能量/情绪特征）
  // ...

  saveUserProfile(profile);
}

function updateArtistPreference(artistName, delta) {
  const profile = getUserProfile();
  if (!profile.artists) profile.artists = { loved: [], liked: [], neutral: [], skipped: [] };

  // 从所有列表中移除
  ['loved', 'liked', 'neutral', 'skipped'].forEach(list => {
    profile.artists[list] = profile.artists[list].filter(a => a !== artistName);
  });

  // 根据增量放入合适的列表
  if (delta >= 3) profile.artists.loved.unshift(artistName);
  else if (delta >= 1) profile.artists.liked.unshift(artistName);
  else if (delta <= -1) profile.artists.skipped.unshift(artistName);
  else profile.artists.neutral.push(artistName);
}
```

### 5.3 AI 对话记忆注入

```javascript
// 在每次AI对话时，将品味信息注入上下文
function buildTasteContext() {
  const profile = getUserProfile();
  if (!profile || !profile.demographics) return '';

  return `
  [用户品味档案]
  喜欢的风格: ${profile.demographics.preferredGenres?.join(', ') || '未知'}
  偏好的年代: ${profile.demographics.favoriteEras?.join(', ') || '无'}
  喜欢的歌手: ${profile.artists?.loved?.slice(0, 5).join(', ') || '未知'}
  不喜欢的: ${profile.artists?.skipped?.slice(0, 3).join(', ') || '无'}
  收听场景: ${profile.demographics.moodPreferences?.join(', ') || '未设置'}

  统计: 共播放${profile.stats.totalPlays}首，收藏${profile.stats.totalLikes}首，跳过${profile.stats.totalSkips}首
  最近播放: ${profile.stats.recentlyPlayed?.slice(0, 3).join(', ') || '无'}
  `;
}

// 在conversationHistory构建时注入
function buildConversationWithTaste() {
  const tasteContext = buildTasteContext();
  const systemPrompt = `你是NOSH，一个音乐电台主播...
  ${tasteContext ? `了解用户品味: ${tasteContext}` : ''}
  `;
  // ... 构建完整对话
}
```

---

## 六、歌单生成算法

### 6.1 生成流程

```javascript
async function generatePlaylist(profile) {
  // 1. 基于品味生成搜索查询
  const queries = buildQueriesFromProfile(profile);
  // 例如: ['周杰伦 晴天', '林俊杰 江南', '90年代 流行', ...]

  // 2. 并行搜索多源（网易云 + 酷狗）
  const searchResults = await Promise.all(
    queries.map(q => searchMultiSource(q))
  );

  // 3. 去重 + 质量过滤
  const filtered = deduplicateAndFilter(searchResults);

  // 4. 排序（优先：喜欢的艺术家 > 喜欢的风格 > 近期热门）
  const sorted = rankByTaste(filtered, profile);

  // 5. 选择前15-20首
  const playlist = sorted.slice(0, 20);

  // 6. 保存歌单
  return savePlaylist(playlist, profile);
}

function buildQueriesFromProfile(profile) {
  const queries = [];

  // 喜欢的艺术家（优先）
  if (profile.artists?.loved) {
    profile.artists.loved.slice(0, 3).forEach(artist => {
      queries.push(`${artist} 热门歌曲`);
    });
  }

  // 喜欢的风格
  if (profile.demographics?.preferredGenres) {
    profile.demographics.preferredGenres.slice(0, 2).forEach(genre => {
      queries.push(`${genre} 经典歌曲`);
    });
  }

  // 偏好的年代
  if (profile.demographics?.favoriteEras) {
    profile.demographics.favoriteEras.slice(0, 1).forEach(era => {
      queries.push(`${era} 年代流行`);
    });
  }

  // 随机补充（探索）
  queries.push('小众精品推荐');
  queries.push('高评分独立音乐');

  return [...new Set(queries)].slice(0, 10);
}
```

### 6.2 品味匹配评分

```javascript
function rankByTaste(songs, profile) {
  return songs.map(song => {
    let score = 0;

    // 艺术家匹配（最重要）
    if (profile.artists?.loved?.some(a => song.artist.includes(a))) {
      score += 30;
    }
    if (profile.artists?.liked?.some(a => song.artist.includes(a))) {
      score += 15;
    }
    if (profile.artists?.skipped?.some(a => song.artist.includes(a))) {
      score -= 50;
    }

    // 风格标签匹配
    const songTags = song.tags || [];
    if (profile.demographics?.preferredGenres) {
      const genreMatch = songTags.filter(t =>
        profile.demographics.preferredGenres.includes(t)
      ).length;
      score += genreMatch * 10;
    }

    // 不喜欢的标签
    if (profile.demographics?.dislikedGenres) {
      const genreMismatch = songTags.filter(t =>
        profile.demographics.dislikedGenres.includes(t)
      ).length;
      score -= genreMismatch * 15;
    }

    // 年代匹配
    if (profile.demographics?.favoriteEras) {
      const eraMatch = songTags.some(t =>
        profile.demographics.favoriteEras.includes(t)
      );
      if (eraMatch) score += 5;
    }

    // 时长过滤（排除太短或太长的）
    if (song.duration < 60000 || song.duration > 600000) {
      score -= 20;
    }

    // 随机性（避免推荐太集中）
    score += Math.random() * 5;

    return { song, score };
  }).sort((a, b) => b.score - a.score);
}
```

---

## 七、UI/UX 设计

### 7.1 首次访问引导界面

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     🎵                        NOSH RADIO                 │
│                                                         │
│  ╔═══════════════════════════════════════════════════╗  │
│  ║                                                   ║  │
│  ║     嗨，我是 NOSH，你的专属音乐向导 🎧            ║  │
│  ║                                                   ║  │
│  ║     在开始之前，让我了解一下你的音乐品味          ║  │
│  ║     这样我就能为你打造一份真正属于你的歌单         ║  │
│  ║                                                   ║  │
│  ║  ┌─────────────────────────────────────────────┐  ║  │
│  ║  │ 你平时喜欢什么类型的音乐？                    │  ║  │
│  ║  │                                             │  ║  │
│  ║  │  [流行] [摇滚] [爵士] [古典]                 │  ║  │
│  ║  │  [电子] [民谣] [R&B] [嘻哈]                  │  ║  │
│  ║  └─────────────────────────────────────────────┘  ║  │
│  ║                                                   ║  │
│  ║  ┌─────────────────────────────────────────────┐  ║  │
│  ║  │ 或者直接告诉我，比如：                       │  ║  │
│  ║  │ "我喜欢周杰伦和林俊杰，平时工作的时候听"    │  ║  │
│  ║  └─────────────────────────────────────────────┘  ║  │
│  ║                                                   ║  │
│  ║  ┌─────────────────────────────────────────────┐  ║  │
│  ║  │ > 我喜欢周杰伦，古典音乐，偶尔听点爵士       │  ║  │
│  ║  └─────────────────────────────────────────────┘  ║  │
│  ║                                                   ║  │
│  ║            [ 开始为我定制歌单 ]                   ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.2 歌单确认界面

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     🎵                        NOSH RADIO                 │
│                                                         │
│  ╔═══════════════════════════════════════════════════╗  │
│  ║           ✨ 你的专属歌单已生成 ✨                ║  │
│  ║                                                   ║  │
│  ║  基于你的品味：周杰伦/古典/爵士                   ║  │
│  ║                                                   ║  │
│  ║  ┌─────────────────────────────────────────────┐  ║  │
│  ║  │ ▶ 1. 晴天 - 周杰伦            4:27  ♡       │  ║  │
│  ║  │ ▶ 2. 夜曲 - 周杰伦            4:32  ♡       │  ║  │
│  ║  │ ▶ 3. 简单爱 - 周杰伦          4:31          │  ║  │
│  ║  │ ▶ 4. 秋日蒙太奇 - 爵士乐      5:12  ♡       │  ║  │
│  ║  │ ▶ 5. 哥德堡变奏曲 - 巴赫      15:00         │  ║  │
│  ║  │   ...                                       │  ║  │
│  ║  └─────────────────────────────────────────────┘  ║  │
│  ║                                                   ║  │
│  ║  共15首歌曲  ▶ 开始播放  ✏️ 调整歌单              ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.3 品味设置面板

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🎛️  我的音乐品味                              │   │
│  ├─────────────────────────────────────────────────┤   │
│  │                                                 │   │
│  │  喜欢的风格                                     │   │
│  │  [流行 ✓] [爵士 ✓] [古典 ✓] [摇滚] [电子]     │   │
│  │                                                 │   │
│  │  偏好的年代                                     │   │
│  │  [80s ✓] [90s ✓] [2000s] [2010后]             │   │
│  │                                                 │   │
│  │  收藏的艺术家                                   │   │
│  │  🧡 周杰伦  🧡 披头士  🧡 林俊杰               │   │
│  │                                                 │   │
│  │  不喜欢的                                       │   │
│  │  🚫 嘻哈  🚫 重金属                            │   │
│  │                                                 │   │
│  │  ─────────────────────────────────────────     │   │
│  │                                                 │   │
│  │  听歌统计                                       │   │
│  │  已播放 156 首  |  收藏 45 首  |  跳过 23 首   │   │
│  │                                                 │   │
│  │  [ 🗑️ 清空品味数据]  [ ✓ 保存更改 ]            │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 八、实施优先级

### Phase 1: 基础数据架构（第1-2周）
- [ ] 设计并实现 `UserProfile` 数据结构
- [ ] 设计并实现 `Playlist` 数据结构
- [ ] 实现 `localStorage` 持久化层
- [ ] 创建品味探测对话流程

### Phase 2: 引导流程（第2-3周）
- [ ] 首次访问引导 UI
- [ ] AI 品味探测对话（使用现有 AI 接口）
- [ ] 基于品味生成歌单
- [ ] 歌单确认和展示 UI

### Phase 3: 学习机制（第3-4周）
- [ ] 行为信号采集（播放/跳过/点赞）
- [ ] 品味更新算法
- [ ] AI 上下文注入（让 AI 记得用户）
- [ ] 品味面板 UI

### Phase 4: 优化与进化（第4-6周）
- [ ] 推荐算法优化
- [ ] 探索机制（避免推荐太单一）
- [ ] 歌单刷新和更新逻辑
- [ ] 数据分析和可视化

---

## 九、关键技术点

### 9.1 品味向量更新
使用指数移动平均，让最近的偏好权重更高：
```javascript
features.energy = features.energy * 0.7 + newValue * 0.3;
```

### 9.2 冷启动策略
新用户没有任何数据时：
1. 使用简单的音乐测试（3首不同风格）
2. 根据用户选择快速建立初始画像
3. 结合时间/地点/情绪做上下文推荐

### 9.3 防止推荐过度集中
```javascript
// 限制同一艺术家的歌曲数量
if (artistCount >= 3) score -= 20;
```

---

## 十、存储层代码示例

```javascript
// ==================== 存储层 ====================

const STORAGE_KEYS = {
  USER_PROFILE: 'noshUserProfile',
  PLAYLIST: 'noshPlaylist',
  LISTENING_HISTORY: 'noshListeningHistory',
  SETTINGS: 'noshSettings'
};

// 获取用户画像
function getUserProfile() {
  const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
  return data ? JSON.parse(data) : null;
}

// 保存用户画像
function saveUserProfile(profile) {
  profile.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
}

// 获取歌单
function getPlaylist() {
  const data = localStorage.getItem(STORAGE_KEYS.PLAYLIST);
  return data ? JSON.parse(data) : null;
}

// 保存歌单
function savePlaylist(playlist) {
  playlist.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify(playlist));
}

// 添加听歌历史
function addListeningHistory(song, action) {
  const history = getListeningHistory();
  history.unshift({
    songId: song.id,
    artist: song.artist,
    songName: song.name,
    action: action,
    timestamp: Date.now()
  });
  // 最多保留1000条
  if (history.length > 1000) history.splice(1000);
  localStorage.setItem(STORAGE_KEYS.LISTENING_HISTORY, JSON.stringify(history));
}

// 获取听歌历史
function getListeningHistory() {
  const data = localStorage.getItem(STORAGE_KEYS.LISTENING_HISTORY);
  return data ? JSON.parse(data) : [];
}

// 清除所有数据
function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}
```

---

## 十一、用户识别与后端设计

### 11.1 用户识别方案对比

| 方案 | 实现难度 | 用户体验 | 跨设备 | 安全性 |
|------|---------|---------|--------|--------|
| **匿名UUID（设备指纹）** | 低 | 免登录 | ❌ | 一般 |
| **平台账号登录（网易云/酷狗）** | 中 | 需登录 | ✅ | 高 |
| **手机号/邮箱登录** | 高 | 需注册 | ✅ | 高 |
| **OAuth（Google/Apple）** | 中 | 一键登录 | ✅ | 高 |

### 11.2 推荐方案：匿名 + 平台登录 双轨制

#### 匿名用户（默认）

```javascript
// 首次访问时生成 UUID，存储在 localStorage
function getOrCreateAnonymousId() {
  let anonId = localStorage.getItem('noshAnonymousId');
  if (!anonId) {
    anonId = 'anon_' + crypto.randomUUID();
    localStorage.setItem('noshAnonymousId', anonId);
  }
  return anonId;
}
```

#### 平台账号登录（网易云/酷狗）

用户登录后，关联匿名ID与平台账号，并合并历史数据。

### 11.3 数据库设计

```sql
-- 用户表
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  anonymous_id VARCHAR(64) UNIQUE,    -- 匿名UUID
  netease_token TEXT,                -- 网易云cookie
  netease_user_id BIGINT,            -- 网易云用户ID
  kugou_token TEXT,                  -- 酷狗token
  kugou_user_id BIGINT,              -- 酷狗用户ID

  -- 唯一识别：优先用平台账号，否则用匿名ID
  CONSTRAINT users_platform UNIQUE (netease_user_id, kugou_user_id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 品味画像表
CREATE TABLE user_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),

  -- 品味数据（JSONB 存储灵活）
  demographics JSONB DEFAULT '{}',    -- 喜欢的风格/年代/场景
  artists JSONB DEFAULT '{}',         -- 艺术家偏好
  features JSONB DEFAULT '{}',         -- 音乐特征向量

  updated_at TIMESTAMP DEFAULT NOW()
);

-- 歌单表
CREATE TABLE playlists (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  name VARCHAR(255) DEFAULT '我的NOSH歌单',
  is_default BOOLEAN DEFAULT false,
  songs JSONB DEFAULT '[]',           -- 歌曲列表
  taste_snapshot JSONB,               -- 生成时的品味快照
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 听歌历史表
CREATE TABLE listening_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  song_id VARCHAR(64),
  song_name VARCHAR(255),
  artist VARCHAR(255),
  action VARCHAR(20),                -- play, skip, like, dislike
  source VARCHAR(20),                -- netease, kugou
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_history_user ON listening_history(user_id);
CREATE INDEX idx_history_action ON listening_history(action);
CREATE INDEX idx_playlists_user ON playlists(user_id);
```

### 11.4 匿名与登录账号合并

```javascript
// 用户首次登录时，合并匿名数据
async function mergeAnonymousData(userId, anonymousId) {
  // 1. 查找匿名用户的历史记录
  const anonymousHistory = await db.query(
    'SELECT * FROM listening_history WHERE user_id = $1',
    [anonymousId]
  );

  // 2. 转移到登录用户
  for (const record of anonymousHistory.rows) {
    await db.query(
      'INSERT INTO listening_history (user_id, song_id, ...) VALUES ($1, $2, ...)',
      [userId, record.song_id, ...]
    );
  }

  // 3. 合并品味画像（如果有）
  const anonProfile = await db.query(
    'SELECT * FROM user_profiles WHERE user_id = $1',
    [anonymousId]
  );

  if (anonProfile.rows.length > 0) {
    // 合并到用户画像（策略：取两者的并集）
  }

  // 4. 删除匿名记录
  await db.query('DELETE FROM listening_history WHERE user_id = $1', [anonymousId]);
  await db.query('DELETE FROM user_profiles WHERE user_id = $1', [anonymousId]);

  // 5. 更新用户表，关联匿名ID
  await db.query(
    'UPDATE users SET anonymous_id = $1 WHERE id = $2',
    [anonymousId, userId]
  );
}
```

### 11.5 识别流程图

```
                    用户请求
                        │
                        ▼
            ┌───────────────────────┐
            │   请求头带什么？        │
            └───────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  有平台Token？                    无Token
        │                               │
        ▼                               ▼
  用平台账号识别              用 anonymous_id
        │                               │
        ▼                               ▼
  查询 users 表            查询 users 表
  (netease_user_id /       (anonymous_id)
   kugou_user_id)
        │                               │
        └───────────────┬───────────────┘
                        ▼
                 找到用户？
                        │
                   ┌────┴────┐
                   ▼         ▼
                 是        否
                  │          │
                  ▼          ▼
              返回用户数据    创建新用户
                  │          │
                  ▼          ▼
              查询/更新    关联 anonymous_id
```

### 11.6 实际使用场景

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  场景1: 用户首次访问（不登录）                          │
│  ────────────────────────────────────                    │
│  • 生成 anonymous_id = 'anon_xxx'                      │
│  • 所有数据关联到这个ID                                 │
│  • localStorage 保存 anonymous_id                       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  场景2: 用户扫码登录网易云                              │
│  ────────────────────────────────────                    │
│  • 获取网易云 cookie/userId                             │
│  • 查找/创建 users 表记录                               │
│  • 合并 anonymous_id 的历史数据                         │
│  • 后续用 netease_user_id 识别                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  场景3: 用户再次访问（已登录）                          │
│  ────────────────────────────────────                    │
│  • 自动带上登录态                                        │
│  • 直接用平台账号识别用户                                │
│  • 跨设备同步（登录同一网易云账号）                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  场景4: 用户退出登录                                    │
│  ────────────────────────────────────                    │
│  • 保留品味数据（关联到 anonymous_id）                   │
│  • 下次登录可重新合并                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 11.7 关键设计原则

1. **匿名优先**：用户可以不登录就用，只是不能跨设备同步
2. **登录可选**：登录后自动合并历史数据
3. **数据可迁移**：品味数据跟人走，不是跟设备走
4. **渐进式**：先匿名快速体验，想同步再登录

---

## 十二、版本记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0 | 2026-05-07 | 初始方案设计 |
| 1.1 | 2026-05-07 | 新增用户识别与后端设计方案 |
