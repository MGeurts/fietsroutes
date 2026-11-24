import type { Progress } from './network';
import type { RouteViewpoint } from './routeViewpoints';

export function nearbyRouteTourism(points: RouteViewpoint[], progress: Progress | null): RouteViewpoint[] {
  if (!progress || !Number.isFinite(progress.meters) || progress.offRoute > 75) return [];
  return points.filter(point => {
    const ahead = point.metersFromStart - progress.meters;
    return ahead <= 200 && ahead >= -100;
  });
}
