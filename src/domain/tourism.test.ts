import { expect, it } from 'vitest';
import { normalizeTourism, parseTourismSnapshot, safeWebsite } from './tourism';
it('neemt telefoonnummers over uit beide OSM-velden en gebruikt een volledig adres indien aanwezig', () => {
  const places = normalizeTourism([
    { type: 'node', id: 1, lat: 51, lon: 3, tags: { amenity: 'restaurant', phone: '+32 1', 'contact:phone': '+32 2', 'addr:full': 'Bosweg 1, Gent' } },
    { type: 'node', id: 2, lat: 51, lon: 3, tags: { amenity: 'cafe', 'contact:phone': '+32 3' } },
  ]);
  expect(places[0]).toMatchObject({ phone: '+32 1', address: 'Bosweg 1, Gent' });
  expect(places[1].phone).toBe('+32 3');
});

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
