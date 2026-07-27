const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE_DIR = path.join(ROOT, 'build', 'bundled');
const TARGET_NM = path.join(BUNDLE_DIR, 'node_modules');
const SRC_NM = path.join(ROOT, 'node_modules');

// Packages required by module/util files (from previous scan)
const REQUIRED = new Set([
  'axios', 'crypto-js', 'md5', 'music-metadata', 'node-forge',
  'pac-proxy-agent', 'qrcode', 'tunnel', 'xml2js',
  // These are transitive deps of the above
  'agent-base', 'debug', 'ms', 'https-proxy-agent', 'form-data',
  'follow-redirects', 'proxy-from-env', 'mime-types', 'mime-db',
  'content-type', 'strtok3', 'token-types', 'peek-readable',
  'file-type', 'media-typer', 'asn1', 'node-int64',
  // crypto-js doesn't have transitive deps
  // md5 has: charenc, crypt-usage
  'charenc', 'crypt',
]);

function copyPackage(name, depth = 0) {
  if (depth > 3) return; // prevent infinite recursion
  const src = path.join(SRC_NM, name);
  const dst = path.join(TARGET_NM, name);
  if (!fs.existsSync(src)) {
    // Try NeteaseCloudMusicApi nested node_modules
    const nestedSrc = path.join(SRC_NM, 'NeteaseCloudMusicApi', 'node_modules', name);
    if (fs.existsSync(nestedSrc)) {
      doCopy(nestedSrc, dst, name, depth);
      return;
    }
    console.log(`  [SKIP] ${name} not found in root or nested`);
    return;
  }
  if (fs.existsSync(dst)) return; // already copied
  doCopy(src, dst, name, depth);
}

function doCopy(src, dst, name, depth) {
  fs.cpSync(src, dst, { recursive: true, force: true });
  console.log(`${'  '.repeat(depth)}[OK] ${name}`);

  // Copy transitive deps
  const pkgJson = path.join(src, 'package.json');
  if (fs.existsSync(pkgJson)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
      for (const dep of Object.keys(deps || {})) {
        if (!REQUIRED.has(dep)) {
          REQUIRED.add(dep);
          copyPackage(dep, depth + 1);
        }
      }
    } catch (e) {
      console.log(`${'  '.repeat(depth)}  [WARN] Could not read package.json for ${name}: ${e.message}`);
    }
  }
}

console.log('Resolving dependencies for build/bundled/...');
if (!fs.existsSync(TARGET_NM)) {
  fs.mkdirSync(TARGET_NM, { recursive: true });
}

// First copy the nested node_modules from NeteaseCloudMusicApi (bulk copy)
const nestedNm = path.join(SRC_NM, 'NeteaseCloudMusicApi', 'node_modules');
if (fs.existsSync(nestedNm)) {
  console.log('Copying NeteaseCloudMusicApi nested node_modules as base...');
  fs.cpSync(nestedNm, TARGET_NM, { recursive: true, force: true });
}

// Then copy missing ones individually with transitive deps
console.log('\nResolving individual missing packages...');
for (const pkg of REQUIRED) {
  const dst = path.join(TARGET_NM, pkg);
  if (!fs.existsSync(dst)) {
    copyPackage(pkg);
  }
}

// Verify
console.log('\n=== Verification ===');
let found = 0;
let missing = [];
for (const pkg of REQUIRED) {
  if (fs.existsSync(path.join(TARGET_NM, pkg))) {
    found++;
  } else {
    missing.push(pkg);
  }
}
console.log(`Packages found: ${found}/${REQUIRED.size}`);
if (missing.length > 0) {
  console.log(`Missing: ${missing.join(', ')}`);
}

// Count total packages
const totalPkgs = fs.readdirSync(TARGET_NM).filter(f => 
  fs.statSync(path.join(TARGET_NM, f)).isDirectory()
).length;
console.log(`Total packages in node_modules: ${totalPkgs}`);

// Test netease-server
console.log('\n=== Testing netease-server (3s timeout) ===');
const { spawn } = require('child_process');
const proc = spawn('node', ['netease-server.js'], {
  cwd: BUNDLE_DIR,
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 3000,
});
let output = '';
proc.stdout.on('data', d => output += d);
proc.stderr.on('data', d => output += d);
setTimeout(() => {
  if (!proc.killed) {
    proc.kill();
    if (output.includes('server running')) {
      console.log('✅ netease-server started successfully!');
    } else {
      console.log('❌ netease-server output:', output.substring(0, 500));
    }
  }
}, 2000);
proc.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.log(`❌ netease-server exited with code ${code}`);
    console.log('Output:', output.substring(0, 1000));
  }
});
