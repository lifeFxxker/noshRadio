/**
 * noshRadio — Electron preload
 *
 * 安全地暴露有限的 API 给渲染进程。
 * contextIsolation: true, nodeIntegration: false
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noshElectron', {
  isElectron: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',

  // 窗口控制
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onMaximizeChange: (callback) => {
      ipcRenderer.on('window-maximize-changed', (_, maximized) => callback(maximized));
    },
  },

  // 开发工具
  devtools: {
    open: () => ipcRenderer.send('devtools:open'),
  },

  // 插件管理
  plugin: {
    status: (name) => ipcRenderer.invoke('plugin:status', name),
    install: (name) => ipcRenderer.invoke('plugin:install', name),
    remove: (name) => ipcRenderer.invoke('plugin:remove', name),
    list: () => ipcRenderer.invoke('plugin:list'),
  },
});
