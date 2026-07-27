const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('build/bundled/netease-server.js', 'utf-8');
const lines = content.split('\n');

// Check __dirname references
const dirnameRefs = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('__dirname') || lines[i].includes('__filename')) {
    dirnameRefs.push({line: i+1, text: lines[i].substring(0, 150)});
  }
}
console.log('=== __dirname refs (first 20) ===');
dirnameRefs.slice(0, 20).forEach(r => console.log(`  L${r.line}: ${r.text}`));
console.log(`  (total: ${dirnameRefs.length})`);

// Check require() for relative paths that might need filesystem access
const requireRefs = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/require\(['"]\.\/[^'"]+/);
  if (m) {
    requireRefs.push({line: i+1, text: m[0]});
  }
}
console.log('\n=== Relative require() calls (first 30) ===');
requireRefs.slice(0, 30).forEach(r => console.log(`  L${r.line}: ${r.text}`));
console.log(`  (total: ${requireRefs.length})`);

// Check if there's a require to './generateConfig' that is bundled inline
const genConfig = lines.filter(l => l.includes('generateConfig'));
console.log('\n=== generateConfig references (first 5) ===');
genConfig.slice(0, 5).forEach(l => console.log(`  ${l.substring(0, 150)}`));

// Simulate the bundle loading in the installed path
// Count total lines and size
console.log(`\n=== Stats ===`);
console.log(`Total lines: ${lines.length}`);
console.log(`Total size: ${(content.length / 1024).toFixed(1)} KB`);
