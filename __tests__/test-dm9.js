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
  
  const reader = protobuf.Reader.create(buf);
  
  // Skip outer tag+len
  reader.uint32(); // tag
  const outerLen = reader.uint32(); // outer length
  const endPos = reader.pos + outerLen;
  
  // Read inner repeated messages
  while (reader.pos < endPos) {
    const tag = reader.uint32();
    const len = reader.uint32();
    const msgEnd = reader.pos + len;
    
    const fields = {};
    while (reader.pos < msgEnd) {
      const ftag = reader.uint32();
      const fnum = ftag >>> 3;
      const wtype = ftag & 7;
      
      let val;
      if (wtype === 0) val = reader.uint64().toString();
      else if (wtype === 2) {
        const slen = reader.uint32();
        val = buf.toString('utf8', reader.pos, reader.pos + slen);
        reader.pos += slen;
      } else if (wtype === 5) val = reader.fixed32();
      else { reader.skipType(wtype); val = '?'; }
      
      fields[fnum] = val;
    }
    
    // Print all fields
    console.log('DM:', JSON.stringify(fields));
    // Find progress - likely field 5 (16777215=FFFFFF=color) or field 10
    break; // just first one
  }
})();
