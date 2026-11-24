import { readFile, writeFile, rename } from 'node:fs/promises';
import { normalizeTourism } from '../src/domain/tourism.ts';

const network = JSON.parse(await readFile(new URL('../public/data/network.json', import.meta.url), 'utf8'));
const extent = network.junctions.reduce((b, n) => [Math.min(b[0], n.position[0]), Math.min(b[1], n.position[1]), Math.max(b[2], n.position[0]), Math.max(b[3], n.position[1])], [180, 90, -180, -90]);
const bbox = [extent[1] - .02, extent[0] - .02, extent[3] + .02, extent[2] + .02].join(',');
const query = `[out:json][timeout:120][maxsize:67108864];(nwr["tourism"~"^(guest_house|hotel|hostel|camp_site|museum|attraction|viewpoint)$"](${bbox});nwr["amenity"~"^(restaurant|cafe|pub|bar|ice_cream|drinking_water|toilets|bicycle_repair_station)$"](${bbox}););out center tags;`;
const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(150000), headers: { 'User-Agent': 'Fietsroutes-Vlaanderen-data-import/1.2 (https://github.com/MGeurts/fietsroutes)' } });
if (!response.ok) throw Error(`Overpass HTTP ${response.status}; bestaande snapshot behouden.`);
const data = await response.json();
if (data.remark || !Array.isArray(data.elements)) throw Error('Onvolledige Overpass-respons; bestaande snapshot behouden.');
const places = normalizeTourism(data.elements);
if (!places.length) throw Error('Geen plaatsen gevonden; bestaande snapshot behouden.');
const target = new URL('../public/data/tourism.json', import.meta.url), temporary = new URL('../public/data/tourism.json.tmp', import.meta.url);
await writeFile(temporary, JSON.stringify({ version: 1, fetchedAt: new Date().toISOString(), places }));
await rename(temporary, target);
console.log(`Toerismesnapshot bijgewerkt: ${places.length} plaatsen in het netwerkgebied. Bron: OpenStreetMap (ODbL), via Overpass.`);
