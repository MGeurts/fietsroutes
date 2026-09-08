/**
 * Build the production graph off-line. It accepts only OSM route relations that explicitly
 * describe a regional cycle-node route, rejects alternatives/connections, and emits no edge
 * when endpoints or geometry cannot be verified. This script is intentionally never run by
 * the browser or on Antagonist shared hosting.
 */
import fs from 'node:fs';
import path from 'node:path';
import { KnooppuntNode, OfficialNetworkDataset, OfficialNetworkDatasetEdge } from '../src/types';
import { GRID_SECTORS } from '../src/services/offlineDataService';

type Bbox = [number, number, number, number];
interface OSMNode { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string>; }
interface OSMWay { type: 'way'; id: number; nodes?: number[]; }
interface OSMRelationMember { type: 'node' | 'way' | 'relation'; ref: number; role: string; }
interface OSMRelation { type: 'relation'; id: number; tags?: Record<string, string>; members?: OSMRelationMember[]; }
type OSMElement = OSMNode | OSMWay | OSMRelation;
interface OSMResponse { elements: OSMElement[]; }

// Public Overpass instances reject the large recursive query for an entire province. Discover
// relation ids in small cells first, then download their geometry in bounded batches.
const SECTORS: Bbox[] = GRID_SECTORS.map((sector) => sector.bbox);
const MAX_CELL_SIZE_DEGREES = 0.25;
const RELATIONS_PER_GEOMETRY_REQUEST = 20;
// Try each independent public endpoint once. A second attempt at an unresponsive
// endpoint only makes the command look stuck; the next provider is a better retry.
const RETRIES_PER_ENDPOINT = 1;
const REQUEST_PAUSE_MS = 250;
const REQUEST_TIMEOUT_MS = 12_000;
const ENDPOINT_TOLERANCE_DEGREES = 0.0045; // ~500 m: only a data-validation tolerance, never a route fallback.

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function close(a: [number, number], b: [number, number]): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= ENDPOINT_TOLERANCE_DEGREES;
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function splitIntoCells([south, west, north, east]: Bbox): Bbox[] {
  const cells: Bbox[] = [];
  for (let cellSouth = south; cellSouth < north; cellSouth += MAX_CELL_SIZE_DEGREES) {
    for (let cellWest = west; cellWest < east; cellWest += MAX_CELL_SIZE_DEGREES) {
      cells.push([
        Number(cellSouth.toFixed(6)),
        Number(cellWest.toFixed(6)),
        Number(Math.min(cellSouth + MAX_CELL_SIZE_DEGREES, north).toFixed(6)),
        Number(Math.min(cellWest + MAX_CELL_SIZE_DEGREES, east).toFixed(6)),
      ]);
    }
  }
  return cells;
}

function chunks<T>(values: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
}

async function queryOverpass(query: string, label: string): Promise<OSMResponse> {
  const errors: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= RETRIES_PER_ENDPOINT; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'fietsroutes-network-builder/1.1',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) return response.json() as Promise<OSMResponse>;

        const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 180);
        errors.push(`${endpoint}: HTTP ${response.status}${detail ? ` (${detail})` : ''}`);
        if (response.status !== 429 && response.status < 500) break;
      } catch (error) {
        errors.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (attempt < RETRIES_PER_ENDPOINT) await pause(1000 * attempt);
    }
  }
  throw new Error(`Overpass query failed for ${label}. ${errors.join(' | ')}`);
}

async function discoverRelationIds(cells: Bbox[]): Promise<number[]> {
  const ids = new Set<number>();
  for (let index = 0; index < cells.length; index += 1) {
    const bbox = cells[index];
    console.log(`Discovering ${index + 1}/${cells.length}: ${bbox.join(', ')}...`);
    const [south, west, north, east] = bbox;
    const response = await queryOverpass(
      `[out:json][timeout:90]; relation["type"="route"]["route"="bicycle"]["network"="rcn"]["network:type"="node_network"](${south},${west},${north},${east}); out ids;`,
      bbox.join(','),
    );
    for (const element of response.elements) {
      if (element.type === 'relation') ids.add(element.id);
    }
    await pause(REQUEST_PAUSE_MS);
  }
  return [...ids];
}

async function fetchRelationGeometries(relationIds: number[]): Promise<OSMResponse[]> {
  const batches = chunks(relationIds, RELATIONS_PER_GEOMETRY_REQUEST);
  const responses: OSMResponse[] = [];
  for (let index = 0; index < batches.length; index += 1) {
    const ids = batches[index];
    console.log(`Downloading geometry ${index + 1}/${batches.length} (${ids.length} relations)...`);
    responses.push(await queryOverpass(
      `[out:json][timeout:120]; relation(id:${ids.join(',')}); out body; >; out body;`,
      `relation batch ${index + 1}/${batches.length}`,
    ));
    await pause(REQUEST_PAUSE_MS);
  }
  return responses;
}

function buildCoordinates(relation: OSMRelation, ways: Map<number, OSMWay>, nodes: Map<number, OSMNode>, from: OSMNode, to: OSMNode): [number, number][] | null {
  const segments = (relation.members || [])
    .filter((member) => member.type === 'way')
    .map((member) => ways.get(member.ref)?.nodes?.map((id) => nodes.get(id)).filter((node): node is OSMNode => Boolean(node)).map((node) => [node.lat, node.lon] as [number, number]))
    .filter((segment): segment is [number, number][] => Boolean(segment && segment.length > 1));
  if (segments.length === 0) return null;

  const start: [number, number] = [from.lat, from.lon];
  const finish: [number, number] = [to.lat, to.lon];
  const first = segments.shift()!;
  let coordinates = close(first[0], start) ? first : close(first[first.length - 1], start) ? [...first].reverse() : [];
  if (coordinates.length === 0) return null;
  for (const segment of segments) {
    const tail = coordinates[coordinates.length - 1];
    const next = close(tail, segment[0]) ? segment : close(tail, segment[segment.length - 1]) ? [...segment].reverse() : null;
    if (!next) return null;
    coordinates = coordinates.concat(next.slice(1));
  }
  return close(coordinates[coordinates.length - 1], finish) ? coordinates : null;
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

async function main(): Promise<void> {
  const cells = SECTORS.flatMap(splitIntoCells);
  const relationIds = await discoverRelationIds(cells);
  if (relationIds.length === 0) {
    throw new Error('No officiële RCN-relaties gevonden. Controleer de Overpass-antwoorden; er wordt geen lege dataset geschreven.');
  }
  console.log(`Found ${relationIds.length} unique RCN relations.`);
  const all = await fetchRelationGeometries(relationIds);
  const elements = all.flatMap((response) => response.elements);
  const osmNodes = new Map(elements.filter((element): element is OSMNode => element.type === 'node').map((node) => [node.id, node]));
  const ways = new Map(elements.filter((element): element is OSMWay => element.type === 'way').map((way) => [way.id, way]));
  const relations = elements.filter((element): element is OSMRelation => element.type === 'relation');
  const datasetNodes = new Map<string, KnooppuntNode>();
  const edges = new Map<string, OfficialNetworkDatasetEdge>();
  let rejected = 0;

  for (const relation of relations) {
    const tags = relation.tags || {};
    const state = tags.state?.toLowerCase();
    if (state === 'connection' || state === 'alternate') { rejected += 1; continue; }
    const endpointMembers = (relation.members || [])
      .filter((member) => member.type === 'node')
      .map((member) => osmNodes.get(member.ref))
      .filter((node): node is OSMNode => Boolean(node?.tags?.rcn_ref));
    const from = endpointMembers[0];
    const to = endpointMembers[endpointMembers.length - 1];
    if (!from || !to || from.id === to.id) { rejected += 1; continue; }
    const coordinates = buildCoordinates(relation, ways, osmNodes, from, to);
    if (!coordinates || coordinates.length < 2) { rejected += 1; continue; }
    const fromId = `osm-${from.id}`;
    const toId = `osm-${to.id}`;
    const key = [fromId, toId].sort().join('|');
    if (edges.has(key)) continue;
    datasetNodes.set(fromId, { id: fromId, ref: from.tags!.rcn_ref, lat: from.lat, lng: from.lon, name: from.tags?.name });
    datasetNodes.set(toId, { id: toId, ref: to.tags!.rcn_ref, lat: to.lat, lng: to.lon, name: to.tags?.name });
    edges.set(key, {
      from: fromId, to: toId, coordinates, distanceKm: edgeDistanceKm(coordinates),
      source: `OpenStreetMap RCN relation ${relation.id}`, verifiedAt: new Date().toISOString(),
    });
  }

  const dataset: OfficialNetworkDataset = {
    version: 1, generatedAt: new Date().toISOString(), nodes: [...datasetNodes.values()], edges: [...edges.values()],
  };
  const output = path.join(process.cwd(), 'public', 'data', 'benelux_network.json');
  fs.writeFileSync(output, JSON.stringify(dataset));
  console.log(`Wrote ${dataset.nodes.length} nodes and ${dataset.edges.length} verified edges; rejected ${rejected} relations.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
