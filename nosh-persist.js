// nosh-persist.js — 数据持久化适配层
// localStorage + 本地文件双写，server 不可用时静默降级

const PERSIST_SERVER_BASE = '/api/data';

// 写：同步写 localStorage + 异步写 server（fire-and-forget，不阻塞 UI）
function persistData(key, data) {
  // 1. 同步写入 localStorage（瞬时生效，浏览器刷新后立即可用）
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('nosh: localStorage write failed', e);
  }

  // 2. 异步写入 server（fire-and-forget，1s 超时）
  fetch(PERSIST_SERVER_BASE + '/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, data }),
  }).catch(() => {
    // 静默降级，server 不可用不影响用户体验
  });
}

// 读：优先 localStorage（同步快），可选从 server 拉取
function loadData(key) {
  try {
    const local = localStorage.getItem(key);
    if (local) return JSON.parse(local);
  } catch (e) {
    // 兼容旧数据：非 JSON 格式（如纯字符串 anonymousId）直接返回原始值
    try { return localStorage.getItem(key); } catch (_) { /* ignore */ }
  }
  return null;
}

// 启动时恢复：localStorage 为空但 server 有数据 → 拉回 localStorage
async function restoreFromServer() {
  const keys = [
    'noshUserProfile',
    'noshPlaylist',
    'noshListeningHistory',
    'noshSettings',
    'noshAnonymousId',
    'noshFavorites',
    'noshRecentRecs',
  ];
  for (const key of keys) {
    // 仅当 localStorage 中没有时才尝试从 server 恢复
    if (localStorage.getItem(key) !== null) continue;
    try {
      const res = await fetch(PERSIST_SERVER_BASE + '/load?key=' + encodeURIComponent(key), {
        signal: AbortSignal.timeout(1000),
      });
      if (!res.ok) continue;
      const result = await res.json();
      if (result.success && result.data !== undefined) {
        localStorage.setItem(key, JSON.stringify(result.data));
      }
    } catch (e) {
      // 静默降级
    }
  }
}

// 页面加载后尝试从 server 恢复数据
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    restoreFromServer();
  });
}
