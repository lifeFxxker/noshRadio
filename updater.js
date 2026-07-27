/**
 * noshRadio — GitHub Release 自动升级模块
 *
 * 职责：检查新版本 → 下载安装包 → 静默安装
 * 不依赖任何第三方包，仅用 Node.js 内置模块。
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ─── 配置 ──────────────────────────────────────────────────────
function getConfig() {
  try {
    return require(path.join(__dirname, 'package.json')).update;
  } catch {
    return {};
  }
}

function getGitHubConfig() {
  const cfg = getConfig();
  return {
    owner: cfg.githubOwner || 'lifeFxxker',
    repo: cfg.githubRepo || 'noshRadio',
  };
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

// ─── GitHub API：获取最新 Release ────────────────────────────
function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const { owner, repo } = getGitHubConfig();
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

    https.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'noshRadio/1.0', 'Accept': 'application/vnd.github.v3+json' },
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API 返回 ${res.statusCode}`));
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

  // Gitee API 有时不返回 asset.size，尝试通过 HEAD 请求获取真实大小
  let assetSize = asset.size || 0;
  if (!assetSize) {
    try {
      const downloadUrl = asset.browser_download_url || asset.name;
      const url = downloadUrl.startsWith('http')
        ? downloadUrl
        : `https://gitee.com${downloadUrl}`;
      const proto = url.startsWith('https') ? https : http;
      assetSize = await new Promise((resolve) => {
        const req = proto.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
          resolve(parseInt(res.headers['content-length'], 10) || 0);
        });
        req.on('error', () => resolve(0));
        req.end();
      });
    } catch {
      assetSize = 0;
    }
  }

  return {
    version: latestTag,
    tagName: data.tag_name,
    releaseNotes: data.body || '',
    downloadUrl: asset.browser_download_url || asset.name,
    assetName: asset.name,
    assetSize,
  };
}

/**
 * 下载更新包到临时目录，实时回调进度
 * @param {object} updateInfo - checkForUpdate 的返回值
 * @param {function} onProgress - ({ percent, bytes, total }) => void
 * @returns {string} 下载到的本地文件路径
 */
function downloadUpdate(updateInfo, onProgress) {
  const tmpDir = process.env.TEMP || '.';
  const destPath = path.join(tmpDir, `noshRadio-update-${updateInfo.version}.exe`);

  // GitHub 的 browser_download_url 是完整 URL
  let url = updateInfo.downloadUrl;

  return downloadWithRedirects(url, destPath, onProgress, 5);
}

/**
 * 递归下载，跟随重定向链（最多 maxRedirects 层）
 */
function downloadWithRedirects(url, destPath, onProgress, maxRedirects) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;

    proto.get(url, { timeout: 300000 }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); // 消耗掉响应体以释放连接
        if (maxRedirects <= 0) {
          return reject(new Error(`重定向次数过多`));
        }
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(downloadWithRedirects(redirectUrl, destPath, onProgress, maxRedirects - 1));
      }

      // 非 200 视为错误
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`服务器返回状态码 ${res.statusCode}`));
      }

      const total = parseInt(res.headers['content-length'], 10) || 0;
      if (total > 0 && total < 1024 * 1024) {
        res.resume();
        return reject(new Error(`安装包过小 (${(total / 1024 / 1024).toFixed(1)}MB)，下载地址可能不正确`));
      }

      // 开始写入文件
      const file = fs.createWriteStream(destPath);
      let received = 0;

      res.on('data', (chunk) => {
        received += chunk.length;
        if (total && onProgress) {
          onProgress({
            percent: Math.min(100, Math.round(received / total * 100)),
            bytes: received,
            total,
          });
        }
      });

      res.pipe(file);

      file.on('finish', () => {
        file.close();

        // 最终验证文件大小
        try {
          const stat = fs.statSync(destPath);
          if (stat.size < 1024 * 1024) {
            fs.unlink(destPath, () => {});
            return reject(new Error(`下载的文件过小 (${(stat.size / 1024 / 1024).toFixed(1)}MB)`));
          }
        } catch (e) {
          return reject(new Error(`无法检查下载的文件: ${e.message}`));
        }

        resolve(destPath);
      });

      res.on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * 执行静默安装
 * @param {string} downloadPath - 下载好的 .exe 路径
 * @param {string} [installDir] - 安装目录，默认从 process.execPath 推导
 * @returns {{ success: boolean, error?: string }}
 */
function installUpdate(downloadPath, installDir) {
  const dir = installDir || path.dirname(process.execPath);

  // 校验安装包存在
  if (!downloadPath || !fs.existsSync(downloadPath)) {
    return { success: false, error: `安装包不存在: ${downloadPath}` };
  }
  // 校验 exe 文件大小（至少 1MB 才合理）
  const stat = fs.statSync(downloadPath);
  if (stat.size < 1024 * 1024) {
    return { success: false, error: `安装包异常 (${(stat.size / 1024 / 1024).toFixed(1)}MB)，文件可能损坏或下载不完整` };
  }

  console.log(`[updater] Installing: ${downloadPath} (${(stat.size / 1024 / 1024).toFixed(1)}MB) → ${dir}`);

  try {
    const child = spawn(downloadPath, ['/S', `/D=${dir}`], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', (err) => {
      console.error(`[updater] 安装进程启动失败: ${err.message}`);
    });
    child.unref(); // 让子进程独立于父进程运行
    return { success: true };
  } catch (e) {
    return { success: false, error: `启动安装程序失败: ${e.message}` };
  }
}

module.exports = { checkForUpdate, downloadUpdate, installUpdate };
