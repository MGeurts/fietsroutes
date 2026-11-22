import { mkdir, readFile, readdir, writeFile, rename, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { zipSync, unzipSync } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const build = join(root, 'dist'), releases = join(root, 'releases');
const entries = Object.create(null);
async function collect(directory, prefix = '') {
  for (const item of (await readdir(directory)).sort()) {
    const full = join(directory, item), path = `${prefix}${item}`, stat = await lstat(full);
    if (stat.isSymbolicLink()) throw Error(`Symlink niet toegestaan in release: ${path}`);
    if (stat.isDirectory()) await collect(full, `${path}/`);
    else if (stat.isFile()) entries[path] = new Uint8Array(await readFile(full));
  }
}
await collect(build);
for (const required of ['.htaccess', 'index.html', 'data/network.json', 'sw.js', 'manifest.webmanifest']) {
  if (!entries[required]) throw Error(`Build onvolledig: ${required} ontbreekt. ZIP niet bijgewerkt.`);
}
const archive = zipSync(entries, { level: 6 });
// Verify the archive before replacing a previous release.
const verified = unzipSync(archive);
if (Object.keys(verified).length !== Object.keys(entries).length) throw Error('ZIP-controle mislukt.');
for (const [path, bytes] of Object.entries(entries)) {
  if (!Buffer.from(bytes).equals(Buffer.from(verified[path]))) throw Error(`ZIP-bestand beschadigd: ${path}`);
}
await mkdir(releases, { recursive: true });
const name = 'fietsroutes-antagonist.zip';
const temporary = join(releases, `.${name}.${process.pid}.tmp`);
await writeFile(temporary, archive);
await rename(temporary, join(releases, name));
console.log(`ZIP bijgewerkt: releases/${name} (${Object.keys(entries).length} bestanden)`);
