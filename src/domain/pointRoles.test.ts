import { describe, expect, it } from 'vitest';
import { mapPointRoles, routePointRoles, stopRole } from './pointRoles';
import type { PlannedRoute } from './network';
const route = (stops: string[], junctions: string[]): PlannedRoute => ({ stops, junctions, steps: [], meters: 0 });
describe('Consistente knooppuntrollen', () => {
  it('onderscheidt start, manueel, automatisch en eind per bezoek', () => {
    expect(routePointRoles(route(['1', '3', '5'], ['1', '2', '3', '4', '5'])).map(p => p.role)).toEqual(['start', 'automatic', 'manual', 'automatic', 'end']);
    expect([0, 1, 2].map(i => stopRole(i, 3))).toEqual(['start', 'manual', 'end']);
  });
  it('maakt een gedeeld start- en eindpunt herkenbaar op de kaart', () => {
    const r = route(['1', '3', '1'], ['1', '2', '3', '4', '1']);
    expect(routePointRoles(r).at(-1)?.role).toBe('end');
    expect(mapPointRoles(r).get('1')).toBe('start-end');
  });
  it('labelt een eerder automatisch bezoek niet als een later manueel bezoek', () => {
    const r = route(['1', '3', '2', '5'], ['1', '2', '3', '2', '5']);
    expect(routePointRoles(r).map(p => p.role)).toEqual(['start', 'automatic', 'manual', 'manual', 'end']);
    expect(mapPointRoles(r).get('2')).toBe('manual');
  });
  it('houdt een enkel gekozen punt een startpunt', () => {
    expect(routePointRoles(route(['1'], ['1']))).toEqual([{ id: '1', role: 'start' }]);
  });
});
