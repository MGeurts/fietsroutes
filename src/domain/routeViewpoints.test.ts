import { expect, it } from 'vitest';
import { routeViewpoints } from './routeViewpoints';
import { distance, type PlannedRoute, type Step } from './network';
import type { TourismPlace } from './tourism';

const a: [number, number] = [3, 51], b: [number, number] = [3.02, 51];
const length = distance(a, b);
const step = { coordinates: [a, b], meters: length } as Step;
const route = { steps: [step], meters: length } as PlannedRoute;
const place = (id: string, lon: number, lat: number, kind = 'Uitkijkpunt'): TourismPlace => ({ id, position: [lon, lat], kind, category: kind === 'Restaurant' ? 'food' : 'sight', name: id });

it('vindt uitkijkpunten naast segmenten, filtert op 50 meter en sorteert langs de route', () => {
  const result = routeViewpoints(route, [place('later', 3.015, 51), place('first', 3.005, 51.0003), place('far', 3.01, 51.001), place('restaurant', 3.01, 51, 'Restaurant')]);
  expect(result.map(v => v.place.id)).toEqual(['first', 'later']);
  expect(result[0].metersFromRoute).toBeGreaterThan(30);
  expect(result[0].metersFromRoute).toBeLessThan(40);
  expect(result[0].metersFromStart).toBeCloseTo(length / 4, 0);
});
it('toont een uitkijkpunt eenmaal bij een heen-en-terugroute en verwerkt trajectlengtes', () => {
  const loop = { steps: [{ ...step, meters: length * 2 }, { ...step, coordinates: [b, a] }], meters: length * 3 } as PlannedRoute;
  const result = routeViewpoints(loop, [place('view', 3.01, 51)]);
  expect(result).toHaveLength(1);
  expect(result[0].metersFromStart).toBeCloseTo(length, 0);
});
it('neemt ook attracties en musea binnen 50 meter op, zonder horeca', () => {
  const result = routeViewpoints(route, [place('Tankmonument M41 Walker Bulldog', 3.005, 51, 'Attractie'), place('Museum', 3.015, 51.0002, 'Museum'), place('Café', 3.01, 51, 'Restaurant'), place('Te ver', 3.01, 51.001, 'Attractie')]);
  expect(result.map(v => v.place.name)).toEqual(['Tankmonument M41 Walker Bulldog', 'Museum']);
});
it('vindt ook punten vlak naast het route-einde en verwerkt lege routes', () => {
  expect(routeViewpoints(route, [place('nearEnd', 3.0202, 51)])).toHaveLength(1);
  expect(routeViewpoints({ steps: [], meters: 0 } as unknown as PlannedRoute, [place('view', 3.01, 51)])).toEqual([]);
});
it('neemt openbare toiletten en drinkwater op binnen 50 meter, maar geen andere voorzieningen', () => {
  const toilet = { ...place('Toilet', 3.005, 51.0002, 'Openbaar toilet'), category: 'service' as const };
  const far = { ...toilet, id: 'far', position: [3.01, 51.001] as [number, number] };
  const water = { ...toilet, id: 'water', kind: 'Drinkwater' };
  const repair = { ...toilet, id: 'repair', kind: 'Fietsherstelpunt' };
  expect(routeViewpoints(route, [toilet, far, water, repair]).map(v => v.place.id)).toEqual(['Toilet', 'water']);
});
