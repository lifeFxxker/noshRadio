import { existsSync, mkdirSync, cpSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BUNDLE_DIR = join(ROOT, 'build', 'bundled');
const TARGET_NM = join(BUNDLE_DIR, 'node_modules');
const ROOT_NM = join(ROOT, 'node_modules');
const NESTED_NM = join(ROOT_NM, 'NeteaseCloudMusicApi', 'node_modules');

// Read the base packages from module/util file scanning
const requiredPackages = [
  'axios', 'crypto-js', 'md5', 'music-metadata', 'node-forge',
  'pac-proxy-agent', 'qrcode', 'tunnel', 'xml2js',
];

// First copy ALL from nested NM as base
if (!existsSync(TARGET_NM)) mkdirSync(TARGET_NM, { recursive: true });
if (existsSync(NESTED_NM)) {
  console.log('Copying base packages from nested node_modules...');
  const entries = readdirSync(NESTED_NM);
  for (const entry of entries) {
    const src = join(NESTED_NM, entry);
    const dst = join(TARGET_NM, entry);
    if (!existsSync(dst)) {
      cpSync(src, dst, { recursive: true, force: true });
    }
  }
  console.log(`  Copied ${entries.length} base packages`);
}

// Now resolve each required package and its transitive deps recursively
const copied = new Set();

function copyPackage(pkgName) {
  if (copied.has(pkgName)) return;
  
  // Try root NM first, then nested NM
  let srcDir = join(ROOT_NM, pkgName);
  if (!existsSync(srcDir)) {
    srcDir = join(NESTED_NM, pkgName);
  }
  if (!existsSync(srcDir)) {
    // Try scoped
    const parts = pkgName.split('/');
    if (parts.length > 1) {
      srcDir = join(ROOT_NM, parts[0], parts[1]);
    }
  }
  if (!existsSync(srcDir)) return;
  
  const dstDir = join(TARGET_NM, pkgName);
  if (existsSync(dstDir)) {
    copied.add(pkgName);
    return; // already copied
  }
  
  cpSync(srcDir, dstDir, { recursive: true, force: true });
  copied.add(pkgName);
  process.stdout.write(`  ${pkgName}\n`);
  
  // Read package.json for dependencies
  const pkgJsonPath = join(srcDir, 'package.json');
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.peerDependencies || {}) };
      for (const dep of Object.keys(deps)) {
        copyPackage(dep);
      }
    } catch (e) {
      // ignore
    }
  }
}

console.log('\nResolving transitive dependencies...');
copyPackage('axios');
copyPackage('crypto-js');
copyPackage('md5');
copyPackage('music-metadata');
copyPackage('node-forge');
copyPackage('pac-proxy-agent');
copyPackage('qrcode');
copyPackage('tunnel');
copyPackage('xml2js');

const count = readdirSync(TARGET_NM).filter(e => statSync(join(TARGET_NM, e)).isDirectory()).length;
console.log(`\nTotal packages in build/bundled/node_modules/: ${count}`);

// Test: try requiring each package
console.log('\nVerification (dry require):');
for (const pkg of requiredPackages) {
  const pkgDir = join(TARGET_NM, pkg);
  if (existsSync(pkgDir)) {
    try {
      const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'));
      console.log(`  ✅ ${pkg} v${pkgJson.version}`);
    } catch {
      console.log(`  ⚠️  ${pkg} (no package.json)`);
    }
  } else {
    console.log(`  ❌ ${pkg} - MISSING`);
  }
}
