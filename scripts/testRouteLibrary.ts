import assert from 'node:assert/strict';
import { createShareUrl, deleteSavedRoute, getRouteDraft, getSavedRoutes, readSharedRoute, saveRoute, saveRouteDraft } from '../src/services/routeLibraryService';
import { PlannedRoute } from '../src/types';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
  configurable: true,
});

const nodes = [
  { id: 'library-a', ref: '01', lat: 51, lng: 4 },
  { id: 'library-b', ref: '02', lat: 51.01, lng: 4.01 },
];
const route: PlannedRoute = {
  id: 'library-route', name: 'Lokale testroute', nodes,
  legs: [{ fromNode: nodes[0], toNode: nodes[1], distanceKm: 1.5, coordinates: [[51, 4], [51.01, 4.01]], isVerified: true }],
  fullCoordinates: [[51, 4], [51.01, 4.01]], totalDistanceKm: 1.5, elevationGainM: 12,
  elevationPoints: [{ distance: 0, elevation: 10 }, { distance: 1.5, elevation: 22 }], createdAt: '2026-09-12T00:00:00.000Z',
};

assert.ok(saveRoute(route), 'a valid route must be saved locally');
assert.equal(getSavedRoutes().length, 1, 'saved route must be listed');
assert.equal(getSavedRoutes()[0].fullCoordinates.length, 2, 'saved geometry must remain available offline');
assert.equal(deleteSavedRoute(route.id), true, 'a saved route must be deletable');
assert.equal(getSavedRoutes().length, 0, 'deleted route must disappear from the library');

assert.equal(saveRouteDraft(route), true, 'the active route draft must be persisted');
assert.equal(getRouteDraft()?.elevationPoints.length, 2, 'draft must retain elevation data');

const shareUrl = createShareUrl(route.name, route.nodes, 'https://fietsroute.test/planner?source=test');
assert.ok(shareUrl, 'a valid itinerary must produce a share URL');
const shared = readSharedRoute(new URL(shareUrl!).search);
assert.deepEqual(shared, { name: route.name, nodes: route.nodes }, 'a share URL must restore its exact node order');
assert.equal(readSharedRoute('?route=not-a-valid-payload'), null, 'invalid share payloads must fail safely');

console.log('Route-library tests passed.');
