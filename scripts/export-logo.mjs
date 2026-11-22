import { writeFile, readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Bike } from 'lucide-react';
import sharp from 'sharp';

// Same colours, proportions and Lucide bicycle as the app header.
const bicycle = renderToStaticMarkup(createElement(Bike, { width: 314, height: 314, color: '#073b32', strokeWidth: 2 }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="151" fill="#b4f479"/><g transform="translate(99 99)">${bicycle}</g></svg>`;
await writeFile('public/logo.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('public/logo.png');

const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(sizes.map(size => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); // ICO image type
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index] % 256;
  header[entry + 1] = sizes[index] % 256;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile('public/logo.ico', Buffer.concat([header, ...images]));

const ico = await readFile('public/logo.ico');
for (let index = 0; index < sizes.length; index++) {
  const entry = 6 + index * 16, length = ico.readUInt32LE(entry + 8), start = ico.readUInt32LE(entry + 12);
  const image = await sharp(ico.subarray(start, start + length)).metadata();
  if (image.width !== sizes[index] || image.height !== sizes[index]) throw Error('Ongeldige ICO-resolutie');
}
console.log('Gemaakt: public/logo.ico (16–256 px), public/logo.png (512 px), public/logo.svg.');
