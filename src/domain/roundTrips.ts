import { distance, shortestPath, type Network, type PlannedRoute, type Position, type Step } from './network';
export const directions = [{ key: 'north', label: 'Noord', angle: Math.PI / 2 }, { key: 'east', label: 'Oost', angle: 0 }, { key: 'south', label: 'Zuid', angle: -Math.PI / 2 }, { key: 'west', label: 'West', angle: Math.PI }] as const;
export type DirectionKey = typeof directions[number]['key'];
export interface RoundTripOption { direction: DirectionKey; route: PlannedRoute | null }
export const distanceTolerance = 0.2;

export function routeDirection(network: Network, start: string, route: PlannedRoute): DirectionKey | null {
  const origin = network.nodes.get(start)!.position, scale = Math.cos(origin[1] * Math.PI / 180);
  let x = 0, y = 0;
  for (const step of route.steps) for (let i = 1; i < step.coordinates.length; i++) {
    const a = step.coordinates[i - 1], b = step.coordinates[i], weight = distance(a, b);
    x += ((a[0] + b[0]) / 2 - origin[0]) * scale * weight;
    y += ((a[1] + b[1]) / 2 - origin[1]) * weight;
  }
  if (Math.hypot(x, y) < 1e-10) return null;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'east' : 'west') : (y > 0 ? 'north' : 'south');
}

export function directionalRoundTrip(network: Network, start: string, targetKm: number, direction: DirectionKey): PlannedRoute | null {
  const origin = network.nodes.get(start);
  if (!origin || !Number.isFinite(targetKm) || targetKm < 15 || targetKm > 80) throw Error('Kies een geldig startpunt en een afstand van 15 tot 80 km.');
  const heading = directions.find(d => d.key === direction)!.angle, target = targetKm * 1000;
  const candidates = [...network.nodes.values()].filter(n => n.number && network.adjacency.has(n.id) && distance(origin.position, n.position) > target * 0.08 && distance(origin.position, n.position) < target * 0.45);
  const paths = new Map<string, Step[]>();
  const path = (a: string, b: string) => {
    const key = a + ':' + b;
    if (!paths.has(key)) {
      const steps = shortestPath(network, a, b); paths.set(key, steps);
      // Return paths may differ: never reverse a cached path in a directed graph.
    }
    return paths.get(key)!;
  };
  const near = (angle: number, radius: number) => {
    const aim: Position = [origin.position[0] + Math.cos(angle) * radius / (111000 * Math.cos(origin.position[1] * Math.PI / 180)), origin.position[1] + Math.sin(angle) * radius / 111000];
    return candidates.reduce<typeof origin | undefined>((best, n) => !best || distance(n.position, aim) < distance(best.position, aim) ? n : best, undefined);
  };
  let best: PlannedRoute | null = null, score = Infinity;
  for (const offset of [0, -0.3, 0.3, -0.6, 0.6]) for (const radius of [0.23, 0.18, 0.28, 0.33, 0.13, 0.38]) for (const spread of [0.45, 0.7, 0.25, 0.95]) {
    const a = near(heading + offset - spread, target * radius), b = near(heading + offset + spread, target * radius);
    if (!a || !b || a.id === b.id) continue;
    try {
      const stops = [start, a.id, b.id, start], steps = [...path(start, a.id), ...path(a.id, b.id), ...path(b.id, start)];
      const route: PlannedRoute = { stops, steps, junctions: [start, ...steps.map(s => s.to)], meters: steps.reduce((sum, s) => sum + s.meters, 0) };
      if (!route.meters || Math.abs(route.meters - target) > target * distanceTolerance || routeDirection(network, start, route) !== direction) continue;
      const seen = new Set<string>(); let repeated = 0;
      for (const s of steps) { if (seen.has(s.edge.id)) repeated += s.meters; seen.add(s.edge.id); }
      if (repeated > route.meters * 0.15) continue;
      const nextScore = Math.abs(route.meters - target) + repeated * 4;
      if (nextScore < score) { score = nextScore; best = route; }
    } catch { /* Disconnected official connections cannot form a loop. */ }
  }
  return best;
}
