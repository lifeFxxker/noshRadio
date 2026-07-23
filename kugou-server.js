/**
 * Kugou Server - 集成到 NOSH Music AI
 *
 * 提供搜索和播放URL接口，供前端调用
 * 运行在 http://localhost:3001
 */

const express = require('express');
const url = require('url');
const KugouProvider = require('./kugou-provider');

const app = express();
const PORT = 3001;

app.use(express.json());

// CORS 头
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ─── 调试：回显请求详情 ──────────────────────────────────────
app.get('/debug-req', (req, res) => {
  const parsed = url.parse(req.url, true);
  res.json({
    rawUrl: req.url,
    parsedPathname: parsed.pathname,
    parsedSearch: parsed.search,
    parsedQuery: parsed.query,
    expressQuery: req.query,
  });
});

// 搜索歌曲（使用 url.parse 直接解析，不依赖 Express req.query）
app.get('/search', async (req, res) => {
  try {
    const parsed = url.parse(req.url, true);
    const keywords = parsed.query && parsed.query.keywords;
    const limit = parseInt(String(parsed.query?.limit || '20'), 10);
    const page = parseInt(String(parsed.query?.page || '1'), 10);

    console.log(`[kugou] search req.url="${req.url}" parsed.keywords="${keywords}"`);

    if (!keywords) {
      return res.status(400).json({ error: 'keywords required', receivedUrl: req.url, parsedQuery: parsed.query });
    }

    const result = await KugouProvider.search(keywords, page, limit);
    res.json({
      code: 200,
      result: {
        songs: result.songs,
        total: result.total
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取播放URL
app.get('/url', async (req, res) => {
  try {
    const { id, album_id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }

    const playUrl = await KugouProvider.getPlayUrl(id, album_id || '');
    if (playUrl) {
      res.json({
        code: 200,
        data: [{
          url: playUrl.url,
          br: playUrl.bitrate * 1000,
          platform: playUrl.platform,
          albumImg: playUrl.albumImg || ''
        }]
      });
    } else {
      res.json({
        code: 200,
        data: [{ url: null }]
      });
    }
  } catch (error) {
    console.error('Get URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 搜索歌单
app.get('/playlist/search', async (req, res) => {
  try {
    const { keywords, limit = 20, page = 1 } = req.query;
    if (!keywords) {
      return res.status(400).json({ error: 'keywords required' });
    }

    const result = await KugouProvider.searchPlaylist(keywords, page);
    res.json({
      code: 200,
      result: {
        playlists: result.playlists,
        total: result.total
      }
    });
  } catch (error) {
    console.error('Playlist search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取歌单详情
app.get('/playlist', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }

    const playlist = await KugouProvider.getPlaylist(id);
    res.json({
      code: 200,
      result: playlist
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取歌词
app.get('/lyric', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }

    const lyric = await KugouProvider.getLyric(id);
    res.json({
      code: 200,
      lyric: lyric.lyric
    });
  } catch (error) {
    console.error('Get lyric error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 搜索源列表
app.get('/sources', (req, res) => {
  res.json({
    code: 200,
    sources: [
      { id: 'kugou', name: '酷狗音乐', supportSearch: true, supportPlaylist: true }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Kugou API server running at http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log(`  GET /search?keywords=xxx&limit=20&page=1`);
  console.log(`  GET /url?id=kgtrack_xxx`);
  console.log(`  GET /playlist/search?keywords=xxx`);
  console.log(`  GET /playlist?id=kgplaylist_xxx`);
  console.log(`  GET /lyric?id=kgtrack_xxx`);
  console.log(`  GET /sources`);
});