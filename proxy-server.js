const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

// ─── 插件加载 ─────────────────────────────────────────────────
const PLUGIN_PATH = process.env.SOURCE_PLUGIN_PATH || '';
let sourceBridge = null;       // bridge.js 导出的模块
let sourceServerChild = null;  // 音源服务子进程

function tryLoadSourcePlugin() {
  if (!PLUGIN_PATH) return false;
  const bridgePath = path.join(PLUGIN_PATH, 'bridge.js');
  if (!fs.existsSync(bridgePath)) return false;

  try {
    // 清除 require 缓存，确保热加载
    delete require.cache[require.resolve(bridgePath)];
    sourceBridge = require(bridgePath);
    console.log(`[plugin] 插件已加载: ${PLUGIN_PATH}`);

    // 尝试启动独立服务进程
    if (typeof sourceBridge.getServerEntry === 'function') {
      const serverEntry = sourceBridge.getServerEntry();
      if (serverEntry) {
        const PORT = process.env.SOURCE_SERVER_PORT || 30489;
        const SOURCES = ['migu', 'kugou', 'kuwo', 'pyncmd'];
        sourceServerChild = spawn('node', [
          serverEntry,
          '-p', PORT,
          '-o', ...SOURCES,
          '-e', 'https://music.163.com',
        ], {
          stdio: 'ignore',
          shell: true,
          windowsHide: true,
        });
        sourceServerChild.on('error', (err) => {
          console.log(`[plugin] 服务进程启动失败: ${err.message}`);
        });
        sourceServerChild.on('exit', (code) => {
          console.log(`[plugin] 服务进程退出 code=${code}`);
          sourceServerChild = null;
        });
        console.log(`[plugin] 服务进程已启动 (port=${PORT})`);
      } else {
        console.log('[plugin] 服务进程入口不存在，仅使用 resolveUrl API');
      }
    }
    return true;
  } catch (e) {
    console.log(`[plugin] 加载插件失败: ${e.message}`);
    return false;
  }
}

function cleanupSourceServer() {
  if (sourceServerChild) {
    try {
      spawn('taskkill', ['/F', '/T', '/PID', String(sourceServerChild.pid)], {
        windowsHide: true, stdio: 'ignore',
      });
    } catch (_) {}
    sourceServerChild = null;
  }
}

const pluginLoaded = tryLoadSourcePlugin();
process.on('exit', cleanupSourceServer);

// ─── HTTP 服务 ────────────────────────────────────────────────
const port = 8081;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function proxyRequest(req, res, targetHost, targetPort, prefixToStrip) {
  const parsedUrl = url.parse(req.url, true);

  const newPath = parsedUrl.pathname.replace(new RegExp(`^${prefixToStrip}`), '') + (parsedUrl.search || '');

  const options = {
    hostname: targetHost,
    port: targetPort,
    path: newPath,
    method: req.method,
    headers: {
      ...req.headers,
      'Content-Type': req.headers['content-type'] || 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
    },
  };
  delete options.headers['host'];
  delete options.headers['origin'];
  delete options.headers['referer'];

  const proxyReq = http.request(options, (proxyRes) => {
    const responseHeaders = { ...proxyRes.headers };

    res.writeHead(proxyRes.statusCode, {
      ...responseHeaders,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e);
    res.writeHead(502);
    res.end(JSON.stringify({ error: 'Bad Gateway', message: e.message }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // 代理 /netease/* 请求到 NeteaseCloudMusicApi (网易云)
  if (parsedUrl.pathname === '/netease' || parsedUrl.pathname.startsWith('/netease/')) {
    proxyRequest(req, res, 'localhost', 3000, '/netease');
    return;
  }

  // 代理 /kugou/* 请求到 Kugou Server (酷狗)
  if (parsedUrl.pathname === '/kugou' || parsedUrl.pathname.startsWith('/kugou/')) {
    proxyRequest(req, res, 'localhost', 3001, '/kugou');
    return;
  }

  // 代理 /radio/* 请求到 radio-browser.info (在线电台)
  if (parsedUrl.pathname === '/radio' || parsedUrl.pathname.startsWith('/radio/')) {
    const radioPath = parsedUrl.pathname.replace(/^\/radio/, '') + (parsedUrl.search || '');
    const targetUrl = 'https://de1.api.radio-browser.info/json' + radioPath;
    https.get(targetUrl, { headers: { 'User-Agent': 'NOSH-Radio/1.0' } }, (proxyRes) => {
      const ct = proxyRes.headers['content-type'] || 'application/json';
      res.writeHead(proxyRes.statusCode, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=120',
      });
      proxyRes.pipe(res);
    }).on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Radio proxy failed', message: e.message }));
    });
    return;
  }

  // 代理 /source/* 请求到音源服务进程（仅插件加载时可用）
  if (parsedUrl.pathname === '/source' || parsedUrl.pathname.startsWith('/source/')) {
    if (!pluginLoaded || !sourceServerChild) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, pluginMissing: true, error: '音源插件未安装' }));
      return;
    }
    proxyRequest(req, res, 'localhost', 30489, '/source');
    return;
  }

  // API: 跨音源解析歌曲 URL
  if (parsedUrl.pathname === '/api/resolve-url') {
    (async () => {
      const id = parsedUrl.query.id;
      if (!id) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ success: false, error: 'Missing id parameter' }));
        return;
      }

      // 插件未加载 = 功能不可用
      if (!sourceBridge || typeof sourceBridge.resolveUrl !== 'function') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({
          success: false,
          pluginMissing: true,
          error: '音源插件未安装',
        }));
        return;
      }

      try {
        const result = await sourceBridge.resolveUrl(id);
        if (result && result.url) {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({
            success: true,
            url: result.url,
            source: result.source,
            br: result.br,
            size: result.size,
          }));
        } else {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({
            success: false,
            error: 'resolve returned no url',
            fallback: true,
          }));
        }
      } catch (e) {
        const errMsg = e?.message || e || 'unknown error';
        console.log(`[resolve-url] match failed for id=${id}: ${errMsg}`);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({
          success: false,
          error: errMsg,
          fallback: true,
        }));
      }
    })();
    return;
  }

  // API: 代理音频文件（解决外部 CDN 跨域问题）
  if (parsedUrl.pathname === '/api/audio-proxy') {
    const audioUrl = parsedUrl.query.url;
    if (!audioUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }
    const targetUrl = decodeURIComponent(audioUrl);
    const isHttps = targetUrl.startsWith('https');
    const proxyModule = isHttps ? https : http;

    let referer = '';
    if (targetUrl.includes('kuwo.cn')) referer = 'http://www.kuwo.cn/';
    else if (targetUrl.includes('kugou.com')) referer = 'http://www.kugou.com/';
    else if (targetUrl.includes('migu.cn')) referer = 'http://music.migu.cn/';
    else if (targetUrl.includes('bilivideo.com') || targetUrl.includes('bilibili.com')) referer = 'https://www.bilibili.com/';

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Range': req.headers.range || '',
        'Referer': referer,
      },
      timeout: 30000,
    };

    const proxyReq = proxyModule.get(targetUrl, options, (proxyRes) => {
      const responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
        'Content-Type': proxyRes.headers['content-type'] || 'audio/mpeg',
        'Content-Length': proxyRes.headers['content-length'],
        'Content-Range': proxyRes.headers['content-range'],
        'Accept-Ranges': proxyRes.headers['accept-ranges'] || 'bytes',
      };
      Object.keys(responseHeaders).forEach(k => responseHeaders[k] === undefined && delete responseHeaders[k]);

      res.writeHead(proxyRes.statusCode, responseHeaders);

      let lastDataTime = Date.now();
      const STREAM_TIMEOUT_MS = 15000;
      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastDataTime > STREAM_TIMEOUT_MS) {
          console.warn(`[audio-proxy] 上游流超时 (${STREAM_TIMEOUT_MS}ms 无数据)，断开连接: ${targetUrl.substring(0, 80)}...`);
          clearInterval(timeoutCheck);
          proxyRes.destroy();
          if (!res.destroyed) res.destroy();
        }
      }, 5000);

      proxyRes.on('data', () => { lastDataTime = Date.now(); });
      proxyRes.on('error', (e) => {
        console.warn(`[audio-proxy] 上游流错误: ${e.message}`);
        clearInterval(timeoutCheck);
        if (!res.destroyed) res.destroy();
      });
      proxyRes.pipe(res);

      proxyRes.on('end', () => clearInterval(timeoutCheck));
      proxyRes.on('close', () => clearInterval(timeoutCheck));
      res.on('close', () => { clearInterval(timeoutCheck); proxyRes.destroy(); });
    });

    proxyReq.on('error', (e) => {
      console.log(`[audio-proxy] fetch error: ${e.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Proxy fetch failed', message: e.message }));
      }
    });

    proxyReq.on('timeout', () => {
      console.warn(`[audio-proxy] 初始连接超时: ${targetUrl.substring(0, 80)}...`);
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Connection timeout' }));
      }
    });
    return;
  }

  // ==================== Bilibili API ====================
  const wbi = require('./lib/bili-wbi');

  // B站搜索视频（WBI 签名）
  if (parsedUrl.pathname === '/api/bili/search') {
    const keyword = parsedUrl.query.keyword;
    if (!keyword) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing keyword' }));
      return;
    }
    const page = parsedUrl.query.page || 1;
    (async () => {
      try {
        const signed = await wbi.sign({ search_type: 'video', keyword, page, page_size: parsedUrl.query.page_size || '10', order: 'totalrank' });
        const qs = Object.entries(signed)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&');
        const biliUrl = `https://api.bilibili.com/x/web-interface/search/type?${qs}`;
        const headers = await wbi.commonHeaders();
        https.get(new URL(biliUrl), { headers }, (proxyRes) => {
          let body = '';
          proxyRes.on('data', c => body += c);
          proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(body);
          });
        }).on('error', e => {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Bilibili search failed', message: e.message }));
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'WBI sign failed', message: e.message }));
      }
    })();
    return;
  }

  // B站视频详情（WBI 签名获取 CID）
  if (parsedUrl.pathname === '/api/bili/view') {
    const bvid = parsedUrl.query.bvid;
    if (!bvid) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing bvid' }));
      return;
    }
    (async () => {
      try {
        const signed = await wbi.sign({ bvid });
        const qs = Object.entries(signed)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&');
        const opts = new URL(`https://api.bilibili.com/x/web-interface/view?${qs}`);
        const headers = await wbi.commonHeaders();
        https.get(opts, { headers }, (proxyRes) => {
          let body = '';
          proxyRes.on('data', c => body += c);
          proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(body);
          });
        }).on('error', e => {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Bilibili view failed', message: e.message }));
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'WBI sign failed', message: e.message }));
      }
    })();
    return;
  }

  // B站视频播放流
  if (parsedUrl.pathname === '/api/bili/playurl') {
    const bvid = parsedUrl.query.bvid;
    const cid = parsedUrl.query.cid;
    if (!bvid || !cid) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing bvid or cid' }));
      return;
    }
    const qn = parsedUrl.query.qn || '302';
    const fnval = parsedUrl.query.fnval || '4048';
    (async () => {
      try {
        const signed = await wbi.sign({ bvid, cid, qn, fnval, fnver: '0', fourk: '1' });
        const qs = Object.entries(signed)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&');
        const playUrl = `https://api.bilibili.com/x/player/wbi/playurl?${qs}`;
        console.log(`[bili-playurl] ${bvid} cid=${cid}`);
        const opts = new URL(playUrl);
        const headers = await wbi.commonHeaders();
        https.get(opts, { headers }, (proxyRes) => {
          let body = '';
          proxyRes.on('data', c => body += c);
          proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(body);
          });
        }).on('error', e => {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Bilibili playurl failed', message: e.message }));
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'WBI sign failed', message: e.message }));
      }
    })();
    return;
  }

  // B站弹幕
  if (parsedUrl.pathname === '/api/bili/danmaku') {
    const cid = parsedUrl.query.cid;
    if (!cid) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing cid' }));
      return;
    }
    const segTotal = Math.min(parseInt(parsedUrl.query.segments || '20'), 50);
    (async () => {
      try {
        const protobuf = require('protobufjs');
        const dmProto = `syntax = "proto3";
message DmSegMobileReply {
  repeated DanmakuElem elems = 1;
}
message DanmakuElem {
  int64 id = 1;
  int64 oid = 2;
  int32 mode = 3;
  int32 fontsize = 4;
  int32 color = 5;
  string idStr = 6;
  string content = 7;
  int64 ctime = 8;
  int32 weight = 9;
  int64 progress = 10;
  string action = 11;
  string idStr2 = 12;
  int32 attr = 13;
}`;
        const root = protobuf.parse(dmProto).root;
        const ReplyType = root.lookupType('DmSegMobileReply');
        const allDm = [];
        const seen = new Set();

        for (let seg = 1; seg <= segTotal; seg++) {
          const dmUrl = `https://api.bilibili.com/x/v2/dm/web/seg.so?oid=${cid}&type=1&segment_index=${seg}`;
          const headers = await wbi.commonHeaders();
          const buf = await new Promise((resolve, reject) => {
            https.get(new URL(dmUrl), { headers }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => resolve(Buffer.concat(c))); })
            .on('error', reject);
          });
          if (buf.length < 10) break;
          try {
            const decoded = ReplyType.decode(buf);
            const json = ReplyType.toObject(decoded, { longs: Number, defaults: true });
            const elems = json.elems || [];
            for (const dm of elems) {
              if (dm.content && !seen.has(dm.id)) {
                seen.add(dm.id);
                allDm.push({
                  id: dm.id,
                  content: dm.content,
                  progress: dm.progress || 0,
                  color: dm.color || 0xFFFFFF,
                  mode: dm.mode || 1,
                  ctime: dm.ctime || 0
                });
              }
            }
          } catch(e) { break; }
        }

        allDm.sort((a, b) => a.progress - b.progress);
        console.log(`[bili-danmaku] cid=${cid} 获取 ${allDm.length} 条弹幕`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ code: 0, data: { danmaku: allDm, total: allDm.length } }));
      } catch (e) {
        console.log(`[bili-danmaku] 失败: ${e.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Danmaku fetch failed', message: e.message }));
      }
    })();
    return;
  }

  // API: 本地数据持久化 - 保存
  if (parsedUrl.pathname === '/api/data/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { key, data } = JSON.parse(body);
        if (!key) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Missing key' }));
          return;
        }
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, key.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // API: 本地数据持久化 - 加载
  if (parsedUrl.pathname === '/api/data/load') {
    const key = parsedUrl.query.key;
    if (!key) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, error: 'Missing key parameter' }));
      return;
    }
    const filePath = path.join(__dirname, 'data', key.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, error: 'not found' }));
      return;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, data: JSON.parse(content) }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // 静态文件服务
  let filePath = parsedUrl.pathname;
  if (filePath === '/') {
    filePath = '/nosh-music-ai.html';
    filePath = path.join(__dirname, filePath);
  } else {
    filePath = path.join(__dirname, filePath);
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log(`Network: http://<YOUR_IP>:${port}/`);
  console.log(`Netease API proxy: /netease/* -> localhost:3000/*`);
  console.log(`Kugou API proxy: /kugou/* -> localhost:3001/*`);
  if (pluginLoaded) {
    console.log(`多音源代理: /source/* -> localhost:30489/*`);
  } else {
    console.log(`多音源插件未安装，不可用`);
  }
  console.log(`Bilibili API: /api/bili/search, /api/bili/view, /api/bili/playurl, /api/bili/danmaku`);
});
