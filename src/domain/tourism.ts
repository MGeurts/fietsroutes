export const tourismCategories = {
  stay: { label: 'Overnachten', symbol: '🛏' },
  food: { label: 'Eten en drinken', symbol: '🍴' },
  sight: { label: 'Bezienswaardigheden', symbol: '🏛' },
  service: { label: 'Onderweg', symbol: '🚲' },
} as const;
export type TourismCategory = keyof typeof tourismCategories;
export interface TourismPlace {
  id: string; position: [number, number]; category: TourismCategory; name: string;
  kind: string; address?: string; website?: string; openingHours?: string;
}
export interface TourismSnapshot { version: 1; fetchedAt: string; places: TourismPlace[] }
const kinds: Record<string, [TourismCategory, string]> = {
  guest_house: ['stay', 'B&B / gastenverblijf'], hotel: ['stay', 'Hotel'], camp_site: ['stay', 'Camping'], hostel: ['stay', 'Hostel'],
  restaurant: ['food', 'Restaurant'], cafe: ['food', 'Café'], pub: ['food', 'Café / bar'], bar: ['food', 'Bar'], ice_cream: ['food', 'IJssalon'],
  museum: ['sight', 'Museum'], attraction: ['sight', 'Attractie'], viewpoint: ['sight', 'Uitkijkpunt'],
  drinking_water: ['service', 'Drinkwater'], toilets: ['service', 'Openbaar toilet'], bicycle_repair_station: ['service', 'Fietsherstelpunt'],
};
export function safeWebsite(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol)) return url.href; } catch { /* Ignore invalid URLs. */ }
}
export function normalizeTourism(elements: unknown[]): TourismPlace[] {
  const places = new Map<string, TourismPlace>();
  for (const raw of elements) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as { type?: string; id?: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
    const tags = e.tags ?? {}, location = e.center ?? e;
    const kind = kinds[tags.tourism] ?? kinds[tags.amenity];
    if (!kind || !['node', 'way', 'relation'].includes(e.type!) || !Number.isSafeInteger(e.id) || !Number.isFinite(location.lat) || !Number.isFinite(location.lon) || Math.abs(location.lat!) > 90 || Math.abs(location.lon!) > 180) continue;
    const id = `${e.type}/${e.id}`;
    const address = [[tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '), [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const name = [tags.name, tags['name:nl'], tags.official_name, tags.loc_name].find(value => value?.trim())?.trim() || kind[1];
    places.set(id, { id, position: [location.lon!, location.lat!], category: kind[0], kind: kind[1], name, address: address || undefined, website: safeWebsite(tags.website || tags['contact:website']), openingHours: tags.opening_hours });
  }
  return [...places.values()];
}
export function parseTourismSnapshot(value: unknown): TourismSnapshot {
  const s = value as TourismSnapshot;
  if (!s || s.version !== 1 || typeof s.fetchedAt !== 'string' || !Array.isArray(s.places) || s.places.length > 100000) throw Error('Ongeldige toerismegegevens.');
  for (const p of s.places) {
    if (!p || !/^(node|way|relation)\/\d+$/.test(p.id) || !Object.hasOwn(tourismCategories, p.category) || typeof p.name !== 'string' || typeof p.kind !== 'string' || !Array.isArray(p.position) || p.position.length !== 2 || !p.position.every(Number.isFinite) || Math.abs(p.position[0]) > 180 || Math.abs(p.position[1]) > 90 || [p.address, p.website, p.openingHours].some(v => v !== undefined && typeof v !== 'string')) throw Error('Ongeldige toeristische plaats.');
  }
  return s;
}
