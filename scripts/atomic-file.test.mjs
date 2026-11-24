import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replaceFile } from './atomic-file.mjs';

test('herhaalt tijdelijke Windows-vergrendelingen tot atomair vervangen lukt', async () => {
  const waits = []; let attempts = 0;
  await replaceFile('new.tmp', 'old.json', { move: async () => { if (++attempts < 3) throw Object.assign(Error('locked'), { code: 'EPERM' }); }, wait: async ms => waits.push(ms), report: () => {} });
  assert.equal(attempts, 3); assert.deepEqual(waits, [200, 400]);
});
test('stopt begrensd met een herstelbare fout en verwijdert geen bestanden', async () => {
  let attempts = 0;
  await assert.rejects(replaceFile('new.tmp', 'old.json', { move: async () => { attempts++; throw Object.assign(Error('locked'), { code: 'EACCES' }); }, wait: async () => {}, report: () => {} }), /nieuwe gegevens staan in new.tmp/);
  assert.equal(attempts, 7);
});
test('herhaalt andere bestandssysteemfouten niet', async () => {
  let attempts = 0;
  await assert.rejects(replaceFile('new.tmp', 'old.json', { move: async () => { attempts++; throw Object.assign(Error('missing'), { code: 'ENOENT' }); } }), /missing/);
  assert.equal(attempts, 1);
});
