/**
 * noshRadio — Tauri 开发服务器
 *
 * 1. 服务静态文件（HTML/JS/CSS 等）
 * 2. 代理 /api/* 到后端子进程（proxy-server.js）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 1420;
const ROOT = __dirname;

// ─── 后端服务管理 ────────────────────────────────────────
const SERVICES = [
  {
    name: 'proxy-server',
    script: 'proxy-server.js',
    port: 8081,
    env: {
      PORT: '8081',
      APP_ROOT: ROOT,
      SOURCE_PLUGIN_PATH: path.join(ROOT, 'plugins', 'source-bridge'),
    },
  },
  {
    name: 'NeteaseCloudMusicApi',
    script: path.join('node_modules', 'NeteaseCloudMusicApi', 'app.js'),
    port: 3000,
    env: {},
  },
  {
    name: 'kugou-server',
    script: 'kugou-server.js',
    port: 3001,
    env: {},
  },
];

const serviceChildren = [];

function startService(svc) {
  const scriptPath = path.join(ROOT, svc.script);
  if (!fs.existsSync(scriptPath)) {
    console.log(`[dev-server] ${svc.name} (${svc.script}) 不存在，跳过`);
    return;
  }

  const child = spawn('node', [scriptPath], {
    stdio: 'pipe',
    shell: true,
    windowsHide: true,
    env: { ...process.env, ...svc.env },
  });

  child.stdout.on('data', (d) => {
    d.toString().split('\n').filter(Boolean).forEach(line => {
      console.log(`[${svc.name}] ${line.trim()}`);
    });
  });
  child.stderr.on('data', (d) => {
    d.toString().split('\n').filter(Boolean).forEach(line => {
      console.error(`[${svc.name}] ${line.trim()}`);
    });
  });
  child.on('error', (err) => console.log(`[dev-server] ${svc.name} 启动失败: ${err.message}`));
  child.on('exit', (code) => {
    console.log(`[dev-server] ${svc.name} 退出 code=${code}`);
    const idx = serviceChildren.indexOf(child);
    if (idx >= 0) serviceChildren.splice(idx, 1);
  });

  serviceChildren.push(child);
  console.log(`[dev-server] ${svc.name} 已启动 (PID=${child.pid}, port=${svc.port})`);
}

function cleanupServices() {
  serviceChildren.forEach((child) => {
    try {
      spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], {
        windowsHide: true, stdio: 'ignore',
      });
    } catch (_) {}
  });
  serviceChildren.length = 0;
}

// 启动所有服务
SERVICES.forEach(startService);

// dev-server 退出时清理子进程
process.on('exit', cleanupServices);
process.on('SIGINT', () => { cleanupServices(); process.exit(); });
process.on('SIGTERM', () => { cleanupServices(); process.exit(); });

// MIME 类型（前端所需的最小集合）
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

// ─── 静态文件服务 ──────────────────────────────────────────
function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/nosh-music-ai.html' : req.url;
  filePath = path.join(ROOT, filePath);

  // 安全检查：禁止跳出 ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ─── API 代理 → proxy-server ──────────────────────────────
// proxy-server.js 由 dev-server 在启动时自动派生
const PROXY_TARGET = process.env.PROXY_TARGET || `http://127.0.0.1:${SERVICES[0].port}`;

function proxyAPI(req, res) {
  const urlObj = new URL(req.url, PROXY_TARGET);

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port,
    path: urlObj.pathname + urlObj.search,
    method: req.method,
    headers: { ...req.headers },
  };
  // 移除 hop-by-hop headers
  delete options.headers['host'];
  delete options.headers['connection'];
  delete options.headers['transfer-encoding'];

  const proxyReq = http.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    delete headers['transfer-encoding'];
    delete headers['connection'];
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end(JSON.stringify({ error: 'proxy-server not available', detail: err.message }));
  });

  // 将请求体转发（对 POST/PUT 等很重要）
  req.pipe(proxyReq);
}

// ─── 判断是否需要代理到 proxy-server ─────────────────────
const PROXY_PREFIXES = ['/api/', '/netease', '/kugou', '/source', '/radio'];

function shouldProxy(url) {
  return PROXY_PREFIXES.some(p => url.startsWith(p));
}

// ─── 主服务器 ──────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (shouldProxy(req.url)) {
    proxyAPI(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`[dev-server] http://localhost:${PORT}  （静态文件 + /api/* → ${PROXY_TARGET}）`);
});
