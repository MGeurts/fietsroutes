import { describe, expect, it, vi, afterEach } from 'vitest';
import { approachUrl, fetchApproach, parseApproach } from './approach';
import type { Position } from './network';

const from: Position = [3.725, 51.054], to: Position = [3.7205, 51.0522];
const response = { type: 'FeatureCollection', features: [{ geometry: { type: 'LineString', coordinates: [[...from, 12], [3.723, 51.054, 14], [...to, 13]] } }] };
afterEach(() => vi.unstubAllGlobals());
describe('Fietsaanrijroute', () => {
  it('vraagt expliciet fietsroutering van de locatie naar de start aan', () => {
    const url = new URL(approachUrl(from, to));
    expect(url.searchParams.get('lonlats')).toBe('3.725,51.054|3.7205,51.0522');
    expect(url.searchParams.get('profile')).toBe('trekking');
  });
  it('behoudt de weggeometrie en verwerkt GeoJSON met hoogtecoördinaten', () => {
    const route = parseApproach(response, from, to);
    expect(route.coordinates).toEqual([from, [3.723, 51.054], to]);
    expect(route.meters).toBeGreaterThan(300);
  });
  it('weigert lege, ongeldige en te ver weggesnapte trajecten', () => {
    expect(() => parseApproach({ type: 'FeatureCollection', features: [] }, from, to)).toThrow();
    expect(() => parseApproach(response, [4, 51], to)).toThrow('100 meter');
    expect(() => parseApproach({ type: 'FeatureCollection', features: [{ geometry: { type: 'LineString', coordinates: [[NaN, 51], to] } }] }, from, to)).toThrow();
  });
  it('kan worden geannuleerd en geeft bij dienstfouten geen rechte lijn terug', async () => {
    const signal = new AbortController().signal;
    const fetch = vi.fn().mockResolvedValue({ ok: false }); vi.stubGlobal('fetch', fetch);
    await expect(fetchApproach(from, to, signal)).rejects.toThrow('tijdelijk niet beschikbaar');
    expect(fetch.mock.calls[0][1].signal).toBe(signal);
    expect(fetch.mock.calls[0][1].credentials).toBe('omit');
  });
});
