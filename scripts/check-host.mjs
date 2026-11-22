import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const origin = new URL(process.argv[2] ?? 'https://fietsroutes.test');
if (origin.protocol === 'https:') {
  const httpUrl = new URL(origin); httpUrl.protocol = 'http:';
  const redirect = await fetch(httpUrl, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  assert([301, 302, 307, 308].includes(redirect.status), 'HTTP moet naar HTTPS doorsturen.');
  const destination = new URL(redirect.headers.get('location') ?? '', httpUrl);
  assert.equal(destination.protocol, 'https:', 'HTTP-redirect moet HTTPS gebruiken.');
  assert.equal(destination.hostname, origin.hostname, 'HTTPS-redirect mag het domein niet wijzigen.');
  console.log('OK HTTP → HTTPS');
}
async function get(path, mime) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assert.match(response.headers.get('content-type') ?? '', mime, `${path}: verkeerd MIME-type`);
  return response.text();
}
const html = await get('/', /^text\/html\b/i);
assert.equal(html, await readFile(new URL('../dist/index.html', import.meta.url), 'utf8'), 'De host serveert niet de laatste lokale build.');
assert.equal(html, await get('/index.html', /^text\/html\b/i), 'De startpagina en PWA-entry moeten dezelfde gebouwde HTML zijn.');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
assert(scripts.some(src => /^\/assets\/.+\.js$/.test(src)), 'De HTML moet een gebouwd JavaScript-module laden.');
assert(scripts.every(src => !/\.(tsx?|jsx)(?:\?|$)/.test(src)), 'De productiepagina mag geen bronmodules laden.');
for (const src of [...scripts, '/sw.js']) {
  const content = await get(src, /^(?:text|application)\/javascript\b/i);
  assert(!/^\s*</.test(content), `${src}: HTML ontvangen in plaats van JavaScript`);
  console.log(`OK JavaScript: ${src}`);
}
for (const path of ['/src/main.tsx', '/web/index.html', '/package.json']) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 404, `${path}: projectbron mag niet worden geserveerd`);
}
console.log('OK: productie-HTML, script-MIME-types, serviceworker en documentroot.');

