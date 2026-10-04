import { KnooppuntNode, OfficialNetworkDataset, OfficialNetworkDatasetEdge } from '../types';

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Route relations sometimes use a second OSM marker for the same junction on a
// nearby carriageway.  Only snap a malformed relation endpoint to a marker that
// is genuinely at the end of its geometry; 75 m is deliberately tighter than
// the dataset importer's old endpoint tolerance.
const GEOMETRY_ENDPOINT_TOLERANCE_KM = 0.075;
// A displayed junction can use a small cluster of OSM markers around a bridge,
// roundabout or crossing.  Keep the hand-off radius below a city block, while
// still joining the three KP 402 markers that are about 100 m apart.
const JUNCTION_ALIAS_DISTANCE_KM = 0.125;

function geometryDistanceKm(coordinates: [number, number][]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += distanceKm(
      coordinates[index - 1][0], coordinates[index - 1][1],
      coordinates[index][0], coordinates[index][1],
    );
  }
  return Math.round(total * 100) / 100;
}

function closestSameRefEndpoint(
  nodes: Map<string, KnooppuntNode>,
  expected: KnooppuntNode,
  coordinate: [number, number],
): KnooppuntNode | null {
  let closest: KnooppuntNode | null = null;
  let closestDistance = GEOMETRY_ENDPOINT_TOLERANCE_KM;
  for (const candidate of nodes.values()) {
    if (candidate.ref !== expected.ref) continue;
    const candidateDistance = distanceKm(coordinate[0], coordinate[1], candidate.lat, candidate.lng);
    if (candidateDistance <= closestDistance) {
      closest = candidate;
      closestDistance = candidateDistance;
    }
  }
  return closest;
}

/**
 * Correct a relation whose displayed endpoint is a nearby duplicate marker,
 * while its geometry clearly ends at the other marker.  A route that reaches
 * that real endpoint and then returns to it through a side branch is shortened
 * at the first arrival; the side branch is not part of a node-to-node leg.
 */
function normaliseImportedEdge(
  edge: OfficialNetworkDatasetEdge,
  nodes: Map<string, KnooppuntNode>,
): OfficialNetworkDatasetEdge {
  const declaredFrom = nodes.get(edge.from);
  const declaredTo = nodes.get(edge.to);
  if (!declaredFrom || !declaredTo) return edge;

  const start = edge.coordinates[0];
  const finish = edge.coordinates[edge.coordinates.length - 1];
  const geometryFrom = closestSameRefEndpoint(nodes, declaredFrom, start);
  const geometryTo = closestSameRefEndpoint(nodes, declaredTo, finish);
  const declaredFromDistance = distanceKm(start[0], start[1], declaredFrom.lat, declaredFrom.lng);
  const declaredToDistance = distanceKm(finish[0], finish[1], declaredTo.lat, declaredTo.lng);
  const from = geometryFrom && declaredFromDistance > GEOMETRY_ENDPOINT_TOLERANCE_KM ? geometryFrom : declaredFrom;
  const to = geometryTo && declaredToDistance > GEOMETRY_ENDPOINT_TOLERANCE_KM ? geometryTo : declaredTo;

  let coordinates = edge.coordinates;
  // Some relations begin on a side branch, reach their declared start marker,
  // and only then follow the actual connection. Drop that approach branch.
  if (declaredFromDistance > GEOMETRY_ENDPOINT_TOLERANCE_KM) {
    const firstDeparture = coordinates.findIndex((coordinate, index) => index > 0
      && distanceKm(coordinate[0], coordinate[1], from.lat, from.lng) <= GEOMETRY_ENDPOINT_TOLERANCE_KM);
    if (firstDeparture > 0 && firstDeparture < coordinates.length - 1) {
      coordinates = coordinates.slice(firstDeparture);
    }
  }
  // Likewise, a relation can reach the real endpoint before its final coordinate
  // and continue along a side branch. A node-to-node leg must stop on first arrival.
  if (to.id !== declaredTo.id || declaredToDistance > GEOMETRY_ENDPOINT_TOLERANCE_KM) {
    const firstArrival = coordinates.findIndex((coordinate, index) => index > 0
      && distanceKm(coordinate[0], coordinate[1], to.lat, to.lng) <= GEOMETRY_ENDPOINT_TOLERANCE_KM);
    if (firstArrival > 0 && firstArrival < coordinates.length - 1) {
      coordinates = coordinates.slice(0, firstArrival + 1);
    }
  }

  if (from.id === declaredFrom.id && to.id === declaredTo.id && coordinates === edge.coordinates) return edge;
  return {
    ...edge,
    from: String(from.id),
    to: String(to.id),
    coordinates,
    distanceKm: geometryDistanceKm(coordinates),
  };
}

export interface OfficialNetworkEdge {
  fromKey: string;
  toKey: string;
  distanceKm: number;
  coordinates: [number, number][];
  source: string;
  /** Two OSM markers for one physical junction; this is not a route segment. */
  isJunctionAlias?: boolean;
}

export interface OfficialNetworkGraph {
  nodeMap: Map<string, KnooppuntNode>;
  adjacency: Map<string, Map<string, OfficialNetworkEdge>>;
}

let importedEdges = new Map<string, OfficialNetworkDatasetEdge>();
let importedNodes = new Map<string, KnooppuntNode>();
let importedAdjacency = new Map<string, Map<string, OfficialNetworkEdge>>();
let declaredNetworkAdjacency = new Map<string, Map<string, OfficialNetworkEdge>>();
let officialTopologyAdjacency = new Map<string, Map<string, OfficialNetworkEdge>>();
let officialTopologyAnchors = new Map<string, string>();

function edgeKey(from: string, to: string): string {
  return `${from}\u0000${to}`;
}

/** Register a validated, build-time dataset. Browser discovery is never allowed to register edges. */
export function registerOfficialNetworkDataset(dataset: OfficialNetworkDataset): void {
  if (dataset.version !== 1 || !Array.isArray(dataset.edges) || !Array.isArray(dataset.nodes)) return;
  const allowedNodeIds = new Set(dataset.nodes.map((node) => String(node.id)));
  const next = new Map<string, OfficialNetworkDatasetEdge>();
  const nextNodes = new Map(dataset.nodes.map((node) => [String(node.id), node]));
  const nextAdjacency = new Map<string, Map<string, OfficialNetworkEdge>>();
  for (const rawEdge of dataset.edges) {
    const edge = normaliseImportedEdge(rawEdge, nextNodes);
    if (!allowedNodeIds.has(edge.from) || !allowedNodeIds.has(edge.to) || edge.coordinates.length < 2 || edge.distanceKm <= 0) continue;
    next.set(edgeKey(edge.from, edge.to), edge);
    const reverse = {
      ...edge,
      from: edge.to,
      to: edge.from,
      coordinates: [...edge.coordinates].reverse(),
    };
    next.set(edgeKey(edge.to, edge.from), reverse);
    const forwardEdge: OfficialNetworkEdge = {
      fromKey: edge.from, toKey: edge.to, distanceKm: edge.distanceKm,
      coordinates: edge.coordinates, source: edge.source,
    };
    const reverseEdge: OfficialNetworkEdge = {
      fromKey: reverse.from, toKey: reverse.to, distanceKm: reverse.distanceKm,
      coordinates: reverse.coordinates, source: reverse.source,
    };
    const forwardNeighbours = nextAdjacency.get(edge.from) || new Map<string, OfficialNetworkEdge>();
    forwardNeighbours.set(edge.to, forwardEdge);
    nextAdjacency.set(edge.from, forwardNeighbours);
    const reverseNeighbours = nextAdjacency.get(reverse.from) || new Map<string, OfficialNetworkEdge>();
    reverseNeighbours.set(reverse.to, reverseEdge);
    nextAdjacency.set(reverse.from, reverseNeighbours);
  }
  importedEdges = next;
  importedNodes = nextNodes;
  importedAdjacency = nextAdjacency;
  const nextDeclaredAdjacency = new Map<string, Map<string, OfficialNetworkEdge>>(
    [...nextAdjacency].map(([key, neighbours]) => [key, new Map(neighbours)]),
  );
  const hasEquivalentVerifiedGeometry = (fromKey: string, toKey: string, source: string): boolean => {
    const declaredFrom = nextNodes.get(fromKey);
    if (!declaredFrom) return false;
    for (const edge of next.values()) {
      if (edge.source !== source || edge.coordinates.length < 2 || edge.to !== toKey) continue;
      const geometryFrom = nextNodes.get(edge.from);
      if (!geometryFrom || geometryFrom.ref !== declaredFrom.ref) continue;
      if (distanceKm(geometryFrom.lat, geometryFrom.lng, declaredFrom.lat, declaredFrom.lng) <= JUNCTION_ALIAS_DISTANCE_KM) return true;
    }
    return false;
  };
  const addDeclaredConnection = (fromKey: string, toKey: string, source: string) => {
    const from = nextNodes.get(fromKey);
    const to = nextNodes.get(toKey);
    if (!from || !to || fromKey === toKey) return;
    const add = (forwardKey: string, reverseKey: string, fromNode: KnooppuntNode, toNode: KnooppuntNode) => {
      const neighbours = nextDeclaredAdjacency.get(forwardKey) || new Map<string, OfficialNetworkEdge>();
      // Complete, validated geometry always beats a topology-only relation.
      if (!neighbours.has(reverseKey)) {
        neighbours.set(reverseKey, {
          fromKey: forwardKey, toKey: reverseKey, coordinates: [], source,
          distanceKm: distanceKm(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng),
        });
      }
      nextDeclaredAdjacency.set(forwardKey, neighbours);
    };
    // A relation can mention a duplicate marker while the same relation already
    // has complete geometry from a nearby marker with that identical ref. Keep
    // the verified corridor and let the short junction alias perform the handoff;
    // otherwise an incomplete duplicate edge can win the shortest-path search.
    if (!hasEquivalentVerifiedGeometry(fromKey, toKey, source)) add(fromKey, toKey, from, to);
    if (!hasEquivalentVerifiedGeometry(toKey, fromKey, source)) add(toKey, fromKey, to, from);
  };
  for (const connection of dataset.declaredConnections || []) {
    addDeclaredConnection(connection.from, connection.to, connection.source);
  }

  // A physical junction can be mapped as two nearby OSM nodes (for example one
  // marker per carriageway). Relations may use different markers for adjacent
  // routes, fragmenting an otherwise valid node network. Join only markers with
  // the same displayed ref, both already connected to the network, and within
  // 125 metres. This is a topology alias, not invented road geometry.
  const connectedByRef = new Map<string, KnooppuntNode[]>();
  for (const node of nextNodes.values()) {
    if (!(nextDeclaredAdjacency.get(String(node.id))?.size)) continue;
    const sameRef = connectedByRef.get(node.ref) || [];
    sameRef.push(node);
    connectedByRef.set(node.ref, sameRef);
  }
  for (const nodesWithSameRef of connectedByRef.values()) {
    for (let index = 0; index < nodesWithSameRef.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < nodesWithSameRef.length; otherIndex += 1) {
        const fromNode = nodesWithSameRef[index];
        const toNode = nodesWithSameRef[otherIndex];
        if (distanceKm(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng) > JUNCTION_ALIAS_DISTANCE_KM) continue;
        const fromKey = String(fromNode.id);
        const toKey = String(toNode.id);
        const addAlias = (start: string, end: string) => {
          const neighbours = nextDeclaredAdjacency.get(start) || new Map<string, OfficialNetworkEdge>();
          if (!neighbours.has(end)) {
            neighbours.set(end, {
              fromKey: start,
              toKey: end,
              distanceKm: 0,
              coordinates: [],
              source: 'Nabije OSM-markers van hetzelfde knooppunt',
              isJunctionAlias: true,
            });
          }
          nextDeclaredAdjacency.set(start, neighbours);
        };
        addAlias(fromKey, toKey);
        addAlias(toKey, fromKey);
      }
    }
  }

  declaredNetworkAdjacency = nextDeclaredAdjacency;
  const topologyAdjacency = new Map<string, Map<string, OfficialNetworkEdge>>();
  for (const edge of dataset.topology?.edges || []) {
    if (edge.coordinates.length < 2 || edge.distanceKm <= 0) continue;
    const add = (from: string, to: string, coordinates: [number, number][]) => {
      const neighbours = topologyAdjacency.get(from) || new Map<string, OfficialNetworkEdge>();
      neighbours.set(to, { fromKey: from, toKey: to, distanceKm: edge.distanceKm, coordinates, source: edge.source });
      topologyAdjacency.set(from, neighbours);
    };
    add(edge.from, edge.to, edge.coordinates);
    add(edge.to, edge.from, [...edge.coordinates].reverse());
  }
  officialTopologyAdjacency = topologyAdjacency;
  officialTopologyAnchors = new Map(Object.entries(dataset.topology?.anchors || {}));
}

/** OSM ids are stable and refs are not globally unique. */
export function getNodeKey(node: KnooppuntNode): string {
  if (node.id !== undefined && node.id !== null && String(node.id).trim()) {
    return String(node.id);
  }
  return `legacy:${node.ref}:${node.lat.toFixed(5)}:${node.lng.toFixed(5)}`;
}

/**
 * Resolve a leg only when an imported dataset edge has the exact selected endpoints.
 * No hardcoded corridor, proximity, or ref-only fallback is allowed.
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

  return null;
}

export interface OfficialNetworkPath {
  edges: OfficialNetworkEdge[];
  /** Raw OSM endpoints, kept one-for-one with edges for geometry rendering. */
  edgeNodes: KnooppuntNode[];
  /** Junctions shown to the user; duplicate marker aliases are omitted. */
  nodes: KnooppuntNode[];
  requiresLiveGeometry: boolean;
}

function shortestPath(startKey: string, targetKey: string, adjacency: Map<string, Map<string, OfficialNetworkEdge>>): OfficialNetworkEdge[] | null {
  if (startKey === targetKey || !adjacency.has(startKey) || !adjacency.has(targetKey)) return null;
  const distances = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, { key: string; edge: OfficialNetworkEdge }>();
  const queue: { key: string; distance: number }[] = [{ key: startKey, distance: 0 }];
  const push = (entry: { key: string; distance: number }) => {
    queue.push(entry);
    let index = queue.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (queue[parent].distance <= queue[index].distance) break;
      [queue[parent], queue[index]] = [queue[index], queue[parent]];
      index = parent;
    }
  };
  const pop = (): { key: string; distance: number } | undefined => {
    const first = queue[0];
    const last = queue.pop();
    if (queue.length > 0 && last) {
      queue[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < queue.length && queue[left].distance < queue[smallest].distance) smallest = left;
        if (right < queue.length && queue[right].distance < queue[smallest].distance) smallest = right;
        if (smallest === index) break;
        [queue[index], queue[smallest]] = [queue[smallest], queue[index]];
        index = smallest;
      }
    }
    return first;
  };
  while (queue.length > 0) {
    const current = pop()!;
    if (current.distance !== distances.get(current.key)) continue;
    if (current.key === targetKey) break;
    for (const [nextKey, edge] of adjacency.get(current.key) || []) {
      const nextDistance = current.distance + edge.distanceKm;
      if (nextDistance >= (distances.get(nextKey) ?? Infinity)) continue;
      distances.set(nextKey, nextDistance);
      previous.set(nextKey, { key: current.key, edge });
      push({ key: nextKey, distance: nextDistance });
    }
  }
  if (!previous.has(targetKey)) return null;
  const edges: OfficialNetworkEdge[] = [];
  let key = targetKey;
  while (key !== startKey) {
    const step = previous.get(key);
    if (!step) return null;
    edges.unshift(step.edge);
    key = step.key;
  }
  return edges;
}

/**
 * Find the shortest path over imported, verified corridors only. This is a junction
 * network path finder, not a generic bicycle router: every returned segment is an
 * explicit edge from the static build-time dataset.
 */
export function findOfficialNetworkPath(from: KnooppuntNode, to: KnooppuntNode): OfficialNetworkPath | null {
  const startKey = getNodeKey(from);
  const targetKey = getNodeKey(to);
  if (startKey === targetKey) return null;
  const topologyEdges = shortestPath(
    officialTopologyAnchors.get(startKey) || '',
    officialTopologyAnchors.get(targetKey) || '',
    officialTopologyAdjacency,
  );
  // A relation explicitly declaring node A--B is the authoritative network
  // topology, even when its way members cannot be assembled into one safe line.
  // The former verified-only search could choose a detour (or no route) through
  // its much smaller subset and skip valid intermediate knooppunten entirely.
  // Geometry quality is dealt with per selected hop below; it must not change
  // which official node-network path is selected.
  const declaredEdges = topologyEdges ? null : shortestPath(startKey, targetKey, declaredNetworkAdjacency);
  const edges = topologyEdges || declaredEdges;
  if (!edges) return null;
  const edgeNodes = topologyEdges
    ? [from, to]
    : [from, ...edges.slice(0, -1).map((edge) => importedNodes.get(edge.toKey)!).filter(Boolean), to];
  const nodes = topologyEdges
    ? edgeNodes
    : edgeNodes.filter((node, index) => index === 0 || !edges[index - 1]?.isJunctionAlias);
  return {
    edges,
    edgeNodes,
    nodes,
    requiresLiveGeometry: Boolean(declaredEdges?.some((edge) => !edge.isJunctionAlias && edge.coordinates.length < 2)),
  };
}

/**
 * OSM can contain several nearby markers carrying the same junction number.
 * When the rider just selected a neighbouring junction, prefer the nearby
 * marker that has an explicit one-hop official connection from it. This keeps
 * a direct signed connection direct, rather than routing to another marker
 * with the same displayed number through unrelated junctions.
 *
 * The exact marker remains the fallback: no identity is replaced unless the
 * official graph provides this unambiguous direct alternative.
 */
export function findNearbyDirectSameRefNode(
  from: KnooppuntNode,
  requested: KnooppuntNode,
  candidates: KnooppuntNode[],
): KnooppuntNode | null {
  const nearby = candidates.filter((candidate) => candidate.ref === requested.ref
    && Math.abs(candidate.lat - requested.lat) < 0.003
    && Math.abs(candidate.lng - requested.lng) < 0.003);
  const direct = nearby.filter((candidate) => {
    const path = findOfficialNetworkPath(from, candidate);
    return path?.edges.length === 1
      && !path.edges[0].isJunctionAlias
      && path.edges[0].coordinates.length >= 2;
  });
  if (direct.length === 0) return null;
  return direct.reduce((nearest, candidate) => {
    const candidateDistance = Math.hypot(candidate.lat - requested.lat, candidate.lng - requested.lng);
    const nearestDistance = Math.hypot(nearest.lat - requested.lat, nearest.lng - requested.lng);
    return candidateDistance < nearestDistance ? candidate : nearest;
  });
}

/** Build an adjacency graph exclusively from verified, endpoint-matched corridors. */
export function buildOfficialNetworkGraph(nodes: KnooppuntNode[]): OfficialNetworkGraph {
  const nodeMap = new Map<string, KnooppuntNode>();
  const adjacency = new Map<string, Map<string, OfficialNetworkEdge>>();

  for (const node of nodes) {
    const key = getNodeKey(node);
    if (nodeMap.has(key)) continue;
    nodeMap.set(key, node);
    adjacency.set(key, new Map());
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
