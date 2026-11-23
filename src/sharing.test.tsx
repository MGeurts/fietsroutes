import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { expect, it } from 'vitest';
import { routeShareUrl } from './domain/sharing';
it('maakt een publiek HTTPS-adres met alle gekozen punten in de juiste volgorde',()=>{
  const stops=['5421142','5422935','5421142'], url=new URL(routeShareUrl(stops));
  expect(url.origin).toBe('https://fietsroutes.kreaweb.be'); expect(url.search).toBe('');
  expect(new URLSearchParams(url.hash.slice(1)).get('route')?.split(',')).toEqual(stops);
  expect(()=>routeShareUrl(['1'])).toThrow(); expect(()=>routeShareUrl(['1','<script>'])).toThrow();
});
it.each([4,200])('genereert een werkelijk decodeerbare QR-code voor %i gekozen punten',async count=>{
  const data=JSON.parse(readFileSync('public/data/network.json','utf8'));
  const stops=data.junctions.filter((n: {number: string|null})=>n.number).slice(0,count).map((n: {id: string})=>n.id);
  const name='534 - Rondrit & café + bos - 25,3 km', url=routeShareUrl(stops,name);
  const svg=renderToStaticMarkup(<QRCodeSVG value={url} size={count > 60 ? 640 : 400} level="M" boostLevel={false} marginSize={4}/>);
  const {data: pixels,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const decoded=jsQR(new Uint8ClampedArray(pixels),info.width,info.height);
  expect(decoded?.data).toBe(url);
  expect(new URLSearchParams(new URL(decoded!.data).hash.slice(1)).get('name')).toBe(name);
  expect(new URLSearchParams(new URL(decoded!.data).hash.slice(1)).get('route')?.split(',')).toEqual(stops);
});
