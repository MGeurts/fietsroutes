import { ElevationPoint, KnooppuntNode, PlannedRoute, RouteDisplaySegment, RouteLeg } from '../types';

type Coordinate = [number, number];

export interface RoundTripStartOption {
  /** Addresses a visit, not a node number: revisiting one junction is legitimate. */
  key: string;
  node: KnooppuntNode;
  legIndex: number;
  segmentIndex: number;
  automatic: boolean;
  distanceFromStartKm: number;
  occurrence: number;
  occurrences: number;
}

const sameCoordinate = (left: Coordinate, right: Coordinate) => (
  Math.abs(left[0] - right[0]) < 1e-7 && Math.abs(left[1] - right[1]) < 1e-7
);

// Geometry is retained verbatim: even a very short nonzero segment matters.
const identicalCoordinate = (left: Coordinate, right: Coordinate) => (
  left[0] === right[0] && left[1] === right[1]
);

function validNode(node: KnooppuntNode): boolean {
  return Boolean(node) && (typeof node.id === 'string' ? node.id.trim().length > 0 : Number.isFinite(node.id))
    && Number.isFinite(node.lat) && Math.abs(node.lat) <= 90
    && Number.isFinite(node.lng) && Math.abs(node.lng) <= 180;
}

function sameNode(left: KnooppuntNode, right: KnooppuntNode): boolean {
  return validNode(left) && validNode(right) && String(left.id) === String(right.id)
    && sameCoordinate([left.lat, left.lng], [right.lat, right.lng]);
}

function coordinateDistance(left: Coordinate, right: Coordinate): number {
  const radians = Math.PI / 180;
  const a = Math.sin((right[0] - left[0]) * radians / 2) ** 2
    + Math.cos(left[0] * radians) * Math.cos(right[0] * radians)
    * Math.sin((right[1] - left[1]) * radians / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function geometryDistance(coordinates: Coordinate[]): number {
  return coordinates.reduce((sum, coordinate, index) => (
    index ? sum + coordinateDistance(coordinates[index - 1], coordinate) : 0
  ), 0);
}

function validCoordinates(coordinates: Coordinate[]): boolean {
  return Array.isArray(coordinates) && coordinates.length >= 2 && coordinates.every((coordinate) => (
    Array.isArray(coordinate) && coordinate.length === 2
    && Number.isFinite(coordinate[0]) && Math.abs(coordinate[0]) <= 90
    && Number.isFinite(coordinate[1]) && Math.abs(coordinate[1]) <= 180
  ));
}

/** Remove zero-length joins only; no later visit to the same location is removed. */
function joinGeometry(parts: Coordinate[][]): Coordinate[] {
  const joined: Coordinate[] = [];
  for (const part of parts) {
    for (const coordinate of part) {
      if (!joined.length || !identicalCoordinate(joined[joined.length - 1], coordinate)) joined.push(coordinate);
    }
  }
  return joined;
}

function sameGeometry(left: Coordinate[], right: Coordinate[]): boolean {
  const a = joinGeometry([left]);
  const b = joinGeometry([right]);
  return a.length === b.length && a.every((coordinate, index) => identicalCoordinate(coordinate, b[index]));
}

function isCompleteLoop(route: PlannedRoute): boolean {
  if (!route || !Array.isArray(route.nodes) || route.nodes.length < 3 || !route.nodes.every(validNode)
    || !sameNode(route.nodes[0], route.nodes[route.nodes.length - 1])
    || !Array.isArray(route.legs) || route.legs.length !== route.nodes.length - 1
    || !Number.isFinite(route.totalDistanceKm) || route.totalDistanceKm <= 0
    || !Number.isFinite(route.elevationGainM) || route.elevationGainM < 0
    || !validCoordinates(route.fullCoordinates)) return false;

  for (let index = 0; index < route.legs.length; index += 1) {
    const leg = route.legs[index];
    if (!leg || !sameNode(leg.fromNode, route.nodes[index]) || !sameNode(leg.toNode, route.nodes[index + 1])
      || !Number.isFinite(leg.distanceKm) || leg.distanceKm <= 0 || !validCoordinates(leg.coordinates)
      || geometryDistance(leg.coordinates) <= 0) return false;
  }
  // Existing provider geometry may have interior gaps or offset endpoints.
  // Rotation must preserve these unchanged, not silently repair or reverse them.
  // Only the old closing seam and each offered new seam must be continuous.
  if (!identicalCoordinate(route.fullCoordinates[0], route.fullCoordinates.at(-1)!)
    || coordinateDistance(route.fullCoordinates[0], [route.nodes[0].lat, route.nodes[0].lng]) > 0.1) return false;
  const legDistance = route.legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  // The displayed total is rounded to tenths; leg and segment lengths are not.
  if (Math.abs(legDistance - route.totalDistanceKm) > 0.050001
    || !sameGeometry(route.fullCoordinates, joinGeometry(route.legs.map((leg) => leg.coordinates)))) return false;

  const points = route.elevationPoints;
  return Array.isArray(points) && (points.length === 0 || (points.length >= 2
    && Math.abs(points[0].distance) < 1e-7
    && Math.abs(points[points.length - 1].distance - route.totalDistanceKm) < 0.010001
    && points.every((point, index) => Number.isFinite(point.distance) && Number.isFinite(point.elevation)
      && point.distance >= 0 && point.distance <= route.totalDistanceKm + 0.010001
      && (index === 0 || point.distance > points[index - 1].distance))));
}

/** Splitting is allowed only when every segment proves its position in the leg. */
function splittableSegments(leg: RouteLeg): RouteDisplaySegment[] | null {
  const segments = leg.displaySegments;
  if (!segments || segments.length < 2) return null;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment.analysis || !validNode(segment.analysis.fromNode) || !validNode(segment.analysis.toNode)
      || !validCoordinates(segment.coordinates) || geometryDistance(segment.coordinates) <= 0
      || !Number.isFinite(segment.distanceKm) || segment.distanceKm! <= 0
      || !sameNode(segment.analysis.fromNode, index ? segments[index - 1].analysis!.toNode : leg.fromNode)
      || (index > 0 && !identicalCoordinate(segments[index - 1].coordinates.at(-1)!, segment.coordinates[0]))) return null;
    if (coordinateDistance(segment.coordinates[0], [segment.analysis.fromNode.lat, segment.analysis.fromNode.lng]) > 0.1
      || coordinateDistance(segment.coordinates.at(-1)!, [segment.analysis.toNode.lat, segment.analysis.toNode.lng]) > 0.1) return null;
  }
  if (!sameNode(segments.at(-1)!.analysis!.toNode, leg.toNode)
    || !sameGeometry(leg.coordinates, joinGeometry(segments.map((segment) => segment.coordinates)))
    || Math.abs(segments.reduce((sum, segment) => sum + segment.distanceKm!, 0) - leg.distanceKm) > 0.005001) return null;
  return segments;
}

export function getRoundTripStartOptions(route: PlannedRoute): RoundTripStartOption[] {
  if (!isCompleteLoop(route)) return [];
  const options: RoundTripStartOption[] = [];
  let cumulativeDistance = 0;
  const fullDistance = route.legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const add = (node: KnooppuntNode, legIndex: number, segmentIndex: number, distance: number) => {
    const cut = segmentIndex === 0 ? route.legs[legIndex].coordinates[0]
      : route.legs[legIndex].displaySegments![segmentIndex].coordinates[0];
    const preceding = segmentIndex === 0 ? route.legs[(legIndex - 1 + route.legs.length) % route.legs.length].coordinates.at(-1)!
      : route.legs[legIndex].displaySegments![segmentIndex - 1].coordinates.at(-1)!;
    if (!identicalCoordinate(cut, preceding) || coordinateDistance(cut, [node.lat, node.lng]) > 0.1) return;
    options.push({ key: `${legIndex}:${segmentIndex}`, node, legIndex, segmentIndex,
      automatic: segmentIndex > 0, distanceFromStartKm: distance / fullDistance * route.totalDistanceKm,
      occurrence: 1, occurrences: 1 });
  };
  route.legs.forEach((leg, legIndex) => {
    if (legIndex > 0) add(leg.fromNode, legIndex, 0, cumulativeDistance);
    const segments = splittableSegments(leg);
    if (segments) {
      const segmentTotal = segments.reduce((sum, segment) => sum + segment.distanceKm!, 0);
      let prefix = 0;
      segments.slice(0, -1).forEach((segment, segmentIndex) => {
        prefix += segment.distanceKm!;
        add(segment.analysis!.toNode, legIndex, segmentIndex + 1, cumulativeDistance + leg.distanceKm * prefix / segmentTotal);
      });
    }
    cumulativeDistance += leg.distanceKm;
  });
  for (const option of options) {
    const visits = options.filter((other) => sameNode(other.node, option.node));
    option.occurrences = visits.length;
    option.occurrence = visits.indexOf(option) + 1;
  }
  return options;
}

function rotateElevation(points: ElevationPoint[], offset: number, total: number): ElevationPoint[] {
  if (!points.length) return [];
  const nextIndex = points.findIndex((point) => point.distance >= offset);
  const right = points[Math.max(1, nextIndex)];
  const left = points[Math.max(0, nextIndex - 1)];
  const elevation = left.elevation + (right.elevation - left.elevation)
    * (offset - left.distance) / (right.distance - left.distance);
  const shifted = points.slice(1, -1).map((point) => ({
    distance: (point.distance - offset + total) % total, elevation: point.elevation,
  })).filter((point) => point.distance > 1e-7 && point.distance < total - 1e-7);
  shifted.push({ distance: total - offset, elevation: points[0].elevation });
  shifted.sort((a, b) => a.distance - b.distance);
  return [{ distance: 0, elevation }, ...shifted, { distance: total, elevation }];
}

export function rotateRoundTripStart(route: PlannedRoute, key: string): PlannedRoute | null {
  const option = getRoundTripStartOptions(route).find((candidate) => candidate.key === key);
  if (!option) return null;
  const copy = structuredClone(route);
  let legs: RouteLeg[];
  const precedingGeometry = copy.legs.slice(0, option.legIndex).map((leg) => leg.coordinates);
  if (option.segmentIndex === 0) {
    legs = [...copy.legs.slice(option.legIndex), ...copy.legs.slice(0, option.legIndex)];
  } else {
    const leg = copy.legs[option.legIndex];
    const segments = leg.displaySegments!;
    const before = segments.slice(0, option.segmentIndex);
    const after = segments.slice(option.segmentIndex);
    const beforeCoordinates = joinGeometry(before.map((segment) => segment.coordinates));
    const segmentTotal = segments.reduce((sum, segment) => sum + segment.distanceKm!, 0);
    const beforeDistance = leg.distanceKm * before.reduce((sum, segment) => sum + segment.distanceKm!, 0) / segmentTotal;
    const node = after[0].analysis!.fromNode;
    const first: RouteLeg = { ...leg, fromNode: node, coordinates: joinGeometry(after.map((segment) => segment.coordinates)),
      distanceKm: leg.distanceKm - beforeDistance, displaySegments: after, instructions: undefined };
    const last: RouteLeg = { ...leg, toNode: node, coordinates: beforeCoordinates,
      distanceKm: beforeDistance, displaySegments: before, instructions: undefined };
    legs = [first, ...copy.legs.slice(option.legIndex + 1), ...copy.legs.slice(0, option.legIndex), last];
    precedingGeometry.push(beforeCoordinates);
  }
  // Elevation samples use geometric chainage normalised to the displayed total,
  // not the separately rounded lengths returned by the routing providers.
  const offset = geometryDistance(joinGeometry(precedingGeometry))
    / geometryDistance(copy.fullCoordinates) * copy.totalDistanceKm;
  return {
    ...copy,
    nodes: [legs[0].fromNode, ...legs.map((leg) => leg.toNode)],
    legs,
    fullCoordinates: joinGeometry(legs.map((leg) => leg.coordinates)),
    elevationPoints: rotateElevation(copy.elevationPoints, offset, copy.totalDistanceKm),
  };
}
