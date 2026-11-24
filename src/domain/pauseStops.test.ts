// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createNetwork, planRoute } from './network';
import { pauseAnchor, validatePauses, withPauses, type PauseStop } from './pauseStops';
import { exportGpx, importGpx } from './gpx';
import { validateRoute } from './storage';
const network = createNetwork({ version: 1, fetchedAt: '', attribution: '', report: { skippedEdges: 0, ambiguousIds: 0, invalidGeometry: 0 }, junctions: [{ id: '1', number: '1', position: [3, 51], network: '', owner: '' }, { id: '2', number: '2', position: [3.02, 51], network: '', owner: '' }], edges: [{ id: 'a', from: '1', to: '2', coordinates: [[3, 51], [3.02, 51]] }] });
const pause: PauseStop = { id: '91795880000000', anchor: '1', place: { id: 'node/9', category: 'food', name: 'Café & bos', kind: 'Café', position: [3, 51.001] }, minutes: 20, outward: [[3, 51], [3, 51.001]], returning: [[3, 51.001], [3.001, 51.001], [3, 51]] };
it('plant afzonderlijke heen- en terugverbindingen en telt de omweg mee', () => {
  const augmented = withPauses(network, [pause]);
  const route = planRoute(augmented, ['1', pause.id, '2']);
  expect(route.meters).toBeGreaterThan(planRoute(network, ['1', '2']).meters + 200);
  expect(route.steps.map(s => s.edge.id)).toEqual(['pause-out-' + pause.id, 'pause-back-' + pause.id, 'a']);
  expect(pauseAnchor(network, planRoute(network, ['1', '2']), pause.place)).toEqual({ anchor: '1', insertAt: 1 });
});
it('bewaart pauzes in bibliotheek en GPX en herstelt ze zonder nieuwe routeringsaanvraag', () => {
  const augmented = withPauses(network, [pause]), route = planRoute(augmented, ['1', pause.id, '2']);
  const imported = importGpx(exportGpx(route, 'Rit', augmented, [pause]));
  expect(imported.pauses).toEqual([pause]);
  expect(planRoute(withPauses(network, imported.pauses!), imported.stops).meters).toBe(route.meters);
  expect(validateRoute({ id: 'saved', name: 'Rit', stops: route.stops, favorite: false, updatedAt: '', pauses: [pause] }).pauses).toEqual([pause]);
});
it('weigert ongeldige pauzes en verbindingen die niet aansluiten', () => {
  expect(() => validatePauses([{ ...pause, minutes: -1 }])).toThrow();
  expect(() => validatePauses([pause, pause])).toThrow();
  expect(() => withPauses(network, [{ ...pause, anchor: 'missing' }])).toThrow();
  expect(() => withPauses(network, [{ ...pause, outward: [[4, 52], [4, 52.001]] }])).toThrow();
});
