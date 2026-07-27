/**
 * electron-builder afterPack hook.
 * 打包完成后清理无用文件，减小安装包体积。
 * 在 NSIS 压缩前执行。
 */
exports.default = async function (context) {
  const { appOutDir } = context;
  const fs = require('fs');
  const path = require('path');

  // 1. 清理 locales：只保留 zh-CN / en-US，其余 ~45MB 全部删除
  const localesDir = path.join(appOutDir, 'locales');
  if (fs.existsSync(localesDir)) {
    const keep = new Set(['zh-CN.pak', 'en-US.pak']);
    let removed = 0;
    let saved = 0;
    for (const file of fs.readdirSync(localesDir)) {
      if (!keep.has(file)) {
        const p = path.join(localesDir, file);
        const stat = fs.statSync(p);
        saved += stat.size;
        fs.unlinkSync(p);
        removed++;
      }
    }
    console.log(`[cleanup] Removed ${removed} locale files (${(saved / 1048576).toFixed(1)} MB)`);
  }

  // 2. LICENSES.chromium.html (19 MB) 替换为精简版
  const licensesFile = path.join(appOutDir, 'LICENSES.chromium.html');
  if (fs.existsSync(licensesFile) && fs.statSync(licensesFile).size > 1e6) {
    const mini = `<!DOCTYPE html><html><body>
<p>noshRadio 基于 Electron (<a href="https://github.com/electron/electron">https://github.com/electron/electron</a>) 构建.</p>
<p>Chromium 及相关组件协议请参见: <a href="https://chromium.googlesource.com/chromium/src/+/main/LICENSE">https://chromium.googlesource.com/chromium/src/+/main/LICENSE</a></p>
<p>Electron 协议: <a href="https://github.com/electron/electron/blob/main/LICENSE">https://github.com/electron/electron/blob/main/LICENSE</a></p>
</body></html>`;
    fs.writeFileSync(licensesFile, mini, 'utf8');
    console.log('[cleanup] Replaced LICENSES.chromium.html with minimal version');
  }

  // 3. 移除 Electron 运行时不需要的大文件
  //    dxcompiler.dll (24 MB) — DirectX Shader Compiler，仅 WebGPU 需要，Three.js WebGL 不依赖
  //    vk_swiftshader.dll (5.3 MB) — 软 Vulkan 回退，有真实 GPU 的机器永不加载
  const removeIfExists = (...names) => {
    for (const name of names) {
      const p = path.join(appOutDir, name);
      if (fs.existsSync(p)) {
        const size = fs.statSync(p).size;
        fs.unlinkSync(p);
        console.log(`[cleanup] Removed ${name} (${(size / 1048576).toFixed(1)} MB)`);
      }
    }
  };
  removeIfExists('dxcompiler.dll', 'vk_swiftshader.dll', 'vk_swiftshader_icd.json');

  // 5. 清理 app.asar.unpacked 中的无用文件
  const unpackedDir = path.join(appOutDir, 'resources', 'app.asar.unpacked');
  if (fs.existsSync(unpackedDir)) {
    let saved = 0;
    let removed = 0;

    // 文件级匹配规则（基于相对路径匹配）
    function isJunk(relPath) {
      const name = path.basename(relPath);
      // 图片
      if (/\.(png|jpg|jpeg|gif|bmp|ico)$/i.test(name)) return true;
      // sourcemap
      if (name.endsWith('.map')) return true;
      // 预编译 .bc.js
      if (name.endsWith('.bc.js')) return true;
      // 设备文件
      if (name === 'deviceid.txt') return true;
      // 演示代码目录
      if (relPath.includes('/audio_match_demo/')) return true;
      // 测试目录
      if (/\/tests?\//.test(relPath) || /\/__tests__\//.test(relPath)) return true;
      // 文档
      if (/\.(md|markdown)$/i.test(name)) return true;
      if (/^(LICENSE|CHANGELOG|HISTORY|AUTHORS|SECURITY|CONTRIBUTING)/i.test(name)) return true;
      // TypeScript 源文件
      if (name.endsWith('.ts') && !name.endsWith('.d.ts')) return true;
      return false;
    }

    function walk(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = full.slice(unpackedDir.length).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && isJunk(rel)) {
          try {
            saved += entry.size;
            fs.unlinkSync(full);
            removed++;
          } catch { /* skip locked files */ }
        }
      }
    }
    walk(unpackedDir);

    // 清理空目录
    function removeEmpty(dir) {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir)) {
        const f = path.join(dir, e);
        if (fs.statSync(f).isDirectory()) removeEmpty(f);
      }
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    }
    removeEmpty(unpackedDir);

    console.log(`[cleanup] Removed ${removed} junk files from app.asar.unpacked (${(saved / 1048576).toFixed(1)} MB)`);
  }
};
