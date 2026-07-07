const https = require('https');
const protobuf = require('protobufjs');

const cid = process.argv[2] || '39463617043';

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/' } },
      res => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(Buffer.concat(c))); }
    ).on('error', reject);
  });
}

(async () => {
  const buf = await fetchBuf(`https://api.bilibili.com/x/v2/dm/web/seg.so?oid=${cid}&type=1&segment_index=1`);

  const reader = protobuf.Reader.create(buf);
  const outerTag = reader.uint32();
  console.log('Outer: field=' + (outerTag >>> 3) + ' wire=' + (outerTag & 7));

  if ((outerTag & 7) !== 2) return;
  const outerLen = reader.uint32();
  const msgEnd = reader.pos + outerLen;

  let dmIndex = 0;
  while (reader.pos < msgEnd) {
    const tag = reader.uint32();
    if ((tag & 7) !== 2) { reader.skipType(tag & 7); continue; }
    const len = reader.uint32();
    const dmStart = reader.pos;
    const dmEnd = reader.pos + len;

    dmIndex++;
    console.log(`\nDanmaku #${dmIndex}:`);
    
    reader.pos = dmStart;
    while (reader.pos < dmEnd) {
      const ftag = reader.uint32();
      const fnum = ftag >>> 3;
      const wtype = ftag & 7;
      const savedPos = reader.pos;
      
      let val;
      if (wtype === 0) {
        val = 'varint=' + reader.uint64().toString();
      } else if (wtype === 2) {
        const slen = reader.uint32();
        const raw = buf.slice(reader.pos, reader.pos + slen);
        const asStr = raw.toString('utf8');
        if (/^[\x20-\x7E\u4e00-\u9fff\w\s,.!?;:()<>\[\]{}@#$%^&*\-_=+~`|/\\]+$/.test(asStr)) {
          val = 'str="' + asStr.substring(0, 60) + '"';
        } else {
          val = 'bytes(' + slen + ')=' + raw.toString('hex').substring(0, 30);
        }
        reader.pos += slen;
      } else if (wtype === 5) {
        val = 'fixed32=' + reader.fixed32();
      } else if (wtype === 1) {
        val = 'fixed64=' + reader.fixed64().toString();
      } else {
        val = 'wire=' + wtype;
        reader.skipType(wtype);
      }
      
      console.log(`  f${fnum} (w${wtype}): ${val}`);
      if (dmIndex >= 3) break;
    }
    if (dmIndex >= 3) break;
  }
})();
