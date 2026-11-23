import { normalizeSourceEdge } from './normalize-edge.mjs';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';

const base = 'https://geodata.toerismevlaanderen.be/geoserver/wfs';
async function download(layer) {
  const features = [];
  for (let start = 0; ; start += 2000) {
    const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: `routes:${layer}`, outputFormat: 'application/json', srsName: 'EPSG:4326', count: '2000', startIndex: String(start), sortBy: 'objectid' });
    const response = await fetch(`${base}?${params}`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw Error(`WFS ${response.status}: ${layer}`);
    const page = await response.json();
    if (!Array.isArray(page.features)) throw Error(`Ongeldig WFS-antwoord: ${layer}`);
    features.push(...page.features);
    console.log(`${layer}: ${features.length}/${page.numberMatched}`);
    if (features.length >= Number(page.numberMatched)) break;
    if (!page.features.length) throw Error('Onvolledige WFS-download');
  }
  return features;
}

const cached = process.argv.includes('--cached') ? JSON.parse(await readFile('.cache/wfs-source.json', 'utf8')) : null;
const nodes = cached?.nodes ?? await download('knoop_fiets');
const lines = cached?.lines ?? await download('traject_fiets');
await mkdir('.cache', { recursive: true });
const sourceFetchedAt = cached ? (cached.fetchedAt ?? JSON.parse(await readFile('public/data/network.json', 'utf8')).fetchedAt) : new Date().toISOString();
await writeFile('.cache/wfs-source.json', JSON.stringify({ nodes, lines, fetchedAt: sourceFetchedAt }));
const report = { oneWayEdges: 0, unknownDirection: 0, directionConflict: 0, skippedNodes: 0, skippedEdges: 0, directions: {}, ambiguousIds: 0, mergedRecords: 0, invalidGeometry: 0 };
const junctions = [];
const ids = new Set();
const groups = Map.groupBy(nodes, f => f.properties.geoid);
const distance = (a, b) => Math.hypot((a[0] - b[0]) * 70000, (a[1] - b[1]) * 111000);
for (const f of nodes) {
  const p = f.properties;
  if (f.geometry?.type !== 'Point' || p.geoid == null) { report.skippedNodes++; continue; }
  const group = groups.get(p.geoid);
  // Only source-assigned shared identities may merge. Conflicting numbers/positions are excluded.
  if (group.some(n => n.properties.knoopnr !== p.knoopnr || n.geometry?.type !== 'Point' || distance(n.geometry.coordinates, f.geometry.coordinates) > 40)) { report.ambiguousIds++; continue; }
  const id = String(p.geoid);
  if (ids.has(id)) { report.mergedRecords++; continue; }
  ids.add(id);
  junctions.push({ id, number: Number.isInteger(p.knoopnr) && p.knoopnr >= 0 ? String(p.knoopnr) : null, position: f.geometry.coordinates, network: p.naam, owner: p.eigenaar });
}
const edges = [];
const nodeMap = new Map(junctions.map(n => [n.id, n]));
for (const f of lines) {
  const p = f.properties;
  report.directions[String(p.direction)] = (report.directions[String(p.direction)] ?? 0) + 1;
  const result = normalizeSourceEdge(f, nodeMap);
  if (!result.edge) {
    const reason = result.reason;
    if (reason === 'unknownDirection' || reason === 'directionConflict') { report[reason]++; report.skippedEdges++; }
    else report[reason]++;
    continue;
  }
  edges.push(result.edge);
  if (result.edge.oneWay) report.oneWayEdges++;
}
if (junctions.length < 4000 || edges.length < 7000) throw Error(`Datasetcontrole mislukt: ${JSON.stringify(report)}`);
const dataset = { version: 1, fetchedAt: sourceFetchedAt, processedAt: new Date().toISOString(), source: base, attribution: 'Toerisme Vlaanderen en de vijf provinciale toeristische organisaties', junctions, edges, report };
await mkdir('public/data', { recursive: true });
await writeFile('public/data/network.json.tmp', JSON.stringify(dataset));
await rename('public/data/network.json.tmp', 'public/data/network.json');
console.log(JSON.stringify({ junctions: junctions.length, edges: edges.length, report }, null, 2));
