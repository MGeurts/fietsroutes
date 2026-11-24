import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { replaceFile } from './atomic-file.mjs';

export function tourismQueries(extent) {
  const [west, south, east, north] = extent;
  const queries = [];
  for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) {
    const bbox = [south + (north - south) * y / 2, west + (east - west) * x / 4, south + (north - south) * (y + 1) / 2, west + (east - west) * (x + 1) / 4].join(',');
    queries.push(`[out:json][timeout:45][maxsize:134217728];(nwr["tourism"~"^(guest_house|hotel|hostel|camp_site|museum|attraction|viewpoint)$"](${bbox});nwr["amenity"~"^(restaurant|cafe|pub|bar|ice_cream|drinking_water|toilets|bicycle_repair_station)$"](${bbox}););out center tags;`);
  }
  return queries;
}
export function splitTourismQuery(query) {
  const match = query.match(/\((-?[\d.e+]+),(-?[\d.e+]+),(-?[\d.e+]+),(-?[\d.e+]+)\)/i);
  if (!match) throw Error('Het querygebied kan niet verder worden opgesplitst.');
  const [south, west, north, east] = match.slice(1).map(Number);
  if (![south, west, north, east].every(Number.isFinite) || south >= north || west >= east) throw Error('Ongeldig querygebied.');
  const boxes = east - west > north - south
    ? [[south, west, north, (west + east) / 2], [south, (west + east) / 2, north, east]]
    : [[south, west, (south + north) / 2, east], [(south + north) / 2, west, north, east]];
  return boxes.map(box => query.replaceAll(match[0], `(${box.join(',')})`));
}
async function atomicJson(file, data) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data));
  await replaceFile(temporary, file);
}
async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
}
export async function importTourism({ queries, cacheDir, target, fetchBox, normalize, validate, fresh = false, signal, report = console.log, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now() }) {
  await mkdir(cacheDir, { recursive: true });
  const stateFile = join(cacheDir, 'state.json');
  const signature = createHash('sha256').update(JSON.stringify(queries)).digest('hex');
  let state = fresh ? null : await readJson(stateFile);
  if (!state || state.signature !== signature || state.complete || !/^[a-f0-9-]{36}$/.test(state.id) || !Number.isFinite(state.startedAt) || now() - state.startedAt > 6 * 3600000 || now() < state.startedAt) {
    state = { signature, id: randomUUID(), startedAt: now(), complete: false };
    await atomicJson(stateFile, state);
  } else report('Onvoltooide import hervatten; eerder opgehaalde gebieden worden hergebruikt.');
  const elements = [];
  let downloaded = 0, reused = 0, requests = 0;
  async function retrieve(query, key, depth = 0) {
    signal?.throwIfAborted();
    const cacheFile = join(cacheDir, `${state.id}-${key}.json`);
    const cached = await readJson(cacheFile);
    let chunk;
    if (cached?.query === query && Array.isArray(cached.elements)) {
      chunk = cached.elements; reused++;
      report(`Gebied ${key}: uit hervatcache (${chunk.length} objecten).`);
    } else {
      if (requests) await wait(5000);
      signal?.throwIfAborted();
      report(`Gebied ${key}: ophalen…`);
      requests++;
      try { chunk = await fetchBox(query, signal); }
      catch (error) {
        if (depth >= 3 || !(error.resourceLimit || error.cause?.resourceLimit)) throw error;
        report(`Gebied ${key}: serverlimiet bereikt; opsplitsen in twee kleinere gebieden.`);
        const children = splitTourismQuery(query);
        chunk = [];
        for (let child = 0; child < children.length; child++) {
          const result = await retrieve(children[child], `${key}-${child + 1}`, depth + 1);
          for (const element of result) chunk.push(element);
        }
      }
      if (!Array.isArray(chunk)) throw Error('Onvolledig antwoord; bestaande snapshot behouden.');
      await atomicJson(cacheFile, { query, elements: chunk });
      downloaded++;
      report(`Gebied ${key}: ${chunk.length} objecten ontvangen.`);
    }
    return chunk;
  }
  for (let i = 0; i < queries.length; i++) {
    report(`Hoofdgebied ${i + 1}/${queries.length}`);
    const chunk = await retrieve(queries[i], String(i + 1));
    for (const element of chunk) elements.push(element);
  }
  const places = normalize(elements);
  if (!places.length) throw Error('Geen plaatsen gevonden; bestaande snapshot behouden.');
  // Refuse suspiciously large losses; --fresh only resets retrieval, it never bypasses this guard.
  const previous = await readJson(target);
  if (Array.isArray(previous?.places) && places.length < previous.places.length * .7) throw Error('Meer dan 30% minder plaatsen gevonden; bestaande snapshot behouden. Controleer de brongegevens.');
  const snapshot = { version: 1, fetchedAt: new Date(state.startedAt).toISOString(), places };
  validate(snapshot);
  signal?.throwIfAborted();
  await atomicJson(target, snapshot);
  try {
    await atomicJson(stateFile, { ...state, complete: true });
    // Only delete generated chunk files, never arbitrary files or directories.
    for (const name of await readdir(cacheDir)) if (/^[a-f0-9-]{36}(?:-\d+)+\.json$/.test(name) && !name.startsWith(state.id + '-')) await unlink(join(cacheDir, name));
  } catch { report('Snapshot bijgewerkt, maar de hervatcache kon niet volledig worden opgeruimd.'); }
  report(`Toerismesnapshot bijgewerkt: ${places.length} plaatsen; ${downloaded} gebieden opgehaald, ${reused} hergebruikt.`);
  return snapshot;
}
