import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createNetwork, shortestPath, planRoute, type Dataset, type Position } from './network';
import { directionalRoundTrip } from './roundTrips';
// @ts-expect-error The plain-JavaScript normalizer also runs directly in Node during import.
import { normalizeSourceEdge } from '../../scripts/normalize-edge.mjs';
const base = { version: 1, fetchedAt: '', attribution: '', report: { skippedEdges: 0, ambiguousIds: 0, invalidGeometry: 0 } };
const positions: Position[] = [[3,51],[3.03,51.03],[3,51.06],[2.97,51.03]];
const nodes = positions.map((position,i)=>({ id: String(i), number: String(i), position, network: '', owner: '' }));
const edges = nodes.map((n,i)=>({ id: 'e'+i, from: n.id, to: String((i+1)%4), coordinates: [n.position,positions[(i+1)%4]], oneWay: true }));
const ring = createNetwork({ ...base, junctions: nodes, edges });
it('biedt alleen de toegestane richting aan en berekent een terugweg via andere trajecten',()=>{
  expect(shortestPath(ring,'0','1').map(s=>s.edge.id)).toEqual(['e0']);
  expect(shortestPath(ring,'1','0').map(s=>s.edge.id)).toEqual(['e1','e2','e3']);
  const forward = planRoute(ring,['0','1']), reversed = planRoute(ring,['1','0']);
  expect(reversed.meters).toBeGreaterThan(forward.meters);
});
it('houdt een eindpunt zonder uitgaande verbinding vindbaar, maar verzint geen terugweg',()=>{
  const n=createNetwork({ ...base, junctions: nodes, edges: [edges[0]] });
  expect(n.adjacency.has('1')).toBe(true); expect(n.adjacency.get('1')).toEqual([]);
  expect(shortestPath(n,'0','1')).toHaveLength(1);
  expect(()=>shortestPath(n,'1','0')).toThrow('toegestane rijrichting');
});
it('behoudt heen en terug voor oude datasets zonder oneWay-vlag',()=>{
  const n=createNetwork({ ...base, junctions: nodes, edges: [{ ...edges[0], oneWay: undefined }] });
  expect(shortestPath(n,'1','0')[0].coordinates).toEqual([...edges[0].coordinates].reverse());
});
it('gebruikt ook in rondritten nooit omgekeerde gecachte eenrichtingspaden',()=>{
  const route=directionalRoundTrip(ring,'0',15,'north'); expect(route).not.toBeNull();
  for(const step of route!.steps) { expect(step.from).toBe(step.edge.from); expect(step.to).toBe(step.edge.to); }
  expect(route!.stops.at(-1)).toBe('0');
});
it('importeert expliciete Eenrichting, behoudt tweerichting en weigert onbekende/tegenstrijdige richtingen',()=>{
  const map=new Map(nodes.map(n=>[n.id,n]));
  const source=(direction: unknown, coordinates: Position[]=edges[0].coordinates)=>({ properties: { objectid:1, begin_geoid:0, end_geoid:1, direction }, geometry: { type:'LineString',coordinates } });
  expect(normalizeSourceEdge(source('Eenrichting'),map).edge.oneWay).toBe(true);
  for(const d of [null,'']) expect(normalizeSourceEdge(source(d),map).edge.oneWay).toBeUndefined();
  expect(normalizeSourceEdge(source('onbekend'),map).reason).toBe('unknownDirection');
  expect(normalizeSourceEdge(source('Eenrichting',[...edges[0].coordinates].reverse()),map).reason).toBe('directionConflict');
  expect(normalizeSourceEdge(source(null,[...edges[0].coordinates].reverse()),map).edge.coordinates).toEqual(edges[0].coordinates);
});
it('bevat echte eenrichtingsbrontrajecten uitsluitend in hun toegestane richting',()=>{
  const data=JSON.parse(readFileSync('public/data/network.json','utf8')) as Dataset,n=createNetwork(data);
  const directed=data.edges.filter(e=>e.oneWay); expect(directed.length).toBe(80);
  for(const edge of directed){
    expect(n.adjacency.get(edge.from)!.some(s=>s.edge.id===edge.id&&s.to===edge.to)).toBe(true);
    expect(n.adjacency.get(edge.to)!.some(s=>s.edge.id===edge.id&&s.to===edge.from)).toBe(false);
  }
});
