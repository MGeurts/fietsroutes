export type NetworkCoordinate = [number, number];

function distanceDegrees(a: NetworkCoordinate, b: NetworkCoordinate): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function sameCoordinate(a: NetworkCoordinate, b: NetworkCoordinate): boolean {
  return distanceDegrees(a, b) < 1e-10;
}

function lineLengthDegrees(coordinates: NetworkCoordinate[]): number {
  return coordinates.slice(1).reduce((length, coordinate, index) => length + distanceDegrees(coordinates[index], coordinate), 0);
}

/**
 * Assemble the ways of one route relation into a single ordered line.
 *
 * OSM relation members are not guaranteed to be in travel order, nor to have a
 * consistent direction. We therefore grow the line at both ends. A very small
 * gap is retained as a visible short connector; a larger gap rejects the whole
 * geometry rather than inventing a route across the map.
 */
export function assembleRelationGeometry(
  inputSegments: NetworkCoordinate[][],
  maxJoinDistanceDegrees: number,
): NetworkCoordinate[] | null {
  if (inputSegments.length === 0 || inputSegments.some((segment) => segment.length < 2)) return null;

  const remaining = inputSegments.map((segment) => [...segment]);
  let coordinates = remaining.shift()!;

  while (remaining.length > 0) {
    const head = coordinates[0];
    const tail = coordinates[coordinates.length - 1];
    let best: { index: number; side: 'prepend' | 'append'; reverse: boolean; distance: number } | null = null;

    const consider = (index: number, side: 'prepend' | 'append', reverse: boolean, distance: number) => {
      if (!best || distance < best.distance) best = { index, side, reverse, distance };
    };

    remaining.forEach((segment, index) => {
      const start = segment[0];
      const end = segment[segment.length - 1];
      consider(index, 'append', false, distanceDegrees(tail, start));
      consider(index, 'append', true, distanceDegrees(tail, end));
      consider(index, 'prepend', false, distanceDegrees(head, end));
      consider(index, 'prepend', true, distanceDegrees(head, start));
    });

    if (!best || best.distance > maxJoinDistanceDegrees) return null;
    const segment = remaining.splice(best.index, 1)[0];
    const oriented = best.reverse ? [...segment].reverse() : segment;

    if (best.side === 'append') {
      coordinates = coordinates.concat(sameCoordinate(coordinates[coordinates.length - 1], oriented[0]) ? oriented.slice(1) : oriented);
    } else {
      coordinates = (sameCoordinate(oriented[oriented.length - 1], coordinates[0]) ? oriented.slice(0, -1) : oriented).concat(coordinates);
    }
  }

  return coordinates;
}

/**
 * Some valid OSM relations contain a short loop or parallel carriageway.  They
 * cannot be represented by visiting every member exactly once in one line, even
 * though the member ways do contain a valid path between the two named junctions.
 * Build that path from the relation's own ways only; this is deliberately not a
 * road-router fallback.
 */
export function findRelationPathGeometry(
  inputSegments: NetworkCoordinate[][],
  start: NetworkCoordinate,
  finish: NetworkCoordinate,
  maxJoinDistanceDegrees: number,
  maxEndpointDistanceDegrees: number,
): NetworkCoordinate[] | null {
  if (inputSegments.length === 0 || inputSegments.some((segment) => segment.length < 2)) return null;

  type Endpoint = { segmentIndex: number; atStart: boolean; coordinate: NetworkCoordinate };
  const endpoints: Endpoint[] = inputSegments.flatMap((segment, segmentIndex) => [
    { segmentIndex, atStart: true, coordinate: segment[0] },
    { segmentIndex, atStart: false, coordinate: segment[segment.length - 1] },
  ]);
  const parent = endpoints.map((_, index) => index);
  const root = (index: number): number => {
    while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; }
    return index;
  };
  const join = (a: number, b: number) => {
    const aRoot = root(a); const bRoot = root(b);
    if (aRoot !== bRoot) parent[bRoot] = aRoot;
  };
  for (let left = 0; left < endpoints.length; left += 1) {
    for (let right = left + 1; right < endpoints.length; right += 1) {
      if (distanceDegrees(endpoints[left].coordinate, endpoints[right].coordinate) <= maxJoinDistanceDegrees) join(left, right);
    }
  }

  const nearestEndpoint = (target: NetworkCoordinate): number | null => {
    let nearest: number | null = null;
    let distance = maxEndpointDistanceDegrees;
    endpoints.forEach((endpoint, index) => {
      const candidate = distanceDegrees(endpoint.coordinate, target);
      if (candidate <= distance) { nearest = index; distance = candidate; }
    });
    return nearest;
  };
  const startEndpoint = nearestEndpoint(start);
  const finishEndpoint = nearestEndpoint(finish);
  if (startEndpoint === null || finishEndpoint === null) return null;
  const startVertex = root(startEndpoint);
  const finishVertex = root(finishEndpoint);
  if (startVertex === finishVertex) return null;

  type Step = { to: number; segmentIndex: number; forward: boolean; weight: number };
  const graph = new Map<number, Step[]>();
  const add = (from: number, step: Step) => graph.set(from, [...(graph.get(from) || []), step]);
  inputSegments.forEach((segment, segmentIndex) => {
    const from = root(segmentIndex * 2);
    const to = root(segmentIndex * 2 + 1);
    const weight = lineLengthDegrees(segment);
    if (from === to) return;
    add(from, { to, segmentIndex, forward: true, weight });
    add(to, { to: from, segmentIndex, forward: false, weight });
  });

  const distances = new Map<number, number>([[startVertex, 0]]);
  const previous = new Map<number, Step & { from: number }>();
  const remaining = new Set<number>(graph.keys());
  while (remaining.size > 0) {
    let current: number | null = null;
    let currentDistance = Infinity;
    for (const vertex of remaining) {
      const distance = distances.get(vertex) ?? Infinity;
      if (distance < currentDistance) { current = vertex; currentDistance = distance; }
    }
    if (current === null || currentDistance === Infinity) break;
    remaining.delete(current);
    if (current === finishVertex) break;
    for (const step of graph.get(current) || []) {
      if (!remaining.has(step.to)) continue;
      const candidate = currentDistance + step.weight;
      if (candidate < (distances.get(step.to) ?? Infinity)) {
        distances.set(step.to, candidate);
        previous.set(step.to, { ...step, from: current });
      }
    }
  }
  if (!previous.has(finishVertex)) return null;

  const path: (Step & { from: number })[] = [];
  for (let vertex = finishVertex; vertex !== startVertex;) {
    const step = previous.get(vertex);
    if (!step) return null;
    path.unshift(step);
    vertex = step.from;
  }
  return path.reduce<NetworkCoordinate[]>((coordinates, step) => {
    const segment = step.forward ? inputSegments[step.segmentIndex] : [...inputSegments[step.segmentIndex]].reverse();
    return coordinates.concat(coordinates.length > 0 && sameCoordinate(coordinates[coordinates.length - 1], segment[0]) ? segment.slice(1) : segment);
  }, []);
}
