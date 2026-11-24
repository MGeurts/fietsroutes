import { distance, lineLength, type PlannedRoute, type Position } from './network';
import { SpatialGrid, pointBox } from './spatialIndex';
import type { TourismPlace } from './tourism';

export interface RouteViewpoint { place: TourismPlace; metersFromStart: number; metersFromRoute: number }
export const viewpointRadius = 50;

export function routeViewpoints(route: PlannedRoute, places: TourismPlace[], radius = viewpointRadius, allCategories = false): RouteViewpoint[] {
  const grid = new SpatialGrid(places.filter(p => allCategories || p.category === 'sight' || p.kind === 'Openbaar toilet' || p.kind === 'Drinkwater').map(p => ({ value: p, box: pointBox(...p.position) })));
  const matches = new Map<string, RouteViewpoint>();
  let routeMeters = 0;
  for (const step of route.steps) {
    const geometryMeters = lineLength(step.coordinates), scale = geometryMeters ? step.meters / geometryMeters : 0;
    let stepMeters = 0;
    for (let i = 1; i < step.coordinates.length; i++) {
      const a = step.coordinates[i - 1], b = step.coordinates[i], length = distance(a, b);
      const cos = Math.cos((a[1] + b[1]) / 2 * Math.PI / 180), latMargin = radius / 110000, lonMargin = latMargin / Math.max(cos, .01);
      const candidates = grid.query({ west: Math.min(a[0], b[0]) - lonMargin, east: Math.max(a[0], b[0]) + lonMargin, south: Math.min(a[1], b[1]) - latMargin, north: Math.max(a[1], b[1]) + latMargin });
      for (const place of candidates) {
        const vector = (p: Position) => [(p[0] - a[0]) * cos, p[1] - a[1]];
        const [dx, dy] = vector(b), [px, py] = vector(place.position), squared = dx * dx + dy * dy;
        const t = squared ? Math.max(0, Math.min(1, (px * dx + py * dy) / squared)) : 0;
        const projection: Position = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const offset = distance(place.position, projection), along = routeMeters + (stepMeters + length * t) * scale;
        const previous = matches.get(place.id);
        // Show each place once, at its closest passage; ties keep the first visit.
        if (offset <= radius && (!previous || offset < previous.metersFromRoute - .01)) matches.set(place.id, { place, metersFromStart: along, metersFromRoute: offset });
      }
      stepMeters += length;
    }
    routeMeters += step.meters;
  }
  return [...matches.values()].sort((a, b) => a.metersFromStart - b.metersFromStart || a.place.id.localeCompare(b.place.id));
}
