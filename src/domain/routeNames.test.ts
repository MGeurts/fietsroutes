import { expect, it } from 'vitest';
import { copyRouteName, gpxFilename, roundTripName } from './routeNames';
it('behoudt de decimale komma in de gedownloade bestandsnaam', () => {
  expect(gpxFilename('Rondrit 62,8 km')).toBe('Rondrit 62,8 km.gpx');
  expect(gpxFilename('29 - Rondrit 62,8 km')).toBe('29 - Rondrit 62,8 km.gpx');
  expect(gpxFilename('Rit: A/B?')).toBe('Rit AB.gpx');
});
it('zet het startnummer voor de standaard rondritnaam', () => {
  expect(roundTripName('29', 62800)).toBe('29 - Rondrit 62,8 km');
  expect(roundTripName('534', 27800)).toBe('534 - Rondrit 27,8 km');
});
it('nummert kopieën verder zonder bestaande namen te hergebruiken', () => {
  const base = '535 - Rondrit 32,2 km';
  expect(copyRouteName(base, [base])).toBe(`${base} (kopie 1)`);
  expect(copyRouteName(base, [base, `${base} (kopie 1)`, `${base} (kopie 3)`])).toBe(`${base} (kopie 4)`);
  expect(copyRouteName(`${base} (kopie 1)`, [`${base} (kopie 1)`, `${base} (kopie 2)`])).toBe(`${base} (kopie 3)`);
  expect(copyRouteName('Rit', ['rit (Kopie 1)'])).toBe('Rit (kopie 2)');
});
it('houdt ook kopieën van lange routenamen binnen de opslaglimiet', () => {
  const first = copyRouteName('a'.repeat(120), []);
  const second = copyRouteName('a'.repeat(120), [first]);
  expect(first.length).toBeLessThanOrEqual(120);
  expect(second.length).toBeLessThanOrEqual(120);
  expect(first).not.toBe(second);
});
