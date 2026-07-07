const https = require('https');
const protobuf = require('protobufjs');

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/' }
    }, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(c) }));
    }).on('error', reject);
  });
}

(async () => {
  // First search for a very popular B站 video
  console.log('=== 搜索热门视频 ===');
  const searchRes = await fetchBuf(`https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent('周杰伦 演唱会 全程')}&page=1&page_size=5`);
  const search = JSON.parse(searchRes.buf.toString());
  const vids = search.data.result.filter(r => r.type === 'video' && r.bvid);
  
  for (const v of vids.slice(0, 3)) {
    const title = v.title.replace(/<[^>]+>/g, '').substring(0, 40);
    console.log(`\n=== 检查: ${v.bvid} ${title} ===`);
    
    // Get view info for CID
    const viewBuf = await fetchBuf(`https://api.bilibili.com/x/web-interface/view?bvid=${v.bvid}`);
    const view = JSON.parse(viewBuf.buf.toString());
    if (view.code !== 0 || !view.data) {
      console.log('  View failed:', view.code);
      continue;
    }
    const cid = view.data.cid;
    const duration = view.data.duration;
    console.log(`  CID: ${cid}, Duration: ${duration}s`);
    
    // Try seg 1-6
    const segCount = Math.min(Math.ceil(duration / 360) + 1, 20);
    let totalDm = 0;
    let totalWithProgress = 0;
    
    for (let seg = 1; seg <= segCount; seg++) {
      const url = `https://api.bilibili.com/x/v2/dm/web/seg.so?oid=${cid}&type=1&segment_index=${seg}`;
      const { status, buf } = await fetchBuf(url);
      if (buf.length < 10 || status !== 200) break;
      
      const schema = `syntax = "proto3"; message R { message E { int64 id = 1; int64 progress = 10; string content = 7; } repeated E elems = 1; }`;
      try {
        const root = protobuf.parse(schema).root;
        const decoded = root.lookupType('R').decode(buf);
        const json = root.lookupType('R').toObject(decoded, { longs: Number, defaults: true });
        const dms = json.elems || [];
        totalDm += dms.length;
        totalWithProgress += dms.filter(d => d.progress > 0).length;
      } catch(e) { break; }
    }
    
    console.log(`  Total dm: ${totalDm}, with progress: ${totalWithProgress}`);
    
    // If found plenty with progress, show samples
    if (totalWithProgress > 0) {
      // Get first seg with progress
      for (let seg = 1; seg <= segCount; seg++) {
        const url = `https://api.bilibili.com/x/v2/dm/web/seg.so?oid=${cid}&type=1&segment_index=${seg}`;
        const { buf } = await fetchBuf(url);
        if (buf.length < 10) continue;
        const schema = `syntax = "proto3"; message R { message E { int64 id = 1; int64 progress = 10; string content = 7; } repeated E elems = 1; }`;
        try {
          const root = protobuf.parse(schema).root;
          const decoded = root.lookupType('R').decode(buf);
          const json = root.lookupType('R').toObject(decoded, { longs: Number, defaults: true });
          const withProgress = (json.elems || []).filter(d => d.progress > 0);
          if (withProgress.length > 0) {
            console.log(`  Sample from seg ${seg}:`);
            withProgress.slice(0, 5).forEach(d => {
              console.log(`    [${(d.progress/1000).toFixed(1)}s] ${d.content}`);
            });
            break;
          }
        } catch(e) {}
      }
      break;
    }
    
    if (totalDm === 0) console.log('  (no danmaku at all)');
  }
})();
