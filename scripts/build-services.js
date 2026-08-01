/**
 * 后端服务打包脚本
 * 将 kugou-server.js 和 NeteaseCloudMusicApi 用 esbuild 打包为单文件，
 * 输出到 build/bundled/ 目录，供 Tauri 构建使用。
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE_DIR = path.join(ROOT, 'build', 'bundled');
const NETASE_PKG = path.join(ROOT, 'node_modules', 'NeteaseCloudMusicApi');

/**
 * 跨平台递归复制目录。
 * 注意：不用 fs.cpSync —— node v24.12.0 在 Windows 上复制较大目录时会崩溃
 * (0xC0000409, STATUS_STACK_BUFFER_OVERRUN)。改用系统原生命令。
 */
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  if (process.platform === 'win32') {
    // robocopy 退出码 0-7 均为成功
    execSync(`robocopy "${src}" "${dst}" /E /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
  } else {
    execSync(`cp -R "${src}/." "${dst}/"`, { stdio: 'inherit' });
  }
}

console.log('[build-services] 开始打包后端服务...');

// 清空并重建目录
if (fs.existsSync(BUNDLE_DIR)) {
  fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BUNDLE_DIR, { recursive: true });

// 1. 打包 kugou-server.js (含 express)
console.log('[build-services] 打包 kugou-server.js...');
execSync(
  `npx esbuild kugou-server.js --bundle --platform=node --outfile="${path.join(BUNDLE_DIR, 'kugou-server.js')}"`,
  { cwd: ROOT, stdio: 'inherit' }
);

// 2. 打包 NeteaseCloudMusicApi
console.log('[build-services] 打包 NeteaseCloudMusicApi...');
execSync(
  `npx esbuild "${path.join(NETASE_PKG, 'app.js')}" --bundle --platform=node --outfile="${path.join(BUNDLE_DIR, 'netease-server.js')}"`,
  { cwd: ROOT, stdio: 'inherit' }
);

// 3. 复制 NeteaseCloudMusicApi 的运行时模块（esbuild 无法内联的目录）
for (const dir of ['module', 'util', 'plugins', 'data']) {
  const src = path.join(NETASE_PKG, dir);
  const dst = path.join(BUNDLE_DIR, dir);
  if (fs.existsSync(src)) {
    copyDir(src, dst);
    console.log(`[build-services] 复制 ${dir}/`);
  }
}

// 4. 复制 package.json (inner_version.js 需要)
fs.copyFileSync(
  path.join(NETASE_PKG, 'package.json'),
  path.join(BUNDLE_DIR, 'package.json')
);

// 5. 安装运行时依赖（module/ 文件需要 axios 等 npm 包）
console.log('[build-services] 安装运行时依赖...');
execSync(
  `npm install --prefix "${BUNDLE_DIR}" --omit=dev --no-package-lock --no-audit --no-fund --ignore-scripts`,
  { cwd: ROOT, stdio: 'inherit' }
);

// 6. 验证
console.log('[build-services] 验证...');
const bundledKugou = path.join(BUNDLE_DIR, 'kugou-server.js');
const bundledNetease = path.join(BUNDLE_DIR, 'netease-server.js');

if (!fs.existsSync(bundledKugou)) {
  console.error(`[build-services] 错误: ${bundledKugou} 未生成`);
  process.exit(1);
}
if (!fs.existsSync(bundledNetease)) {
  console.error(`[build-services] 错误: ${bundledNetease} 未生成`);
  process.exit(1);
}

const kugouSize = fs.statSync(bundledKugou).size;
const neteaseSize = fs.statSync(bundledNetease).size;
console.log(`[build-services] ✅ kugou-server.js: ${(kugouSize / 1024).toFixed(1)} KB`);
console.log(`[build-services] ✅ netease-server.js: ${(neteaseSize / 1024).toFixed(1)} KB`);
console.log('[build-services] 打包完成');
