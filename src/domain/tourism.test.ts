import { expect, it } from 'vitest';
import { normalizeTourism, parseTourismSnapshot, safeWebsite } from './tourism';

it('normaliseert punten en gebouwcentra met adres en beschikbare details', () => {
  const places = normalizeTourism([
    { type: 'node', id: 1, lat: 51, lon: 3, tags: { tourism: 'guest_house', name: 'B&B Bos', website: 'https://example.com', 'addr:street': 'Bosweg', 'addr:housenumber': '2', opening_hours: 'Mo-Fr 09:00-17:00' } },
    { type: 'way', id: 2, center: { lat: 51.1, lon: 3.1 }, tags: { amenity: 'restaurant' } },
    { type: 'node', id: 3, lat: 51, lon: 3, tags: { amenity: 'bicycle_repair_station' } },
  ]);
  expect(places[0]).toMatchObject({ category: 'stay', address: 'Bosweg 2', name: 'B&B Bos', position: [3, 51] });
  expect(places[1]).toMatchObject({ category: 'food', name: 'Restaurant', position: [3.1, 51.1] });
  expect(places[2].category).toBe('service');
});
it('weigert ongeldige locaties, onbekende categorieën en onveilige links', () => {
  expect(normalizeTourism([{ type: 'node', id: 1, tags: { tourism: 'hotel' } }, { type: 'node', id: 2, lat: 999, lon: 3, tags: { amenity: 'cafe' } }])).toEqual([]);
  expect(safeWebsite('javascript:alert(1)')).toBeUndefined();
  expect(safeWebsite('data:text/html,evil')).toBeUndefined();
  expect(() => parseTourismSnapshot({ version: 1, fetchedAt: '', places: [{ category: 'evil' }] })).toThrow();
});
