/**
 * noshRadio — Gitee Release 自动升级模块
 *
 * 职责：检查新版本 → 下载安装包 → 静默安装
 * 不依赖任何第三方包，仅用 Node.js 内置模块。
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ─── 配置（与 package.json 中的 update 字段对应）──────────────
function getConfig() {
  try {
    return require(path.join(__dirname, 'package.json')).update;
  } catch {
    return { giteeOwner: 'yangshengzhe', giteeRepo: 'nosh-radio' };
  }
}

// ─── semver 比较（只比较三位数，忽略 prerelease）─────────────
function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

// ─── Gitee API v5：获取最新 Release ──────────────────────────
function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const cfg = getConfig();
    const url = `https://gitee.com/api/v5/repos/${cfg.giteeOwner}/${cfg.giteeRepo}/releases/latest`;

    https.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Gitee API 返回 ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/**
 * 检查是否有新版本
 * @param {string} currentVersion - 当前版本号（如 "1.0.0"）
 * @returns {object|null} { version, releaseNotes, downloadUrl, assetName, assetSize }
 */
async function checkForUpdate(currentVersion) {
  let data;
  try {
    data = await fetchLatestRelease();
  } catch {
    return null; // 网络错误 / API 限流 → 静默失败
  }

  const latestTag = (data.tag_name || '').replace(/^v/, '');
  if (!latestTag || compareVersions(latestTag, currentVersion) <= 0) {
    return null; // 没有新版本
  }

  // 从 assets 中找到 .exe 安装包（排除 .exe.blockmap）
  const assets = data.assets || [];
  const asset = assets.find(a => a.name.endsWith('.exe') && !a.name.endsWith('.exe.blockmap'));
  if (!asset) return null;

  return {
    version: latestTag,
    tagName: data.tag_name,
    releaseNotes: data.body || '',
    downloadUrl: asset.browser_download_url || asset.name,
    assetName: asset.name,
    assetSize: asset.size || 0,
  };
}

/**
 * 下载更新包到临时目录，实时回调进度
 * @param {object} updateInfo - checkForUpdate 的返回值
 * @param {function} onProgress - ({ percent, bytes, total }) => void
 * @returns {string} 下载到的本地文件路径
 */
function downloadUpdate(updateInfo, onProgress) {
  return new Promise((resolve, reject) => {
    const tmpDir = process.env.TEMP || '.';
    const destPath = path.join(tmpDir, `noshRadio-update-${updateInfo.version}.exe`);
    const file = fs.createWriteStream(destPath);

    // Gitee 的 browser_download_url 可能是一个相对路径，需补全域名
    const url = updateInfo.downloadUrl.startsWith('http')
      ? updateInfo.downloadUrl
      : `https://gitee.com${updateInfo.downloadUrl}`;

    https.get(url, { timeout: 300000 }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 改为用 http 或 https 跟随重定向后的 URL
        https.get(res.headers.location, { timeout: 300000 }, (res2) => {
          pipeDownload(res2, file, destPath, onProgress, resolve, reject);
        }).on('error', reject);
        return;
      }
      pipeDownload(res, file, destPath, onProgress, resolve, reject);
    }).on('error', reject);
  });
}

function pipeDownload(response, file, destPath, onProgress, resolve, reject) {
  const total = parseInt(response.headers['content-length'], 10) || 0;
  let received = 0;

  response.on('data', (chunk) => {
    received += chunk.length;
    if (total && onProgress) {
      onProgress({
        percent: Math.min(100, Math.round(received / total * 100)),
        bytes: received,
        total,
      });
    }
  });

  response.pipe(file);

  file.on('finish', () => {
    file.close();
    resolve(destPath);
  });

  response.on('error', (err) => {
    file.close();
    fs.unlink(destPath, () => {});
    reject(err);
  });

  file.on('error', (err) => {
    fs.unlink(destPath, () => {});
    reject(err);
  });
}

/**
 * 执行静默安装
 * @param {string} downloadPath - 下载好的 .exe 路径
 * @param {string} [installDir] - 安装目录，默认从 process.execPath 推导
 */
function installUpdate(downloadPath, installDir) {
  const dir = installDir || path.dirname(process.execPath);

  console.log(`[updater] Installing: ${downloadPath} → ${dir}`);

  const child = spawn(downloadPath, ['/S', `/D=${dir}`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  child.unref(); // 让子进程独立于父进程运行
}

module.exports = { checkForUpdate, downloadUpdate, installUpdate };
