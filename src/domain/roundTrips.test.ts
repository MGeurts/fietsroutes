import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createNetwork, distance, type Dataset } from './network';
import { directions, directionalRoundTrip, routeDirection } from './roundTrips';
const data = JSON.parse(readFileSync('public/data/network.json', 'utf8')) as Dataset, network = createNetwork(data);
it('vindt vier officiële lussen rond Zutendaal met passende afstand en windrichting', () => {
  const start = [...network.nodes.values()].filter(n => n.number && network.adjacency.has(n.id)).sort((a,b) => distance(a.position, [5.57,50.93]) - distance(b.position, [5.57,50.93]))[0].id;
  const signatures = new Set<string>();
  for (const d of directions) {
    const route = directionalRoundTrip(network, start, 30, d.key);
    expect(route, d.label).not.toBeNull();
    expect(route!.stops[0]).toBe(start); expect(route!.stops.at(-1)).toBe(start);
    expect(route!.meters).toBeGreaterThanOrEqual(24000); expect(route!.meters).toBeLessThanOrEqual(36000);
    expect(routeDirection(network, start, route!)).toBe(d.key);
    let repeated = 0; const seen = new Set<string>();
    for (let i=0;i<route!.steps.length;i++) {
      const step = route!.steps[i]; expect(network.data.edges.some(e=>e.id===step.edge.id)).toBe(true);
      if(i) expect(route!.steps[i-1].to).toBe(step.from);
      if(seen.has(step.edge.id)) repeated += step.meters; seen.add(step.edge.id);
    }
    expect(repeated).toBeLessThanOrEqual(route!.meters*.15);
    signatures.add([...seen].sort().join(','));
  }
  expect(signatures.size).toBe(4);
}, 20000);
it('verzint geen lus wanneer er geen verbindingen zijn', () => {
  const isolated = createNetwork({ ...data, edges: [] });
  for(const d of directions) expect(directionalRoundTrip(isolated, data.junctions[0].id, 30, d.key)).toBeNull();
  expect(()=>directionalRoundTrip(network,'onbekend',30,'north')).toThrow();
});
