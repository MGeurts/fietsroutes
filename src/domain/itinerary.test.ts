import { expect, it } from 'vitest';
import { cyclingTime, routeItinerary } from './itinerary';
import type { Junction, Network, PlannedRoute, Step } from './network';

const nodes = new Map(['a', 'b', 'x', 'c'].map(id => [id, { id, number: id === 'x' ? null : id, position: [3, 51], network: 'Test', owner: 'Test' } as Junction]));
const network = { nodes } as Network;
const route: PlannedRoute = { stops: ['a', 'c', 'a'], junctions: ['a', 'b', 'x', 'c', 'b', 'a'], steps: [100, 20, 30, 40, 50].map(meters => ({ meters }) as Step), meters: 240 };
it('toont alle genummerde bezoeken met de juiste rol en bewerkbaar stopindex', () => {
  const points = routeItinerary(network, route);
  expect(points.map(p => p.id)).toEqual(['a', 'b', 'c', 'b', 'a']);
  expect(points.map(p => p.role)).toEqual(['start', 'automatic', 'manual', 'automatic', 'end']);
  expect(points.map(p => p.stopIndex)).toEqual([0, null, 1, null, 2]);
});
it('telt trajecten via ongenummerde verbindingspunten mee tot het volgende knooppunt', () => {
  const points = routeItinerary(network, route);
  expect(points.map(p => p.metersToNext)).toEqual([100, 50, 40, 50, null]);
  expect(points.reduce((total, p) => total + (p.metersToNext ?? 0), 0)).toBe(route.meters);
});
it('berekent de tijd volgens het fietsprofiel, ook voor heel korte trajecten', () => {
  expect(cyclingTime(1000, 20)).toBe('3 min');
  expect(cyclingTime(1000, 15)).toBe('4 min');
  expect(cyclingTime(100, 20)).toBe('18 sec');
  expect(cyclingTime(30000, 20)).toBe('1 u 30 min');
});
