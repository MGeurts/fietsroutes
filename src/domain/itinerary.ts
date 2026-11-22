import type { Network, PlannedRoute } from './network';
import { routePointRoles, type PointRole } from './pointRoles';

export interface ItineraryPoint { id: string; role: PointRole; stopIndex: number | null; metersToNext: number | null }
export function routeItinerary(network: Network, route: PlannedRoute): ItineraryPoint[] {
  const cumulative = [0];
  for (const step of route.steps) cumulative.push(cumulative.at(-1)! + step.meters);
  let nextStop = 1;
  const visible = routePointRoles(route).flatMap((point, index) => {
    const stopIndex = point.role === 'start' ? 0 : point.role === 'end' ? route.stops.length - 1 : point.role === 'manual' ? nextStop++ : null;
    return network.nodes.get(point.id)?.number ? [{ ...point, stopIndex, routeIndex: index }] : [];
  });
  return visible.map((point, index) => ({ id: point.id, role: point.role, stopIndex: point.stopIndex, metersToNext: index + 1 < visible.length ? cumulative[visible[index + 1].routeIndex] - cumulative[point.routeIndex] : null }));
}
export function cyclingTime(meters: number, speedKmh: number): string {
  const seconds = Math.round(meters / (speedKmh * 1000 / 3600));
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} u ${minutes % 60} min`;
}
