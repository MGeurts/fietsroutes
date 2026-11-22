export interface RouteDraft { version: 1; name: string; stops: string[]; activeId: string | null; speed: number; tileLayer: string }
export const draftKey = 'fietsroutes:draft:v1';
export function validateDraft(value: unknown): RouteDraft {
  const d = value as Partial<RouteDraft> | null;
  if (!d || d.version !== 1 || typeof d.name !== 'string' || d.name.length > 120 || !Array.isArray(d.stops) || d.stops.length > 200 || !d.stops.every(s => typeof s === 'string' && /^\d{1,16}$/.test(s)) || !(d.activeId === null || typeof d.activeId === 'string') || ![15, 18, 20, 25].includes(d.speed!) || !['osm', 'network', 'cycle'].includes(d.tileLayer!)) throw Error('De werkroute kan niet worden gelezen.');
  return { version: 1, name: d.name, stops: [...d.stops], activeId: d.activeId, speed: d.speed!, tileLayer: d.tileLayer! };
}
export function readDraft(): RouteDraft | null { const raw = localStorage.getItem(draftKey); return raw ? validateDraft(JSON.parse(raw)) : null; }
export function writeDraft(value: RouteDraft) { const draft = validateDraft(value); if (draft.stops.length) localStorage.setItem(draftKey, JSON.stringify(draft)); else localStorage.removeItem(draftKey); }
export function readRecovery(): { draft: RouteDraft | null; error: string } { try { return { draft: readDraft(), error: '' }; } catch { return { draft: null, error: 'De vorige werkroute kon niet worden gelezen. Automatisch herstel is niet beschikbaar.' }; } }
