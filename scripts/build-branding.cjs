// Generate platform icons and Store artwork from the editable SVG master.
// Usage: node scripts/build-branding.cjs <path-to-sharp-module>
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(__dirname, '..');
const master = fs.readFileSync(path.join(root, 'build/icon.svg'));
async function png(size) { return sharp(master).resize(size, size).png().toBuffer(); }
async function main() {
  fs.copyFileSync(path.join(root, 'build/icon.svg'), path.join(root, 'public/favicon.svg'));
  fs.writeFileSync(path.join(root, 'build/icon.png'), await png(1024));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(sizes.map(png));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + i * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[i].length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  fs.writeFileSync(path.join(root, 'build/icon.ico'), Buffer.concat([header, ...images]));
  const chunks = [];
  for (const [type, size] of [['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024]]) {
    const data = await png(size); const head = Buffer.alloc(8);
    head.write(type); head.writeUInt32BE(data.length + 8, 4); chunks.push(head, data);
  }
  const icns = Buffer.alloc(8); icns.write('icns'); icns.writeUInt32BE(8 + chunks.reduce((n,b)=>n+b.length,0),4);
  fs.writeFileSync(path.join(root, 'build/icon.icns'), Buffer.concat([icns,...chunks]));
  const appx = path.join(root, 'build/appx'); fs.mkdirSync(appx, {recursive:true});
  for (const [name,size] of [['StoreLogo',50],['Square44x44Logo',44],['Square150x150Logo',150],['SmallTile',71],['LargeTile',310]]) {
    fs.writeFileSync(path.join(appx,`${name}.png`), await png(size));
  }
  await sharp({create:{width:310,height:150,channels:4,background:'#090d38'}})
    .composite([{input:await png(130),left:90,top:10}]).png().toFile(path.join(appx,'Wide310x150Logo.png'));
  const store = path.join(root, 'store-assets'); fs.mkdirSync(store, {recursive:true});
  for (const size of [300, 512, 1024]) fs.writeFileSync(path.join(store, `Sholly-PDF-logo-${size}x${size}.png`), await png(size));
  await sharp({create:{width:1920,height:1080,channels:4,background:'#090d38'}})
    .composite([{input:await png(800),left:560,top:140}]).png().toFile(path.join(store,'Sholly-PDF-branding-1920x1080.png'));
  console.log('Generated SVG, PNG, ICO, ICNS and Store branding.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
