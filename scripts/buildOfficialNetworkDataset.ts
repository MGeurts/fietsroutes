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

// Keep requests small enough for public Overpass instances and process them sequentially.
const SECTORS: Bbox[] = GRID_SECTORS.map((sector) => sector.bbox);
const ENDPOINT_TOLERANCE_DEGREES = 0.0045; // ~500 m: only a data-validation tolerance, never a route fallback.

function close(a: [number, number], b: [number, number]): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= ENDPOINT_TOLERANCE_DEGREES;
}

async function fetchSector(bbox: Bbox): Promise<OSMResponse> {
  const [south, west, north, east] = bbox;
  const query = `[out:json][timeout:180];
    relation["type"="route"]["route"="bicycle"]["network"="rcn"]["network:type"="node_network"](${south},${west},${north},${east});
    out body; >; out body;`;
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (response.ok) return response.json() as Promise<OSMResponse>;
  }
  throw new Error(`Overpass did not return a response for ${bbox.join(',')}`);
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
  const all: OSMResponse[] = [];
  for (const bbox of SECTORS) {
    console.log(`Fetching ${bbox.join(', ')}...`);
    all.push(await fetchSector(bbox));
  }
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
