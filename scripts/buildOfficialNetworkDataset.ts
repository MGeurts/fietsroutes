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
import type {
  KnooppuntNode,
  OfficialNetworkDeclaredConnection,
  OfficialNetworkDataset,
  OfficialNetworkDatasetEdge,
  OfficialNetworkTopology,
  OfficialNetworkTopologyVertex,
  OfficialNetworkValidationEntry,
  OfficialNetworkValidationReport,
} from '../src/types';

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
const REF_ENDPOINT_TOLERANCE_DEGREES = 0.01; // Relation ref is authoritative; geometry only chooses the local duplicate ref.
const SEGMENT_JOIN_TOLERANCE_DEGREES = 0.00001; // Ways must actually meet; never bridge a visible gap.
const JUNCTION_INDEX_CELL_DEGREES = 0.01;
const MAX_UNMAPPED_GEOMETRY_GAP_KM = 1;
const DUTCH_NETWORK_WFS = 'https://geo.rijkswaterstaat.nl/services/ogc/gdr/fietsareaal/wfs';
const DUTCH_NETWORK_PAGE_SIZE = 1_000;
// RWS and OSM place a marker at the same signed junction. Keep this deliberately
// small: an approximate nearby junction must never be silently substituted.
const DUTCH_TOPOLOGY_ANCHOR_DISTANCE_KM = 0.075;

interface WfsFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { gid?: number | string };
}

interface WfsResponse {
  features?: WfsFeature[];
}

interface SourceBuildResult {
  junctionNodes: Map<number, OplNode>;
  validation: OfficialNetworkValidationEntry[];
}

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

function buildJunctionRefIndex(nodes: Iterable<OplNode>): Map<string, OplNode[]> {
  const index = new Map<string, OplNode[]>();
  for (const node of nodes) {
    const ref = getKnooppuntRef(node);
    if (!ref) continue;
    const bucket = index.get(ref) || [];
    bucket.push(node);
    index.set(ref, bucket);
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

function getExplicitEndpoints(relation: OplRelation, nodes: Map<number, OplNode>): { from: OplNode; to: OplNode } | null {
  const explicit = relation.nodeMemberIds.map((id) => nodes.get(id)).filter((node): node is OplNode => Boolean(node && getKnooppuntRef(node)));
  if (explicit.length < 2) return null;
  const from = explicit[0];
  const to = explicit[explicit.length - 1];
  return from.id === to.id ? null : { from, to };
}

/**
 * Standard Node Network route relations normally advertise the two end-node labels in
 * `ref=29-30`.  Most relations do not also include those junction nodes as members.
 * We accept that authoritative topology only when each ref can be located near an end
 * of a member way, preventing a repeated number elsewhere in Belgium/NL from matching.
 */
function getRefTagEndpoints(relation: OplRelation, nodes: Map<number, OplNode>, ways: Map<number, OplWay>, junctionsByRef: Map<string, OplNode[]>): { from: OplNode; to: OplNode } | null {
  const match = /^\s*([^\-–]+?)\s*[-–]\s*([^\-–]+?)\s*$/.exec(relation.tags.ref || '');
  if (!match) return null;
  const fromCandidates = junctionsByRef.get(match[1].trim()) || [];
  const toCandidates = junctionsByRef.get(match[2].trim()) || [];
  if (fromCandidates.length === 0 || toCandidates.length === 0) return null;
  const wayEnds = relation.wayMemberIds.flatMap((wayId) => {
    const ids = ways.get(wayId)?.nodeIds;
    const first = ids?.[0] === undefined ? undefined : nodes.get(ids[0]);
    const last = !ids?.length ? undefined : nodes.get(ids[ids.length - 1]);
    return [first, last].filter((node): node is OplNode => Boolean(node));
  });
  if (wayEnds.length === 0) return null;
  const nearest = (candidates: OplNode[]): OplNode | null => {
    let closest: OplNode | null = null;
    let closestDistance = REF_ENDPOINT_TOLERANCE_DEGREES;
    for (const candidate of candidates) {
      for (const endpoint of wayEnds) {
        const candidateDistance = Math.hypot(candidate.lat - endpoint.lat, candidate.lng - endpoint.lng);
        if (candidateDistance <= closestDistance) {
          closest = candidate;
          closestDistance = candidateDistance;
        }
      }
    }
    return closest;
  };
  const from = nearest(fromCandidates);
  const to = nearest(toCandidates);
  return from && to && from.id !== to.id ? { from, to } : null;
}

function resolveEndpoints(relation: OplRelation, coordinates: [number, number][], nodes: Map<number, OplNode>, junctionIndex: Map<string, OplNode[]>): { from: OplNode; to: OplNode; coordinates: [number, number][] } | null {
  const explicit = getExplicitEndpoints(relation, nodes);
  const start = coordinates[0];
  const finish = coordinates[coordinates.length - 1];
  if (explicit) {
    const { from, to } = explicit;
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

function toDatasetNode(node: OplNode): KnooppuntNode | null {
  const ref = getKnooppuntRef(node);
  if (!ref) return null;
  return { id: `osm-${node.id}`, ref, lat: node.lat, lng: node.lng, name: node.tags.name };
}

function topologyVertexId(coordinate: [number, number]): string {
  return `nl:${coordinate[0].toFixed(6)}:${coordinate[1].toFixed(6)}`;
}

function asLineStrings(feature: WfsFeature): [number, number][][] {
  const { geometry } = feature;
  if (!geometry?.coordinates) return [];
  const isCoordinate = (value: unknown): value is [number, number] => Array.isArray(value)
    && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates) && geometry.coordinates.every(isCoordinate)) {
    return [geometry.coordinates.map(([lng, lat]) => [lat, lng])];
  }
  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates
      .filter((line): line is unknown[] => Array.isArray(line) && line.every(isCoordinate))
      .map((line) => (line as [number, number][]).map(([lng, lat]) => [lat, lng]));
  }
  return [];
}

async function fetchDutchNetworkFeatures(): Promise<WfsFeature[]> {
  const features: WfsFeature[] = [];
  for (let startIndex = 0; ; startIndex += DUTCH_NETWORK_PAGE_SIZE) {
    const parameters = new URLSearchParams({
      SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature',
      TYPENAMES: 'fietsareaal:fietsnetwerken_vrij', OUTPUTFORMAT: 'application/json',
      SRSNAME: 'EPSG:4326', COUNT: String(DUTCH_NETWORK_PAGE_SIZE), STARTINDEX: String(startIndex),
    });
    let response: Response | undefined;
    let failure: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetch(`${DUTCH_NETWORK_WFS}?${parameters}`, { signal: AbortSignal.timeout(120_000) });
        if (response.ok) break;
        failure = new Error(`HTTP ${response.status}`);
      } catch (error) {
        failure = error;
      }
    }
    if (!response?.ok) throw new Error(`Rijkswaterstaat WFS niet bereikbaar bij pagina ${startIndex}: ${String(failure)}`);
    const page = await response.json() as WfsResponse;
    const pageFeatures = page.features || [];
    features.push(...pageFeatures);
    console.log(`Nederlandse officiële trajecten: ${features.length} segmenten opgehaald...`);
    if (pageFeatures.length < DUTCH_NETWORK_PAGE_SIZE) return features;
  }
}

function buildDutchOfficialTopology(junctionNodes: Map<number, OplNode>): Promise<OfficialNetworkTopology> {
  return (async () => {
    console.log('Downloading officiële Nederlandse fietsknooppunttrajecten (Rijkswaterstaat)...');
    const features = await fetchDutchNetworkFeatures();
    const vertices = new Map<string, OfficialNetworkTopologyVertex>();
    const edges = new Map<string, OfficialNetworkTopology['edges'][number]>();
    for (const feature of features) {
      for (const coordinates of asLineStrings(feature)) {
        if (coordinates.length < 2 || hasUnmappedGeometryGap(coordinates)) continue;
        const from = topologyVertexId(coordinates[0]);
        const to = topologyVertexId(coordinates[coordinates.length - 1]);
        if (from === to) continue;
        vertices.set(from, { id: from, lat: coordinates[0][0], lng: coordinates[0][1] });
        vertices.set(to, { id: to, lat: coordinates[coordinates.length - 1][0], lng: coordinates[coordinates.length - 1][1] });
        const key = [from, to].sort().join('|');
        if (edges.has(key)) continue;
        edges.set(key, {
          from, to, coordinates, distanceKm: edgeDistanceKm(coordinates),
          source: `Rijkswaterstaat fietsnetwerken_vrij ${feature.properties?.gid ?? 'segment'}`,
        });
      }
    }

    const vertexIndex = new Map<string, OfficialNetworkTopologyVertex[]>();
    for (const vertex of vertices.values()) {
      const bucket = vertexIndex.get(junctionCell(vertex.lat, vertex.lng)) || [];
      bucket.push(vertex);
      vertexIndex.set(junctionCell(vertex.lat, vertex.lng), bucket);
    }
    const anchors: Record<string, string> = {};
    for (const junction of junctionNodes.values()) {
      const row = Math.floor(junction.lat / JUNCTION_INDEX_CELL_DEGREES);
      const column = Math.floor(junction.lng / JUNCTION_INDEX_CELL_DEGREES);
      let closest: OfficialNetworkTopologyVertex | undefined;
      let closestDistance = DUTCH_TOPOLOGY_ANCHOR_DISTANCE_KM;
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          for (const vertex of vertexIndex.get(`${row + rowOffset}:${column + columnOffset}`) || []) {
            const candidateDistance = edgeDistanceKm([[junction.lat, junction.lng], [vertex.lat, vertex.lng]]);
            if (candidateDistance <= closestDistance) {
              closest = vertex;
              closestDistance = candidateDistance;
            }
          }
        }
      }
      if (closest) anchors[`osm-${junction.id}`] = closest.id;
    }
    console.log(`Nederland: ${features.length} officiële trajecten; ${vertices.size} netwerkpunten en ${Object.keys(anchors).length} veilig gekoppelde knooppunten.`);
    return { vertices: [...vertices.values()], edges: [...edges.values()], anchors };
  })();
}

/** An OSM way normally has dense geometry. A larger gap would render as an invented straight line. */
function hasUnmappedGeometryGap(coordinates: [number, number][]): boolean {
  for (let index = 1; index < coordinates.length; index += 1) {
    if (edgeDistanceKm([coordinates[index - 1], coordinates[index]]) > MAX_UNMAPPED_GEOMETRY_GAP_KM) return true;
  }
  return false;
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

function consumeVerifiedEdges(relations: OplRelation[], country: string, nodes: Map<number, OplNode>, ways: Map<number, OplWay>, junctionIndex: Map<string, OplNode[]>, junctionsByRef: Map<string, OplNode[]>, datasetNodes: Map<string, KnooppuntNode>, edges: Map<string, OfficialNetworkDatasetEdge>, declaredConnections: Map<string, OfficialNetworkDeclaredConnection>): OfficialNetworkValidationEntry[] {
  const validation: OfficialNetworkValidationEntry[] = [];
  for (const relation of relations) {
    // Route relations with explicit endpoint nodes remain useful topology, even when
    // their way members are malformed or split. Their geometry is *not* invented;
    // the client will obtain it per declared Node-to-Node hop when necessary.
    const declared = getExplicitEndpoints(relation, nodes) || getRefTagEndpoints(relation, nodes, ways, junctionsByRef);
    const report = (status: OfficialNetworkValidationEntry['status'], reason?: string) => {
      validation.push({ relationId: relation.id, country, ref: relation.tags.ref, status, reason });
    };
    if (declared) {
      const fromId = `osm-${declared.from.id}`;
      const toId = `osm-${declared.to.id}`;
      const fromNode = toDatasetNode(declared.from);
      const toNode = toDatasetNode(declared.to);
      if (fromNode) datasetNodes.set(fromId, fromNode);
      if (toNode) datasetNodes.set(toId, toNode);
      declaredConnections.set([fromId, toId].sort().join('|'), {
        from: fromId, to: toId, source: `OpenStreetMap RCN relation ${relation.id}`,
      });
    }
    const geometry = buildCoordinates(relation, ways, nodes);
    if (!geometry || geometry.length < 2) {
      report(declared ? 'declared-topology' : 'rejected', declared
        ? 'Way members ontbreken of vormen geen aaneengesloten geometrie; de expliciete knooppuntrelatie blijft behouden.'
        : 'Way members ontbreken of vormen geen aaneengesloten geometrie, en er zijn geen veilige knooppunteinden.');
      continue;
    }
    if (hasUnmappedGeometryGap(geometry)) {
      report(declared ? 'declared-topology' : 'rejected', declared
        ? 'De geometrie bevat een onverklaarde onderbreking; de expliciete knooppuntrelatie blijft behouden.'
        : 'De geometrie bevat een onverklaarde onderbreking en er zijn geen veilige knooppunteinden.');
      continue;
    }
    const resolved = resolveEndpoints(relation, geometry, nodes, junctionIndex);
    if (!resolved) {
      report(declared ? 'declared-topology' : 'rejected', declared
        ? 'De routegeometrie eindigt niet veilig op de knooppunten; de expliciete knooppuntrelatie blijft behouden.'
        : 'De routegeometrie kan niet eenduidig aan twee knooppunten worden gekoppeld.');
      continue;
    }
    const { from, to, coordinates } = resolved;
    const fromRef = getKnooppuntRef(from);
    const toRef = getKnooppuntRef(to);
    if (!fromRef || !toRef) {
      report(declared ? 'declared-topology' : 'rejected', 'Een geometrisch eindpunt heeft geen bruikbare knooppuntreferentie.');
      continue;
    }
    const fromId = `osm-${from.id}`;
    const toId = `osm-${to.id}`;
    const key = [fromId, toId].sort().join('|');
    if (edges.has(key)) {
      report('verified-geometry');
      continue;
    }
    datasetNodes.set(fromId, { id: fromId, ref: fromRef, lat: from.lat, lng: from.lng, name: from.tags.name });
    datasetNodes.set(toId, { id: toId, ref: toRef, lat: to.lat, lng: to.lng, name: to.tags.name });
    edges.set(key, { from: fromId, to: toId, coordinates, distanceKm: edgeDistanceKm(coordinates), source: `OpenStreetMap RCN relation ${relation.id}`, verifiedAt: new Date().toISOString() });
    report('verified-geometry');
  }
  return validation;
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

async function processSource(source: PbfSource, pbfFile: string, workingDirectory: string, datasetNodes: Map<string, KnooppuntNode>, edges: Map<string, OfficialNetworkDatasetEdge>, declaredConnections: Map<string, OfficialNetworkDeclaredConnection>): Promise<SourceBuildResult> {
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
  for (const node of junctionNodes.values()) {
    nodes.set(node.id, node);
    const datasetNode = toDatasetNode(node);
    if (datasetNode) datasetNodes.set(String(datasetNode.id), datasetNode);
  }
  const validation = consumeVerifiedEdges(relations, source.label, nodes, ways, buildJunctionIndex(junctionNodes.values()), buildJunctionRefIndex(junctionNodes.values()), datasetNodes, edges, declaredConnections);
  console.log(`${source.label}: ${relations.length} relations examined; ${junctionNodes.size} junctions, ${nodes.size} nodes and ${ways.size} ways retained.`);
  fs.rmSync(relationsFile, { force: true }); fs.rmSync(junctionsFile, { force: true }); fs.rmSync(idsFile, { force: true }); fs.rmSync(payloadFile, { force: true });
  return { junctionNodes, validation };
}

function createValidationReport(entries: OfficialNetworkValidationEntry[]): OfficialNetworkValidationReport {
  const reasons: Record<string, number> = {};
  for (const entry of entries) {
    if (!entry.reason) continue;
    reasons[entry.reason] = (reasons[entry.reason] || 0) + 1;
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    summary: {
      examined: entries.length,
      verifiedGeometry: entries.filter((entry) => entry.status === 'verified-geometry').length,
      declaredTopology: entries.filter((entry) => entry.status === 'declared-topology').length,
      rejected: entries.filter((entry) => entry.status === 'rejected').length,
      reasons,
    },
    entries,
  };
}

async function main(): Promise<void> {
  const workingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fietsroutes-network-'));
  try {
    await runOsmium(['--version']);
    const datasetNodes = new Map<string, KnooppuntNode>();
    const edges = new Map<string, OfficialNetworkDatasetEdge>();
    const declaredConnections = new Map<string, OfficialNetworkDeclaredConnection>();
    const validationEntries: OfficialNetworkValidationEntry[] = [];
    let dutchJunctionNodes = new Map<number, OplNode>();
    for (const source of PBF_SOURCES) {
      const result = await processSource(source, await downloadPbf(source, workingDirectory), workingDirectory, datasetNodes, edges, declaredConnections);
      validationEntries.push(...result.validation);
      if (source.label === 'Netherlands') dutchJunctionNodes = result.junctionNodes;
    }
    if (edges.size === 0) throw new Error('Geen verifieerbare RCN-routes gevonden; er wordt geen lege dataset geschreven.');
    const topology = await buildDutchOfficialTopology(dutchJunctionNodes);
    const dataset: OfficialNetworkDataset = { version: 1, generatedAt: new Date().toISOString(), nodes: [...datasetNodes.values()], edges: [...edges.values()], declaredConnections: [...declaredConnections.values()], topology };
    const output = path.join(process.cwd(), 'public', 'data', 'benelux_network.json');
    const validationOutput = path.join(process.cwd(), 'public', 'data', 'benelux_network_validation.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(dataset));
    const validationReport = createValidationReport(validationEntries);
    fs.writeFileSync(validationOutput, JSON.stringify(validationReport));
    console.log(`Wrote ${dataset.nodes.length} nodes, ${dataset.edges.length} verified OSM edges, ${declaredConnections.size} declared OSM connections and ${topology.edges.length} official Netherlands trajectory segments; ${validationReport.summary.declaredTopology} topology-only and ${validationReport.summary.rejected} rejected relations are documented in benelux_network_validation.json.`);
  } finally {
    fs.rmSync(workingDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
