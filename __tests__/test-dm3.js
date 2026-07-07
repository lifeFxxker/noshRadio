const https = require('https');
const wbi = require('../lib/bili-wbi');

function fetchBuffer(url, extra) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    https.get(opts, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.bilibili.com/',
        ...extra
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

(async () => {
  const cid = process.argv[2] || '39463617043';
  
  // Try WBI-signed protobuf endpoint
  try {
    const params = await wbi.sign({ oid: cid, type: '1', segment_index: '1' });
    const qs = Object.entries(params).map(([k,v]) => k + '=' + encodeURIComponent(String(v))).join('&');
    const url = `https://api.bilibili.com/x/v2/dm/wbi/list?${qs}`;
    console.log('WBI DM URL (truncated):', url.substring(0, 150));
    const buf = await fetchBuffer(url);
    console.log('Response size:', buf.length, 'bytes');
    console.log('First 50 bytes hex:', buf.slice(0, 50).toString('hex'));
    // If it starts with protobuf, it won't be valid JSON
    try {
      const json = JSON.parse(buf.toString());
      console.log('JSON! code:', json.code);
      if (json.data) console.log('data keys:', Object.keys(json.data));
    } catch(e) {
      console.log('Binary response (not JSON) - likely protobuf');
      // Try to find any readable text
      const readable = buf.toString('utf8').replace(/[^\x20-\x7E\u4e00-\u9fff]/g, '').substring(0, 200);
      if (readable.trim()) console.log('Readable content:', readable.substring(0, 100));
    }
  } catch(e) {
    console.log('Error:', e.message);
  }
})();
