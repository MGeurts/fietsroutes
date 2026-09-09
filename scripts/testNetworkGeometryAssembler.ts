import assert from 'node:assert/strict';
import { assembleRelationGeometry, findRelationPathGeometry } from '../src/services/networkGeometryAssembler';

const assembled = assembleRelationGeometry([
  [[50, 5.0001], [50, 5.0002]],
  [[50, 5.0003], [50, 5.0004]],
  [[50, 5], [50, 5.0001]],
], 0.00015);

assert.ok(assembled, 'unordered and reversed relation members must assemble into one line');
assert.deepEqual(assembled![0], [50, 5]);
assert.deepEqual(assembled![assembled!.length - 1], [50, 5.0004]);

const rejected = assembleRelationGeometry([
  [[50, 5], [50, 5.0001]],
  [[50, 5.001], [50, 5.0011]],
], 0.00015);
assert.equal(rejected, null, 'a substantial gap must not be bridged');

const recentOsmSplit = assembleRelationGeometry([
  [[50.88, 5.64], [50.88, 5.6401]],
  [[50.88, 5.64045], [50.88, 5.64055]],
], 0.00036);
assert.ok(recentOsmSplit, 'a short OSM split such as relation 11198434 must remain one route');

const pathThroughLoop = findRelationPathGeometry([
  [[50, 5], [50, 5.0001]],
  [[50, 5.0001], [50, 5.0002]],
  [[50, 5.0002], [50.0001, 5.0002]],
  [[50.0001, 5.0002], [50, 5.0001]], // parallel loop in one OSM relation
  [[50, 5.0002], [50, 5.0003]],
], [50, 5], [50, 5.0003], 0.00001, 0.00001);
assert.ok(pathThroughLoop, 'a relation with a loop must retain its OSM-only end-to-end path');
assert.deepEqual(pathThroughLoop![0], [50, 5]);
assert.deepEqual(pathThroughLoop![pathThroughLoop!.length - 1], [50, 5.0003]);

console.log('Network-geometry assembly tests passed.');
