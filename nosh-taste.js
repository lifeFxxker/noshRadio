// nosh-taste.js — 品味系统存储层
// 所有数据存储在 localStorage，与任何平台账号无关

const STORAGE_KEYS = {
  USER_PROFILE: 'noshUserProfile',
  PLAYLIST: 'noshPlaylist',
  LISTENING_HISTORY: 'noshListeningHistory',
  SETTINGS: 'noshSettings',
  ANONYMOUS_ID: 'noshAnonymousId',
};

// ===== 播放历史（跨刷新持久化）=====
function getPlayHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PLAYLIST + '_history');
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function savePlayHistory(history) {
  try {
    persistData(STORAGE_KEYS.PLAYLIST + '_history', history);
  } catch (e) { console.warn('nosh: savePlayHistory failed', e); }
}

// ===== 独立收藏列表 =====
const FAVORITES_KEY = 'noshFavorites';

function getFavorites() {
  try {
    const data = localStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function saveFavorites(favorites) {
  try {
    persistData(FAVORITES_KEY, favorites);
  } catch (e) { console.warn('nosh: saveFavorites failed', e); }
}

function addFavoriteSong(song) {
  try {
    const favorites = getFavorites();
    // 按 song.id 去重，已存在则跳过
    if (favorites.some(s => s.id === song.id)) return;
    favorites.unshift(song);
    saveFavorites(favorites);
  } catch (e) { console.warn('nosh: addFavoriteSong failed', e); }
}

function removeFavoriteSong(songId) {
  try {
    const favorites = getFavorites();
    saveFavorites(favorites.filter(s => s.id !== songId));
  } catch (e) { console.warn('nosh: removeFavoriteSong failed', e); }
}

function isFavorite(songId) {
  try {
    const favorites = getFavorites();
    return favorites.some(s => s.id === songId);
  } catch (e) { return false; }
}

function getUserProfile() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
}

function saveUserProfile(profile) {
  try {
    // 如果有品味数据（喜欢的歌手/风格），自动标记为已 onboard
    const hasTasteData =
      (profile.artists?.loved?.length > 0) ||
      (profile.demographics?.preferredGenres?.length > 0);
    if (hasTasteData) profile.isOnboarded = true;
    profile.updatedAt = Date.now();
    persistData(STORAGE_KEYS.USER_PROFILE, profile);
  } catch (e) { console.warn('nosh: saveUserProfile failed', e); }
}

function getPlaylist() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PLAYLIST);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
}

function savePlaylist(playlist) {
  try {
    playlist.updatedAt = Date.now();
    persistData(STORAGE_KEYS.PLAYLIST, playlist);
  } catch (e) { console.warn('nosh: savePlaylist failed', e); }
}

function getListeningHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LISTENING_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function addListeningHistory(record) {
  try {
    const history = getListeningHistory();
    history.unshift({ ...record, timestamp: Date.now() });
    if (history.length > 1000) history.splice(1000);
    persistData(STORAGE_KEYS.LISTENING_HISTORY, history);
  } catch (e) { console.warn('nosh: addListeningHistory failed', e); }
}

function clearAllData() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  } catch (e) { console.warn('nosh: clearAllData failed', e); }
}

function getOrCreateUUID() {
  try {
    let uuid = loadData(STORAGE_KEYS.ANONYMOUS_ID);
    if (!uuid) {
      uuid = 'nosh_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      persistData(STORAGE_KEYS.ANONYMOUS_ID, uuid);
    }
    return uuid;
  } catch (e) {
    // 如果连UUID都无法创建，用一个随机字符串作为后备
    return 'nosh_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// ==================== 数据结构 ====================

const DEFAULT_PROFILE = {
  version: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  anonymousId: '',

  demographics: {
    preferredGenres: [],
    dislikedGenres: [],
    favoriteEras: [],
    moodPreferences: [],
    languagePreference: 'all',
  },

  artists: {
    favorite: [],
    veryLoved: [],
    loved: [],
    liked: [],
    neutral: [],
    skipped: [],
  },
  artistWeights: {},
  artistPlayCounts: {},

  features: {
    energy: 0.5,
    tempo: 0.5,
    mood: 0.5,
    vocals: 0.5,
    complexity: 0.5,
  },

  stats: {
    totalPlays: 0,
    totalLikes: 0,
    totalSkips: 0,
    favoriteHour: null,
    recentlyPlayed: [],
  },

  isOnboarded: false,
};

function initUserProfile() {
  let profile = getUserProfile();
  if (!profile) {
    profile = { ...DEFAULT_PROFILE, anonymousId: getOrCreateUUID() };
    saveUserProfile(profile);
  }
  return profile;
}

function getProfile() {
  const cached = getUserProfile();
  if (!cached) return initUserProfile();
  // 兼容旧缓存：深层合并缺省字段，防止 stats/features 等不存在导致崩溃
  return {
    ...DEFAULT_PROFILE,
    ...cached,
    stats: { ...DEFAULT_PROFILE.stats, ...(cached.stats || {}) },
    demographics: { ...DEFAULT_PROFILE.demographics, ...(cached.demographics || {}) },
    artists: { ...DEFAULT_PROFILE.artists, ...(cached.artists || {}) },
    features: { ...DEFAULT_PROFILE.features, ...(cached.features || {}) },
    detectedGenres: cached.detectedGenres || {},
    detectedArtists: cached.detectedArtists || [],
  };
}

// ==================== 歌单 ====================

function createPlaylist(songs, tasteSnapshot) {
  const playlist = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'pl_' + Date.now(),
    name: '我的 NOSH 歌单',
    description: '根据你的品味生成的个性化歌单',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    songs: songs || [],
    tasteSnapshot: tasteSnapshot || null,
  };
  savePlaylist(playlist);
  return playlist;
}

function addSongToPlaylist(song) {
  const playlist = getPlaylist();
  if (!playlist) return;
  playlist.songs.push(song);
  savePlaylist(playlist);
}

function addSongToPlaylistOrCreate(song) {
  let playlist = getPlaylist();
  if (!playlist) {
    playlist = createPlaylist([], null);
  }
  // 去重检查（统一转字符串避免数字 vs 字符串类型不匹配）
  if (song && song.id && playlist.songs.some(s => String(s.id) === String(song.id))) {
    return;
  }
  // 再按 歌名+歌手 兜底检查（不同搜索来源 id 可能完全不一样）
  if (song && song.name) {
    const dup = playlist.songs.some(s =>
      s.name === song.name && s.artist === song.artist
    );
    if (dup) return;
  }
  playlist.songs.push(song);
  savePlaylist(playlist);
}

function clearPlaylist() {
  const playlist = getPlaylist();
  if (playlist) {
    playlist.songs = [];
    playlist.updatedAt = Date.now();
    savePlaylist(playlist);
  }
}

function removeSongFromPlaylist(index) {
  const playlist = getPlaylist();
  if (!playlist || !playlist.songs || index < 0 || index >= playlist.songs.length) return;
  const removed = playlist.songs.splice(index, 1);
  playlist.updatedAt = Date.now();
  savePlaylist(playlist);
  return removed[0];
}

function getSongById(songId) {
  const playlist = getPlaylist();
  if (!playlist) return null;
  return playlist.songs.find(s => s.id === songId) || null;
}

function updateSongLiked(songId, liked) {
  const playlist = getPlaylist();
  if (!playlist) return;
  const song = playlist.songs.find(s => s.id === songId);
  if (song) {
    song.liked = liked;
    savePlaylist(playlist);
  }
}

// ==================== 品味更新 ====================

function updateArtistWeight(artistName, delta) {
  if (!artistName || !artistName.trim()) return;
  // 拆分多歌手名：网易云返回 "周杰伦, 杨瑞代"，拆成 ["周杰伦", "杨瑞代"]
  const names = artistName.split(/\s*[,，]\s*/).map(s => s.trim()).filter(Boolean);
  if (names.length === 0) return;

  const profile = getProfile();
  profile.artistWeights = profile.artistWeights || {};
  profile.artistPlayCounts = profile.artistPlayCounts || {};
  profile.artists = profile.artists || { favorite: [], veryLoved: [], loved: [], liked: [], neutral: [], skipped: [] };

  for (const singleName of names) {
    const oldWeight = profile.artistWeights[singleName] || 0;
    const newWeight = oldWeight * 0.8 + delta;
    profile.artistWeights[singleName] = newWeight;

    // 累计播放次数（仅正向操作）
    if (delta > 0) {
      profile.artistPlayCounts[singleName] = (profile.artistPlayCounts[singleName] || 0) + delta;
    }

    // 清除该歌手在所有列表中的旧记录
    ['favorite', 'veryLoved', 'loved', 'liked', 'neutral', 'skipped'].forEach(list => {
      profile.artists[list] = (profile.artists[list] || []).filter(a => a !== singleName);
    });

    // 根据累计播放次数分级
    const playCount = profile.artistPlayCounts[singleName] || 0;
    if (playCount >= 30) profile.artists.favorite.unshift(singleName);
    else if (playCount >= 10) profile.artists.veryLoved.unshift(singleName);
    else if (playCount >= 3) profile.artists.loved.unshift(singleName);
    else if (newWeight >= 1) profile.artists.liked.unshift(singleName);
    else if (newWeight <= -1) profile.artists.skipped.unshift(singleName);
    else profile.artists.neutral.push(singleName);
  }

  saveUserProfile(profile);
}

function updateStats(action, songId) {
  const profile = getProfile();
  if (action === 'play') profile.stats.totalPlays++;
  else if (action === 'like') profile.stats.totalLikes++;
  else if (action === 'skip') profile.stats.totalSkips++;

  if (songId) {
    profile.stats.recentlyPlayed = [songId, ...(profile.stats.recentlyPlayed || []).filter(id => id !== songId)].slice(0, 10);
  }
  saveUserProfile(profile);
}

function updateDemographics(demographics) {
  const profile = getProfile();
  profile.demographics = { ...profile.demographics, ...demographics };
  saveUserProfile(profile);
}

// ==================== 行为追踪 ====================

function trackPlay(song) {
  addListeningHistory({ songId: song.id, songName: song.name, artist: song.artist, action: 'play', source: song.source || 'unknown' });
  updateArtistWeight(song.artist, 1);
  updateStats('play', song.id);
}

function trackSkip(song) {
  addListeningHistory({ songId: song.id, songName: song.name, artist: song.artist, action: 'skip', source: song.source || 'unknown' });
  updateArtistWeight(song.artist, -1);
  updateStats('skip', song.id);
}

function trackLike(song) {
  addListeningHistory({ songId: song.id, songName: song.name, artist: song.artist, action: 'like', source: song.source || 'unknown' });
  updateArtistWeight(song.artist, 2);
  updateStats('like', song.id);
  updateSongLiked(song.id, true);
}

// ==================== 歌单生成 ====================

function buildQueriesFromProfile(profile) {
  const queries = [];

  if (profile.artists?.loved?.length) {
    profile.artists.loved.slice(0, 5).forEach(artist => {
      queries.push(`${artist} 热门歌曲`);
      queries.push(`${artist} 经典`);
    });
  }

  if (profile.demographics?.preferredGenres?.length) {
    profile.demographics.preferredGenres.slice(0, 3).forEach(genre => {
      queries.push(`${genre} 经典歌曲`);
      queries.push(`${genre} 热门推荐`);
    });
  }

  if (profile.demographics?.favoriteEras?.length) {
    profile.demographics.favoriteEras.slice(0, 1).forEach(era => {
      queries.push(`${era} 年代经典华语`);
    });
  }

  queries.push('小众精品推荐');
  queries.push('高评分独立音乐');

  return [...new Set(queries)].slice(0, 10);
}

function rankByTaste(songs, profile) {
  const artistCount = {};

  return songs.map(song => {
    let score = 0;

    // 歌手匹配：通吃多歌手名（song.artist 可能是 "周杰伦, 杨瑞代"）
    const songArtists = (song.artist || '').split(/\s*[,，]\s*/).map(s => s.trim()).filter(Boolean);
    if (profile.artists?.loved?.some(a => songArtists.includes(a) || song.artist.includes(a))) score += 30;
    if (profile.artists?.liked?.some(a => songArtists.includes(a) || song.artist.includes(a))) score += 15;
    if (profile.artists?.skipped?.some(a => songArtists.includes(a) || song.artist.includes(a))) score -= 50;

    // 风格偏好通过 buildQueriesFromProfile 影响搜索关键词起作用，
    // 此处不再依赖 song.tags（搜索API不返回风格标签）
    // 额外增加：如果歌曲来源平台匹配语言偏好，给小幅加分
    if (profile.demographics?.languagePreference) {
      const langPref = profile.demographics.languagePreference;
      if (langPref === '华语' && song._source === 'local') score += 5;
      else if (langPref === '日语' && song._source === 'bilibili') score += 5;
      else if (langPref === 'all') score += 2;
    }

    if (song.duration && (song.duration < 60 || song.duration > 600)) score -= 20;

    // 多歌手名拆分后去重计数
    for (const artist of songArtists) {
      artistCount[artist] = (artistCount[artist] || 0) + 1;
      if (artistCount[artist] > 3) score -= 20 * (artistCount[artist] - 3);
    }

    score += Math.random() * 5;

    return { song, score };
  }).sort((a, b) => b.score - a.score);
}

function buildAddedReason(song, profile) {
  const reasons = [];
  const songArtists = (song.artist || '').split(/\s*[,，]\s*/).map(s => s.trim()).filter(Boolean);
  if (profile.artists?.loved?.some(a => songArtists.includes(a) || song.artist.includes(a))) {
    reasons.push(`你喜欢 ${songArtists.join('、')}`);
  }
  if (profile.demographics?.preferredGenres?.length && profile.demographics.preferredGenres.length > 0) {
    reasons.push('符合你喜欢的风格');
  }
  return reasons.join('，') || '根据你的品味精选';
}

// ==================== AI 上下文 ====================

function buildTasteContext() {
  // 刷新播放历史检测的品味数据
  try { refreshDetectedTaste(); } catch (e) {}

  const profile = getUserProfile();
  if (!profile || !profile.isOnboarded) return '';

  const parts = [];

  if (profile.demographics?.preferredGenres?.length) {
    parts.push(`喜欢的风格: ${profile.demographics.preferredGenres.join(', ')}`);
  }
  // 从播放历史检测到的风格（反映实际收听行为）
  if (profile.detectedGenres && Object.keys(profile.detectedGenres).length > 0) {
    const sorted = Object.entries(profile.detectedGenres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);
    if (sorted.length > 0) {
      parts.push(`常听风格(根据播放统计): ${sorted.join(', ')}`);
    }
  }
  if (profile.demographics?.favoriteEras?.length) {
    parts.push(`偏好的年代: ${profile.demographics.favoriteEras.join(', ')}`);
  }
  if (profile.artists?.loved?.length) {
    parts.push(`喜欢的歌手: ${profile.artists.loved.slice(0, 5).join(', ')}`);
  }
  if (profile.artists?.skipped?.length) {
    parts.push(`不喜欢的: ${profile.artists.skipped.slice(0, 3).join(', ')}`);
  }
  if (profile.demographics?.moodPreferences?.length) {
    parts.push(`收听场景: ${profile.demographics.moodPreferences.join(', ')}`);
  }
  if (profile.stats?.totalPlays) {
    const totalLikes = typeof getFavorites === 'function' ? getFavorites().length : (profile.stats?.totalLikes || 0);
    parts.push(`统计: 共播放${profile.stats.totalPlays}首，收藏${totalLikes}首`);
  }
  // 播放历史中最常听的歌手
  if (profile.detectedArtists && profile.detectedArtists.length > 0) {
    const top = profile.detectedArtists.slice(0, 5).map(a => a.name).join(', ');
    parts.push(`播放最多的歌手: ${top}`);
  }

  if (parts.length === 0) return '';
  return `[用户音乐品味档案]\n${parts.join('\n')}`;
}

// ==================== 品味设置 ====================

function isTasteComplete(profile) {
  if (!profile) return false;
  const d = profile.demographics;
  const hasGenre = d?.preferredGenres?.length > 0;
  const hasArtist = profile.artists?.loved?.length > 0 || profile.artists?.liked?.length > 0;
  return hasGenre || hasArtist;
}

// ==================== [[TASTE:]] 标签工具函数 ====================

function addToLovedArtists(artist) {
  if (!artist || !artist.trim()) return;
  artist = artist.trim();

  // 防超长名：超过 6 字符的可能是 "周杰伦, 杨瑞代" 或 AI 拼凑的多名字串
  if (artist.length > 6) {
    // 尝试按常见分隔符拆分
    const parts = artist.split(/[,，、\s]+/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 6);
    if (parts.length >= 2) {
      const profile = getProfile();
      profile.artists = profile.artists || { loved: [], liked: [], neutral: [], skipped: [] };
      for (const name of parts) {
        if (!profile.artists.loved.includes(name)) {
          profile.artists.loved.push(name);
        }
      }
      saveUserProfile(profile);
      return;
    }

    // 收集已知歌手子串匹配
    const knownArtists = new Set();
    try {
      const pl = typeof getPlaylist === 'function' ? getPlaylist() : null;
      if (pl && pl.songs) pl.songs.forEach(s => {
        if (s.artist) s.artist.split(/[,，]\s*/).forEach(n => knownArtists.add(n.trim()));
      });
      if (typeof getFavorites === 'function') {
        getFavorites().forEach(s => {
          if (s.artist) s.artist.split(/[,，]\s*/).forEach(n => knownArtists.add(n.trim()));
        });
      }
      const p = getProfile();
      const a = p.artists || {};
      (a.loved || []).forEach(n => knownArtists.add(n));
      (a.liked || []).forEach(n => knownArtists.add(n));
    } catch (e) {}

    const matched = [];
    for (const known of knownArtists) {
      if (known.length >= 2 && known.length <= 6 && artist.includes(known)) {
        matched.push(known);
      }
    }
    if (matched.length > 0) {
      const profile = getProfile();
      profile.artists = profile.artists || { loved: [], liked: [], neutral: [], skipped: [] };
      for (const name of matched) {
        if (!profile.artists.loved.includes(name)) {
          profile.artists.loved.push(name);
        }
      }
      saveUserProfile(profile);
      return;
    }

    // 无法拆分的长名直接丢弃，避免乱入
    console.warn(`[nosh] 丢弃无法识别的长歌手名: "${artist}"`);
    return;
  }

  // 正常流程
  const profile = getProfile();
  profile.artists = profile.artists || { loved: [], liked: [], neutral: [], skipped: [] };
  if (!profile.artists.loved.includes(artist)) {
    profile.artists.loved.unshift(artist);
    saveUserProfile(profile);
  }
}

function removeFromLovedArtists(artist) {
  if (!artist || !artist.trim()) return;
  const profile = getProfile();
  profile.artists = profile.artists || { loved: [], liked: [], neutral: [], skipped: [] };
  profile.artists.loved = (profile.artists.loved || []).filter(a => a !== artist);
  saveUserProfile(profile);
}

function addPreferredGenre(genre) {
  if (!genre || !genre.trim()) return;
  const profile = getProfile();
  profile.demographics = profile.demographics || {};
  profile.demographics.preferredGenres = profile.demographics.preferredGenres || [];
  if (!profile.demographics.preferredGenres.includes(genre)) {
    profile.demographics.preferredGenres.push(genre);
    saveUserProfile(profile);
  }
}

function addDislikedGenre(genre) {
  if (!genre || !genre.trim()) return;
  const profile = getProfile();
  profile.demographics = profile.demographics || {};
  profile.demographics.dislikedGenres = profile.demographics.dislikedGenres || [];
  if (!profile.demographics.dislikedGenres.includes(genre)) {
    profile.demographics.dislikedGenres.push(genre);
    saveUserProfile(profile);
  }
}

function addFavoriteEra(era) {
  if (!era || !era.trim()) return;
  const profile = getProfile();
  profile.demographics = profile.demographics || {};
  profile.demographics.favoriteEras = profile.demographics.favoriteEras || [];
  if (!profile.demographics.favoriteEras.includes(era)) {
    profile.demographics.favoriteEras.push(era);
    saveUserProfile(profile);
  }
}

// ==================== 播放历史风格推断 ====================

// 知名歌手→风格映射（仅常见华语/日语/欧美歌手，覆盖大部分场景）
const KNOWN_ARTIST_GENRES = {
  // 华语流行
  '周杰伦': '华语流行', '林俊杰': '华语流行', '王力宏': '华语流行', '陶喆': '华语流行',
  '蔡依林': '华语流行', '孙燕姿': '华语流行', '张惠妹': '华语流行', '萧亚轩': '华语流行',
  '陈奕迅': '华语流行', '王菲': '华语流行', '那英': '华语流行', '刘若英': '华语流行',
  '五月天': '华语摇滚', '苏打绿': '华语独立', '鱼丁糸': '华语独立',
  '林宥嘉': '华语流行', '杨丞琳': '华语流行', '田馥甄': '华语流行',
  '邓紫棋': '华语流行', '李荣浩': '华语流行', '薛之谦': '华语流行',
  '毛不易': '华语民谣', '赵雷': '华语民谣', '朴树': '华语民谣',
  '李健': '华语民谣', '许巍': '华语摇滚',
  // 华语R&B/嘻哈
  '方大同': 'R&B', '王嘉尔': '嘻哈', 'Higher Brothers': '嘻哈',
  'VAVA': '嘻哈', 'GAI': '嘻哈',
  // 日语
  '米津玄师': '日语流行', 'YOASOBI': '日语流行', 'Aimer': '日语流行',
  '宇多田光': '日语流行', '仓木麻衣': '日语流行', '滨崎步': '日语流行',
  'RADWIMPS': '日语摇滚', 'ONE OK ROCK': '日语摇滚',
  '久石让': '日语古典', '坂本龙一': '日语古典',
  'LiSA': '日语流行', 'ReoNa': '日语流行', 'Ado': '日语流行',
  // 欧美
  'Taylor Swift': '欧美流行', 'Adele': '欧美流行', 'Ed Sheeran': '欧美流行',
  'Billie Eilish': '欧美流行', 'Lady Gaga': '欧美流行',
  'Bruno Mars': '欧美流行', 'Rihanna': '欧美流行',
  'The Beatles': '欧美摇滚', 'Queen': '欧美摇滚', 'Pink Floyd': '欧美摇滚',
  'Coldplay': '欧美摇滚', 'Linkin Park': '欧美摇滚',
  'Miles Davis': '爵士', 'John Coltrane': '爵士',
  'Beethoven': '古典', 'Mozart': '古典', 'Chopin': '古典',
  'Daft Punk': '电子', 'Marshmello': '电子', 'Martin Garrix': '电子',
  // K-pop
  'BTS': '韩语流行', 'BLACKPINK': '韩语流行', 'TWICE': '韩语流行',
  'IU': '韩语流行', 'BigBang': '韩语流行',
};

/**
 * 从播放历史推断用户真实的风格/歌手偏好
 * 返回 { detectedGenres: {genre: 分数}, topArtists: [{name, plays}] }
 */
function analyzeListeningHistory() {
  const history = typeof getListeningHistory === 'function' ? getListeningHistory() : [];
  if (!history || history.length === 0) return { detectedGenres: {}, topArtists: [] };

  // 只统计 play/like 动作
  const plays = history.filter(h => h.action === 'play' || h.action === 'like');
  if (plays.length === 0) return { detectedGenres: {}, topArtists: [] };

  // 按歌手统计播放次数（拆分多歌手名）
  const artistPlays = {};
  const sourceStats = {};

  for (const record of plays) {
    const artists = (record.artist || '').split(/\s*[,，]\s*/).map(s => s.trim()).filter(Boolean);
    for (const a of artists) {
      artistPlays[a] = (artistPlays[a] || 0) + 1;
    }
    // 记录来源平台统计
    const src = record.source || 'unknown';
    sourceStats[src] = (sourceStats[src] || 0) + 1;
  }

  // 按播放次数排序取前20
  const sortedArtists = Object.entries(artistPlays)
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // 风格推断：从知名歌手映射 + 来源平台 + 播放量加权
  const genreScores = {};

  for (const [artist, count] of sortedArtists) {
    const weight = count / (plays.length || 1); // 相对权重 0~1

    // 1. 知名歌手映射
    const mappedGenre = KNOWN_ARTIST_GENRES[artist];
    if (mappedGenre) {
      genreScores[mappedGenre] = (genreScores[mappedGenre] || 0) + weight;
    }

    // 2. 中文名 → 华语（无映射时的兜底）
    if (!mappedGenre && /[\u4e00-\u9fff]/.test(artist)) {
      genreScores['华语'] = (genreScores['华语'] || 0) + weight * 0.5;
    }
  }

  // 3. 来源平台信号
  const totalSource = Object.values(sourceStats).reduce((a, b) => a + b, 0) || 1;
  for (const [src, count] of Object.entries(sourceStats)) {
    const ratio = count / totalSource;
    if (src === 'bilibili' && ratio > 0.3) {
      genreScores['日语/动漫'] = (genreScores['日语/动漫'] || 0) + ratio * 0.4;
    } else if ((src === 'local' || src === 'netease') && ratio > 0.3) {
      genreScores['华语流行'] = (genreScores['华语流行'] || 0) + ratio * 0.3;
    }
  }

  // 归一化并过滤低分
  const maxScore = Math.max(...Object.values(genreScores), 0.01);
  const normalizedGenres = {};
  for (const [genre, score] of Object.entries(genreScores)) {
    const normalized = Math.round((score / maxScore) * 100);
    if (normalized >= 10) { // 低于10分的不展示
      normalizedGenres[genre] = normalized;
    }
  }

  const topArtists = sortedArtists.slice(0, 10).map(([name, plays]) => ({
    name,
    plays,
  }));

  return { detectedGenres: normalizedGenres, topArtists };
}

/**
 * 刷新 profile 中的 detectedGenres/detectedArtists
 * 每次调用重新计算播放历史，写入 profile 供名片和 AI 上下文使用
 */
function refreshDetectedTaste() {
  const profile = getProfile();
  const result = analyzeListeningHistory();
  profile.detectedGenres = result.detectedGenres;
  profile.detectedArtists = result.topArtists;
  saveUserProfile(profile);
  return result;
}
