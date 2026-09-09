import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dataset = JSON.parse(readFileSync(new URL('../public/data/benelux_network.json', import.meta.url), 'utf8'));
const nodes = new Map(dataset.nodes.map((node) => [node.id, node]));

function connectionKey(from, to) {
  return [from, to].sort().join('\u0000');
}

function distanceKm(from, to) {
  const dLat = ((from.lat - to.lat) * Math.PI) / 180;
  const dLng = ((from.lng - to.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// The planning graph contains all explicit OSM node-to-node relations. A
// verified geometry always supplies the weight; topology-only relations retain
// their true endpoints and use their geographic distance until live geometry is
// requested by the planner.
const connections = new Map();
for (const edge of dataset.edges) {
  connections.set(connectionKey(edge.from, edge.to), { ...edge, verified: true });
}
for (const connection of dataset.declaredConnections || []) {
  const key = connectionKey(connection.from, connection.to);
  if (!connections.has(key)) {
    const from = nodes.get(connection.from);
    const to = nodes.get(connection.to);
    assert.ok(from && to, `topology ${connection.from}–${connection.to} must refer to existing nodes`);
    connections.set(key, { ...connection, distanceKm: distanceKm(from, to), verified: false });
  }
}

const adjacency = new Map();
for (const connection of connections.values()) {
  for (const [from, to] of [[connection.from, connection.to], [connection.to, connection.from]]) {
    const neighbours = adjacency.get(from) || [];
    neighbours.push({ to, distanceKm: connection.distanceKm });
    adjacency.set(from, neighbours);
  }
}

function shortestPath(from, to) {
  const distances = new Map([[from, 0]]);
  const previous = new Map();
  const queue = [{ id: from, distanceKm: 0 }];

  while (queue.length > 0) {
    queue.sort((left, right) => left.distanceKm - right.distanceKm);
    const current = queue.shift();
    if (current.distanceKm !== distances.get(current.id)) continue;
    if (current.id === to) break;
    for (const neighbour of adjacency.get(current.id) || []) {
      const nextDistance = current.distanceKm + neighbour.distanceKm;
      if (nextDistance >= (distances.get(neighbour.to) ?? Infinity)) continue;
      distances.set(neighbour.to, nextDistance);
      previous.set(neighbour.to, current.id);
      queue.push({ id: neighbour.to, distanceKm: nextDistance });
    }
  }

  assert.ok(previous.has(to), `geen route gevonden van ${from} naar ${to}`);
  const path = [];
  for (let node = to; node; node = previous.get(node)) {
    path.unshift(node);
    if (node === from) break;
  }
  return path;
}

function verifyRoute({ name, expectedNodeIds }) {
  for (const nodeId of expectedNodeIds) {
    assert.ok(nodes.has(nodeId), `${name}: knooppunt ${nodeId} ontbreekt in de dataset`);
  }

  for (let index = 1; index < expectedNodeIds.length; index += 1) {
    const from = expectedNodeIds[index - 1];
    const to = expectedNodeIds[index];
    const connection = connections.get(connectionKey(from, to));
    assert.ok(connection, `${name}: officiële verbinding ${from} → ${to} ontbreekt`);
    assert.equal(connection.verified, true, `${name}: ${from} → ${to} moet een geverifieerde geometrie hebben`);
    assert.ok(connection.coordinates.length >= 2, `${name}: ${from} → ${to} moet een volledige lijn hebben`);
  }

  assert.deepEqual(
    shortestPath(expectedNodeIds[0], expectedNodeIds.at(-1)),
    expectedNodeIds,
    `${name}: de kortste knooppuntenroute heeft onverwachte tussenpunten`,
  );
}

assert.equal(dataset.nodes.some((node) => String(node.id).startsWith('kp-') || 'connections' in node), false,
  'de actieve dataset mag geen legacy hardcoded knooppunten of connections-velden bevatten');

verifyRoute({
  name: 'Genk 29 → 64',
  expectedNodeIds: ['osm-122170632', 'osm-416071790', 'osm-329313103', 'osm-329308896'],
});

verifyRoute({
  name: 'Valkenswaard 96 → 80',
  expectedNodeIds: ['osm-42412926', 'osm-42428176', 'osm-42439218', 'osm-269977106'],
});

console.log('Dataset-regressietests voor Genk en Valkenswaard geslaagd.');
