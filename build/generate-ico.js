const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

/* Minimal ICO writer — embeds raw PNG data (supported on Vista+) */
function writeIco(pngs, dst) {
  const num = pngs.length;
  const hdr = Buffer.alloc(6 + 16 * num);
  hdr.writeUInt16LE(0, 0);   // reserved
  hdr.writeUInt16LE(1, 2);   // type = ICO
  hdr.writeUInt16LE(num, 4); // count

  let off = 6 + 16 * num;
  for (let i = 0; i < num; i++) {
    const p = pngs[i];
    const w = p.readUInt32BE(16);  // PNG IHDR width
    const h = p.readUInt32BE(20);  // PNG IHDR height
    const ent = Buffer.alloc(16);
    ent.writeUInt8(w >= 256 ? 0 : w, 0);
    ent.writeUInt8(h >= 256 ? 0 : h, 1);
    ent.writeUInt8(0, 2);
    ent.writeUInt8(0, 3);
    ent.writeUInt16LE(1, 4);    // color planes
    ent.writeUInt16LE(32, 6);   // bits per pixel
    ent.writeUInt32LE(p.length, 8);
    ent.writeUInt32LE(off, 12);
    ent.copy(hdr, 6 + i * 16, 0);
    off += p.length;
  }
  fs.writeFileSync(dst, Buffer.concat([hdr, ...pngs]));
}

async function main() {
  const src = await Jimp.read(path.join(__dirname, 'icon.png'));
  const sizes = [16, 24, 32, 48, 64, 96, 128, 256];
  const pngs = [];

  for (const s of sizes) {
    const buf = await src.clone().resize({ w: s, h: s }).getBuffer('image/png');
    pngs.push(buf);
    console.log('  ' + s + 'x' + s + ': ' + (buf.length / 1024).toFixed(1) + ' KB');
  }

  writeIco(pngs, path.join(__dirname, 'icon.ico'));
  const total = pngs.reduce((a, b) => a + b.length, 0);
  console.log('\nicon.ico generated: ' + (total / 1024).toFixed(1) + ' KB');
  console.log('Sizes: ' + sizes.join(', '));
}

main().catch(e => console.error('Error:', e));
