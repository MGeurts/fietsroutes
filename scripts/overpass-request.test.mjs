import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestOverpass, retryDelay } from './overpass-request.mjs';
test('herhaalt tijdelijke fouten en geeft pas een volledig antwoord terug', async () => {
  let calls = 0; const delays = [];
  const result = await requestOverpass('query', {
    fetcher: async () => ++calls === 1 ? { ok: false, status: 502 } : { ok: true, json: async () => ({ elements: [{ id: 1 }] }) },
    wait: async ms => delays.push(ms), report: () => {},
  });
  assert.equal(calls, 2); assert.deepEqual(delays, [10000]); assert.deepEqual(result, [{ id: 1 }]);
});
test('stopt na drie pogingen en weigert gedeeltelijke antwoorden', async () => {
  let calls = 0;
  await assert.rejects(requestOverpass('query', { fetcher: async () => { calls++; return { ok: true, json: async () => ({ remark: 'incomplete response', elements: [] }) }; }, wait: async () => {}, report: () => {} }), /bestaande snapshot behouden/);
  assert.equal(calls, 3);
});
test('herhaalt een ongeldige aanvraag niet', async () => {
  let calls = 0;
  await assert.rejects(requestOverpass('query', { fetcher: async () => { calls++; return { ok: false, status: 400 }; }, report: () => {} }), /HTTP 400/);
  assert.equal(calls, 1);
});
test('respecteert Retry-After langer dan een minuut, opgesplitst in begrensde wachttijden', async () => {
  const waits = []; let calls = 0;
  await requestOverpass('query', { fetcher: async () => ++calls === 1 ? { ok: false, status: 429, headers: new Headers({ 'retry-after': '125' }) } : { ok: true, json: async () => ({ elements: [] }) }, wait: async ms => waits.push(ms), report: () => {} });
  assert.deepEqual(waits, [60000, 60000, 5000]);
  assert.equal(retryDelay('Tue, 24 Nov 2026 12:02:00 GMT', Date.parse('2026-11-24T12:00:00Z')), 120000);
  assert.equal(retryDelay('invalid'), 0);
});
test('stopt bij annulering zonder nieuwe aanvraag', async () => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  await assert.rejects(requestOverpass('query', { signal: controller.signal, fetcher: async () => { calls++; } }));
  assert.equal(calls, 0);
});
test('meldt de precieze geheugenfout en herhaalt dezelfde te zware query niet', async () => {
  let calls = 0;
  await assert.rejects(requestOverpass('query', { fetcher: async () => { calls++; return { ok: true, json: async () => ({ remark: 'runtime error: Query ran out of memory', elements: [] }) }; } }), error => {
    assert.match(error.message, /out of memory/); assert.equal(error.cause.resourceLimit, true); return true;
  });
  assert.equal(calls, 1);
});
