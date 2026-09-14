import { ElevationPoint, KnooppuntNode, PlannedRoute, RouteConnectionAnalysis, RouteDisplaySegment, RouteLeg } from '../types';

const LIBRARY_KEY = 'fietsroute-route-library-v1';
const DRAFT_KEY = 'fietsroute-active-route-v1';
const SHARE_PARAM = 'route';
const SCHEMA_VERSION = 1;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const MAX_ROUTES = 1_000;
const MAX_COORDINATES = 500_000;
const MAX_SHARE_NODES = 100;
const MAX_SHARE_PAYLOAD_LENGTH = 12_000;

export interface SavedRoute extends PlannedRoute {
  schemaVersion: 1;
  savedAt: string;
  favorite?: boolean;
}

type CompactSharedNode = [string | number, string, number, number];
type SharedRoutePayload = { v: 2; n: string; p: CompactSharedNode[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown, maxLength = 1_000): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDistance(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100_000;
}

function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2
    && isFiniteNumber(value[0]) && Math.abs(value[0]) <= 90
    && isFiniteNumber(value[1]) && Math.abs(value[1]) <= 180;
}

function isCoordinateList(value: unknown): value is [number, number][] {
  return Array.isArray(value) && value.length <= MAX_COORDINATES && value.every(isCoordinate);
}

function isNode(value: unknown): value is KnooppuntNode {
  if (!isRecord(value)) return false;
  return ((isText(value.id) && value.id.length > 0) || isFiniteNumber(value.id))
    && isText(value.ref, 100) && value.ref.length > 0
    && isCoordinate([value.lat, value.lng])
    && ['name', 'municipality', 'region', 'highlight'].every((key) => value[key] === undefined || isText(value[key]));
}

function isGeometrySource(value: unknown): boolean {
  return value === 'official' || value === 'official-declared' || value === 'brouter' || value === 'osm-router';
}

function isAnalysis(value: unknown): value is RouteConnectionAnalysis {
  return isRecord(value) && isNode(value.fromNode) && isNode(value.toNode)
    && isText(value.source)
    && (value.geometrySource === undefined || isGeometrySource(value.geometrySource))
    && (value.relationId === undefined || (isFiniteNumber(value.relationId) && Number.isSafeInteger(value.relationId) && value.relationId >= 0));
}

function isDisplaySegment(value: unknown): value is RouteDisplaySegment {
  return isRecord(value) && isCoordinateList(value.coordinates) && isGeometrySource(value.source)
    && (value.distanceKm === undefined || isDistance(value.distanceKm))
    && (value.analysis === undefined || isAnalysis(value.analysis));
}

function isLeg(value: unknown): value is RouteLeg {
  return isRecord(value) && isNode(value.fromNode) && isNode(value.toNode)
    && isDistance(value.distanceKm) && isCoordinateList(value.coordinates)
    && (value.instructions === undefined || isText(value.instructions, 100_000))
    && (value.isVerified === undefined || typeof value.isVerified === 'boolean')
    && (value.displaySegments === undefined || (Array.isArray(value.displaySegments)
      && value.displaySegments.length <= 10_000 && value.displaySegments.every(isDisplaySegment)));
}

function isElevationPoint(value: unknown): value is ElevationPoint {
  return isRecord(value) && isDistance(value.distance)
    && isFiniteNumber(value.elevation) && value.elevation >= -15_000 && value.elevation <= 100_000;
}

function isTimestamp(value: unknown): value is string {
  return isText(value, 100) && Number.isFinite(Date.parse(value));
}

function isSavedRoute(value: unknown): value is SavedRoute {
  return isRecord(value) && value.schemaVersion === SCHEMA_VERSION
    && isText(value.id) && value.id.length > 0 && isText(value.name)
    && isTimestamp(value.createdAt) && isTimestamp(value.savedAt)
    && (value.favorite === undefined || typeof value.favorite === 'boolean')
    && Array.isArray(value.nodes) && value.nodes.length <= 1_000 && value.nodes.every(isNode)
    && Array.isArray(value.legs) && value.legs.length <= 1_000 && value.legs.every(isLeg)
    && isCoordinateList(value.fullCoordinates) && isDistance(value.totalDistanceKm)
    && isFiniteNumber(value.elevationGainM) && value.elevationGainM >= 0
    && Array.isArray(value.elevationPoints) && value.elevationPoints.length <= MAX_COORDINATES && value.elevationPoints.every(isElevationPoint);
}

function readJson(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Never replace unreadable/invalid existing entries with a filtered subset. */
function readLibraryForMutation(): SavedRoute[] | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const raw = storage.getItem(LIBRARY_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length <= MAX_ROUTES && parsed.every(isSavedRoute) ? parsed : null;
  } catch {
    return null;
  }
}

export function getSavedRoutes(): SavedRoute[] {
  const stored = readJson(LIBRARY_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isSavedRoute).sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export function saveRoute(route: PlannedRoute): SavedRoute | null {
  const existing = readLibraryForMutation();
  if (!existing) return null;
  const previous = existing.find((entry) => entry.id === route.id);
  const saved: SavedRoute = {
    ...route, schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(),
    createdAt: previous?.createdAt ?? route.createdAt,
    ...(previous?.favorite !== undefined ? { favorite: previous.favorite } : {}),
  };
  const next = [saved, ...existing.filter((entry) => entry.id !== saved.id)];
  return isSavedRoute(saved) && next.length <= MAX_ROUTES && writeJson(LIBRARY_KEY, next) ? saved : null;
}

export function deleteSavedRoute(routeId: string): boolean {
  const existing = readLibraryForMutation();
  return existing !== null && writeJson(LIBRARY_KEY, existing.filter((entry) => entry.id !== routeId));
}

export function setSavedRouteFavorite(routeId: string, favorite: boolean): boolean {
  const existing = readLibraryForMutation();
  if (!existing || !existing.some((entry) => entry.id === routeId)) return false;
  return writeJson(LIBRARY_KEY, existing.map((entry) => entry.id === routeId ? { ...entry, favorite } : entry));
}

export function exportRouteLibrary(): string {
  const routes = readLibraryForMutation();
  if (!routes) throw new Error('De routebibliotheek kan niet veilig worden gelezen. Controleer de browseropslag.');
  return JSON.stringify({ format: 'fietsroute-library', version: 1, exportedAt: new Date().toISOString(), routes }, null, 2);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function routeContent(route: SavedRoute): string {
  // Save dates and favorites are local metadata, not a different itinerary.
  const { id: _id, createdAt: _createdAt, savedAt: _savedAt, favorite: _favorite, ...content } = route;
  return canonicalJson(content);
}

function contentHash(content: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < content.length; index += 1) hash = Math.imul(hash ^ content.charCodeAt(index), 16_777_619);
  return (hash >>> 0).toString(36);
}

export function importRouteLibrary(json: string): { imported: number; skipped: number } {
  if (json.length > MAX_BACKUP_BYTES || new TextEncoder().encode(json).length > MAX_BACKUP_BYTES) {
    throw new Error('Dit bibliotheekbestand is te groot (maximaal 25 MB).');
  }
  let backup: unknown;
  try {
    backup = JSON.parse(json);
  } catch {
    throw new Error('Dit is geen geldig JSON-bibliotheekbestand.');
  }
  if (!isRecord(backup) || backup.format !== 'fietsroute-library' || backup.version !== 1
    || !isTimestamp(backup.exportedAt) || !Array.isArray(backup.routes)
    || backup.routes.length > MAX_ROUTES || !backup.routes.every(isSavedRoute)) {
    throw new Error('Dit bestand bevat geen ondersteunde, volledige FietsRoute-bibliotheek. Er is niets geïmporteerd.');
  }
  const existing = readLibraryForMutation();
  if (!existing) throw new Error('De bestaande bibliotheek kan niet veilig worden gelezen. Er is niets gewijzigd.');
  const merged = new Map(existing.map((route) => [route.id, route]));
  const fingerprints = new Map<string, string>();
  const fingerprint = (route: SavedRoute) => {
    let content = fingerprints.get(route.id);
    if (content === undefined) {
      content = routeContent(route);
      fingerprints.set(route.id, content);
    }
    return content;
  };
  let imported = 0;
  let skipped = 0;
  for (const route of backup.routes as SavedRoute[]) {
    const content = routeContent(route);
    let id = route.id;
    let collision = merged.get(id);
    if (collision && fingerprint(collision) !== content) {
      const baseId = `${route.id.slice(0, 80)}-import-${contentHash(content)}`;
      id = baseId;
      let suffix = 2;
      while ((collision = merged.get(id)) && fingerprint(collision) !== content) id = `${baseId}-${suffix++}`;
    }
    collision = merged.get(id);
    if (collision) {
      skipped += 1;
      continue;
    }
    merged.set(id, { ...route, id });
    fingerprints.set(id, content);
    imported += 1;
  }
  if (merged.size > MAX_ROUTES) throw new Error('De bibliotheek kan maximaal 1000 routes bevatten. Er is niets geïmporteerd.');
  // localStorage.setItem is atomic: failed quota writes leave the old library intact.
  if (imported > 0 && !writeJson(LIBRARY_KEY, [...merged.values()])) {
    throw new Error('Importeren is niet gelukt. De browseropslag is vol of niet beschikbaar. De bestaande bibliotheek is behouden.');
  }
  return { imported, skipped };
}

/** Persist the active itinerary including already resolved geometry and terrain. */
export function saveRouteDraft(route: PlannedRoute): boolean {
  const draft = { ...route, schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString() };
  return isSavedRoute(draft) && writeJson(DRAFT_KEY, draft);
}

export function getRouteDraft(): SavedRoute | null {
  const draft = readJson(DRAFT_KEY);
  return isSavedRoute(draft) ? draft : null;
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(base64);
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function createShareUrl(routeName: string, nodes: KnooppuntNode[], baseUrl = globalThis.location?.href): string | null {
  if (!baseUrl || nodes.length < 2 || nodes.length > MAX_SHARE_NODES || !nodes.every(isNode)) return null;
  const payload: SharedRoutePayload = {
    v: 2, n: routeName.trim().slice(0, 120) || 'Gedeelde fietsroute',
    p: nodes.map((node) => [node.id, node.ref, node.lat, node.lng]),
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  if (encoded.length > MAX_SHARE_PAYLOAD_LENGTH) return null;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.searchParams.set(SHARE_PARAM, encoded);
    return url.toString();
  } catch {
    return null;
  }
}

export function readSharedRoute(search = globalThis.location?.search): { name: string; nodes: KnooppuntNode[] } | null {
  if (!search) return null;
  const encoded = new URLSearchParams(search).get(SHARE_PARAM);
  if (!encoded || encoded.length > MAX_SHARE_PAYLOAD_LENGTH) return null;
  const decoded = fromBase64Url(encoded);
  if (!decoded) return null;
  try {
    const payload: unknown = JSON.parse(decoded);
    if (!isRecord(payload) || !isText(payload.n) || !Array.isArray(payload.p)
      || payload.p.length < 2 || payload.p.length > MAX_SHARE_NODES) return null;
    let nodes: KnooppuntNode[];
    if (payload.v === 1 && payload.p.every(isNode)) {
      nodes = payload.p;
    } else if (payload.v === 2) {
      if (!payload.p.every((point) => Array.isArray(point) && point.length === 4)) return null;
      const expanded: unknown[] = payload.p.map(([id, ref, lat, lng]) => ({ id, ref, lat, lng }));
      if (!expanded.every(isNode)) return null;
      nodes = expanded;
    } else {
      return null;
    }
    return { name: payload.n.slice(0, 120), nodes };
  } catch {
    return null;
  }
}
