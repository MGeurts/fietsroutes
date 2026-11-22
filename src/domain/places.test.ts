import { describe, expect, it } from 'vitest';
import { normalizeSearch, parsePlaces, placesUrl } from './places';

const feature = (name: string, coordinates: number[], countrycode = 'BE') => ({ properties: { name, osm_type: 'R', osm_id: name, osm_value: 'village', countrycode, county: 'Hasselt', state: 'Limburg', extra: { admin_level: '8' } }, geometry: { type: 'Point', coordinates } });
describe('Zoeken naar gemeenten en dorpen', () => {
  it('vindt Zutendaal uit het echte Photon-antwoordformaat, zonder vaste stedenlijst', () => {
    const results = parsePlaces({ type: 'FeatureCollection', features: [feature('Zutendaal', [5.5725548, 50.9318992])] }, 'ZUTENDAAL');
    expect(results[0]).toMatchObject({ label: 'Zutendaal', sub: 'Gemeente · Hasselt · Limburg', position: [5.5725548, 50.9318992] });
  });
  it('plaatst een exacte naam voor andere plaatsnamen en negeert hoofdletters en accenten', () => {
    const results = parsePlaces({ type: 'FeatureCollection', features: [feature('Genk-Centrum', [5.5, 50.96]), feature('Genk', [5.5, 50.96])] }, ' GENK ');
    expect(results[0].label).toBe('Genk'); expect(normalizeSearch('  ÉÉN   Plaats ')).toBe('een plaats');
  });
  it('weigert buitenlandse en ongeldige resultaten en verwijdert dubbels', () => {
    const a = feature('Zutendaal', [5.57, 50.93]);
    const results = parsePlaces({ type: 'FeatureCollection', features: [a, a, feature('Buitenland', [5.57, 50.93], 'NL'), feature('Fout', [NaN, 51])] }, 'Zutendaal');
    expect(results).toHaveLength(1); expect(() => parsePlaces({}, 'Zutendaal')).toThrow();
  });
  it('gebruikt de standaard lokale namen en zoekt ook dorpen, zonder GPS-coördinaten te versturen', () => {
    const url = new URL(placesUrl('ZUTENDAAL'));
    expect(url.searchParams.get('q')).toBe('ZUTENDAAL'); expect(url.searchParams.get('osm_tag')).toBe('place');
    expect(url.searchParams.has('lang')).toBe(false); expect(url.searchParams.has('lat')).toBe(false);
  });
});
