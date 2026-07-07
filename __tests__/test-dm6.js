const https = require('https');
const protobuf = require('protobufjs');

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

// Try a different proto schema - newer B站 uses dmSegMobileReply with elems containing Dm
const DM_PROTO_V2 = `
syntax = "proto3";
package bilibili.dm;

message SegReply {
  repeated Danmaku elem = 1;
}

message Danmaku {
  int64 id = 1;
  int64 oid = 2;
  int64 mid = 3;
  int64 uid = 4;
  int64 progress = 5;
  int32 mode = 6;
  int32 fontsize = 7;
  int32 color = 8;
  string content = 9;
  int64 ctime = 10;
  int32 weight = 11;
  string action = 12;
  int32 pool = 13;
  string idStr = 14;
  int32 attr = 15;
}
`;

(async () => {
  const cid = process.argv[2] || '39463617043';
  const buf = await fetchBuf(`https://api.bilibili.com/x/v2/dm/web/seg.so?oid=${cid}&type=1&segment_index=1`);

  // Try different schema definitions
  const schemas = [
    `syntax = "proto3"; message Root { message Elem { int64 id = 1; int64 progress = 5; int32 mode = 6; string content = 9; } repeated Elem elem = 1; }`,
    `syntax = "proto3"; message Root { message Elem { int64 id = 1; int64 oid = 2; int64 mid = 3; int64 progress = 9; string content = 8; } repeated Elem elems = 1; }`,
    DM_PROTO_V2
  ];

  for (const schema of schemas) {
    try {
      const root = protobuf.parse(schema).root;
      const Type = root.lookupType('Root');
      const decoded = Type.decode(buf);
      const json = Type.toObject(decoded, { longs: String, defaults: true, enums: String });
      const firstKey = Object.keys(json)[0];
      const items = json[firstKey] || [];
      if (items.length > 0) {
        console.log(`✅ Schema works! Key="${firstKey}", count=${items.length}`);
        console.log('   Sample:', JSON.stringify(items[0]));
        break;
      }
    } catch(e) {}
  }
})();
