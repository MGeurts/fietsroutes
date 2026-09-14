import assert from 'node:assert/strict';
import {
  createShareUrl, deleteSavedRoute, exportRouteLibrary, getRouteDraft, getSavedRoutes,
  importRouteLibrary, readSharedRoute, saveRoute, saveRouteDraft, setSavedRouteFavorite,
} from '../src/services/routeLibraryService';
import { PlannedRoute } from '../src/types';

const libraryKey = 'fietsroute-route-library-v1';
const storage = new Map<string, string>();
let failWrites = false;
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (failWrites) throw new Error('QuotaExceededError');
    storage.set(key, value);
  },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });

const nodes = [
  { id: 'library-a', ref: '01', lat: 51, lng: 4 },
  { id: 'library-b', ref: '02', lat: 51.01, lng: 4.01 },
];
const coordinates: [number, number][] = [[51, 4], [51.01, 4.01]];
const route: PlannedRoute = {
  id: 'library-route', name: 'Lokale testroute', nodes,
  legs: [{
    fromNode: nodes[0], toNode: nodes[1], distanceKm: 1.5, coordinates, isVerified: true,
    instructions: 'Volg de fietsknooppunten.',
    displaySegments: [{
      coordinates, distanceKm: 1.5, source: 'official',
      analysis: { fromNode: nodes[0], toNode: nodes[1], source: 'OSM', geometrySource: 'official', relationId: 12345 },
    }],
  }],
  fullCoordinates: coordinates, totalDistanceKm: 1.5, elevationGainM: 12,
  elevationPoints: [{ distance: 0, elevation: 10 }, { distance: 1.5, elevation: 22 }], createdAt: '2026-09-12T00:00:00.000Z',
};

assert.ok(saveRoute(route), 'a valid route must be saved locally');
assert.equal(getSavedRoutes().length, 1, 'saved route must be listed');
assert.deepEqual(getSavedRoutes()[0].legs, route.legs, 'geometry and provenance must remain available offline');
assert.equal(setSavedRouteFavorite(route.id, true), true, 'a saved route can be made a favorite');
assert.ok(saveRoute({ ...route, name: 'Bijgewerkte route', createdAt: '2026-09-13T00:00:00.000Z' }));
assert.equal(getSavedRoutes().length, 1, 'saving the same id updates instead of duplicating');
assert.equal(getSavedRoutes()[0].name, 'Bijgewerkte route');
assert.equal(getSavedRoutes()[0].createdAt, route.createdAt, 'updates preserve the original creation time');
assert.equal(getSavedRoutes()[0].favorite, true, 'updates preserve the favorite flag');
assert.equal(setSavedRouteFavorite(route.id, false), true);
assert.ok(saveRoute(route));
assert.equal(getSavedRoutes()[0].favorite, false, 'an explicit non-favorite flag also survives updates');
assert.equal(setSavedRouteFavorite('unknown-id', true), false, 'unknown ids cannot create favorites');
assert.equal(setSavedRouteFavorite(route.id, true), true);

assert.equal(saveRouteDraft(route), true, 'the active route draft must be persisted');
assert.deepEqual(getRouteDraft()?.elevationPoints, route.elevationPoints, 'draft must retain elevation data');
assert.deepEqual(getRouteDraft()?.legs, route.legs, 'draft must retain nested segment analysis');

const originalLibrary = getSavedRoutes();
const backupJson = exportRouteLibrary();
const backup = JSON.parse(backupJson);
assert.equal(backup.format, 'fietsroute-library');
assert.equal(backup.version, 1);
assert.ok(Number.isFinite(Date.parse(backup.exportedAt)));
storage.delete(libraryKey);
assert.deepEqual(importRouteLibrary(backupJson), { imported: 1, skipped: 0 });
assert.deepEqual(getSavedRoutes(), originalLibrary, 'export/import preserves the complete route and metadata');
assert.deepEqual(importRouteLibrary(backupJson), { imported: 0, skipped: 1 }, 'repeated imports do not duplicate routes');

const conflict = { ...backup.routes[0], name: 'Een ander traject met hetzelfde id', favorite: false };
const intentionalCopy = { ...backup.routes[0], id: 'intentional-copy' };
const conflictBackup = JSON.stringify({ ...backup, routes: [conflict, intentionalCopy] });
assert.deepEqual(importRouteLibrary(conflictBackup), { imported: 2, skipped: 0 });
assert.equal(getSavedRoutes().length, 3, 'distinct ids retain intentional copies during import');
assert.deepEqual(getSavedRoutes().find((entry) => entry.id === route.id), originalLibrary[0], 'an id conflict must never overwrite the existing route');
const importedConflict = getSavedRoutes().find((entry) => entry.name === conflict.name);
assert.ok(importedConflict && importedConflict.id !== route.id, 'conflicting route receives a fresh id');
assert.equal(importedConflict?.favorite, false);
assert.deepEqual(importRouteLibrary(conflictBackup), { imported: 0, skipped: 2 }, 'reimport recognizes previously renamed conflicts');
assert.deepEqual(importRouteLibrary(JSON.stringify({ ...backup, routes: [{ ...backup.routes[0], favorite: false, savedAt: '2026-09-14T00:00:00.000Z' }] })), { imported: 0, skipped: 1 });
assert.equal(getSavedRoutes().find((entry) => entry.id === route.id)?.favorite, true, 'import does not overwrite local favorite choices');
const reorderKeys = { ...backup, routes: [{ ...backup.routes[0], nodes: nodes.map(({ id, ref, lat, lng }) => ({ lng, lat, ref, id })) }] };
assert.deepEqual(importRouteLibrary(JSON.stringify(reorderKeys)), { imported: 0, skipped: 1 }, 'JSON key order does not produce duplicate routes');

const intactLibrary = storage.get(libraryKey);
function assertInvalidBackup(mutator: (value: any) => void, message: string) {
  const invalid = JSON.parse(backupJson);
  // Even a valid new route before the invalid one must not be partially imported.
  invalid.routes.unshift({ ...invalid.routes[0], id: 'must-not-be-partially-imported' });
  mutator(invalid);
  assert.throws(() => importRouteLibrary(JSON.stringify(invalid)), Error, message);
  assert.equal(storage.get(libraryKey), intactLibrary, `${message}: validation must be atomic`);
}
assertInvalidBackup((value) => { value.version = 2; }, 'unknown library versions are rejected');
assertInvalidBackup((value) => { value.routes[1].favorite = 'yes'; }, 'favorite must be boolean');
assertInvalidBackup((value) => { value.routes[1].nodes[0].lat = 91; }, 'latitude must be in range');
assertInvalidBackup((value) => { value.routes[1].nodes[0].name = {}; }, 'optional node metadata must be text');
assertInvalidBackup((value) => { value.routes[1].nodes[0].id = null; }, 'node identifiers must be valid');
assertInvalidBackup((value) => { value.routes[1].totalDistanceKm = -1; }, 'distance cannot be negative');
assertInvalidBackup((value) => { value.routes[1].elevationPoints[0].elevation = null; }, 'elevation must be finite');
assertInvalidBackup((value) => { value.routes[1].legs[0].coordinates[0][1] = 181; }, 'geometry longitude must be in range');
assertInvalidBackup((value) => { value.routes[1].legs[0].displaySegments[0].source = 'unknown'; }, 'nested segment sources must be supported');
assertInvalidBackup((value) => { value.routes[1].legs[0].displaySegments[0].analysis.fromNode = null; }, 'nested analysis nodes must be valid');
assertInvalidBackup((value) => { value.routes[1].legs[0].displaySegments[0].analysis.relationId = '12345'; }, 'relation evidence must have numeric ids');
assertInvalidBackup((value) => { value.routes[1].createdAt = 'invalid-date'; }, 'creation dates must be valid');
assertInvalidBackup((value) => { value.routes[1].legs[0].isVerified = 'false'; }, 'verification flags must be boolean');
assert.throws(() => importRouteLibrary('{invalid-json'), /JSON/);
assert.throws(() => importRouteLibrary(' '.repeat(25 * 1024 * 1024 + 1)), /25 MB/);
assert.equal(storage.get(libraryKey), intactLibrary);

failWrites = true;
assert.equal(saveRoute({ ...route, id: 'failed-save' }), null, 'save reports quota failures');
assert.equal(saveRouteDraft(route), false, 'draft reports quota failures');
assert.equal(setSavedRouteFavorite(route.id, false), false, 'favorite reports quota failures');
assert.equal(deleteSavedRoute(route.id), false, 'delete reports storage failures');
assert.throws(() => importRouteLibrary(JSON.stringify({ ...backup, routes: [{ ...backup.routes[0], id: 'failed-import' }] })), /browseropslag/);
assert.equal(storage.get(libraryKey), intactLibrary, 'failed writes retain the previous library');
failWrites = false;

storage.set(libraryKey, '[{"invalid":"existing-data"}]');
assert.equal(saveRoute(route), null, 'saving must not destroy unreadable existing data');
assert.equal(deleteSavedRoute(route.id), false);
assert.throws(() => exportRouteLibrary(), /veilig/);
assert.throws(() => importRouteLibrary(backupJson), /niets gewijzigd/);
assert.equal(storage.get(libraryKey), '[{"invalid":"existing-data"}]');
storage.set(libraryKey, intactLibrary!);
Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
assert.equal(saveRoute(route), null, 'unavailable storage must not report successful saves');
assert.equal(saveRouteDraft(route), false);
assert.throws(() => importRouteLibrary(backupJson), Error);
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });

const shareUrl = createShareUrl(route.name, route.nodes, 'https://fietsroute.test/planner?source=test');
assert.ok(shareUrl, 'a valid itinerary must produce a share URL');
const shared = readSharedRoute(new URL(shareUrl!).search);
assert.deepEqual(shared, { name: route.name, nodes: route.nodes }, 'a share URL must restore its exact node order');
assert.equal(new URL(shareUrl!).searchParams.get('source'), 'test', 'unrelated URL parameters remain available');
const oldPayload = Buffer.from(JSON.stringify({ v: 1, n: route.name, p: route.nodes })).toString('base64url');
assert.deepEqual(readSharedRoute(`?route=${oldPayload}`), shared, 'previously shared v1 links remain supported');
assert.ok(new URL(shareUrl!).searchParams.get('route')!.length < oldPayload.length, 'new links use compact node tuples for QR codes');
const repeatedNodes = [nodes[0], { id: 234, ref: '02', lat: 51.123456789, lng: 4.123456789 }, nodes[0]];
const roundTripUrl = createShareUrl('Café & België 🚲', repeatedNodes, 'https://fietsroute.test/');
assert.deepEqual(readSharedRoute(new URL(roundTripUrl!).search), { name: 'Café & België 🚲', nodes: repeatedNodes }, 'unicode names, numeric ids, coordinate precision and repeated visits survive sharing');
assert.equal(createShareUrl(route.name, Array.from({ length: 101 }, () => nodes[0]), 'https://fietsroute.test/'), null, 'links cannot exceed the reader node limit');
assert.equal(createShareUrl(route.name, [nodes[0], { ...nodes[1], lng: 181 }], 'https://fietsroute.test/'), null);
assert.equal(createShareUrl(route.name, nodes, 'javascript:alert(1)'), null);
assert.equal(createShareUrl(route.name, nodes, 'not-a-url'), null);
assert.equal(createShareUrl(route.name, Array.from({ length: 100 }, (_, index) => ({ ...nodes[0], id: `${index}-${'a'.repeat(990)}` })), 'https://fietsroute.test/'), null, 'oversized encoded links are rejected before copying');
assert.equal(readSharedRoute('?route=not-a-valid-payload'), null, 'invalid share payloads must fail safely');
const badTuplePayload = Buffer.from(JSON.stringify({ v: 2, n: 'Invalid', p: [['a', '01', 51, 4], ['b', '02', 200, 4]] })).toString('base64url');
assert.equal(readSharedRoute(`?route=${badTuplePayload}`), null, 'compact links validate geographic coordinates');

assert.equal(deleteSavedRoute(route.id), true, 'a saved route must be deletable');
assert.ok(!getSavedRoutes().some((entry) => entry.id === route.id), 'deleted route must disappear from the library');
console.log('Route-library tests passed (updates, favorites, atomic backups, validation, storage failures and shared links).');
