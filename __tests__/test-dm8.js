const https = require('https');
const protobuf = require('protobufjs');

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/' }
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
  
  // Use protobufjs reader to inspect raw fields
  const reader = protobuf.Reader.create(buf);
  
  function readFields(r, end) {
    const fields = {};
    while (r.pos < end) {
      const tag = r.uint32();
      const fieldNum = tag >>> 3;
      const wireType = tag & 7;
      if (!fields[fieldNum]) fields[fieldNum] = [];
      
      if (wireType === 0) { // varint
        fields[fieldNum].push({ type: 'varint', value: r.uint64().toString() });
      } else if (wireType === 2) { // length-delimited
        const len = r.uint32();
        const start = r.pos;
        // Try to read as string
        const strVal = buf.toString('utf8', start, start + Math.min(len, 200));
        const isReadable = /^[\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+$/.test(strVal.replace(/\0/g,''));
        if (isReadable && len < 500) {
          const fullStr = buf.toString('utf8', start, start + len).replace(/\0/g, '').trim();
          fields[fieldNum].push({ type: 'string', value: fullStr });
        } else {
          fields[fieldNum].push({ type: 'bytes', hex: buf.slice(start, start + len).toString('hex').substring(0, 40) });
        }
        r.pos += len;
      } else if (wireType === 5) { // 32-bit
        fields[fieldNum].push({ type: 'fixed32', value: r.fixed32() });
      } else if (wireType === 1) { // 64-bit
        fields[fieldNum].push({ type: 'fixed64', hex: r.fixed64().toString().substring(0, 16) });
      }
    }
    return fields;
  }
  
  // First, the outer message - it's a length-delimited root
  const rootTag = reader.uint32();
  console.log('Root tag: field=' + (rootTag >>> 3) + ' wire=' + (rootTag & 7));
  if ((rootTag & 7) === 2) {
    const len = reader.uint32();
    const innerFields = readFields(reader, reader.pos + len);
    
    console.log('=== Fields in SegReply ===');
    for (const [num, vals] of Object.entries(innerFields)) {
      console.log(`Field ${num}:`);
      vals.slice(0, 3).forEach(v => {
        if (v.type === 'string') console.log(`  [string] "${v.value.substring(0, 80)}"`);
        else if (v.type === 'varint') console.log(`  [varint] ${v.value}`);
        else console.log(`  [${v.type}] ${v.hex || v.value}`);
      });
      if (vals.length > 3) console.log(`  ... and ${vals.length - 3} more`);
    }
  }
})();
