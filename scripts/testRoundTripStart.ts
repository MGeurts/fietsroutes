import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getRoundTripStartOptions, rotateRoundTripStart } from '../src/services/roundTripStartService';
import { registerOfficialNetworkDataset } from '../src/services/officialNetworkService';
import { findRoundTrips } from '../src/services/roundTripService';
import { calculateBicycleRouteLegs } from '../src/services/routingService';
import { KnooppuntNode, PlannedRoute, RouteDisplaySegment } from '../src/types';

const a: KnooppuntNode = { id: 'a', ref: '01', lat: 0, lng: 0, municipality: 'Startdorp' };
const b: KnooppuntNode = { id: 'b', ref: '02', lat: 0, lng: 0.01, municipality: 'Noorddorp' };
const c: KnooppuntNode = { id: 'c', ref: '02', lat: 0, lng: 0.02, municipality: 'Zuiddorp' };
const m: KnooppuntNode = { id: 'm', ref: '03', lat: 0, lng: 0.005 };
const position = (node: KnooppuntNode): [number, number] => [node.lat, node.lng];
const segment = (fromNode: KnooppuntNode, toNode: KnooppuntNode, distanceKm: number, relationId = 123): RouteDisplaySegment => ({
  coordinates: [position(fromNode), position(toNode)], distanceKm, source: relationId === 123 ? 'official' : 'official-declared',
  analysis: { fromNode, toNode, source: `OSM relation ${relationId}`, relationId, geometrySource: relationId === 123 ? 'official' : 'official-declared' },
});

function fixture(nodes = [a, b, c, a], distances = [1.01, 1.01, 2.02]): PlannedRoute {
  const legs = nodes.slice(0, -1).map((fromNode, index) => ({
    fromNode, toNode: nodes[index + 1], distanceKm: distances[index],
    coordinates: [position(fromNode), position(nodes[index + 1])],
    displaySegments: [segment(fromNode, nodes[index + 1], distances[index])],
    isVerified: true,
    instructions: `Geverifieerd traject ${index}`,
  }));
  const totalDistanceKm = Math.round(distances.reduce((sum, distance) => sum + distance, 0) * 10) / 10;
  return {
    id: 'closed-route', name: 'Rondrit test', nodes, legs, fullCoordinates: legs.flatMap((leg) => leg.coordinates),
    totalDistanceKm, elevationGainM: 20, createdAt: '2026-09-13T00:00:00Z',
    elevationPoints: [10, 20, 30, 20, 10].map((elevation, index) => ({ distance: index * totalDistanceKm / 4, elevation })),
  };
}

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);
const route = fixture();
const original = structuredClone(route);
const options = getRoundTripStartOptions(route);
assert.deepEqual(options.map((option) => option.node.id), ['b', 'c'], 'equal displayed refs must remain distinct geographic junctions');
assert.equal(options[0].node.ref, options[1].node.ref);
const rotated = rotateRoundTripStart(route, options[0].key)!;
assert.ok(rotated);
assert.deepEqual(rotated.nodes.map((node) => node.id), ['b', 'c', 'a', 'b']);
assert.deepEqual(rotated.legs, [route.legs[1], route.legs[2], route.legs[0]], 'manual rotation retains complete legs and provenance');
assert.deepEqual(rotated.fullCoordinates, [position(b), position(c), position(a), position(b)], 'shared endpoint occurs only once at an interior join');
assert.equal(rotated.totalDistanceKm, route.totalDistanceKm);
assert.equal(rotated.elevationGainM, route.elevationGainM);
assert.equal(rotated.id, route.id);
assert.equal(rotated.name, route.name);
near(rotated.elevationPoints[0].elevation, 20);
assert.deepEqual(rotated.elevationPoints.map((point) => point.elevation), [20, 30, 20, 10, 20]);
near(rotated.elevationPoints.at(-1)!.distance, route.totalDistanceKm);
assert.deepEqual(route, original, 'rotation must not mutate the source route');
rotated.nodes[0].name = 'Only in copy';
rotated.legs[0].coordinates[0][0] = 12;
assert.deepEqual(route, original, 'output must not share mutable route objects with its source');

const repeated = fixture([a, b, c, b, a], [1, 1, 1, 1]);
const visits = getRoundTripStartOptions(repeated).filter((option) => option.node.id === b.id);
assert.equal(visits.length, 2, 'repeated visits must not be deduplicated');
assert.notEqual(visits[0].key, visits[1].key);
assert.deepEqual(visits.map((option) => [option.occurrence, option.occurrences]), [[1, 2], [2, 2]]);
assert.deepEqual(rotateRoundTripStart(repeated, visits[1].key)!.nodes.map((node) => node.id), ['b', 'a', 'b', 'c', 'b']);

const autoRoute = fixture();
const firstSegment = segment(a, m, 0.334);
const lastSegment = segment(m, b, 0.68, 456);
autoRoute.legs[0] = {
  ...autoRoute.legs[0], coordinates: [position(a), position(m), position(b)],
  displaySegments: [firstSegment, lastSegment], isVerified: false,
};
autoRoute.fullCoordinates = autoRoute.legs.flatMap((leg) => leg.coordinates);
const autoOriginal = structuredClone(autoRoute);
const autoOption = getRoundTripStartOptions(autoRoute).find((option) => option.node.id === m.id)!;
assert.ok(autoOption?.automatic, 'a proven segment boundary should be offered as a new start');
const automatic = rotateRoundTripStart(autoRoute, autoOption.key)!;
assert.deepEqual(automatic.nodes.map((node) => node.id), ['m', 'b', 'c', 'a', 'm']);
assert.deepEqual(automatic.legs[0].displaySegments, [lastSegment]);
assert.deepEqual(automatic.legs.at(-1)!.displaySegments, [firstSegment]);
assert.deepEqual(automatic.legs.slice(1, -1), autoRoute.legs.slice(1), 'other legs are untouched');
assert.deepEqual(automatic.fullCoordinates, [position(m), position(b), position(c), position(a), position(m)]);
near(automatic.legs[0].distanceKm + automatic.legs.at(-1)!.distanceKm, autoRoute.legs[0].distanceKm);
near(automatic.legs.reduce((sum, leg) => sum + leg.distanceKm, 0), autoRoute.legs.reduce((sum, leg) => sum + leg.distanceKm, 0));
assert.equal(automatic.totalDistanceKm, autoRoute.totalDistanceKm);
assert.equal(automatic.elevationGainM, autoRoute.elevationGainM);
near(automatic.elevationPoints[0].elevation, 15);
near(automatic.elevationPoints.at(-1)!.elevation, 15);
assert.ok(automatic.elevationPoints.every((point, index, points) => index === 0 || point.distance > points[index - 1].distance));
assert.deepEqual(autoRoute, autoOriginal);
assert.ok(getRoundTripStartOptions(automatic).length, 'a split and rotated loop must still be a valid loop');

const noElevation = fixture();
noElevation.elevationPoints = [];
assert.deepEqual(rotateRoundTripStart(noElevation, '1:0')!.elevationPoints, []);

for (const corrupt of [
  (value: PlannedRoute) => { value.nodes.at(-1)!.id = 'different-id-same-ref'; },
  (value: PlannedRoute) => { value.nodes[value.nodes.length - 1] = { ...a, lng: 0.3 }; },
  (value: PlannedRoute) => { value.legs.pop(); },
  (value: PlannedRoute) => { value.legs[0].toNode = c; },
  (value: PlannedRoute) => { value.legs[0].coordinates[0] = [2, 2]; },
  (value: PlannedRoute) => { value.legs[1].coordinates[0] = [0, 0.011]; },
  (value: PlannedRoute) => { value.fullCoordinates = [position(a), position(c), position(a)]; },
  (value: PlannedRoute) => { value.totalDistanceKm = 25; },
  (value: PlannedRoute) => { value.legs[0].distanceKm = NaN; },
  (value: PlannedRoute) => { value.elevationPoints[1].distance = NaN; },
  (value: PlannedRoute) => { value.nodes[1].lat = NaN; },
]) {
  const invalid = JSON.parse(JSON.stringify(fixture())) as PlannedRoute;
  corrupt(invalid);
  assert.deepEqual(getRoundTripStartOptions(invalid), [], 'incomplete, open or mismatched routes must have no options');
  assert.equal(rotateRoundTripStart(invalid, '1:0'), null);
}
assert.equal(rotateRoundTripStart(route, 'stale-or-invalid-key'), null);

for (const corrupt of [
  (segments: RouteDisplaySegment[]) => { delete segments[0].distanceKm; },
  (segments: RouteDisplaySegment[]) => { segments[0].distanceKm = 0; },
  (segments: RouteDisplaySegment[]) => { delete segments[0].analysis; },
  (segments: RouteDisplaySegment[]) => { segments[1].analysis!.fromNode = c; },
  (segments: RouteDisplaySegment[]) => { segments[1].coordinates[0] = position(c); },
  (segments: RouteDisplaySegment[]) => { segments[0].distanceKm = 99; },
]) {
  const unsafe = JSON.parse(JSON.stringify(autoRoute)) as PlannedRoute;
  corrupt(unsafe.legs[0].displaySegments!);
  const safeOptions = getRoundTripStartOptions(unsafe);
  assert.equal(safeOptions.some((option) => option.automatic), false, 'unproven automatic boundary must not be split');
  assert.equal(safeOptions.length, 2, 'safe manual starts remain available when segment details are incomplete');
}

const directedGeometryEdges = (coordinates: [number, number][]) => coordinates.slice(1)
  .map((coordinate, index) => [coordinates[index], coordinate])
  .filter(([from, to]) => from[0] !== to[0] || from[1] !== to[1])
  .map((edge) => JSON.stringify(edge)).sort();

// Real network geometries are not always contiguous at every logical junction.
// A safe cut elsewhere must retain all existing directed edges, including the
// original discontinuities; it must never reverse or invent a repair segment.
const discontinuous = fixture([a, b, c, m, a], [1, 1, 1, 1]);
discontinuous.legs[1].coordinates.reverse();
discontinuous.fullCoordinates = discontinuous.legs.flatMap((leg) => leg.coordinates);
const discontinuousOriginal = structuredClone(discontinuous);
assert.deepEqual(getRoundTripStartOptions(discontinuous).map((option) => option.key), ['3:0']);
const safeRotation = rotateRoundTripStart(discontinuous, '3:0')!;
assert.ok(safeRotation);
assert.equal(rotateRoundTripStart(discontinuous, '1:0'), null, 'a gap must never become the closing seam');
assert.equal(rotateRoundTripStart(discontinuous, '2:0'), null, 'an incorrectly oriented endpoint must not be a new start');
assert.deepEqual(directedGeometryEdges(safeRotation.fullCoordinates), directedGeometryEdges(discontinuous.fullCoordinates));
assert.deepEqual(discontinuous, discontinuousOriginal);

const tinyGap = fixture();
tinyGap.legs[1].coordinates[0] = [b.lat, b.lng + 1e-8];
tinyGap.fullCoordinates = tinyGap.legs.flatMap((leg) => leg.coordinates);
assert.equal(rotateRoundTripStart(tinyGap, '1:0'), null, 'even a sub-centimetre nonzero gap cannot be discarded');
assert.deepEqual(directedGeometryEdges(rotateRoundTripStart(tinyGap, '2:0')!.fullCoordinates), directedGeometryEdges(tinyGap.fullCoordinates));

// Exercise the same bundled graph and routing pipeline used by the application.
// Fetch is blocked: complete verified roundtrips must work entirely locally.
const dataset = JSON.parse(readFileSync('public/data/benelux_network.json', 'utf8'));
registerOfficialNetworkDataset(dataset);
const start = dataset.nodes.find((node: KnooppuntNode) => node.id === 'osm-416071790');
assert.equal(start?.ref, '534');
const previousFetch = globalThis.fetch;
let networkCalls = 0;
let productionRotations = 0;
globalThis.fetch = async () => { networkCalls += 1; throw new Error('Network disabled for roundtrip regression'); };
try {
  for (const distance of [15, 35, 60]) {
    const loops = findRoundTrips(start, dataset.nodes, distance);
    assert.ok(loops.length > 0, `KP534 must have local loops near ${distance} km`);
    for (const loop of loops) {
      const { legs, error } = await calculateBicycleRouteLegs(loop.nodes);
      assert.equal(error, undefined);
      const totalDistanceKm = Math.round(legs.reduce((sum, leg) => sum + leg.distanceKm, 0) * 10) / 10;
      const realRoute: PlannedRoute = {
        id: 'real-loop', name: loop.description, nodes: loop.nodes, legs,
        fullCoordinates: legs.flatMap((leg) => leg.coordinates), totalDistanceKm,
        elevationGainM: 40, createdAt: '2026-09-14T00:00:00Z',
        elevationPoints: [{ distance: 0, elevation: 50 }, { distance: totalDistanceKm / 2, elevation: 90 }, { distance: totalDistanceKm, elevation: 50 }],
      };
      const realOriginal = structuredClone(realRoute);
      const realOptions = getRoundTripStartOptions(realRoute);
      assert.ok(realOptions.length > 0, `real KP534 ${distance} km loop must expose safe starting junctions`);
      for (const option of realOptions) {
        const realRotated = rotateRoundTripStart(realRoute, option.key)!;
        assert.ok(realRotated);
        assert.equal(realRotated.nodes[0].id, option.node.id);
        assert.equal(realRotated.nodes.at(-1)!.id, option.node.id);
        assert.equal(realRotated.totalDistanceKm, realRoute.totalDistanceKm);
        assert.equal(realRotated.elevationGainM, realRoute.elevationGainM);
        assert.deepEqual(directedGeometryEdges(realRotated.fullCoordinates), directedGeometryEdges(realRoute.fullCoordinates));
        assert.ok(getRoundTripStartOptions(realRotated).length > 0);
        assert.equal(realRotated.elevationPoints[0].elevation, realRotated.elevationPoints.at(-1)!.elevation);
        assert.ok(realRotated.elevationPoints.every((point, index, points) => index === 0 || point.distance > points[index - 1].distance));
        productionRotations += 1;
      }
      assert.deepEqual(realRoute, realOriginal);
    }
  }
  assert.equal(networkCalls, 0);
} finally {
  globalThis.fetch = previousFetch;
}

console.log(`Roundtrip start tests passed (geometry, visits, automatic splits, elevation, invalid data, immutability and ${productionRotations} real KP534 rotations).`);
