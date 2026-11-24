import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { importTourism, tourismQueries } from './tourism-import-core.mjs';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'fietsroutes-import-test-'));
  const options = { queries: ['a', 'b'], cacheDir: join(directory, 'cache'), target: join(directory, 'snapshot.json'), normalize: elements => [...new Map(elements.map(e => [e.id, e])).values()], validate: () => {}, wait: async () => {}, report: () => {}, now: () => 100000000 };
  try { await run(options); } finally {
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(directory.startsWith(join(resolve(tmpdir()), 'fietsroutes-import-test-')));
    await rm(directory, { recursive: true, force: true });
  }
}
test('hervat na fouten, dedupliceert en vervangt nooit door een gedeeltelijk resultaat', async () => fixture(async options => {
  const old = { places: [{ id: 99 }] }; await writeFile(options.target, JSON.stringify(old));
  await assert.rejects(importTourism({ ...options, fetchBox: async query => { if (query === 'b') throw Error('502'); return [{ id: 1 }]; } }), /502/);
  assert.deepEqual(JSON.parse(await readFile(options.target, 'utf8')), old);
  const requested = [];
  const result = await importTourism({ ...options, fetchBox: async query => { requested.push(query); return [{ id: 1 }, { id: 2 }]; } });
  assert.deepEqual(requested, ['b']); assert.equal(result.places.length, 2);
}));
test('haalt na een geslaagde run opnieuw verse gegevens op', async () => fixture(async options => {
  let calls = 0; const fetchBox = async () => { calls++; return [{ id: 1 }]; };
  await importTourism({ ...options, fetchBox }); await importTourism({ ...options, fetchBox });
  assert.equal(calls, 4);
}));
test('negeert onvoltooide cache met --fresh of na zes uur', async () => fixture(async options => {
  const incomplete = async q => { if (q === 'b') throw Error('fout'); return [{ id: 1 }]; };
  await assert.rejects(importTourism({ ...options, fetchBox: incomplete }));
  const requested = [];
  await importTourism({ ...options, fresh: true, fetchBox: async q => { requested.push(q); return [{ id: 1 }]; } });
  assert.deepEqual(requested, ['a', 'b']);
  await assert.rejects(importTourism({ ...options, fetchBox: incomplete }));
  requested.length = 0;
  await importTourism({ ...options, now: () => options.now() + 7 * 3600000, fetchBox: async q => { requested.push(q); return [{ id: 1 }]; } });
  assert.deepEqual(requested, ['a', 'b']);
}));
test('weigert grote onverwachte dalingen en ongeldige data zonder de snapshot te wijzigen', async () => fixture(async options => {
  const old = { places: Array.from({ length: 10 }, (_, id) => ({ id })) }; await writeFile(options.target, JSON.stringify(old));
  await assert.rejects(importTourism({ ...options, fetchBox: async () => [{ id: 1 }] }), /30%/);
  assert.deepEqual(JSON.parse(await readFile(options.target, 'utf8')), old);
  await assert.rejects(importTourism({ ...options, fresh: true, fetchBox: async () => old.places, validate: () => { throw Error('ongeldig'); } }), /ongeldig/);
  assert.deepEqual(JSON.parse(await readFile(options.target, 'utf8')), old);
}));
test('acht gebieden sluiten op elkaar aan en gebruiken dezelfde categorieën', () => {
  const queries = tourismQueries([2, 50, 6, 52]);
  assert.equal(queries.length, 8);
  assert.ok(queries[0].includes('(50,2,51,3)'));
  assert.ok(queries.at(-1).includes('(51,5,52,6)'));
});
test('splitst een te zwaar gebied en hervat ook geslaagde deelgebieden', async () => fixture(async options => {
  const query = tourismQueries([2, 50, 6, 52])[0];
  let fail = true;
  // The initial box is 1° x 1° and is split along latitude on a tie.
  const firstChild = query.replaceAll('(50,2,51,3)', '(50,2,50.5,3)');
  const requested = [];
  const fetcher = async q => {
    requested.push(q);
    if (q === query) { const error = Error('out of memory'); error.resourceLimit = true; throw error; }
    if (fail && q !== firstChild) throw Error('tijdelijk offline');
    return [{ id: q === firstChild ? 1 : 2 }];
  };
  await assert.rejects(importTourism({ ...options, queries: [query], fetchBox: fetcher }));
  fail = false; requested.length = 0;
  const result = await importTourism({ ...options, queries: [query], fetchBox: fetcher });
  assert.equal(requested.includes(firstChild), false);
  assert.equal(result.places.length, 2);
}));
