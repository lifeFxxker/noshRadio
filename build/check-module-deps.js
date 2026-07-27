const fs = require('fs');
const path = require('path');

// Scan all .js files in module/ and util/ for require() calls
const dirs = ['module', 'util', 'plugins', 'data'];
const requiredPackages = new Set();
const nodeBuiltins = new Set([
  'fs', 'path', 'http', 'https', 'url', 'crypto', 'stream', 'buffer',
  'util', 'events', 'child_process', 'os', 'net', 'dns', 'tls',
  'querystring', 'string_decoder', 'assert', 'zlib', 'punycode',
  'readline', 'cluster', 'repl', 'vm', 'v8', 'perf_hooks', 'async_hooks',
  'module', 'process'
]);

for (const dir of dirs) {
  const dirPath = path.join(__dirname, '..', 'build', 'bundled', dir);
  if (!fs.existsSync(dirPath)) continue;
  
  const files = fs.readdirSync(dirPath, { recursive: true }).filter(f => f.endsWith('.js'));
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
    // Match require('xxx') where xxx is not relative (starts with ./ or ../)
    const requires = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
    for (const r of requires) {
      const pkg = r.match(/require\(['"]([^'"]+)['"]\)/)[1];
      if (pkg.startsWith('.') || pkg.startsWith('/')) continue; // relative
      if (nodeBuiltins.has(pkg)) continue; // node built-in
      requiredPackages.add(pkg);
    }
  }
}

console.log('Required npm packages by module/util/plugins files:');
console.log(Array.from(requiredPackages).sort().join('\n'));
