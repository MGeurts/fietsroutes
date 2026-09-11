import { KnooppuntNode } from '../types';
import { buildOfficialNetworkGraph, getNodeKey, OfficialNetworkGraph } from './officialNetworkService';

export interface GeneratedLoop {
  nodes: KnooppuntNode[];
  distanceKm: number;
  nodeCount: number;
  description: string;
  direction?: string;
}

function polygonAreaKm2(nodes: KnooppuntNode[]): number {
  if (nodes.length < 4) return 0;
  const origin = nodes[0];
  const kmPerLat = 111;
  const kmPerLng = 111 * Math.cos((origin.lat * Math.PI) / 180);
  let area = 0;
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const a = nodes[index];
    const b = nodes[index + 1];
    area += ((a.lng - origin.lng) * kmPerLng) * ((b.lat - origin.lat) * kmPerLat)
      - ((a.lat - origin.lat) * kmPerLat) * ((b.lng - origin.lng) * kmPerLng);
  }
  return Math.abs(area) / 2;
}

function hasSelfIntersection(nodes: KnooppuntNode[]): boolean {
  const orientation = (a: KnooppuntNode, b: KnooppuntNode, c: KnooppuntNode) =>
    (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  const intersects = (a: KnooppuntNode, b: KnooppuntNode, c: KnooppuntNode, d: KnooppuntNode) =>
    Math.sign(orientation(a, b, c)) !== Math.sign(orientation(a, b, d)) &&
    Math.sign(orientation(c, d, a)) !== Math.sign(orientation(c, d, b));
  const edgeCount = nodes.length - 1;
  for (let a = 0; a < edgeCount; a += 1) {
    for (let b = a + 2; b < edgeCount; b += 1) {
      if (a === 0 && b === edgeCount - 1) continue;
      if (intersects(nodes[a], nodes[a + 1], nodes[b], nodes[b + 1])) return true;
    }
  }
  return false;
}

/** Builds a graph solely from verified corridors; historic connections and proximity are ignored. */
export function buildKnooppuntenGraph(allAvailableNodes: KnooppuntNode[]): OfficialNetworkGraph {
  return buildOfficialNetworkGraph(allAvailableNodes);
}

export interface NearestRoundTripStart {
  node: KnooppuntNode;
  distanceKm: number;
}

/** Find the nearest junction that is actually connected to the official graph. */
export function findNearestRoundTripStart(
  center: { lat: number; lng: number },
  allAvailableNodes: KnooppuntNode[],
): NearestRoundTripStart | null {
  const graph = buildKnooppuntenGraph(allAvailableNodes);
  let nearest: NearestRoundTripStart | null = null;
  for (const [key, node] of graph.nodeMap) {
    if ((graph.adjacency.get(key)?.size || 0) === 0) continue;
    const distanceKm = Math.hypot(
      (node.lat - center.lat) * 111,
      (node.lng - center.lng) * 111 * Math.cos((center.lat * Math.PI) / 180),
    );
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { node, distanceKm };
    }
  }
  return nearest;
}

/** Find closed loops over verified graph edges only. */
export function findRoundTrips(
  startNode: KnooppuntNode,
  allAvailableNodes: KnooppuntNode[],
  targetKm: number,
): GeneratedLoop[] {
  const graph = buildKnooppuntenGraph(allAvailableNodes);
  const startKey = getNodeKey(startNode);
  if (!graph.nodeMap.has(startKey)) return [];

  const minimumKm = Math.max(8, targetKm * 0.55);
  const maximumKm = targetKm * 1.4;
  const found: { keys: string[]; distanceKm: number; areaKm2: number }[] = [];
  const seen = new Set<string>();

  const search = (currentKey: string, visited: Set<string>, path: string[], distanceKm: number) => {
    if (found.length >= 80 || path.length > 36) return;
    const neighbours = graph.adjacency.get(currentKey);
    if (!neighbours) return;
    for (const [nextKey, edge] of neighbours) {
      if (nextKey === startKey) {
        if (path.length < 4) continue;
        const total = distanceKm + edge.distanceKm;
        if (total < minimumKm || total > maximumKm) continue;
        const keys = [...path, startKey];
        const nodes = keys.map((key) => graph.nodeMap.get(key)!);
        const area = polygonAreaKm2(nodes);
        if (area < 1.5 || hasSelfIntersection(nodes)) continue;
        const reverseInvariant = keys.slice(0, -1).sort().join('|');
        if (seen.has(reverseInvariant)) continue;
        seen.add(reverseInvariant);
        found.push({ keys, distanceKm: Math.round(total * 10) / 10, areaKm2: area });
        continue;
      }
      if (visited.has(nextKey)) continue;
      const nextDistance = distanceKm + edge.distanceKm;
      if (nextDistance > maximumKm) continue;
      visited.add(nextKey);
      search(nextKey, visited, [...path, nextKey], nextDistance);
      visited.delete(nextKey);
    }
  };

  search(startKey, new Set([startKey]), [startKey], 0);
  return found
    .sort((a, b) => {
      const scoreA = Math.abs(a.distanceKm - targetKm) - (a.areaKm2 / (a.distanceKm * a.distanceKm)) * 8;
      const scoreB = Math.abs(b.distanceKm - targetKm) - (b.areaKm2 / (b.distanceKm * b.distanceKm)) * 8;
      return scoreA - scoreB;
    })
    .slice(0, 5)
    .map((loop, index) => ({
      nodes: loop.keys.map((key) => graph.nodeMap.get(key)!),
      distanceKm: loop.distanceKm,
      nodeCount: loop.keys.length,
      description: index === 0 ? 'Aanbevolen officiële rondrit' : `Alternatieve officiële rondrit ${index + 1}`,
      direction: 'Officieel knooppuntennetwerk',
    }));
}
