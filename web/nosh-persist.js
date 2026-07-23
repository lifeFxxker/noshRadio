// nosh-persist.js — 数据持久化适配层
// Tauri 环境 → 写文件到 app_data_dir/data/
// 浏览器环境 → localStorage 降级

const PERSIST_DIR = 'data';

// 检测 Tauri 可用
function _isTauri() {
  return typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.core;
}

function _getFilePath(key) {
  // 过滤非文件名字符
  const safeName = String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${PERSIST_DIR}/${safeName}.json`;
}

// 写数据
function persistData(key, data) {
  const json = JSON.stringify(data);

  // 1. Tauri 环境 → 写文件
  if (_isTauri()) {
    try {
      window.__TAURI__.core.invoke('write_data_file', {
        relativePath: _getFilePath(key),
        content: json,
      }).catch(() => {});
    } catch (_) {}
  }

  // 2. 同步写入 localStorage（双写，浏览器降级时可用）
  try {
    localStorage.setItem(key, json);
  } catch (e) {
    console.warn('nosh: localStorage write failed', e);
  }
}

// 读数据
function loadData(key) {
  // 1. Tauri 环境 → 读文件
  if (_isTauri()) {
    try {
      const result = window.__TAURI__.core.invoke('read_data_file', {
        relativePath: _getFilePath(key),
      });
      if (result) return JSON.parse(result);
    } catch (_) {}
  }

  // 2. 降级到 localStorage
  try {
    const local = localStorage.getItem(key);
    if (local) return JSON.parse(local);
  } catch (e) {
    try { return localStorage.getItem(key); } catch (_) {}
  }
  return null;
}

// 同步版读（浏览器环境同步，Tauri 环境尝试同步但走 localStorage fallback）
function loadDataSync(key) {
  // 同步版只走 localStorage（最终一致，Tauri 下次页面加载时会同步到文件）
  try {
    const local = localStorage.getItem(key);
    if (local) return JSON.parse(local);
  } catch (e) {
    try { return localStorage.getItem(key); } catch (_) {}
  }
  return null;
}

// 删除数据
function deleteData(key) {
  if (_isTauri()) {
    try {
      window.__TAURI__.core.invoke('delete_data_file', {
        relativePath: _getFilePath(key),
      }).catch(() => {});
    } catch (_) {}
  }
  try {
    localStorage.removeItem(key);
  } catch (_) {}
}

// 页面加载时：从 Tauri 文件同步到 localStorage（热备）
async function _syncFromFile() {
  if (!_isTauri()) return;
  const keys = [
    'noshUserProfile', 'noshPlaylist', 'noshListeningHistory',
    'noshSettings', 'noshAnonymousId', 'noshFavorites',
    'noshRecentRecs', 'noshSavedPlaylists',
  ];
  for (const key of keys) {
    try {
      const result = await window.__TAURI__.core.invoke('read_data_file', {
        relativePath: _getFilePath(key)
      });
      if (result) {
        localStorage.setItem(key, result);
      }
    } catch (_) {
      // 文件不存在或读失败 → 静默
    }
  }
}

// 页面加载同步
if (typeof window !== 'undefined') {
  if (_isTauri()) {
    // Tauri 环境：文件 → localStorage（页面启动时同步一次）
    window.addEventListener('load', () => { _syncFromFile(); });
  }
}
