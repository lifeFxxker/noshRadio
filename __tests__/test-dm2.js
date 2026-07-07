const https = require('https');
const http = require('http');
const cid = process.argv[2] || '39463617043';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

(async () => {
  const endpoints = [
    `https://api.bilibili.com/x/v2/dm/dm/view?oid=${cid}&type=1`,
    `https://api.bilibili.com/x/v2/dm/list?oid=${cid}&type=1`,
    `https://api.bilibili.com/x/v2/dm/ajax?id=${cid}&type=1`,
  ];
  for (const url of endpoints) {
    try {
      const body = await fetch(url);
      const first = body.substring(0, 300);
      try {
        const json = JSON.parse(body);
        console.log(`✅ JSON (code=${json.code}):`, url.split('?')[0]);
        if (json.data) {
          const keys = Object.keys(json.data);
          console.log('   keys:', keys.join(', '));
          for (const k of keys) {
            const v = json.data[k];
            if (Array.isArray(v)) console.log(`   ${k}: ${v.length} items`);
            else if (typeof v === 'object' && v !== null) console.log(`   ${k}: {${Object.keys(v).join(',')}}`);
            else console.log(`   ${k}: ${String(v).substring(0, 50)}`);
          }
        }
      } catch {
        console.log(`❌ Not JSON (${body.length} bytes):`, url.split('?')[0]);
        console.log('   raw:', first);
      }
    } catch(e) {
      console.log(`❌ Error: ${url.split('?')[0]} - ${e.message}`);
    }
  }
})();
