import { createNetwork, distance, type Network, type PlannedRoute, type Position } from './network';
import { parseTourismSnapshot, type TourismPlace } from './tourism';
export interface PauseStop { id: string; anchor: string; place: TourismPlace; minutes: number; outward: Position[]; returning: Position[] }
export function validatePauses(value: unknown): PauseStop[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw Error('Ongeldige pauzeplaatsen.');
  for (const p of value) {
    if (!p || !/^9\d{13}$/.test(p.id) || !/^\d{1,16}$/.test(p.anchor) || !Number.isInteger(p.minutes) || p.minutes < 0 || p.minutes > 240) throw Error('Ongeldige pauzeplaats.');
    parseTourismSnapshot({ version: 1, fetchedAt: '', places: [p.place] });
    for (const line of [p.outward, p.returning]) if (!Array.isArray(line) || line.length < 2 || line.length > 10000 || !line.every((v: unknown) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90)) throw Error('Ongeldige pauzeverbinding.');
  }
  if (new Set(value.map(p => p.id)).size !== value.length) throw Error('Dubbele pauzeplaats.');
  return value;
}
export function withPauses(network: Network, pauses: PauseStop[]): Network {
  if (!pauses.length) return network;
  return createNetwork({ ...network.data, junctions: [...network.data.junctions, ...pauses.map(p => ({ id: p.id, number: null, position: p.place.position, network: 'Pauzeplaats', owner: 'OpenStreetMap' }))], edges: [...network.data.edges, ...pauses.flatMap(p => {
    if (network.nodes.has(p.id) || !network.nodes.has(p.anchor)) throw Error('De pauzeplaats kan niet op dit netwerk worden aangesloten.');
    const anchor = network.nodes.get(p.anchor)!.position;
    if (distance(p.outward[0], anchor) > 100 || distance(p.outward.at(-1)!, p.place.position) > 100 || distance(p.returning[0], p.place.position) > 100 || distance(p.returning.at(-1)!, anchor) > 100) throw Error('Ongeldige pauzeverbinding.');
    return [{ id: `pause-out-${p.id}`, from: p.anchor, to: p.id, coordinates: p.outward, oneWay: true }, { id: `pause-back-${p.id}`, from: p.id, to: p.anchor, coordinates: p.returning, oneWay: true }];
  })] });
}
export function pauseAnchor(network: Network, route: PlannedRoute, place: TourismPlace): { anchor: string; insertAt: number } {
  const candidates = route.junctions.map((id, i) => ({ id, i, node: network.nodes.get(id)! })).filter(p => p.node.number);
  const best = candidates.sort((a, b) => distance(a.node.position, place.position) - distance(b.node.position, place.position))[0];
  if (!best || distance(best.node.position, place.position) > 3000) throw Error('Kies een pauzeplaats dichter bij de route (maximaal 3 km van een routeknooppunt).');
  let next = 1;
  for (let i = 1; i <= best.i; i++) if (route.junctions[i] === route.stops[next]) next++;
  return { anchor: best.id, insertAt: Math.min(next, route.stops.length - 1) };
}
