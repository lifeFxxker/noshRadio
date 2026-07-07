const https = require('https');
const protobuf = require('protobufjs');

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.bilibili.com/' }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

(async () => {
  const cid = process.argv[2] || '39463617043';
  const buf = await fetchBuf(`https://api.bilibili.com/x/v2/dm/web/seg.so?oid=${cid}&type=1&segment_index=1`);

  // Try brute-force field numbers for content string (8-20)
  for (let contentField = 7; contentField <= 12; contentField++) {
    for (let progressField = 4; progressField <= 10; progressField++) {
      try {
        const schema = `syntax = "proto3"; message Root { message Elem { int64 id = 1; int64 oid = 2; int64 uid = 3; int64 progress = ${progressField}; int32 mode = 5; int32 fontsize = 6; int32 color = 7; string content = ${contentField}; int64 ctime = 9; } repeated Elem elem = 1; }`;
        const root = protobuf.parse(schema).root;
        const Type = root.lookupType('Root');
        const decoded = Type.decode(buf);
        const json = Type.toObject(decoded, { longs: String, defaults: true });
        const items = json.elem || [];
        if (items.length > 0) {
          const hasContent = items.some(i => i.content && i.content.length > 0);
          const hasProgress = items.some(i => Number(i.progress) > 0 && Number(i.progress) < 360000000);
          if (hasContent && hasProgress) {
            console.log(`✅ content=${contentField} progress=${progressField}`);
            items.slice(0, 3).forEach(i => {
              const sec = (Number(i.progress) / 1000).toFixed(1);
              console.log(`   [${sec}s] ${i.content}`);
            });
            process.exit(0);
          }
        }
      } catch(e) {}
    }
  }
  console.log('Not found');
})();
