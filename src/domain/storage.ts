import { validatePauses, type PauseStop } from './pauseStops';
export interface SavedRoute { id: string; name: string; stops: string[]; speed?: number; pauses?: PauseStop[]; favorite: boolean; updatedAt: string }
const key = 'fietsroutes:library:v1';
export function validateRoute(value: unknown): SavedRoute {
  if (!value || typeof value !== 'object') throw Error('Ongeldig routebestand.');
  const r = value as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length > 100 || typeof r.name !== 'string' || r.name.length > 120 || !Array.isArray(r.stops) || r.stops.length < 2 || r.stops.length > 200 || !r.stops.every(s => typeof s === 'string' && /^\d{1,16}$/.test(s)) || typeof r.favorite !== 'boolean' || typeof r.updatedAt !== 'string') throw Error('Ongeldig routebestand.');
  if (r.speed !== undefined && ![15, 18, 20, 25].includes(r.speed as number)) throw Error('Ongeldig fietsprofiel.');
  const pauses = validatePauses(r.pauses);
  return { ...(pauses.length ? { pauses } : {}), id: r.id, name: r.name, stops: r.stops, speed: r.speed as number | undefined, favorite: r.favorite, updatedAt: r.updatedAt };
}
export function readLibrary(): SavedRoute[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw Error('De bibliotheek kan niet worden gelezen.');
  return value.map(validateRoute);
}
export function writeLibrary(routes: SavedRoute[]) { localStorage.setItem(key, JSON.stringify(routes.map(validateRoute))); }
export function parseBackup(text: string): SavedRoute[] {
  const value = JSON.parse(text);
  if (value.version !== 1 || !Array.isArray(value.routes) || value.routes.length > 1000) throw Error('Ongeldige bibliotheekbackup.');
  return value.routes.map(validateRoute);
}
export function mergeLibrary(current: SavedRoute[], imported: SavedRoute[]): SavedRoute[] {
  const result = [...current];
  for (const route of imported) {
    if (result.some(r => r.name === route.name && (r.speed ?? 20) === (route.speed ?? 20) && JSON.stringify(r.pauses ?? []) === JSON.stringify(route.pauses ?? []) && JSON.stringify(r.stops) === JSON.stringify(route.stops))) continue;
    result.push({ ...route, id: crypto.randomUUID() });
  }
  return result;
}
