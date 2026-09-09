import assert from 'node:assert/strict';
import { INITIAL_NODES } from '../src/data/knooppuntenData';
import { buildKnooppuntenGraph } from '../src/services/roundTripService';
import { calculateBicycleLeg, estimateElevationProfile, UnknownKnooppuntenConnectionError } from '../src/services/routingService';
import { getNodeKey, registerOfficialNetworkDataset } from '../src/services/officialNetworkService';

const node = (ref: string) => {
  const result = INITIAL_NODES.find((candidate) => candidate.ref === ref);
  assert.ok(result, `seed node ${ref} is required for this regression test`);
  return result;
};

async function main() {
  const kp64 = node('64');
  const kp251 = node('251');
  const kp62 = node('62');

  const verifiedLeg = await calculateBicycleLeg(kp64, kp251);
  assert.ok(verifiedLeg.coordinates.length > 1, 'a verified corridor must include its real geometry');
  assert.ok(verifiedLeg.instructions?.startsWith('Geverifieerde corridor:'), 'the leg must retain its provenance');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 503 });
  try {
    await assert.rejects(
      () => calculateBicycleLeg(kp64, kp62),
      UnknownKnooppuntenConnectionError,
      'a route must fail clearly when both verified data and live bike routers are unavailable',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const graph = buildKnooppuntenGraph([kp64, kp251, kp62]);
  assert.equal(graph.adjacency.get(getNodeKey(kp64))?.has(getNodeKey(kp62)), false, 'the graph must not infer proximity edges');
  assert.equal(graph.adjacency.get(getNodeKey(kp64))?.has(getNodeKey(kp251)), true, 'the graph must retain verified corridors');

  const elevation = estimateElevationProfile(verifiedLeg.coordinates, verifiedLeg.distanceKm);
  assert.equal(elevation.available, false, 'synthetic height must not be presented as measurement');
  assert.deepEqual(elevation.points, []);

  const pathNodes = [
    { id: 'test-a', ref: '10', lat: 51, lng: 4 },
    { id: 'test-b', ref: '11', lat: 51, lng: 4.01 },
    { id: 'test-c', ref: '12', lat: 51, lng: 4.02 },
  ];
  registerOfficialNetworkDataset({
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes: pathNodes,
    edges: [
      { from: 'test-a', to: 'test-b', distanceKm: 1, coordinates: [[51, 4], [51, 4.01]], source: 'test', verifiedAt: 'test' },
      { from: 'test-b', to: 'test-c', distanceKm: 1, coordinates: [[51, 4.01], [51, 4.02]], source: 'test', verifiedAt: 'test' },
    ],
  });
  const multiHopLeg = await calculateBicycleLeg(pathNodes[0], pathNodes[2]);
  assert.equal(multiHopLeg.distanceKm, 2, 'non-adjacent selected nodes must use verified intermediate corridors');
  assert.equal(multiHopLeg.coordinates.length, 3, 'joined route geometry must not duplicate the shared junction coordinate');

  const topologyNodes = [
    { id: 'topology-a', ref: '20', lat: 52, lng: 5 },
    { id: 'topology-c', ref: '22', lat: 52, lng: 5.02 },
  ];
  registerOfficialNetworkDataset({
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes: topologyNodes,
    edges: [],
    topology: {
      vertices: [
        { id: 'v-a', lat: 52, lng: 5 },
        { id: 'v-b', lat: 52, lng: 5.01 },
        { id: 'v-c', lat: 52, lng: 5.02 },
      ],
      edges: [
        { from: 'v-a', to: 'v-b', distanceKm: 1, coordinates: [[52, 5], [52, 5.01]], source: 'official test' },
        { from: 'v-b', to: 'v-c', distanceKm: 1, coordinates: [[52, 5.01], [52, 5.02]], source: 'official test' },
      ],
      anchors: { 'topology-a': 'v-a', 'topology-c': 'v-c' },
    },
  });
  const topologyLeg = await calculateBicycleLeg(topologyNodes[0], topologyNodes[1]);
  assert.equal(topologyLeg.distanceKm, 2, 'official trajectory segments must route between their anchored junctions');
  assert.equal(topologyLeg.coordinates.length, 3, 'official trajectory segments must retain their joined geometry');
  assert.equal(topologyLeg.instructions, 'Geverifieerde knooppuntenroute via officiële trajectsegmenten.');

  const genkLikeNodes = [
    { id: 'genk-29', ref: '29', lat: 50.9455188, lng: 5.5460142 },
    { id: 'genk-30', ref: '30', lat: 50.9566814, lng: 5.5336876 },
    { id: 'genk-250', ref: '250', lat: 50.9652694, lng: 5.5186055 },
  ];
  registerOfficialNetworkDataset({
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes: genkLikeNodes,
    edges: [{ from: 'genk-30', to: 'genk-250', distanceKm: 2, coordinates: [[50.9566814, 5.5336876], [50.9652694, 5.5186055]], source: 'test', verifiedAt: 'test' }],
  });
  let curatedRouterCalls = 0;
  globalThis.fetch = async () => {
    curatedRouterCalls += 1;
    return new Response(JSON.stringify({
      features: [{ geometry: { coordinates: [[5.5460142, 50.9455188], [5.5336876, 50.9566814]] }, properties: { 'track-length': 2000 } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const curatedLeg = await calculateBicycleLeg(genkLikeNodes[0], genkLikeNodes[2]);
    assert.equal(curatedRouterCalls, 1, 'a curated intermediate node must prevent one direct live route over the whole leg');
    assert.match(curatedLeg.instructions || '', /30/, 'the known local intermediate knooppunt must be retained before a direct fallback');
  } finally {
    globalThis.fetch = originalFetch;
  }

  const declaredNodes = [
    { id: 'declared-a', ref: '40', lat: 52, lng: 4 },
    { id: 'declared-b', ref: '41', lat: 52, lng: 4.01 },
    { id: 'declared-c', ref: '42', lat: 52, lng: 4.02 },
  ];
  registerOfficialNetworkDataset({
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes: declaredNodes,
    edges: [],
    declaredConnections: [
      { from: 'declared-a', to: 'declared-b', source: 'explicit OSM relation' },
      { from: 'declared-b', to: 'declared-c', source: 'explicit OSM relation' },
    ],
  });
  let declaredRouterCalls = 0;
  globalThis.fetch = async () => {
    declaredRouterCalls += 1;
    const offset = declaredRouterCalls === 1 ? 0 : 0.01;
    return new Response(JSON.stringify({
      features: [{ geometry: { coordinates: [[4 + offset, 52], [4.01 + offset, 52]] }, properties: { 'track-length': 1000 } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const declaredLeg = await calculateBicycleLeg(declaredNodes[0], declaredNodes[2]);
    assert.equal(declaredRouterCalls, 2, 'each missing geometry hop must be routed between declared intermediate nodes');
    assert.equal(declaredLeg.isVerified, false, 'live geometry for a declared connection must remain visibly distinct');
    assert.match(declaredLeg.instructions || '', /41/, 'the declared intermediate knooppunt must be retained in the route order');
  } finally {
    globalThis.fetch = originalFetch;
  }

  const fallbackNodes = [
    { id: 'fallback-a', ref: '30', lat: 53, lng: 5 },
    { id: 'fallback-b', ref: '31', lat: 53, lng: 5.01 },
  ];
  globalThis.fetch = async () => new Response(JSON.stringify({
    features: [{ geometry: { coordinates: [[5, 53], [5.005, 53.001], [5.01, 53]] }, properties: { 'track-length': 1234 } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const fallbackLeg = await calculateBicycleLeg(fallbackNodes[0], fallbackNodes[1]);
    assert.equal(fallbackLeg.isVerified, false, 'a router fallback must be visibly marked as unverified');
    assert.equal(fallbackLeg.distanceKm, 1.23, 'a router fallback must retain the router distance');
    assert.equal(fallbackLeg.coordinates.length, 3, 'a router fallback must use real router geometry, never a straight-line placeholder');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('Official-network regression tests passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
