import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createNetwork, type Dataset } from './network';
import { searchJunctions } from './places';
const data = JSON.parse(readFileSync(new URL('../../public/data/network.json', import.meta.url), 'utf8')) as Dataset;
const network = createNetwork(data);
it('toont de Limburgse 64 in Zutendaal bovenaan, ook als die achteraan in de brondata staat', () => {
  const results = searchJunctions(network, '64', [5.57, 50.93]);
  expect(results[0]).toMatchObject({ key: '5421142', label: 'Knooppunt 64', sub: 'Fietsroutenetwerk Limburg' });
  expect(results).toHaveLength(data.junctions.filter(n => n.number === '64' && network.adjacency.has(n.id)).length);
  expect(results.length).toBeGreaterThan(8);
});
it('rangschikt opnieuw bij een ander kaartcentrum en blijft op het exacte nummer zoeken', () => {
  const far = data.junctions.find(n => n.number === '64' && n.network.includes('Antwerpen') && network.adjacency.has(n.id))!;
  const results = searchJunctions(network, ' 64 ', far.position);
  expect(results[0].position).toEqual(far.position);
  expect(results.every(n => n.label === 'Knooppunt 64')).toBe(true);
  expect(searchJunctions(network, ' ', far.position)).toEqual([]);
});
