/**
 * Build the production graph from regional OpenStreetMap PBF extracts.
 *
 * This deliberately does not use Overpass: a nationwide relation query can time out,
 * and recursive JSON responses can exceed the GitHub Actions Node heap. Osmium scans
 * the binary extracts on disk and returns only the route relations, their ways, and
 * the referenced nodes needed to verify an individual knooppunt connection.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { KnooppuntNode, OfficialNetworkDataset, OfficialNetworkDatasetEdge } from '../src/types';

interface PbfSource { filename: string; label: string; url: string; }
interface OplNode { id: number; lat: number; lng: number; tags: Record<string, string>; }
interface OplWay { id: number; nodeIds: number[]; }
interface OplRelation { id: number; tags: Record<string, string>; nodeMemberIds: number[]; wayMemberIds: number[]; }

const PBF_SOURCES: PbfSource[] = [
  { label: 'Belgium', filename: 'belgium-latest.osm.pbf', url: 'https://download.geofabrik.de/europe/belgium-latest.osm.pbf' },
  { label: 'Netherlands', filename: 'netherlands-latest.osm.pbf', url: 'https://download.geofabrik.de/europe/netherlands-latest.osm.pbf' },
];
const EXPLICIT_ENDPOINT_TOLERANCE_DEGREES = 0.0045; // Tag-defined endpoints only (~500 m).
const INFERRED_ENDPOINT_TOLERANCE_DEGREES = 0.001; // Geometry endpoint to one unique junction (~110 m).
const SEGMENT_JOIN_TOLERANCE_DEGREES = 0.00001; // Ways must actually meet; never bridge a visible gap.
const JUNCTION_INDEX_CELL_DEGREES = 0.01;

function close(a: [number, number], b: [number, number], tolerance = SEGMENT_JOIN_TOLERANCE_DEGREES): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

function decodeOpl(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function parseTags(line: string): Record<string, string> {
  const token = /(?:^|\s)T([^\s]*)/.exec(line)?.[1];
  if (!token) return {};
  const tags: Record<string, string> = {};
  for (const pair of token.split(',')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    tags[decodeOpl(pair.slice(0, separator))] = decodeOpl(pair.slice(separator + 1));
  }
  return tags;
}

function parseNode(line: string): OplNode | null {
  const id = /^n(\d+)\b/.exec(line)?.[1];
  const lng = /(?:^|\s)x(-?\d+(?:\.\d+)?)/.exec(line)?.[1];
  const lat = /(?:^|\s)y(-?\d+(?:\.\d+)?)/.exec(line)?.[1];
  if (!id || lng === undefined || lat === undefined) return null;
  return { id: Number(id), lat: Number(lat), lng: Number(lng), tags: parseTags(line) };
}

function parseWay(line: string): OplWay | null {
  const id = /^w(\d+)\b/.exec(line)?.[1];
  const members = /(?:^|\s)N([^\s]*)/.exec(line)?.[1];
  if (!id || !members) return null;
  const nodeIds = members.split(',')
    .map((member) => /^n(\d+)$/.exec(member)?.[1])
    .filter((member): member is string => Boolean(member))
    .map(Number);
  return nodeIds.length > 1 ? { id: Number(id), nodeIds } : null;
}

function parseRelation(line: string): OplRelation | null {
  const id = /^r(\d+)\b/.exec(line)?.[1];
  const members = /(?:^|\s)M([^\s]*)/.exec(line)?.[1];
  if (!id || members === undefined) return null;
  const nodeMemberIds: number[] = [];
  const wayMemberIds: number[] = [];
  for (const member of members.split(',')) {
    const match = /^(n|w)(\d+)(?:@.*)?$/.exec(member);
    if (!match) continue;
    if (match[1] === 'n') nodeMemberIds.push(Number(match[2]));
    if (match[1] === 'w') wayMemberIds.push(Number(match[2]));
  }
  return { id: Number(id), tags: parseTags(line), nodeMemberIds, wayMemberIds };
}

async function readOplLines(file: string, consume: (line: string) => void): Promise<void> {
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) consume(line);
}

function isRcnCycleRelation(relation: OplRelation): boolean {
  return relation.tags.type === 'route'
    && relation.tags.route === 'bicycle'
    && relation.tags.network === 'rcn'
    && relation.tags.state?.toLowerCase() !== 'connection'
    && relation.tags.state?.toLowerCase() !== 'alternate';
}

function getKnooppuntRef(node: OplNode): string | undefined {
  if (node.tags.rcn_ref) return node.tags.rcn_ref.trim();
  if (node.tags['network:type'] === 'node_network' && node.tags.ref) return node.tags.ref.trim();
  if (node.tags.network === 'rcn' && node.tags.ref) return node.tags.ref.trim();
  return undefined;
}

function buildCoordinates(relation: OplRelation, ways: Map<number, OplWay>, nodes: Map<number, OplNode>): [number, number][] | null {
  const segments = relation.wayMemberIds
    .map((wayId) => ways.get(wayId)?.nodeIds.map((nodeId) => nodes.get(nodeId)).filter((node): node is OplNode => Boolean(node)).map((node) => [node.lat, node.lng] as [number, number]))
    .filter((segment): segment is [number, number][] => Boolean(segment && segment.length > 1));
  if (segments.length !== relation.wayMemberIds.length || segments.length === 0) return null;

  const first = segments.shift()!;
  let coordinates = first;
  for (const segment of segments) {
    const tail = coordinates[coordinates.length - 1];
    const next = close(tail, segment[0]) ? segment : close(tail, segment[segment.length - 1]) ? [...segment].reverse() : null;
    if (!next) return null;
    coordinates = coordinates.concat(next.slice(1));
  }
  return coordinates;
}

function junctionCell(lat: number, lng: number): string {
  return `${Math.floor(lat / JUNCTION_INDEX_CELL_DEGREES)}:${Math.floor(lng / JUNCTION_INDEX_CELL_DEGREES)}`;
}

function buildJunctionIndex(nodes: Iterable<OplNode>): Map<string, OplNode[]> {
  const index = new Map<string, OplNode[]>();
  for (const node of nodes) {
    if (!getKnooppuntRef(node)) continue;
    const key = junctionCell(node.lat, node.lng);
    const bucket = index.get(key) || [];
    bucket.push(node);
    index.set(key, bucket);
  }
  return index;
}

function findUniqueJunction(coordinate: [number, number], index: Map<string, OplNode[]>): OplNode | null {
  const [lat, lng] = coordinate;
  const row = Math.floor(lat / JUNCTION_INDEX_CELL_DEGREES);
  const column = Math.floor(lng / JUNCTION_INDEX_CELL_DEGREES);
  const candidates: OplNode[] = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      for (const node of index.get(`${row + rowOffset}:${column + columnOffset}`) || []) {
        if (close(coordinate, [node.lat, node.lng], INFERRED_ENDPOINT_TOLERANCE_DEGREES)) candidates.push(node);
      }
    }
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function resolveEndpoints(relation: OplRelation, coordinates: [number, number][], nodes: Map<number, OplNode>, junctionIndex: Map<string, OplNode[]>): { from: OplNode; to: OplNode; coordinates: [number, number][] } | null {
  const explicit = relation.nodeMemberIds.map((id) => nodes.get(id)).filter((node): node is OplNode => Boolean(node && getKnooppuntRef(node)));
  const start = coordinates[0];
  const finish = coordinates[coordinates.length - 1];
  if (explicit.length > 1) {
    const from = explicit[0];
    const to = explicit[explicit.length - 1];
    if (from.id === to.id) return null;
    if (close(start, [from.lat, from.lng], EXPLICIT_ENDPOINT_TOLERANCE_DEGREES) && close(finish, [to.lat, to.lng], EXPLICIT_ENDPOINT_TOLERANCE_DEGREES)) return { from, to, coordinates };
    if (close(start, [to.lat, to.lng], EXPLICIT_ENDPOINT_TOLERANCE_DEGREES) && close(finish, [from.lat, from.lng], EXPLICIT_ENDPOINT_TOLERANCE_DEGREES)) return { from, to, coordinates: [...coordinates].reverse() };
    return null;
  }
  const from = findUniqueJunction(start, junctionIndex);
  const to = findUniqueJunction(finish, junctionIndex);
  if (!from || !to || from.id === to.id) return null;
  return { from, to, coordinates };
}

function edgeDistanceKm(coordinates: [number, number][]): number {
  let distance = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [aLat, aLng] = coordinates[index - 1];
    const [bLat, bLng] = coordinates[index];
    const latKm = (aLat - bLat) * 111.32;
    const lngKm = (aLng - bLng) * 111.32 * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
    distance += Math.hypot(latKm, lngKm);
  }
  return Math.round(distance * 100) / 100;
}

function runOsmium(args: string[], allowMissingReferences = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('osmium', args, { stdio: 'inherit' });
    child.once('error', (error) => reject(new Error(`Osmium kon niet starten. Installeer osmium-tool: ${error.message}`)));
    child.once('exit', (code) => {
      if (code === 0) { resolve(); return; }
      // Geofabrik country extracts intentionally omit members outside their boundary.
      // `getid` still writes all present objects, but returns 1 for those references.
      // The geometry validation below rejects every relation needing a missing member.
      if (code === 1 && allowMissingReferences) {
        console.warn('Osmium meldt ontbrekende grensreferenties; onvolledige relaties worden overgeslagen.');
        resolve();
        return;
      }
      reject(new Error(`Osmium stopte met exitcode ${code ?? 'onbekend'}.`));
    });
  });
}

async function downloadPbf(source: PbfSource, workingDirectory: string): Promise<string> {
  const suppliedDirectory = process.env.NETWORK_PBF_DIR;
  if (suppliedDirectory) {
    const suppliedFile = path.join(suppliedDirectory, source.filename);
    if (!fs.existsSync(suppliedFile)) throw new Error(`NETWORK_PBF_DIR bevat ${source.filename} niet.`);
    return suppliedFile;
  }
  const target = path.join(workingDirectory, source.filename);
  console.log(`Downloading ${source.label} PBF...`);
  const response = await fetch(source.url, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`PBF download failed for ${source.label}: HTTP ${response.status}.`);
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(target));
  return target;
}

async function readRelations(relationFile: string): Promise<OplRelation[]> {
  const relations: OplRelation[] = [];
  await readOplLines(relationFile, (line) => {
    if (!line.startsWith('r')) return;
    const relation = parseRelation(line);
    if (relation && isRcnCycleRelation(relation) && relation.wayMemberIds.length > 0) relations.push(relation);
  });
  return relations;
}

async function readPayload(payloadFile: string): Promise<{ nodes: Map<number, OplNode>; ways: Map<number, OplWay> }> {
  const nodes = new Map<number, OplNode>();
  const ways = new Map<number, OplWay>();
  await readOplLines(payloadFile, (line) => {
    if (line.startsWith('n')) { const node = parseNode(line); if (node) nodes.set(node.id, node); }
    else if (line.startsWith('w')) { const way = parseWay(line); if (way) ways.set(way.id, way); }
  });
  return { nodes, ways };
}

function consumeVerifiedEdges(relations: OplRelation[], nodes: Map<number, OplNode>, ways: Map<number, OplWay>, junctionIndex: Map<string, OplNode[]>, datasetNodes: Map<string, KnooppuntNode>, edges: Map<string, OfficialNetworkDatasetEdge>): number {
  let rejected = 0;
  for (const relation of relations) {
    const geometry = buildCoordinates(relation, ways, nodes);
    if (!geometry || geometry.length < 2) { rejected += 1; continue; }
    const resolved = resolveEndpoints(relation, geometry, nodes, junctionIndex);
    if (!resolved) { rejected += 1; continue; }
    const { from, to, coordinates } = resolved;
    const fromRef = getKnooppuntRef(from);
    const toRef = getKnooppuntRef(to);
    if (!fromRef || !toRef) { rejected += 1; continue; }
    const fromId = `osm-${from.id}`;
    const toId = `osm-${to.id}`;
    const key = [fromId, toId].sort().join('|');
    if (edges.has(key)) continue;
    datasetNodes.set(fromId, { id: fromId, ref: fromRef, lat: from.lat, lng: from.lng, name: from.tags.name });
    datasetNodes.set(toId, { id: toId, ref: toRef, lat: to.lat, lng: to.lng, name: to.tags.name });
    edges.set(key, { from: fromId, to: toId, coordinates, distanceKm: edgeDistanceKm(coordinates), source: `OpenStreetMap RCN relation ${relation.id}`, verifiedAt: new Date().toISOString() });
  }
  return rejected;
}

async function readJunctions(junctionFile: string): Promise<Map<number, OplNode>> {
  const nodes = new Map<number, OplNode>();
  await readOplLines(junctionFile, (line) => {
    if (!line.startsWith('n')) return;
    const node = parseNode(line);
    if (node && getKnooppuntRef(node)) nodes.set(node.id, node);
  });
  return nodes;
}

async function processSource(source: PbfSource, pbfFile: string, workingDirectory: string, datasetNodes: Map<string, KnooppuntNode>, edges: Map<string, OfficialNetworkDatasetEdge>): Promise<number> {
  const stem = path.basename(source.filename, '.osm.pbf');
  const relationsFile = path.join(workingDirectory, `${stem}-relations.opl`);
  const junctionsFile = path.join(workingDirectory, `${stem}-junctions.opl`);
  const idsFile = path.join(workingDirectory, `${stem}-ids.txt`);
  const payloadFile = path.join(workingDirectory, `${stem}-payload.opl`);
  console.log(`Selecting ${source.label} RCN route relations with Osmium...`);
  await runOsmium(['tags-filter', '--omit-referenced', '--output-format', 'opl', '--output', relationsFile, pbfFile, 'r/network=rcn']);
  await runOsmium(['tags-filter', '--omit-referenced', '--output-format', 'opl', '--output', junctionsFile, pbfFile, 'n/rcn_ref', 'n/network:type=node_network', 'n/network=rcn']);
  const relations = await readRelations(relationsFile);
  const junctionNodes = await readJunctions(junctionsFile);
  if (relations.length === 0) throw new Error(`Geen RCN-fietsrelaties gevonden in ${source.label}.`);
  if (junctionNodes.size === 0) throw new Error(`Geen RCN-knooppunten gevonden in ${source.label}.`);
  const ids = new Set<string>();
  for (const relation of relations) { relation.nodeMemberIds.forEach((id) => ids.add(`n${id}`)); relation.wayMemberIds.forEach((id) => ids.add(`w${id}`)); }
  fs.writeFileSync(idsFile, [...ids].join('\n'));
  console.log(`Extracting ${ids.size} ${source.label} route members with their referenced nodes...`);
  await runOsmium(['getid', '--add-referenced', '--remove-tags', '--id-file', idsFile, '--output-format', 'opl', '--output', payloadFile, pbfFile], true);
  const { nodes, ways } = await readPayload(payloadFile);
  for (const node of junctionNodes.values()) nodes.set(node.id, node);
  const rejected = consumeVerifiedEdges(relations, nodes, ways, buildJunctionIndex(junctionNodes.values()), datasetNodes, edges);
  console.log(`${source.label}: ${relations.length} relations examined; ${junctionNodes.size} junctions, ${nodes.size} nodes and ${ways.size} ways retained.`);
  fs.rmSync(relationsFile, { force: true }); fs.rmSync(junctionsFile, { force: true }); fs.rmSync(idsFile, { force: true }); fs.rmSync(payloadFile, { force: true });
  return rejected;
}

async function main(): Promise<void> {
  const workingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fietsroutes-network-'));
  try {
    await runOsmium(['--version']);
    const datasetNodes = new Map<string, KnooppuntNode>();
    const edges = new Map<string, OfficialNetworkDatasetEdge>();
    let rejected = 0;
    for (const source of PBF_SOURCES) rejected += await processSource(source, await downloadPbf(source, workingDirectory), workingDirectory, datasetNodes, edges);
    if (edges.size === 0) throw new Error('Geen verifieerbare RCN-routes gevonden; er wordt geen lege dataset geschreven.');
    const dataset: OfficialNetworkDataset = { version: 1, generatedAt: new Date().toISOString(), nodes: [...datasetNodes.values()], edges: [...edges.values()] };
    const output = path.join(process.cwd(), 'public', 'data', 'benelux_network.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(dataset));
    console.log(`Wrote ${dataset.nodes.length} nodes and ${dataset.edges.length} verified edges; rejected ${rejected} relations.`);
  } finally {
    fs.rmSync(workingDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
