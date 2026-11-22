import type { Position } from './network';

export interface PlaceResult { key: string; label: string; sub: string; position: Position }
export const normalizeSearch = (query: string) => query.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('nl-BE').replace(/\s+/g, ' ');
export function placesUrl(query: string): string {
  // Default names preserve Dutch OSM names; the public server does not support lang=nl.
  return `https://photon.komoot.io/api/?${new URLSearchParams({ q: query.trim(), limit: '8', bbox: '2.5,50.65,5.95,51.55', osm_tag: 'place' })}`;
}
export function parsePlaces(data: unknown, query: string): PlaceResult[] {
  const collection = data as { type?: string; features?: unknown[] } | null;
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) throw Error('De plaatszoeker gaf een ongeldig antwoord.');
  const results: PlaceResult[] = [], seen = new Set<string>();
  for (const value of collection.features) {
    if (!value || typeof value !== 'object') continue;
    const feature = value as { properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown } };
    const p = feature.properties, c = feature.geometry?.coordinates;
    if (!p || typeof p.name !== 'string' || String(p.countrycode).toLowerCase() !== 'be' || feature.geometry?.type !== 'Point' || !Array.isArray(c) || c.length < 2 || typeof c[0] !== 'number' || typeof c[1] !== 'number' || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || c[0] < 2.5 || c[0] > 5.95 || c[1] < 50.65 || c[1] > 51.55) continue;
    const position: Position = [c[0], c[1]];
    const identity = `${normalizeSearch(p.name)}:${position.map(n => n.toFixed(3)).join(',')}`;
    if (seen.has(identity)) continue; seen.add(identity);
    const kind = p.extra && typeof p.extra === 'object' && 'admin_level' in p.extra && p.extra.admin_level === '8' ? 'Gemeente' : ({ city: 'Stad', town: 'Plaats', village: 'Dorp', hamlet: 'Gehucht', suburb: 'Deelgemeente', neighbourhood: 'Wijk' } as Record<string, string>)[String(p.osm_value)] ?? 'Plaats';
    const area = [...new Set([p.county, p.state].filter((s): s is string => typeof s === 'string' && normalizeSearch(s) !== normalizeSearch(String(p.name))))];
    results.push({ key: `place:${String(p.osm_type)}:${String(p.osm_id)}:${identity}`, label: p.name, sub: [kind, ...area].join(' · '), position });
  }
  const normalized = normalizeSearch(query);
  return results.sort((a, b) => Number(normalizeSearch(b.label) === normalized) - Number(normalizeSearch(a.label) === normalized)).slice(0, 6);
}
export async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceResult[]> {
  const response = await fetch(placesUrl(query), { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw Error('Plaatsen zoeken is tijdelijk niet beschikbaar. Probeer opnieuw.');
  return parsePlaces(await response.json(), query);
}

