import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createNetwork, distance, locateOnRoute, planRoute, roundTrip, shortestPath, type Dataset, type Position } from './network';
import { mergeLibrary, parseBackup } from './storage';
import { exportGpx } from './gpx';

function fixture() {
  const positions: Position[] = [[3, 51], [3.01, 51], [3.02, 51], [3.01, 51.01], [4, 51]];
  const data: Dataset = { version: 1, fetchedAt: '', attribution: '', report: { skippedEdges: 0, ambiguousIds: 0, invalidGeometry: 0 }, junctions: positions.map((position, i) => ({ id: String(i), number: i === 4 ? '1' : String(i + 1), position, network: 'Test', owner: 'Test' })), edges: [[0, 1], [1, 2], [2, 3], [3, 0]].map(([from, to], i) => ({ id: String(i), from: String(from), to: String(to), coordinates: [positions[from], positions[to]] })) };
  return createNetwork(data);
}
describe('Routering zonder verzonnen aansluitingen', () => {
  it('kiest echte verbindingen en houdt gelijke nummers met verschillende IDs apart', () => {
    const network = fixture(), path = shortestPath(network, '0', '2');
    expect(path.map(s => s.to)).toEqual(['1', '2']);
    expect(() => shortestPath(network, '0', '4')).toThrow('Geen aaneengesloten');
  });
  it('draait de geometrie correct om bij een omgekeerde route', () => {
    const n = fixture(), forward = planRoute(n, ['0', '1', '2']), backward = planRoute(n, ['2', '1', '0']);
    expect(backward.meters).toBeCloseTo(forward.meters);
    expect(backward.steps[0].coordinates[0]).toEqual(n.nodes.get('2')!.position);
  });
  it('behoudt de volgorde van verplichte tussenpunten', () => {
    const r = planRoute(fixture(), ['0', '2', '0']);
    expect(r.junctions).toEqual(['0', '1', '2', '1', '0']);
    expect(r.steps.length).toBe(4);
  });
  it('springt bij de start van een lus niet naar het eindpunt', () => {
    const r = planRoute(fixture(), ['0', '1', '2', '3', '0']);
    const p = locateOnRoute(r, [3, 51]);
    expect(p.meters).toBeLessThan(10); expect(p.arrived).toBe(false); expect(p.next).toBe('1');
  });
  it('zet de voortgang stil wanneer de fietser afwijkt', () => {
    const r = planRoute(fixture(), ['0', '1', '2']);
    const p = locateOnRoute(r, [3, 51.1], 100);
    expect(p.meters).toBe(100); expect(p.offRoute).toBeGreaterThan(75);
  });
  it('exporteert brongeometrie en ontsnapt XML in routenamen', () => {
    const n = fixture(), xml = exportGpx(planRoute(n, ['0', '1', '2']), '<Route & "fiets">', n);
    expect(xml).toContain('&lt;Route &amp; &quot;fiets&quot;&gt;');
    expect(xml.match(/<trkseg>/g)).toHaveLength(2); expect(xml).toContain('<fr:node>0</fr:node>');
  });
});
describe('Bibliotheekimport', () => {
  it('weigert ongeldige of te grote knooppuntlijsten', () => {
    expect(() => parseBackup(JSON.stringify({ version: 1, routes: [{ id: 'test', name: 'route', stops: ['1', '<script>'], favorite: false, updatedAt: '' }] }))).toThrow();
  });
  it('slaat identieke imports over en overschrijft geen bestaande route', () => {
    const a = { id: 'a', name: 'Rit', stops: ['1', '2'], favorite: false, updatedAt: '' };
    expect(mergeLibrary([a], [a])).toHaveLength(1);
    const merged = mergeLibrary([a], [{ ...a, stops: ['2', '3'] }]);
    expect(merged).toHaveLength(2); expect(merged[0]).toEqual(a); expect(merged[1].id).not.toBe('a');
  });
});
describe('Volledige officiële Vlaamse dataset', () => {
  const data: Dataset = JSON.parse(readFileSync('public/data/network.json', 'utf8'));
  const network = createNetwork(data);
  it('heeft unieke identiteiten en controleerbare geometrie aan beide uiteinden', () => {
    expect(data.junctions.length).toBeGreaterThan(5000);
    expect(network.nodes.size).toBe(data.junctions.length);
    expect(data.junctions.every(n => n.number === null || /^\d+$/.test(n.number))).toBe(true);
    expect(data.edges.length).toBeGreaterThan(7000);
    expect(new Set(data.edges.map(e => e.id)).size).toBe(data.edges.length);
    for (const edge of data.edges) {
      expect(edge.coordinates.every(p => p.length === 2 && p.every(Number.isFinite))).toBe(true);
      expect(distance(network.nodes.get(edge.from)!.position, edge.coordinates[0])).toBeLessThan(42);
      expect(distance(network.nodes.get(edge.to)!.position, edge.coordinates.at(-1)!)).toBeLessThan(42);
    }
  });
  it('kan een echte rondrit bij Gent vinden zonder fictieve trajecten', () => {
    const gent = [...network.nodes.values()].filter(n => n.number && network.adjacency.has(n.id)).sort((a, b) => distance(a.position, [3.725, 51.054]) - distance(b.position, [3.725, 51.054]))[0];
    const route = roundTrip(network, gent.id, 30);
    expect(route.stops[0]).toBe(route.stops.at(-1));
    expect(route.meters).toBeGreaterThan(18000); expect(route.meters).toBeLessThan(42000);
    const ids = new Set(data.edges.map(e => e.id));
    expect(route.steps.every(s => ids.has(s.edge.id))).toBe(true);
    for (let i = 1; i < route.steps.length; i++) expect(route.steps[i - 1].to).toBe(route.steps[i].from);
  });
});
