import { ElevationPoint, KnooppuntNode, PlannedRoute, RouteLeg } from '../types';

const LIBRARY_KEY = 'fietsroute-route-library-v1';
const DRAFT_KEY = 'fietsroute-active-route-v1';
const SHARE_PARAM = 'route';
const SCHEMA_VERSION = 1;

export interface SavedRoute extends PlannedRoute {
  schemaVersion: 1;
  savedAt: string;
}

type SharedRoutePayload = {
  v: 1;
  n: string;
  p: KnooppuntNode[];
};

function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
}

function isNode(value: unknown): value is KnooppuntNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as Partial<KnooppuntNode>;
  return (typeof node.id === 'string' || typeof node.id === 'number')
    && typeof node.ref === 'string'
    && Number.isFinite(node.lat)
    && Number.isFinite(node.lng);
}

function isLeg(value: unknown): value is RouteLeg {
  if (!value || typeof value !== 'object') return false;
  const leg = value as Partial<RouteLeg>;
  return isNode(leg.fromNode)
    && isNode(leg.toNode)
    && Number.isFinite(leg.distanceKm)
    && Array.isArray(leg.coordinates)
    && leg.coordinates.every(isCoordinate);
}

function isElevationPoint(value: unknown): value is ElevationPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<ElevationPoint>;
  return Number.isFinite(point.distance) && Number.isFinite(point.elevation);
}

function isSavedRoute(value: unknown): value is SavedRoute {
  if (!value || typeof value !== 'object') return false;
  const route = value as Partial<SavedRoute>;
  return route.schemaVersion === SCHEMA_VERSION
    && typeof route.id === 'string'
    && typeof route.name === 'string'
    && typeof route.createdAt === 'string'
    && typeof route.savedAt === 'string'
    && Array.isArray(route.nodes) && route.nodes.every(isNode)
    && Array.isArray(route.legs) && route.legs.every(isLeg)
    && Array.isArray(route.fullCoordinates) && route.fullCoordinates.every(isCoordinate)
    && Number.isFinite(route.totalDistanceKm)
    && Number.isFinite(route.elevationGainM)
    && Array.isArray(route.elevationPoints) && route.elevationPoints.every(isElevationPoint);
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
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getSavedRoutes(): SavedRoute[] {
  const stored = readJson(LIBRARY_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isSavedRoute).sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export function saveRoute(route: PlannedRoute): SavedRoute | null {
  const saved: SavedRoute = { ...route, schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString() };
  const existing = getSavedRoutes().filter((entry) => entry.id !== saved.id);
  return writeJson(LIBRARY_KEY, [saved, ...existing]) ? saved : null;
}

export function deleteSavedRoute(routeId: string): boolean {
  return writeJson(LIBRARY_KEY, getSavedRoutes().filter((entry) => entry.id !== routeId));
}

/** Persist the active itinerary including already resolved geometry and terrain. */
export function saveRouteDraft(route: PlannedRoute): boolean {
  return writeJson(DRAFT_KEY, { ...route, schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString() });
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
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function createShareUrl(routeName: string, nodes: KnooppuntNode[], baseUrl = globalThis.location?.href): string | null {
  if (!baseUrl || nodes.length < 2 || !nodes.every(isNode)) return null;
  const payload: SharedRoutePayload = { v: SCHEMA_VERSION, n: routeName.trim().slice(0, 120) || 'Gedeelde fietsroute', p: nodes };
  const url = new URL(baseUrl);
  url.searchParams.set(SHARE_PARAM, toBase64Url(JSON.stringify(payload)));
  return url.toString();
}

export function readSharedRoute(search = globalThis.location?.search): { name: string; nodes: KnooppuntNode[] } | null {
  if (!search) return null;
  const encoded = new URLSearchParams(search).get(SHARE_PARAM);
  if (!encoded || encoded.length > 12_000) return null;
  const decoded = fromBase64Url(encoded);
  if (!decoded) return null;
  try {
    const payload = JSON.parse(decoded) as Partial<SharedRoutePayload>;
    if (payload.v !== SCHEMA_VERSION || typeof payload.n !== 'string' || !Array.isArray(payload.p) || payload.p.length < 2 || payload.p.length > 100 || !payload.p.every(isNode)) return null;
    return { name: payload.n.slice(0, 120), nodes: payload.p };
  } catch {
    return null;
  }
}
