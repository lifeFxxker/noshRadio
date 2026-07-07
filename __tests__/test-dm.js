const https = require('https');
const cid = process.argv[2] || '39463617043';
const url = `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`;
https.get(url, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/' }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('status:', res.statusCode, 'type:', res.headers['content-type']);
    console.log('size:', d.length, 'bytes');
    // Parse XML danmaku
    const regex = /<d p="([^"]+)"[^>]*>([^<]+)<\/d>/g;
    const matches = [];
    let m;
    while ((m = regex.exec(d)) !== null) {
      matches.push({ attrs: m[1], text: m[2] });
    }
    console.log('total danmaku:', matches.length);
    if (matches.length > 0) {
      matches.slice(0, 5).forEach(({ attrs, text }) => {
        const parts = attrs.split(',');
        console.log(`  time=${parts[0]}s text="${text}" color=${parts[3]}`);
      });
    }
  });
}).on('error', e => console.error(e.message));
