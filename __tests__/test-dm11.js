const https = require('https');
const protobuf = require('protobufjs');

const cid = process.argv[2] || '39463617043';

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/' }
    }, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve(Buffer.concat(c)));
    }).on('error', reject);
  });
}

(async () => {
  for (let seg = 2; seg <= 20; seg++) {
    const url = `https://api.bilibili.com/x/v2/dm/web/seg.so?oid=${cid}&type=1&segment_index=${seg}`;
    const buf = await fetchBuf(url);
    if (buf.length < 10) { console.log(`Seg ${seg}: empty (${buf.length} bytes)`); break; }

    const schema = `syntax = "proto3";
message R {
  message E {
    int64 id = 1;
    int64 progress = 10;
    string content = 7;
  }
  repeated E elems = 1;
}`;
    const root = protobuf.parse(schema).root;
    const decoded = root.lookupType('R').decode(buf);
    const json = root.lookupType('R').toObject(decoded, { longs: Number, defaults: true });
    const dms = json.elems || [];
    const withProgress = dms.filter(d => d.progress > 0);
    console.log(`Seg ${seg}: ${dms.length} dm, ${withProgress.length} with progress`);
    if (withProgress.length > 0) {
      withProgress.slice(0, 3).forEach(d =>
        console.log(`  ${(d.progress/1000).toFixed(1)}s: ${d.content}`));
    }
  }
})();
