/**
 * Bilibili WBI 签名模块
 *
 * B 站部分 API（如 playurl）需要 WBI 签名鉴权。
 * 算法来源：Bilibili 公开 Web API 逆向（wbi/view 等端点）。
 *
 * 用法：
 *   const wbi = require('./lib/bili-wbi');
 *   const params = await wbi.sign({ bvid: 'BV1xx411c7mD', cid: 12345 });
 *   // => { bvid: '...', cid: '...', wts: '...', w_rid: '...' }
 */
const crypto = require('crypto');
const https = require('https');

// mix_key 分隔符表（B 站官方混淆表，0-63 各出现一次）
const MIXIN_KEY_ENC_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
];

// 缓存 WBI keys
let wbiKeysCache = null;
let wbiKeysExpire = 0;
let cachedBuvid3 = null;

/**
 * 获取或生成 buvid3
 */
async function ensureBuvid3() {
  if (cachedBuvid3) return cachedBuvid3;
  try {
    const res = await new Promise((resolve, reject) => {
      https.get('https://www.bilibili.com', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      }, (r) => {
        let c = [];
        r.on('data', d => c.push(d));
        r.on('end', () => resolve({ headers: r.headers }));
      }).on('error', reject);
    });
    const setCookie = res.headers['set-cookie'] || [];
    for (const cookie of Array.isArray(setCookie) ? setCookie : [setCookie]) {
      const match = cookie.match(/buvid3=([^;]+)/);
      if (match) {
        cachedBuvid3 = match[1];
        return cachedBuvid3;
      }
    }
  } catch(e) { /* fallback */ }
  // 回退：生成随机 buvid3
  const rand = () => Math.random().toString(36).substring(2, 10);
  cachedBuvid3 = `${rand()}${rand()}${rand()}${rand()}infoc`;
  return cachedBuvid3;
}

function getMixinKey(imgKey, subKey) {
  const raw = imgKey + subKey;
  return MIXIN_KEY_ENC_TABLE.map(i => raw[i]).join('').slice(0, 32);
}

/**
 * 从 B 站 nav 接口获取 WBI 密钥
 */
function fetchWbiKeys() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      'https://api.bilibili.com/x/web-interface/nav',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com/'
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            // 即使 code != 0（如 -101 未登录），wbi_img 数据仍然存在
            const navData = data.data;
            const wbiImgData = (navData && navData.wbi_img) || {};
            const imgUrl = wbiImgData.img_url || (navData || {}).wbi_img;
            const subUrl = wbiImgData.sub_url || (navData || {}).wbi_img_sub;
            if (!imgUrl || !subUrl) {
              reject(new Error(`WBI keys not found in nav response (code=${data.code})`));
              return;
            }
            // img_url: "https://i0.hdslb.com/bfs/wbi/7cd08494138d5639.png"
            const imgKey = imgUrl.replace(/^.*\/([^/]+)\.(png|jpg|jpeg)$/, '$1');
            const subKey = subUrl.replace(/^.*\/([^/]+)\.(png|jpg|jpeg)$/, '$1');
            resolve({ img_key: imgKey, sub_key: subKey });
          } catch (e) {
            reject(new Error(`解析 WBI keys 失败: ${e.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('获取 WBI keys 超时'));
    });
  });
}

/**
 * 获取 WBI keys（带缓存，1 天过期）
 */
async function getWbiKeys() {
  if (wbiKeysCache && Date.now() < wbiKeysExpire) {
    return wbiKeysCache;
  }
  const keys = await fetchWbiKeys();
  wbiKeysCache = keys;
  wbiKeysExpire = Date.now() + 24 * 60 * 60 * 1000;
  console.log(`[bili-wbi] keys refreshed: ${keys.img_key.slice(0,6)}...`);
  return keys;
}

/**
 * 对参数对象进行 WBI 签名
 * @param {Object} params - 查询参数 { key: value }
 * @returns {Promise<Object>} 包含原参数 + wts + w_rid
 */
async function sign(params) {
  const keys = await getWbiKeys();

  // 正确算法：imgKey+subKey → mixin table 重排 → 取前32位
  const mixinKey = getMixinKey(keys.img_key, keys.sub_key);

  // 对参数排序、URL 编码
  const sortedKeys = Object.keys(params).sort();
  const queryParts = [];
  for (const key of sortedKeys) {
    const val = String(params[key]);
    queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
  }

  // 加入时间戳
  const wts = Math.floor(Date.now() / 1000);
  queryParts.push(`wts=${wts}`);

  const queryString = queryParts.join('&');

  // 计算 w_rid = md5(queryString + mixinKey)
  const w_rid = crypto.createHash('md5').update(queryString + mixinKey).digest('hex');

  return {
    ...params,
    wts,
    w_rid
  };
}

/**
 * 强制刷新 WBI keys
 */
function resetCache() {
  wbiKeysCache = null;
  wbiKeysExpire = 0;
}

/**
 * 给 Bilibili API 请求添加通用 headers（含 Cookie buvid3）
 */
async function commonHeaders() {
  const buvid3 = await ensureBuvid3();
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.bilibili.com/',
    'Cookie': `buvid3=${buvid3}`,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Origin': 'https://www.bilibili.com',
  };
}

module.exports = { sign, getWbiKeys, resetCache, commonHeaders, ensureBuvid3 };
