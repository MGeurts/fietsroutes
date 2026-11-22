import { distance, lineLength, type Position } from './network';

export interface Approach { coordinates: Position[]; meters: number }
export function approachUrl(from: Position, to: Position): string {
  const params = new URLSearchParams({ lonlats: `${from.join(',')}|${to.join(',')}`, profile: 'trekking', alternativeidx: '0', format: 'geojson' });
  return `https://brouter.de/brouter?${params}`;
}
export function parseApproach(value: unknown, from: Position, to: Position): Approach {
  const data = value as { type?: string; features?: { geometry?: { type?: string; coordinates?: unknown } }[] } | null;
  const geometry = data?.type === 'FeatureCollection' && Array.isArray(data.features) ? data.features.find(f => f.geometry?.type === 'LineString')?.geometry : null;
  const points = geometry?.coordinates;
  if (!Array.isArray(points) || points.length < 2 || points.length > 200000 || !points.every(p => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number' && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) throw Error('De fietsroutingdienst gaf geen geldig traject terug.');
  const coordinates: Position[] = points.map(p => [p[0], p[1]]);
  if (distance(coordinates[0], from) > 100 || distance(coordinates.at(-1)!, to) > 100) throw Error('Geen fietsbare aansluiting binnen 100 meter van je locatie of het startpunt gevonden.');
  return { coordinates, meters: lineLength(coordinates) };
}
export async function fetchApproach(from: Position, to: Position, signal: AbortSignal): Promise<Approach> {
  const response = await fetch(approachUrl(from, to), { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw Error('De fietsaanrijroute is tijdelijk niet beschikbaar. Probeer opnieuw.');
  return parseApproach(await response.json(), from, to);
}
