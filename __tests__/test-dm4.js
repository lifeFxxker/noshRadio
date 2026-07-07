const https = require('https');
const wbi = require('../lib/bili-wbi');

// Generate a pseudo-random buvid3
function makeBuvid3() {
  const hex = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return hex.toUpperCase() + 'infoc';
}

function fetchBuffer(url, cookie) {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Cookie': cookie || ''
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

(async () => {
  const cid = process.argv[2] || '39463617043';
  const buvid3 = makeBuvid3();
  const cookie = `buvid3=${buvid3}; buvid4=${buvid3}`;
  console.log('Cookie:', cookie);

  const params = await wbi.sign({ oid: cid, type: '1', segment_index: '1' });
  const qs = Object.entries(params).map(([k,v]) => k + '=' + encodeURIComponent(String(v))).join('&');
  const url = `https://api.bilibili.com/x/v2/dm/wbi/list?${qs}`;
  
  const { status, buf } = await fetchBuffer(url, cookie);
  console.log('Status:', status, 'Size:', buf.length);
  
  if (buf.length > 0 && buf[0] !== 0x3c) { // Not HTML (<)
    console.log('✅ Binary protobuf response!');
    console.log('First hex:', buf.slice(0, 20).toString('hex'));
  } else {
    console.log('❌ HTML response:', buf.toString('utf8').substring(0, 200));
  }
})();
