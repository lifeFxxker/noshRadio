const https = require('https');
const protobuf = require('protobufjs');

// B站 Danmaku protobuf schema (reverse-engineered, public)
const DM_PROTO = `
syntax = "proto3";
package bilibili.community.service.dm.v1;

message DmSegMobileReply {
  repeated DanmakuElem elems = 1;
}

message DanmakuElem {
  int64 id = 1;
  int64 oid = 2;
  int64 mid = 3;
  int64 uid = 4;
  int32 mode = 5;
  int32 fontsize = 6;
  int32 color = 7;
  string content = 8;
  int64 progress = 9;
  int64 ctime = 10;
  int32 weight = 11;
  string action = 12;
  int32 pool = 13;
  string idStr = 14;
  int32 attr = 15;
}
`;

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/'
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
  console.log('Fetching danmaku for CID:', cid);
  
  const buf = await fetchBuf(`https://api.bilibili.com/x/v2/dm/web/seg.so?oid=${cid}&type=1&segment_index=1`);
  console.log('Raw size:', buf.length, 'bytes');

  const root = protobuf.parse(DM_PROTO).root;
  const DmSegMobileReply = root.lookupType('bilibili.community.service.dm.v1.DmSegMobileReply');
  
  try {
    const decoded = DmSegMobileReply.decode(buf);
    const json = DmSegMobileReply.toObject(decoded, { 
      longs: Number, enums: Number, defaults: true 
    });
    
    const danmaku = json.elems || [];
    console.log('Danmaku count:', danmaku.length);
    
    // Sort by progress (time position)
    danmaku.sort((a, b) => a.progress - b.progress);
    
    // Show first 10
    danmaku.slice(0, 10).forEach(d => {
      const seconds = (d.progress / 1000).toFixed(1);
      console.log(`  [${seconds}s] ${d.content}`);
    });
    
    if (danmaku.length > 10) {
      console.log(`  ... and ${danmaku.length - 10} more`);
      // Also show last 3
      danmaku.slice(-3).forEach(d => {
        const seconds = (d.progress / 1000).toFixed(1);
        console.log(`  [${seconds}s] ${d.content}`);
      });
    }
  } catch(e) {
    console.log('Decode failed:', e.message);
  }
})();
