import assert from 'node:assert/strict';
import { buildKnooppuntenGraph } from '../src/services/roundTripService';
import { calculateBicycleLeg, fetchElevationProfile, UnknownKnooppuntenConnectionError } from '../src/services/routingService';
import { getNodeKey, registerOfficialNetworkDataset } from '../src/services/officialNetworkService';

async function main() {
  const kp64 = { id: 'fixture-64', ref: '64', lat: 50.91965, lng: 5.56714 };
  const kp251 = { id: 'fixture-251', ref: '251', lat: 50.93368, lng: 5.5757 };
  const kp62 = { id: 'fixture-62', ref: '62', lat: 50.94116, lng: 5.59278 };
  registerOfficialNetworkDataset({
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes: [kp64, kp251, kp62],
    edges: [{
      from: kp64.id,
      to: kp251.id,
      distanceKm: 1.8,
      coordinates: [[kp64.lat, kp64.lng], [kp251.lat, kp251.lng]],
      source: 'fixture dataset edge',
      verifiedAt: 'test',
    }],
  });

  const verifiedLeg = await calculateBicycleLeg(kp64, kp251);
  assert.ok(verifiedLeg.coordinates.length > 1, 'a verified dataset edge must include its real geometry');
  assert.ok(verifiedLeg.instructions?.startsWith('Geverifieerde netwerkverbinding:'), 'the leg must retain its provenance');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 503 });
  try {
    await assert.rejects(
      () => calculateBicycleLeg(kp64, kp62),
      UnknownKnooppuntenConnectionError,
      'a route must fail clearly when both verified data and live bike routers are unavailable',
    );
    await assert.rejects(
      () => calculateBicycleLeg(kp64, { id: 'fixture-503', ref: '503', lat: 50.892, lng: 5.662 }),
      UnknownKnooppuntenConnectionError,
      'an unknown test node must never be injected into the imported network graph',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const graph = buildKnooppuntenGraph([kp64, kp251, kp62]);
  assert.equal(graph.adjacency.get(getNodeKey(kp64))?.has(getNodeKey(kp62)), false, 'the graph must not infer proximity edges');
  assert.equal(graph.adjacency.get(getNodeKey(kp64))?.has(getNodeKey(kp251)), true, 'the graph must retain imported verified edges');

  globalThis.fetch = async (input) => {
    const requestUrl = new URL(String(input));
    assert.equal(requestUrl.hostname, 'api.open-meteo.com', 'height profile must use the terrain-elevation endpoint');
    const sampleCount = requestUrl.searchParams.get('latitude')?.split(',').length || 0;
    return new Response(JSON.stringify({ elevation: Array.from({ length: sampleCount }, (_, index) => 10 + index) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const elevation = await fetchElevationProfile(verifiedLeg.coordinates, verifiedLeg.distanceKm);
    assert.equal(elevation.available, true, 'terrain samples must enable the profile');
    assert.ok(elevation.points.length >= 2, 'a profile requires at least a start and end sample');
    assert.equal(elevation.totalAscent, elevation.points.length - 1, 'ascent must be calculated from returned terrain heights');
  } finally {
    globalThis.fetch = originalFetch;
  }

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
    { id: 'genk-29', ref: 'test-29', lat: 50.9455188, lng: 5.5460142 },
    { id: 'genk-30', ref: 'test-30', lat: 50.9566814, lng: 5.5336876 },
    { id: 'genk-250', ref: 'test-250', lat: 50.9652694, lng: 5.5186055 },
  ];
  registerOfficialNetworkDataset({
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes: genkLikeNodes,
    edges: [{ from: 'genk-30', to: 'genk-250', distanceKm: 2, coordinates: [[50.9566814, 5.5336876], [50.9652694, 5.5186055]], source: 'test', verifiedAt: 'test' }],
    declaredConnections: [{ from: 'genk-29', to: 'genk-30', source: 'test topology' }],
  });
  let intermediateRouterCalls = 0;
  globalThis.fetch = async () => {
    intermediateRouterCalls += 1;
    return new Response(JSON.stringify({
      features: [{ geometry: { coordinates: [[5.5460142, 50.9455188], [5.5336876, 50.9566814]] }, properties: { 'track-length': 2000 } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const intermediateLeg = await calculateBicycleLeg(genkLikeNodes[0], genkLikeNodes[2]);
    assert.equal(intermediateRouterCalls, 1, 'an imported intermediate node must prevent one direct live route over the whole leg');
    assert.match(intermediateLeg.instructions || '', /test-30/, 'the imported intermediate knooppunt must be retained before a direct fallback');
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

  // A complete-geometry subset must never overrule the declared OSM node network.
  // The selected route should retain the official intermediate node, even if its
  // own geometry still has to be obtained from the live bicycle router.
  const topologyPriorityNodes = [
    { id: 'priority-a', ref: '50', lat: 51, lng: 4 },
    { id: 'priority-b', ref: '51', lat: 51, lng: 4.01 },
    { id: 'priority-c', ref: '52', lat: 51, lng: 4.02 },
    { id: 'priority-detour', ref: '53', lat: 51.04, lng: 4.01 },
  ];
  registerOfficialNetworkDataset({
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes: topologyPriorityNodes,
    edges: [
      { from: 'priority-a', to: 'priority-detour', distanceKm: 1, coordinates: [[51, 4], [51.04, 4.01]], source: 'incomplete test subset', verifiedAt: 'test' },
      { from: 'priority-detour', to: 'priority-c', distanceKm: 1, coordinates: [[51.04, 4.01], [51, 4.02]], source: 'incomplete test subset', verifiedAt: 'test' },
    ],
    declaredConnections: [
      { from: 'priority-a', to: 'priority-b', source: 'OSM relation 50-51' },
      { from: 'priority-b', to: 'priority-c', source: 'OSM relation 51-52' },
    ],
  });
  let topologyPriorityRouterCalls = 0;
  globalThis.fetch = async () => {
    topologyPriorityRouterCalls += 1;
    return new Response(JSON.stringify({
      features: [{ geometry: { coordinates: [[4, 51], [4.01, 51]] }, properties: { 'track-length': 1000 } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const topologyPriorityLeg = await calculateBicycleLeg(topologyPriorityNodes[0], topologyPriorityNodes[2]);
    assert.equal(topologyPriorityRouterCalls, 2, 'declared OSM topology must be selected before the incomplete geometry subset');
    assert.match(topologyPriorityLeg.instructions || '', /51/, 'the declared OSM intermediate node must be preserved');
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
