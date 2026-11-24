import { expect, it } from 'vitest';
import { nearbyRouteTourism } from './tourismProximity';
import type { RouteViewpoint } from './routeViewpoints';
import type { Progress } from './network';

const point = { place: { id: 'node/1' }, metersFromStart: 1000 } as RouteViewpoint;
const progress = (meters: number, offRoute = 0) => ({ meters, offRoute }) as Progress;
it('activeert vanaf 200 meter voor een punt tot en met 100 meter erna', () => {
  expect(nearbyRouteTourism([point], progress(799))).toEqual([]);
  for (const meters of [800, 999, 1000, 1100]) expect(nearbyRouteTourism([point], progress(meters))).toEqual([point]);
  expect(nearbyRouteTourism([point], progress(1101))).toEqual([]);
});
it('licht geen latere passage op en stopt bij routeafwijking of ontbrekende voortgang', () => {
  expect(nearbyRouteTourism([point, { ...point, metersFromStart: 5000 }], progress(900))).toEqual([point]);
  expect(nearbyRouteTourism([point], progress(900, 76))).toEqual([]);
  expect(nearbyRouteTourism([point], null)).toEqual([]);
});
