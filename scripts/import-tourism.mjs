import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { normalizeTourism, parseTourismSnapshot } from '../src/domain/tourism.ts';
import { requestOverpass } from './overpass-request.mjs';
import { importTourism, tourismQueries } from './tourism-import-core.mjs';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('npm run data:tourism [-- --fresh]\nHervat standaard een onvoltooide import van maximaal 6 uur oud. --fresh haalt alle gebieden opnieuw op.');
    return;
  }
  if (args.some(arg => arg !== '--fresh')) throw Error('Onbekende optie. Gebruik --help voor uitleg.');
  const cacheDir = fileURLToPath(new URL('../.cache/tourism-import/', import.meta.url));
  await mkdir(cacheDir, { recursive: true });
  const lockFile = join(cacheDir, 'import.lock');
  let lock;
  try { lock = await open(lockFile, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(await readFile(lockFile, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw Error('Importvergrendeling is onleesbaar: controleer of een andere import actief is.');
    try { process.kill(pid, 0); throw Error('Er loopt al een toerisme-import. Wacht tot die voltooid is.'); }
    catch (check) { if (check.code !== 'ESRCH') throw check; }
    await unlink(lockFile); lock = await open(lockFile, 'wx');
  }
  await lock.writeFile(String(process.pid));
  const controller = new AbortController();
  const stop = () => controller.abort(new Error('Import onderbroken; opgehaalde gebieden blijven beschikbaar om te hervatten.'));
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const wait = ms => delay(ms, undefined, { signal: controller.signal });
  try {
    const network = JSON.parse(await readFile(new URL('../public/data/network.json', import.meta.url), 'utf8'));
    const extent = network.junctions.reduce((b, n) => [Math.min(b[0], n.position[0]), Math.min(b[1], n.position[1]), Math.max(b[2], n.position[0]), Math.max(b[3], n.position[1])], [180, 90, -180, -90]);
    if (!extent.every(Number.isFinite) || extent[0] >= extent[2] || extent[1] >= extent[3]) throw Error('Ongeldig netwerkgebied.');
    const queries = tourismQueries([extent[0] - .02, extent[1] - .02, extent[2] + .02, extent[3] + .02]);
    await importTourism({ queries, cacheDir, target: fileURLToPath(new URL('../public/data/tourism.json', import.meta.url)),
      fetchBox: (query, signal) => requestOverpass(query, { signal, wait }), normalize: normalizeTourism, validate: parseTourismSnapshot,
      fresh: args.includes('--fresh'), signal: controller.signal, wait });
  } finally {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    await lock.close(); await unlink(lockFile);
  }
}
main().catch(error => { console.error(`Toerisme bijwerken mislukt: ${error.message}\nBestaande snapshot behouden. Start dezelfde opdracht opnieuw om te hervatten.`); process.exitCode = 1; });
