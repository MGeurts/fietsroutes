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

  await assert.rejects(
    () => calculateBicycleLeg(kp64, kp62),
    UnknownKnooppuntenConnectionError,
    'an unverified direct connection must never be routed by a fallback',
  );

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
  console.log('Official-network regression tests passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
