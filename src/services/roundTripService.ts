import { KnooppuntNode } from '../types';
import { calculateHaversineDistanceKm } from './routingService';
import { OFFICIAL_GIS_CORRIDORS } from '../data/officialGisCorridors';
import { INITIAL_NODES } from '../data/knooppuntenData';

export interface GeneratedLoop {
  nodes: KnooppuntNode[];
  distanceKm: number;
  nodeCount: number;
  description: string;
  direction?: string;
}

/**
 * Check if two line segments (p1-p2 and p3-p4) intersect in 2D plane
 */
function doSegmentsIntersect(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
  p3: { lat: number; lng: number },
  p4: { lat: number; lng: number }
): boolean {
  function ccw(a: { lat: number; lng: number }, b: { lat: number; lng: number }, c: { lat: number; lng: number }) {
    return (c.lat - a.lat) * (b.lng - a.lng) > (b.lat - a.lat) * (c.lng - a.lng);
  }
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Check if a polygon is simple (no self-intersecting non-adjacent edges)
 */
function isSimplePolygon(nodes: KnooppuntNode[]): boolean {
  const n = nodes.length - 1; // last node is same as first
  if (n < 3) return false;

  for (let i = 0; i < n; i++) {
    const a1 = nodes[i];
    const a2 = nodes[i + 1];

    for (let j = i + 2; j < n; j++) {
      // Don't check adjacent segments or first & last segment sharing start/end
      if (i === 0 && j === n - 1) continue;

      const b1 = nodes[j];
      const b2 = nodes[j + 1];

      if (doSegmentsIntersect(a1, a2, b1, b2)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Calculate enclosed polygon area in square kilometers using Shoelace formula
 */
function calculatePolygonAreaKm2(nodes: KnooppuntNode[]): number {
  if (nodes.length < 4) return 0;
  let area = 0;
  const kmPerLat = 111.0;
  const avgLat = nodes.reduce((sum, n) => sum + n.lat, 0) / nodes.length;
  const kmPerLng = 111.0 * Math.cos((avgLat * Math.PI) / 180);

  for (let i = 0; i < nodes.length - 1; i++) {
    const x1 = (nodes[i].lng - nodes[0].lng) * kmPerLng;
    const y1 = (nodes[i].lat - nodes[0].lat) * kmPerLat;
    const x2 = (nodes[i + 1].lng - nodes[0].lng) * kmPerLng;
    const y2 = (nodes[i + 1].lat - nodes[0].lat) * kmPerLat;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2.0;
}

/**
 * Build an authentic graph of knooppunten connections
 */
export function buildKnooppuntenGraph(allAvailableNodes: KnooppuntNode[]): {
  nodeMap: Map<string, KnooppuntNode>;
  adjacency: Map<string, Set<string>>;
} {
  const nodeMap = new Map<string, KnooppuntNode>();
  const adjacency = new Map<string, Set<string>>();

  // Populate nodeMap with available nodes and fallback seed nodes
  const combined = [...INITIAL_NODES, ...allAvailableNodes];
  for (const node of combined) {
    if (!nodeMap.has(node.ref)) {
      nodeMap.set(node.ref, node);
      adjacency.set(node.ref, new Set());
    }
  }

  // 1. Add connections from INITIAL_NODES
  for (const node of combined) {
    if (node.connections) {
      for (const targetRef of node.connections) {
        if (nodeMap.has(targetRef) && node.ref !== targetRef) {
          adjacency.get(node.ref)?.add(targetRef);
          adjacency.get(targetRef)?.add(node.ref);
        }
      }
    }
  }

  // 2. Add connections from OFFICIAL_GIS_CORRIDORS
  for (const key of Object.keys(OFFICIAL_GIS_CORRIDORS)) {
    const parts = key.split('-');
    if (parts.length === 2) {
      const [fromRef, toRef] = parts;
      if (nodeMap.has(fromRef) && nodeMap.has(toRef) && fromRef !== toRef) {
        adjacency.get(fromRef)?.add(toRef);
        adjacency.get(toRef)?.add(fromRef);
      }
    }
  }

  // 3. For any node with degree < 2, or newly discovered Overpass nodes,
  // infer realistic physical network edges using Gabriel Graph / Relative Neighborhood Graph rule:
  // Nodes within 0.8km to 5.5km without an intervening node in between them.
  const nodeList = Array.from(nodeMap.values());
  for (let i = 0; i < nodeList.length; i++) {
    const u = nodeList[i];
    const uNeighbors = adjacency.get(u.ref)!;

    // Look for potential neighbors if node has fewer than 4 connections
    if (uNeighbors.size >= 4) continue;

    const candidates: { node: KnooppuntNode; dist: number }[] = [];
    for (let j = 0; j < nodeList.length; j++) {
      if (i === j) continue;
      const v = nodeList[j];
      if (uNeighbors.has(v.ref)) continue;

      const d = calculateHaversineDistanceKm(u.lat, u.lng, v.lat, v.lng);
      // Realistic cycling distance between adjacent knooppunten (0.8km - 5.5km)
      if (d >= 0.8 && d <= 5.5) {
        candidates.push({ node: v, dist: d });
      }
    }

    // Sort by proximity
    candidates.sort((a, b) => a.dist - b.dist);

    for (const { node: v, dist: dUV } of candidates) {
      if (uNeighbors.size >= 4) break;
      const vNeighbors = adjacency.get(v.ref)!;
      if (vNeighbors.size >= 4) continue;

      // Relative Neighborhood rule: no third node w is strictly closer to both u and v
      let hasInterveningNode = false;
      for (let k = 0; k < nodeList.length; k++) {
        const w = nodeList[k];
        if (w.ref === u.ref || w.ref === v.ref) continue;
        const dUW = calculateHaversineDistanceKm(u.lat, u.lng, w.lat, w.lng);
        const dWV = calculateHaversineDistanceKm(w.lat, w.lng, v.lat, v.lng);

        // If w lies almost directly on the path between u and v
        if (dUW + dWV < dUV * 1.15) {
          hasInterveningNode = true;
          break;
        }
      }

      if (!hasInterveningNode) {
        uNeighbors.add(v.ref);
        vNeighbors.add(u.ref);
      }
    }
  }

  return { nodeMap, adjacency };
}

/**
 * Find valid, authentic round trips (closed cycles) starting and ending at startNode
 */
export function findRoundTrips(
  startNode: KnooppuntNode,
  allAvailableNodes: KnooppuntNode[],
  targetKm: number
): GeneratedLoop[] {
  const { nodeMap, adjacency } = buildKnooppuntenGraph(allAvailableNodes);

  // Make sure start node is in map
  if (!nodeMap.has(startNode.ref)) {
    nodeMap.set(startNode.ref, startNode);
    if (!adjacency.has(startNode.ref)) {
      adjacency.set(startNode.ref, new Set());
    }
  }

  const startRef = startNode.ref;
  const startNeighbors = Array.from(adjacency.get(startRef) || []);

  if (startNeighbors.length < 2) {
    // If start node has fewer than 2 neighbors in graph, connect to 2 closest nodes
    const sorted = Array.from(nodeMap.values())
      .filter(n => n.ref !== startRef)
      .map(n => ({ n, d: calculateHaversineDistanceKm(startNode.lat, startNode.lng, n.lat, n.lng) }))
      .sort((a, b) => a.d - b.d);

    for (const item of sorted.slice(0, 3)) {
      adjacency.get(startRef)?.add(item.n.ref);
      adjacency.get(item.n.ref)?.add(startRef);
    }
  }

  const validLoops: {
    pathRefs: string[];
    distanceKm: number;
    areaKm2: number;
  }[] = [];

  const maxKm = targetKm * 1.4;
  const minKm = Math.max(8, targetKm * 0.55);

  // Helper to calculate segment distance with road winding factor
  function getDist(refA: string, refB: string): number {
    const a = nodeMap.get(refA)!;
    const b = nodeMap.get(refB)!;
    const corr = OFFICIAL_GIS_CORRIDORS[`${refA}-${refB}`] || OFFICIAL_GIS_CORRIDORS[`${refB}-${refA}`];
    if (corr) return corr.distanceKm;
    return Math.round(calculateHaversineDistanceKm(a.lat, a.lng, b.lat, b.lng) * 1.2 * 10) / 10;
  }

  // Depth-first search for cycles
  function dfs(
    currentRef: string,
    visited: Set<string>,
    path: string[],
    accumulatedKm: number
  ) {
    const neighbors = Array.from(adjacency.get(currentRef) || []);

    for (const nextRef of neighbors) {
      if (nextRef === startRef) {
        // Closed cycle found!
        // At least 4 distinct nodes for a genuine non-degenerate 2D loop
        if (path.length >= 4) {
          const closingDist = getDist(currentRef, startRef);
          const totalDist = accumulatedKm + closingDist;

          if (totalDist >= minKm && totalDist <= maxKm) {
            const fullPathRefs = [...path, startRef];
            const fullNodes = fullPathRefs.map(r => nodeMap.get(r)!);

            // Verify polygon is simple and non-collapsed
            if (isSimplePolygon(fullNodes)) {
              const area = calculatePolygonAreaKm2(fullNodes);
              // Area must be positive and non-trivial (preventing 1D flattened collapsed sticks)
              if (area >= 1.5) {
                validLoops.push({
                  pathRefs: fullPathRefs,
                  distanceKm: Math.round(totalDist * 10) / 10,
                  areaKm2: area,
                });
              }
            }
          }
        }
        continue;
      }

      if (visited.has(nextRef)) continue;

      const legDist = getDist(currentRef, nextRef);
      const newAccumulated = accumulatedKm + legDist;

      // Pruning: if current distance already exceeds target limit
      if (newAccumulated > maxKm) continue;

      // Angle check: prevent sharp 180-degree U-turns back into previous trajectory
      if (path.length >= 2) {
        const prev = nodeMap.get(path[path.length - 2])!;
        const curr = nodeMap.get(currentRef)!;
        const next = nodeMap.get(nextRef)!;

        const v1x = curr.lng - prev.lng;
        const v1y = curr.lat - prev.lat;
        const v2x = next.lng - curr.lng;
        const v2y = next.lat - curr.lat;

        const dot = v1x * v2x + v1y * v2y;
        const mag1 = Math.hypot(v1x, v1y);
        const mag2 = Math.hypot(v2x, v2y);

        if (mag1 > 0 && mag2 > 0) {
          const cosAngle = dot / (mag1 * mag2);
          // If cosAngle < -0.85 (angle > ~150 deg, sharp hairpin back onto almost the same path), skip
          if (cosAngle < -0.85) continue;
        }
      }

      visited.add(nextRef);
      path.push(nextRef);

      dfs(nextRef, visited, path, newAccumulated);

      path.pop();
      visited.delete(nextRef);

      // Stop if we have accumulated sufficient diverse loops to keep response instantaneous
      if (validLoops.length > 50) return;
    }
  }

  const initialVisited = new Set<string>([startRef]);
  dfs(startRef, initialVisited, [startRef], 0);

  // If no loops found within strict distance, do a broader search with relaxed min/max
  if (validLoops.length === 0) {
    function dfsRelaxed(
      currentRef: string,
      visited: Set<string>,
      path: string[],
      accumulatedKm: number
    ) {
      const neighbors = Array.from(adjacency.get(currentRef) || []);
      for (const nextRef of neighbors) {
        if (nextRef === startRef) {
          if (path.length >= 4) {
            const totalDist = accumulatedKm + getDist(currentRef, startRef);
            const fullPathRefs = [...path, startRef];
            const fullNodes = fullPathRefs.map(r => nodeMap.get(r)!);
            if (isSimplePolygon(fullNodes)) {
              validLoops.push({
                pathRefs: fullPathRefs,
                distanceKm: Math.round(totalDist * 10) / 10,
                areaKm2: calculatePolygonAreaKm2(fullNodes),
              });
            }
          }
          continue;
        }
        if (visited.has(nextRef)) continue;
        if (accumulatedKm > targetKm * 1.8) continue;

        visited.add(nextRef);
        path.push(nextRef);
        dfsRelaxed(nextRef, visited, path, accumulatedKm + getDist(currentRef, nextRef));
        path.pop();
        visited.delete(nextRef);
        if (validLoops.length > 20) return;
      }
    }
    dfsRelaxed(startRef, new Set([startRef]), [startRef], 0);
  }

  // Deduplicate loops that represent the same polygon traversed in reverse
  const uniqueLoops: typeof validLoops = [];
  const seenSets = new Set<string>();

  for (const loop of validLoops) {
    const inner = loop.pathRefs.slice(1, -1);
    const sortedKey = [...inner].sort().join(',');
    if (!seenSets.has(sortedKey)) {
      seenSets.add(sortedKey);
      uniqueLoops.push(loop);
    }
  }

  // Score and rank loops:
  // - Closeness to targetKm (weight 60%)
  // - High circularity / roundness (Area / Perimeter^2, weight 40%)
  uniqueLoops.sort((a, b) => {
    const diffA = Math.abs(a.distanceKm - targetKm);
    const diffB = Math.abs(b.distanceKm - targetKm);

    // Isoperimetric quotient: 4 * PI * Area / Perimeter^2 (1 for perfect circle, lower for skinny loops)
    const circA = (4 * Math.PI * a.areaKm2) / (a.distanceKm * a.distanceKm);
    const circB = (4 * Math.PI * b.areaKm2) / (b.distanceKm * b.distanceKm);

    const scoreA = diffA * 1.5 - circA * 12;
    const scoreB = diffB * 1.5 - circB * 12;

    return scoreA - scoreB;
  });

  // Convert to GeneratedLoop objects with descriptions
  return uniqueLoops.slice(0, 5).map((l, idx) => {
    const fullNodes = l.pathRefs.map(r => nodeMap.get(r)!);
    
    // Determine prominent orientation (North, East, South, West)
    let avgLat = 0;
    let avgLng = 0;
    for (const n of fullNodes) {
      avgLat += n.lat;
      avgLng += n.lng;
    }
    avgLat /= fullNodes.length;
    avgLng /= fullNodes.length;

    const dLat = avgLat - startNode.lat;
    const dLng = avgLng - startNode.lng;

    let dir = 'Klassieke rondrit';
    if (Math.abs(dLat) > Math.abs(dLng)) {
      dir = dLat > 0 ? 'Noordelijke lus' : 'Zuidelijke lus';
    } else {
      dir = dLng > 0 ? 'Oostelijke lus' : 'Westelijke lus';
    }

    const title = idx === 0 ? `Aanbevolen ${dir}` : `Alternatief ${idx + 1}: ${dir}`;

    return {
      nodes: fullNodes,
      distanceKm: l.distanceKm,
      nodeCount: fullNodes.length,
      description: title,
      direction: dir,
    };
  });
}
