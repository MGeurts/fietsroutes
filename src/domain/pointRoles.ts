import type { PlannedRoute } from './network';

export type PointRole = 'start' | 'manual' | 'automatic' | 'end' | 'start-end';
export const pointRoleLabels: Record<PointRole, string> = { start: 'Startpunt', manual: 'Manueel tussenpunt', automatic: 'Automatisch tussenpunt', end: 'Eindpunt', 'start-end': 'Start- en eindpunt' };
export function stopRole(index: number, count: number): PointRole { return index === 0 ? 'start' : index === count - 1 ? 'end' : 'manual'; }
// Classify visits, not just IDs: the same junction can be visited automatically
// on one leg and deliberately chosen on a later leg.
export function routePointRoles(route: PlannedRoute): { id: string; role: PointRole }[] {
  let nextStop = 1;
  return route.junctions.map((id, index, visits) => {
    if (index === 0) return { id, role: 'start' };
    if (index === visits.length - 1) return { id, role: 'end' };
    if (id === route.stops[nextStop]) { nextStop++; return { id, role: 'manual' }; }
    return { id, role: 'automatic' };
  });
}
export function mapPointRoles(route: PlannedRoute): Map<string, PointRole> {
  const roles = new Map<string, PointRole>();
  const priority: Record<PointRole, number> = { automatic: 0, manual: 1, end: 2, start: 3, 'start-end': 4 };
  for (const point of routePointRoles(route)) {
    const previous = roles.get(point.id);
    if (!previous || priority[point.role] > priority[previous]) roles.set(point.id, point.role);
  }
  if (route.stops.length > 1 && route.stops[0] === route.stops.at(-1)) roles.set(route.stops[0], 'start-end');
  return roles;
}
