import { expect, it } from 'vitest';
import { mergeLibrary, parseBackup, validateRoute } from './storage';

const route = { id: 'test', name: 'Rondrit', stops: ['1', '2'], favorite: false, updatedAt: '' };

it('leest bestaande backups en bewaart fietsprofielen in nieuwe backups', () => {
  expect(parseBackup(JSON.stringify({ version: 1, routes: [route] }))[0].speed).toBeUndefined();
  for (const speed of [15, 18, 20, 25]) {
    expect(parseBackup(JSON.stringify({ version: 1, routes: [{ ...route, speed }] }))[0].speed).toBe(speed);
  }
  expect(() => validateRoute({ ...route, speed: 0 })).toThrow('Ongeldig fietsprofiel');
  expect(() => validateRoute({ ...route, speed: '20' })).toThrow('Ongeldig fietsprofiel');
});

it('behoudt routes met een verschillend fietsprofiel bij samenvoegen', () => {
  expect(mergeLibrary([route], [{ ...route, speed: 20 }])).toHaveLength(1);
  expect(mergeLibrary([route], [{ ...route, speed: 15 }])).toHaveLength(2);
});
