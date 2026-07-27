/**
 * Kugou Provider - 基于 Listen1 架构
 * 支持搜索和播放 KuGou 音乐
 *
 * API来源: Listen1 Chrome Extension (kugou.js)
 * https://github.com/listen1/listen1_chrome_extension
 */

const axios = require('axios');
const crypto = require('crypto');

class KugouProvider {
  static get meta() {
    return {
      id: 'kugou',
      name: 'KuGou Music',
      supportPlayback: true,
      supportSearch: true,
      supportPlaylist: true
    };
  }

  /**
   * 搜索歌曲
   * @param {string} keyword - 搜索关键词
   * @param {number} page - 页码 (从1开始)
   * @param {number} pageSize - 每页数量
   * @returns {Promise<{songs: Array, total: number}>}
   */
  static async search(keyword, page = 1, pageSize = 20) {
    const targetUrl = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}`;

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.kugou.com/',
        'Origin': 'https://www.kugou.com'
      }
    });

    const data = response.data;
    if (!data.data || !data.data.lists) {
      return { songs: [], total: 0 };
    }

    const total = data.data.total;
    const songs = data.data.lists.map(song => this._convertSong(song));

    return { songs, total };
  }

  /**
   * 搜索歌单
   * @param {string} keyword - 搜索关键词
   * @param {number} page - 页码
   * @returns {Promise<{playlists: Array, total: number}>}
   */
  static async searchPlaylist(keyword, page = 1) {
    const targetUrl = `http://mobilecdnbj.kugou.com/api/v3/search/special?keyword=${encodeURIComponent(keyword)}&pagesize=20&filter=0&page=${page}`;

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'http://m.kugou.com'
      }
    });

    const data = response.data;
    if (!data.data || !data.data.info) {
      return { playlists: [], total: 0 };
    }

    const total = data.data.total;
    const playlists = data.data.info.map(item => ({
      id: `kgplaylist_${item.specialid}`,
      title: item.specialname,
      author: item.nickname,
      cover: item.imgurl ? item.imgurl.replace('{size}', '400') : '',
      songCount: item.songcount,
      source: 'kugou',
      sourceUrl: `https://www.kugou.com/yy/special/single/{size}.html`.replace('{size}', item.specialid)
    }));

    return { playlists, total };
  }

  /**
   * 获取歌曲播放URL
   * 使用 wwwapi.kugou.com play/getdata API（对照 lx-music-source / listen1 方案）
   * @param {string} trackId - 歌曲ID (格式: kgtrack_{hash})
   * @param {string} albumId - 专辑ID (可选)
   * @returns {Promise<{url: string, bitrate: number, platform: string}|null>}
   */
  static async getPlayUrl(trackId, albumId) {
    const hash = trackId.replace('kgtrack_', '');
    if (!hash) return null;

    // 生成随机设备ID（mid），模拟客户端请求
    const mid = crypto.createHash('md5').update(`${Date.now()}_${Math.random()}`).digest('hex');

    // 方案A: wwwapi 主接口（lx-music-source / listen1 通用方案）
    let targetUrl = `https://wwwapi.kugou.com/yy/index.php?r=play/getdata`;
    targetUrl += `&hash=${hash}`;
    targetUrl += `&album_id=${albumId || ''}`;
    targetUrl += `&mid=${mid}&platid=4&_=${Date.now()}`;

    try {
      const response = await axios.get(targetUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.kugou.com/',
          'Cookie': `kg_mid=${mid}`
        }
      });

      const data = response.data;
      // wwwapi response: { status: 1, err_code: 0, data: { play_url: '...', img: '...' } }
      if (data && data.status === 1 && data.err_code === 0 && data.data) {
        // play_url 字段名，部分版本返回 url 字段
        const playUrl = data.data.play_url || data.data.url || '';
        if (playUrl) {
          // 将 http 升级为 https
          const secureUrl = playUrl.startsWith('http://') ? playUrl.replace('http://', 'https://') : playUrl;
          return {
            url: secureUrl,
            bitrate: data.data.bitrate || 128,
            platform: 'kugou',
            albumImg: data.data.img || data.data.album_img || ''
          };
        }
      }

      // 方案B: 如果主接口返回 need auth（20028/30020），尝试 trackercdn 兜底
      if (data && (data.err_code === 20028 || data.err_code === 30020)) {
        console.log(`[kugou] wwwapi 需要验证(${data.err_code})，尝试 trackercdn 兜底`);
        const key = crypto.createHash('md5').update(`${hash}kgcloudv2`).digest('hex');
        let fallbackUrl = `http://trackercdn.kugou.com/i/v2/?key=${key}&hash=${hash}&appid=1005&pid=2&cmd=25&behavior=play`;
        if (albumId) fallbackUrl += `&album_id=${albumId}`;

        const fbResponse = await axios.get(fallbackUrl, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.kugou.com/'
          }
        });
        const fbData = fbResponse.data;
        if (fbData && fbData.url && Array.isArray(fbData.url) && fbData.url[0]) {
          return {
            url: fbData.url[0],
            bitrate: 128,
            platform: 'kugou',
            albumImg: fbData.album_img || ''
          };
        }
      }
    } catch (error) {
      console.error(`Kugou getPlayUrl error (hash=${hash}):`, error.message);
    }
    return null;
  }

  /**
   * 获取歌单详情
   * @param {string} playlistId - 歌单ID (格式: kgplaylist_{id})
   * @returns {Promise<{info: Object, tracks: Array}>}
   */
  static async getPlaylist(playlistId) {
    const listId = playlistId.replace('kgplaylist_', '');
    const targetUrl = `https://m.kugou.com/plist/list/${listId}?json=true`;

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://m.kugou.com/'
      }
    });

    const data = response.data;
    const info = {
      id: `kgplaylist_${data.info.list.specialid}`,
      title: data.info.list.specialname,
      cover: data.info.list.imgurl ? data.info.list.imgurl.replace('{size}', '400') : '',
      source: 'kugou',
      sourceUrl: `https://www.kugou.com/yy/special/single/{size}.html`.replace('{size}', data.info.list.specialid)
    };

    // 获取每首歌的详细信息
    const tracks = await Promise.all(
      data.list.list.info.map(async (item) => {
        const track = {
          id: `kgtrack_${item.hash}`,
          title: '',
          artist: '',
          artistId: '',
          album: '',
          albumId: `kgalbum_${item.album_id}`,
          source: 'kugou',
          sourceUrl: `https://www.kugou.com/song/#hash=${item.hash}&album_id=${item.album_id}`,
          lyricUrl: item.hash
        };

        // 获取完整信息
        try {
          const songInfoUrl = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${item.hash}`;
          const songInfoRes = await axios.get(songInfoUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              'Referer': 'https://m.kugou.com/'
            }
          });
          const songInfo = songInfoRes.data;
          track.title = songInfo.songName || item.filename.split('-')[1]?.trim() || '';
          track.artist = songInfo.singerId === 0 ? '未知' : songInfo.singerName || '';
          track.artistId = songInfo.singerId ? `kgartist_${songInfo.singerId}` : '';
          track.album = songInfo.album_img ? '' : '';
        } catch (e) {
          // 从filename解析
          const parts = item.filename.split('-');
          track.artist = parts[0]?.trim() || '';
          track.title = parts[1]?.trim() || item.filename;
        }

        return track;
      })
    );

    return { info, tracks };
  }

  /**
   * 解析URL识别类型
   * @param {string} url - 歌单URL
   * @returns {Object|null}
   */
  static parseUrl(url) {
    // https://www.kugou.com/yy/special/single/{size}.html
    const match = /\/\/www.kugou.com\/yy\/special\/single\/([0-9]+).html/.exec(url);
    if (match) {
      return {
        type: 'playlist',
        id: `kgplaylist_${match[1]}`
      };
    }
    return null;
  }

  /**
   * 获取歌词
   * 使用 krcs.kugou.com 搜索 + lyrics.kugou.com 下载
   * @param {string} trackId - 歌曲ID (kgtrack_{hash})
   * @returns {Promise<{lyric: string}|null>}
   */
  static async getLyric(trackId) {
    const hash = trackId.replace('kgtrack_', '');
    const searchUrl = `http://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=&duration=&hash=${hash}`;

    try {
      // 1. 搜索歌词候选
      const searchRes = await axios.get(searchUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.kugou.com/'
        }
      });

      const searchData = searchRes.data;
      if (searchData.status !== 200 || !searchData.candidates || searchData.candidates.length === 0) {
        return { lyric: '' };
      }

      // 取第一个候选
      const candidate = searchData.candidates[0];
      const { id, accesskey } = candidate;
      if (!id || !accesskey) return { lyric: '' };

      // 2. 下载 LRC 格式歌词
      const dlUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${id}&accesskey=${accesskey}&fmt=lrc&charset=utf8`;
      const dlRes = await axios.get(dlUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.kugou.com/'
        }
      });

      const dlData = dlRes.data;
      if (dlData.status === 200 && dlData.content) {
        const lrcText = Buffer.from(dlData.content, 'base64').toString('utf-8');
        return { lyric: lrcText };
      }

      return { lyric: '' };
    } catch (error) {
      console.error('Kugou getLyric error:', error.message);
      return { lyric: '' };
    }
  }

  /**
   * 获取推荐歌单
   * @param {number} offset - 偏移
   * @returns {Promise<Array>}
   */
  static async showPlaylist(offset = 0) {
    const page = Math.floor(offset / 30) + 1;
    const targetUrl = `https://m.kugou.com/plist/index&json=true&page=${page}`;

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://m.kugou.com/'
      }
    });

    const data = response.data;
    return data.plist.list.info.map(item => ({
      id: `kgplaylist_${item.specialid}`,
      title: item.specialname,
      cover: item.imgurl ? item.imgurl.replace('{size}', '400') : '',
      source: 'kugou',
      sourceUrl: `https://www.kugou.com/yy/special/single/{size}.html`.replace('{size}', item.specialid)
    }));
  }

  // ========== 私有方法 ==========

  /**
   * 转换歌曲数据格式
   * @private
   */
  static _convertSong(song) {
    let singerId = song.SingerId;
    let singerName = song.SingerName;

    if (song.SingerId instanceof Array) {
      [singerId] = song.SingerId;
      [singerName] = song.SingerName.split('、');
    }

    return {
      id: `kgtrack_${song.FileHash}`,
      title: song.SongName,
      artist: singerName || '',
      artistId: singerId ? `kgartist_${singerId}` : '',
      album: song.AlbumName || '',
      albumId: song.AlbumID ? `kgalbum_${song.AlbumID}` : '',
      source: 'kugou',
      sourceUrl: `https://www.kugou.com/song/#hash=${song.FileHash}&album_id=${song.AlbumID}`,
      imgUrl: (song.trans_param && song.trans_param.union_cover) ? song.trans_param.union_cover.replace('{size}', '400') : '',
      duration: song.Duration || 0,
      hash: song.FileHash,
      hqHash: song.HQFileHash || '',
      sqHash: song.SQFileHash || '',
      album_id: song.AlbumID || ''
    };
  }
}

module.exports = KugouProvider;