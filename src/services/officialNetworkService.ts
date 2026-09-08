import { KnooppuntNode, OfficialNetworkDataset, OfficialNetworkDatasetEdge } from '../types';
import { getOfficialGisCorridor, OFFICIAL_GIS_CORRIDORS } from '../data/officialGisCorridors';

/** A conservative endpoint tolerance prevents a duplicate ref in another region being matched. */
const ENDPOINT_TOLERANCE_KM = 0.35;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface OfficialNetworkEdge {
  fromKey: string;
  toKey: string;
  distanceKm: number;
  coordinates: [number, number][];
  source: string;
}

export interface OfficialNetworkGraph {
  nodeMap: Map<string, KnooppuntNode>;
  adjacency: Map<string, Map<string, OfficialNetworkEdge>>;
}

let importedEdges = new Map<string, OfficialNetworkDatasetEdge>();

function edgeKey(from: string, to: string): string {
  return `${from}\u0000${to}`;
}

/** Register a validated, build-time dataset. Browser discovery is never allowed to register edges. */
export function registerOfficialNetworkDataset(dataset: OfficialNetworkDataset): void {
  if (dataset.version !== 1 || !Array.isArray(dataset.edges) || !Array.isArray(dataset.nodes)) return;
  const allowedNodeIds = new Set(dataset.nodes.map((node) => String(node.id)));
  const next = new Map<string, OfficialNetworkDatasetEdge>();
  for (const edge of dataset.edges) {
    if (!allowedNodeIds.has(edge.from) || !allowedNodeIds.has(edge.to) || edge.coordinates.length < 2 || edge.distanceKm <= 0) continue;
    next.set(edgeKey(edge.from, edge.to), edge);
    next.set(edgeKey(edge.to, edge.from), {
      ...edge,
      from: edge.to,
      to: edge.from,
      coordinates: [...edge.coordinates].reverse(),
    });
  }
  importedEdges = next;
}

/**
 * OSM ids are stable and refs are not globally unique.  Imported legacy data without an
 * id keeps a location-qualified key, so it can never silently collide with another `251`.
 */
export function getNodeKey(node: KnooppuntNode): string {
  if (node.id !== undefined && node.id !== null && String(node.id).trim()) {
    return String(node.id);
  }
  return `legacy:${node.ref}:${node.lat.toFixed(5)}:${node.lng.toFixed(5)}`;
}

function isAtCoordinate(node: KnooppuntNode, coordinate: [number, number]): boolean {
  return distanceKm(node.lat, node.lng, coordinate[0], coordinate[1]) <= ENDPOINT_TOLERANCE_KM;
}

/**
 * Resolve a leg only when a verified corridor has the requested refs *and* physically
 * terminates at the selected two nodes. No geometric, router, or nearest-node fallback is allowed.
 */
export function getOfficialEdgeBetween(from: KnooppuntNode, to: KnooppuntNode): OfficialNetworkEdge | null {
  if (getNodeKey(from) === getNodeKey(to)) return null;

  const imported = importedEdges.get(edgeKey(getNodeKey(from), getNodeKey(to)));
  if (imported) {
    return {
      fromKey: getNodeKey(from), toKey: getNodeKey(to), distanceKm: imported.distanceKm,
      coordinates: imported.coordinates, source: imported.source,
    };
  }

  const corridor = getOfficialGisCorridor(from.ref, to.ref);
  if (!corridor || corridor.coordinates.length < 2) return null;

  const start = corridor.coordinates[0];
  const end = corridor.coordinates[corridor.coordinates.length - 1];
  if (!isAtCoordinate(from, start) || !isAtCoordinate(to, end)) return null;

  return {
    fromKey: getNodeKey(from),
    toKey: getNodeKey(to),
    distanceKm: corridor.distanceKm,
    coordinates: corridor.coordinates,
    source: corridor.source,
  };
}

/** Build an adjacency graph exclusively from verified, endpoint-matched corridors. */
export function buildOfficialNetworkGraph(nodes: KnooppuntNode[]): OfficialNetworkGraph {
  const nodeMap = new Map<string, KnooppuntNode>();
  const byRef = new Map<string, KnooppuntNode[]>();
  const adjacency = new Map<string, Map<string, OfficialNetworkEdge>>();

  for (const node of nodes) {
    const key = getNodeKey(node);
    if (nodeMap.has(key)) continue;
    nodeMap.set(key, node);
    adjacency.set(key, new Map());
    const matching = byRef.get(node.ref) || [];
    matching.push(node);
    byRef.set(node.ref, matching);
  }

  for (const corridor of Object.values(OFFICIAL_GIS_CORRIDORS)) {
    if (!corridor.verified || corridor.coordinates.length < 2) continue;
    const start = corridor.coordinates[0];
    const end = corridor.coordinates[corridor.coordinates.length - 1];
    const from = (byRef.get(corridor.from) || []).find((node) => isAtCoordinate(node, start));
    const to = (byRef.get(corridor.to) || []).find((node) => isAtCoordinate(node, end));
    if (!from || !to || getNodeKey(from) === getNodeKey(to)) continue;

    const forward = getOfficialEdgeBetween(from, to);
    const reverse = getOfficialEdgeBetween(to, from);
    if (!forward || !reverse) continue;
    adjacency.get(forward.fromKey)?.set(forward.toKey, forward);
    adjacency.get(reverse.fromKey)?.set(reverse.toKey, reverse);
  }

  for (const edge of importedEdges.values()) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) continue;
    adjacency.get(edge.from)?.set(edge.to, {
      fromKey: edge.from, toKey: edge.to, distanceKm: edge.distanceKm,
      coordinates: edge.coordinates, source: edge.source,
    });
  }

  return { nodeMap, adjacency };
}
