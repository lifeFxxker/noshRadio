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
  
  // Now use protobufjs to properly decode with the correct schema
  // Based on test-dm8 findings: content=7, color=5 (0xFFFFFF mode)
  // For progress, check field 1-30 for a reasonable value

  // Use a schema with all known fields based on our analysis
  const schema = `syntax = "proto3";
message DmSegMobileReply {
  repeated DanmakuElem elems = 1;
}
message DanmakuElem {
  int64 id = 1;
  int64 oid = 2;
  int32 mode = 3;
  int32 fontsize = 4;
  int32 color = 5;
  string idStr = 6;
  string content = 7;
  int64 ctime = 8;
  int32 weight = 9;
  int64 progress = 10;
  string action = 11;
  string idStr2 = 12;
  int32 attr = 13;
  string colorful = 25;
  int64 cid = 26;
  int32 seg = 27;
}
`;
  
  const root = protobuf.parse(schema).root;
  const ReplyType = root.lookupType('DmSegMobileReply');
  const decoded = ReplyType.decode(buf);
  const json = ReplyType.toObject(decoded, { longs: Number, defaults: true });
  
  console.log('Danmaku count:', json.elems.length);
  json.elems.forEach((e, i) => {
    console.log(`[${i}] progress=${e.progress || '?'} content="${e.content}" color=${e.color} mode=${e.mode}`);
  });
})();
