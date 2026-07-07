/**
 * 多音源解析服务启动脚本
 *
 * 功能: 当网易云歌曲因版权缺失时，自动从其他音源获取可播放URL
 *
 * 使用方法:
 *   node source-server.js
 *
 * 默认端口: 30489
 * 默认音源优先级: migu > kugou > kuwo > pyncmd
 */

const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.SOURCE_SERVER_PORT || 30489;
const SOURCES = ['migu', 'kugou', 'kuwo', 'pyncmd'];

console.log('===========================================');
console.log('  多音源代理服务');
console.log('===========================================');
console.log(`  端口: ${PORT}`);
console.log(`  音源: ${SOURCES.join(' > ')}`);
console.log('===========================================');
console.log('');

// 启动预编译服务进程
const serverPath = path.join(__dirname, 'node_modules', '@unblockneteasemusic', 'server', 'precompiled', 'app.js');

const child = spawn('node', [
  serverPath,
  '-p', PORT,
  '-o', ...SOURCES,
  '-e', 'https://music.163.com'
], {
  stdio: 'inherit',
  shell: true
});

child.on('error', (err) => {
  console.error('启动失败:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`服务退出，代码: ${code}`);
  process.exit(code);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  child.kill('SIGINT');
  process.exit(0);
});

console.log(`服务启动中，请访问 http://localhost:${PORT}/`);
console.log('按 Ctrl+C 停止服务');
