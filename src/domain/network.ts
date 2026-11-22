export type Position = [number, number]; // longitude, latitude (GeoJSON)
export interface Junction { id: string; number: string | null; position: Position; network: string; owner: string }
export interface Edge { id: string; from: string; to: string; coordinates: Position[] }
export interface Dataset { version: number; fetchedAt: string; attribution: string; junctions: Junction[]; edges: Edge[]; report: { skippedEdges: number; ambiguousIds: number; invalidGeometry: number } }
export interface Step { edge: Edge; from: string; to: string; coordinates: Position[]; meters: number }
export interface PlannedRoute { stops: string[]; steps: Step[]; junctions: string[]; meters: number }
export interface Network { data: Dataset; nodes: Map<string, Junction>; adjacency: Map<string, Step[]> }

export function distance(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * rad / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function lineLength(points: Position[]): number { return points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0); }
export function createNetwork(data: Dataset): Network {
  const nodes = new Map(data.junctions.map(n => [n.id, n]));
  const adjacency = new Map<string, Step[]>();
  for (const edge of data.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to) || edge.coordinates.length < 2) throw Error('Ongeldige netwerkverbinding.');
    const meters = lineLength(edge.coordinates);
    for (const reverse of [false, true]) {
      const from = reverse ? edge.to : edge.from, to = reverse ? edge.from : edge.to;
      const step = { edge, from, to, meters, coordinates: reverse ? [...edge.coordinates].reverse() : edge.coordinates };
      adjacency.set(from, [...(adjacency.get(from) ?? []), step]);
    }
  }
  return { data, nodes, adjacency };
}

// Binary min-heap keeps routing responsive across the full Flemish graph.
class Queue {
  private items: [string, number][] = [];
  push(item: [string, number]) {
    this.items.push(item); let i = this.items.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.items[p][1] <= item[1]) break; this.items[i] = this.items[p]; i = p; }
    this.items[i] = item;
  }
  pop(): [string, number] | undefined {
    const first = this.items[0], last = this.items.pop();
    if (this.items.length && last) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.items.length && this.items[c + 1][1] < this.items[c][1]) c++;
        if (last[1] <= this.items[c][1]) break;
        this.items[i] = this.items[c]; i = c;
      }
      this.items[i] = last;
    }
    return first;
  }
}
export function shortestPath(network: Network, from: string, to: string): Step[] {
  if (!network.nodes.has(from) || !network.nodes.has(to)) throw Error('Een knooppunt is niet meer beschikbaar.');
  const costs = new Map([[from, 0]]), previous = new Map<string, Step>(), queue = new Queue();
  queue.push([from, 0]);
  let current;
  while ((current = queue.pop())) {
    const [id, cost] = current;
    if (cost !== costs.get(id)) continue;
    if (id === to) {
      const path: Step[] = []; let cursor = to;
      while (cursor !== from) { const step = previous.get(cursor)!; path.push(step); cursor = step.from; }
      return path.reverse();
    }
    for (const step of network.adjacency.get(id) ?? []) {
      const candidate = cost + step.meters;
      if (candidate < (costs.get(step.to) ?? Infinity)) { costs.set(step.to, candidate); previous.set(step.to, step); queue.push([step.to, candidate]); }
    }
  }
  throw Error('Geen aaneengesloten verbinding gevonden in het beschikbare officiële netwerk. Kies een ander knooppunt.');
}
export function planRoute(network: Network, stops: string[]): PlannedRoute {
  const steps = stops.slice(1).flatMap((to, i) => shortestPath(network, stops[i], to));
  return { stops, steps, junctions: steps.length ? [steps[0].from, ...steps.map(s => s.to)] : stops, meters: steps.reduce((sum, s) => sum + s.meters, 0) };
}

export function roundTrip(network: Network, start: string, targetKm: number): PlannedRoute {
  const origin = network.nodes.get(start)!;
  const candidates = [...network.nodes.values()].filter(n => n.number && distance(origin.position, n.position) > targetKm * 120 && distance(origin.position, n.position) < targetKm * 400);
  let best: PlannedRoute | undefined, bestScore = Infinity;
  // Try triangular loops in multiple directions; reject routes with substantial retracing.
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, radius = targetKm * 1000 / 4;
    const aim = (a: number): Position => [origin.position[0] + Math.cos(a) * radius / (111000 * Math.cos(origin.position[1] * Math.PI / 180)), origin.position[1] + Math.sin(a) * radius / 111000];
    const near = (p: Position) => candidates.reduce<Junction | undefined>((best, n) => !best || distance(n.position, p) < distance(best.position, p) ? n : best, undefined);
    const a = near(aim(angle)), b = near(aim(angle + 1.2));
    if (!a || !b || a.id === b.id) continue;
    try {
      const route = planRoute(network, [start, a.id, b.id, start]);
      const seen = new Set<string>(); let repeated = 0;
      for (const step of route.steps) { if (seen.has(step.edge.id)) repeated += step.meters; seen.add(step.edge.id); }
      if (repeated > route.meters * 0.15) continue;
      const score = Math.abs(route.meters - targetKm * 1000) + repeated * 4;
      if (score < bestScore) { best = route; bestScore = score; }
    } catch { /* Disconnected candidates cannot form a loop. */ }
  }
  if (!best || Math.abs(best.meters - targetKm * 1000) > targetKm * 400) throw Error('Geen geschikte rondrit gevonden. Probeer een andere afstand of startplaats.');
  return best;
}

export interface Progress { meters: number; remaining: number; offRoute: number; next: string | null; nextDistance: number; arrived: boolean }
export function locateOnRoute(route: PlannedRoute, location: Position, previousMeters = 0, network?: Network): Progress {
  let passed = 0, bestDistance = Infinity, projected = previousMeters;
  const ends: { id: string; meters: number }[] = [];
  for (const step of route.steps) {
    for (let i = 1; i < step.coordinates.length; i++) {
      const a = step.coordinates[i - 1], b = step.coordinates[i];
      const scale = Math.cos(location[1] * Math.PI / 180);
      const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, (((location[0] - a[0]) * scale * dx + (location[1] - a[1]) * dy) / (dx * dx + dy * dy)) || 0));
      const point: Position = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      const length = distance(a, b), at = passed + t * length, away = distance(location, point);
      // A continuity window prevents snapping to the end of a loop or a later crossing.
      if (at >= previousMeters - 80 && at <= previousMeters + 1500 && away < bestDistance) { bestDistance = away; projected = at; }
      passed += length;
    }
    if (!network || network.nodes.get(step.to)?.number) ends.push({ id: step.to, meters: passed });
  }
  const meters = bestDistance <= 75 ? Math.max(previousMeters, projected) : previousMeters;
  const next = ends.find(e => e.meters > meters + 25);
  return { meters, remaining: Math.max(0, route.meters - meters), offRoute: bestDistance, next: next?.id ?? null, nextDistance: next ? next.meters - meters : 0, arrived: route.meters - meters < 35 && bestDistance < 50 };
}
