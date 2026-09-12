import { KnooppuntNode, RouteConnectionAnalysis, RouteDisplaySegment, RouteGeometrySource, RouteLeg, ElevationPoint, PlannedRoute } from '../types';
import { ElevationProfileResult } from '../types';
import { findOfficialNetworkPath, getOfficialEdgeBetween } from './officialNetworkService';

// In-memory cache for resolved legs to make route rendering instantaneous
const legCache = new Map<string, RouteLeg>();
// A second click (or a route update) can request the same leg while its live
// geometry is still loading. Share that request instead of sending it to the
// external router a second time.
type PendingLeg = {
  controller: AbortController;
  consumers: number;
  promise: Promise<RouteLeg>;
};

const pendingLegs = new Map<string, PendingLeg>();
// These limits apply to the complete page, rather than to one selected route.
// Public bike routers are shared resources, so a long itinerary must not turn
// into an unbounded number of requests when another route is being replaced.
const MAX_CONCURRENT_ROUTE_LEGS = 3;
const MAX_CONCURRENT_LIVE_SEGMENTS = 3;
const ROUTE_LEG_LIMITER = createAsyncLimiter(MAX_CONCURRENT_ROUTE_LEGS);
const LIVE_ROUTER_LIMITER = createAsyncLimiter(MAX_CONCURRENT_LIVE_SEGMENTS);

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** A live route service was unavailable after the verified network and bike-router fallbacks. */
export class UnknownKnooppuntenConnectionError extends Error {
  constructor(fromRef: string, toRef: string) {
    super(`Geen officiële fietsknooppuntenverbinding gevonden tussen ${fromRef} en ${toRef}.`);
    this.name = 'UnknownKnooppuntenConnectionError';
  }
}

type LiveRouterResult = { coordinates: [number, number][]; distanceKm: number; source: string; geometrySource: RouteGeometrySource };

function abortError(): DOMException {
  return new DOMException('De berekening is geannuleerd.', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

type QueuedTask<T> = {
  signal?: AbortSignal;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  removeAbortListener: () => void;
};

function createAsyncLimiter(limit: number) {
  let active = 0;
  const queue: QueuedTask<unknown>[] = [];

  const drain = () => {
    while (active < limit && queue.length > 0) {
      const task = queue.shift()!;
      task.removeAbortListener();
      active += 1;
      void task.run()
        .then(task.resolve, task.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  };

  return <T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    throwIfAborted(signal);
    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask<T> = {
        signal,
        run,
        resolve,
        reject,
        removeAbortListener: () => undefined,
      };
      const onAbort = () => {
        const queueIndex = queue.indexOf(task as QueuedTask<unknown>);
        if (queueIndex < 0) return;
        queue.splice(queueIndex, 1);
        reject(abortError());
      };
      task.removeAbortListener = () => signal?.removeEventListener('abort', onAbort);
      signal?.addEventListener('abort', onAbort, { once: true });
      queue.push(task as QueuedTask<unknown>);
      drain();
    });
  };
}

function relationIdFromSource(source: string): number | undefined {
  const value = /(?:relation|relatie|rel)\s+(\d+)/i.exec(source)?.[1];
  return value ? Number(value) : undefined;
}

function analysisForConnection(
  fromNode: KnooppuntNode,
  toNode: KnooppuntNode,
  source: string,
  geometrySource: RouteGeometrySource,
): RouteConnectionAnalysis {
  return { fromNode, toNode, source, geometrySource, relationId: relationIdFromSource(source) };
}

function asLeafletCoordinates(rawCoordinates: unknown): [number, number][] | null {
  if (!Array.isArray(rawCoordinates)) return null;
  const coordinates = rawCoordinates
    .filter((coordinate): coordinate is [number, number] => Array.isArray(coordinate)
      && coordinate.length >= 2 && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]))
    .map(([lng, lat]) => [lat, lng] as [number, number]);
  return coordinates.length >= 2 ? coordinates : null;
}

async function fetchJson(url: string, timeoutMs: number, signal?: AbortSignal): Promise<unknown | null> {
  throwIfAborted(signal);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? response.json() : null;
  } catch (error) {
    if (signal?.aborted) throw abortError();
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

/**
 * Return real road geometry when an otherwise valid selected pair is missing from our
 * local node graph. This keeps the planner usable while making the provenance visible;
 * it never fabricates a straight or curved line.
 */
async function fetchLiveBicycleRoute(fromNode: KnooppuntNode, toNode: KnooppuntNode, signal?: AbortSignal): Promise<LiveRouterResult | null> {
  return LIVE_ROUTER_LIMITER(async () => {
    throwIfAborted(signal);
    const brouterUrl = `https://brouter.de/brouter?lonlats=${fromNode.lng},${fromNode.lat}|${toNode.lng},${toNode.lat}&profile=trekking&format=geojson`;
    const brouter = await fetchJson(brouterUrl, 8_000, signal) as {
      features?: { geometry?: { coordinates?: unknown }; properties?: { 'track-length'?: string | number } }[];
    } | null;
    const brouterFeature = brouter?.features?.[0];
    const brouterCoordinates = asLeafletCoordinates(brouterFeature?.geometry?.coordinates);
    if (brouterCoordinates) {
      const metres = Number(brouterFeature?.properties?.['track-length']);
      const distanceKm = Number.isFinite(metres) && metres > 0
        ? Math.round((metres / 1_000) * 100) / 100
        : Math.round(calculateHaversineDistanceKm(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng) * 120) / 100;
      return { coordinates: brouterCoordinates, distanceKm, source: 'BRouter fietsroutering', geometrySource: 'brouter' };
    }

    const osrmUrl = `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${fromNode.lng},${fromNode.lat};${toNode.lng},${toNode.lat}?overview=full&geometries=geojson`;
    const osrm = await fetchJson(osrmUrl, 8_000, signal) as {
      routes?: { distance?: number; geometry?: { coordinates?: unknown } }[];
    } | null;
    const osrmRoute = osrm?.routes?.[0];
    const osrmCoordinates = asLeafletCoordinates(osrmRoute?.geometry?.coordinates);
    if (!osrmCoordinates) return null;
    const metres = Number(osrmRoute.distance);
    if (!Number.isFinite(metres) || metres <= 0) return null;
    return { coordinates: osrmCoordinates, distanceKm: Math.round((metres / 1_000) * 100) / 100, source: 'OpenStreetMap fietsroutering', geometrySource: 'osm-router' };
  }, signal);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      throwIfAborted(signal);
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function calculateBicycleLeg(
  fromNode: KnooppuntNode,
  toNode: KnooppuntNode,
  signal?: AbortSignal,
): Promise<RouteLeg> {
  throwIfAborted(signal);
  const cacheKey = `${fromNode.id || fromNode.ref}_${toNode.id || toNode.ref}`;
  if (legCache.has(cacheKey)) {
    return legCache.get(cacheKey)!;
  }
  let pending = pendingLegs.get(cacheKey);
  if (!pending) {
    const controller = new AbortController();
    const calculation = ROUTE_LEG_LIMITER(
      () => calculateBicycleLegUncached(fromNode, toNode, controller.signal),
      controller.signal,
    )
      .then((leg) => {
        legCache.set(cacheKey, leg);
        return leg;
      })
      .finally(() => {
        pendingLegs.delete(cacheKey);
      });
    pending = { controller, consumers: 0, promise: calculation };
    pendingLegs.set(cacheKey, pending);
  }
  return subscribeToPendingLeg(pending, signal);
}

function subscribeToPendingLeg(pending: PendingLeg, signal?: AbortSignal): Promise<RouteLeg> {
  throwIfAborted(signal);
  pending.consumers += 1;
  let settled = false;
  let rejectSubscriber: (reason?: unknown) => void = () => undefined;
  const release = () => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener('abort', onAbort);
    pending.consumers -= 1;
    if (pending.consumers === 0) pending.controller.abort();
  };
  const onAbort = () => {
    release();
    rejectSubscriber(abortError());
  };

  return new Promise<RouteLeg>((resolve, reject) => {
    rejectSubscriber = reject;
    signal?.addEventListener('abort', onAbort, { once: true });
    pending.promise.then(
      (leg) => {
        release();
        resolve(leg);
      },
      (error) => {
        release();
        reject(error);
      },
    );
  });
}

export type RouteLegCalculation = {
  legs: RouteLeg[];
  error?: unknown;
};

/**
 * Resolve independent itinerary legs concurrently while retaining itinerary
 * order. The per-page limiter above keeps all route work bounded, including
 * callers outside this helper.
 */
export async function calculateBicycleRouteLegs(
  nodes: KnooppuntNode[],
  signal?: AbortSignal,
): Promise<RouteLegCalculation> {
  throwIfAborted(signal);
  const legCount = Math.max(0, nodes.length - 1);
  if (legCount === 0) return { legs: [] };

  const controllers = Array.from({ length: legCount }, () => new AbortController());
  const outcomes = new Array<{ leg?: RouteLeg; error?: unknown }>(legCount);
  let nextIndex = 0;
  let firstFailureIndex = Infinity;
  const abortLaterLegs = (failureIndex: number) => {
    for (let index = failureIndex + 1; index < controllers.length; index += 1) {
      controllers[index].abort();
    }
  };
  const parentAbort = () => controllers.forEach((controller) => controller.abort());
  signal?.addEventListener('abort', parentAbort, { once: true });

  const worker = async () => {
    while (nextIndex < legCount) {
      if (signal?.aborted || nextIndex > firstFailureIndex) return;
      const index = nextIndex;
      nextIndex += 1;
      try {
        outcomes[index] = { leg: await calculateBicycleLeg(nodes[index], nodes[index + 1], controllers[index].signal) };
      } catch (error) {
        if (signal?.aborted) return;
        // AbortError here means that an earlier itinerary leg already failed.
        // It is not the error that should be shown to the cyclist.
        if (isAbortError(error)) continue;
        outcomes[index] = { error };
        if (index < firstFailureIndex) {
          firstFailureIndex = index;
          abortLaterLegs(index);
        }
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_ROUTE_LEGS, legCount) }, worker));
  } finally {
    signal?.removeEventListener('abort', parentAbort);
  }
  throwIfAborted(signal);

  const failedIndex = outcomes.findIndex((outcome) => outcome?.error !== undefined);
  if (failedIndex < 0) return { legs: outcomes.map((outcome) => outcome.leg!) };
  return {
    legs: outcomes.slice(0, failedIndex).flatMap((outcome) => outcome?.leg ? [outcome.leg] : []),
    error: outcomes[failedIndex].error,
  };
}

async function calculateBicycleLegUncached(
  fromNode: KnooppuntNode,
  toNode: KnooppuntNode,
  signal?: AbortSignal,
): Promise<RouteLeg> {
  throwIfAborted(signal);
  const edge = getOfficialEdgeBetween(fromNode, toNode);
  if (edge) {
    const leg: RouteLeg = {
      fromNode,
      toNode,
      distanceKm: edge.distanceKm,
      coordinates: edge.coordinates,
      instructions: `Geverifieerde netwerkverbinding: ${edge.source}`,
      isVerified: true,
      displaySegments: [{ coordinates: edge.coordinates, distanceKm: edge.distanceKm, source: 'official', analysis: analysisForConnection(fromNode, toNode, edge.source, 'official') }],
    };
    return leg;
  }

  const path = findOfficialNetworkPath(fromNode, toNode);
  if (path) {
    const viaRefs = path.nodes.slice(1, -1).map((node) => node.ref);
    if (path.requiresLiveGeometry) {
      const segments = await mapWithConcurrency(path.edges, MAX_CONCURRENT_LIVE_SEGMENTS, async (edge, index) => {
        const segmentFrom = path.edgeNodes[index] || fromNode;
        const segmentTo = path.edgeNodes[index + 1] || toNode;
        if (edge.isJunctionAlias) return null;
        if (edge.coordinates.length >= 2) {
          return { coordinates: edge.coordinates, distanceKm: edge.distanceKm, source: 'official' as const, analysis: analysisForConnection(segmentFrom, segmentTo, edge.source, 'official') };
        }
        const liveRoute = await fetchLiveBicycleRoute(segmentFrom, segmentTo, signal);
        if (!liveRoute) throw new UnknownKnooppuntenConnectionError(segmentFrom.ref, segmentTo.ref);
        // The OSM Node-to-Node relation establishes this as an official connection.
        // Only its detailed road geometry comes from the live router.
        return { coordinates: liveRoute.coordinates, distanceKm: liveRoute.distanceKm, source: 'official-declared' as const, analysis: analysisForConnection(segmentFrom, segmentTo, edge.source, 'official-declared') };
      }, signal);
      const visibleSegments = segments.filter((segment): segment is NonNullable<typeof segment> => segment !== null);
      const leg: RouteLeg = {
        fromNode, toNode,
        distanceKm: Math.round(visibleSegments.reduce((total, segment) => total + segment.distanceKm, 0) * 100) / 100,
        coordinates: visibleSegments.flatMap((segment, index) => index === 0 ? segment.coordinates : segment.coordinates.slice(1)),
        instructions: viaRefs.length > 0
          ? `Knooppuntvolgorde uit OSM-relaties via ${viaRefs.join(' → ')}; ontbrekende weggeometrie is live berekend.`
          : 'Knooppuntverbinding uit een OSM-relatie; ontbrekende weggeometrie is live berekend.',
        isVerified: false,
        displaySegments: visibleSegments,
      };
      return leg;
    }
    const leg: RouteLeg = {
      fromNode,
      toNode,
      distanceKm: Math.round(path.edges.reduce((total, segment) => total + segment.distanceKm, 0) * 100) / 100,
      coordinates: path.edges.flatMap((segment, index) => index === 0 ? segment.coordinates : segment.coordinates.slice(1)),
      instructions: viaRefs.length > 0
        ? `Geverifieerde knooppuntenroute via ${viaRefs.join(' → ')}.`
        : 'Geverifieerde knooppuntenroute via officiële trajectsegmenten.',
      isVerified: true,
      displaySegments: path.edges
        .map((edge, index) => ({ edge, index }))
        .filter(({ edge }) => !edge.isJunctionAlias)
        .map(({ edge, index }) => ({
          coordinates: edge.coordinates,
          distanceKm: edge.distanceKm,
          source: 'official' as const,
          analysis: analysisForConnection(path.edgeNodes[index] || fromNode, path.edgeNodes[index + 1] || toNode, edge.source, 'official'),
        })),
    };
    return leg;
  }

  const liveRoute = await fetchLiveBicycleRoute(fromNode, toNode, signal);
  if (!liveRoute) throw new UnknownKnooppuntenConnectionError(fromNode.ref, toNode.ref);
  const leg: RouteLeg = {
    fromNode, toNode, distanceKm: liveRoute.distanceKm, coordinates: liveRoute.coordinates,
    instructions: `${liveRoute.source}; knooppuntverbinding niet geverifieerd.`,
    isVerified: false,
    displaySegments: [{ coordinates: liveRoute.coordinates, distanceKm: liveRoute.distanceKm, source: liveRoute.geometrySource, analysis: analysisForConnection(fromNode, toNode, liveRoute.source, liveRoute.geometrySource) }],
  };
  return leg;
}

const MAX_ELEVATION_SAMPLES = 100;
const ELEVATION_SAMPLE_SPACING_KM = 0.15;

type ElevationSample = { latitude: number; longitude: number; distanceKm: number };

function sampleRouteForElevation(coordinates: [number, number][]): ElevationSample[] {
  if (coordinates.length < 2) return [];

  const cumulativeDistances = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    const [previousLat, previousLng] = coordinates[index - 1];
    const [currentLat, currentLng] = coordinates[index];
    cumulativeDistances.push(
      cumulativeDistances[index - 1]
      + calculateHaversineDistanceKm(previousLat, previousLng, currentLat, currentLng),
    );
  }

  const routeLengthKm = cumulativeDistances[cumulativeDistances.length - 1];
  if (!Number.isFinite(routeLengthKm) || routeLengthKm <= 0) return [];

  const sampleCount = Math.min(
    MAX_ELEVATION_SAMPLES,
    Math.max(2, Math.ceil(routeLengthKm / ELEVATION_SAMPLE_SPACING_KM) + 1),
  );

  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const targetDistanceKm = (routeLengthKm * sampleIndex) / (sampleCount - 1);
    let coordinateIndex = 1;
    while (coordinateIndex < cumulativeDistances.length - 1 && cumulativeDistances[coordinateIndex] < targetDistanceKm) {
      coordinateIndex += 1;
    }

    const segmentStartDistanceKm = cumulativeDistances[coordinateIndex - 1];
    const segmentLengthKm = cumulativeDistances[coordinateIndex] - segmentStartDistanceKm;
    const progress = segmentLengthKm > 0
      ? (targetDistanceKm - segmentStartDistanceKm) / segmentLengthKm
      : 0;
    const [startLat, startLng] = coordinates[coordinateIndex - 1];
    const [endLat, endLng] = coordinates[coordinateIndex];

    return {
      latitude: startLat + (endLat - startLat) * progress,
      longitude: startLng + (endLng - startLng) * progress,
      distanceKm: targetDistanceKm,
    };
  });
}

/**
 * Retrieve a terrain-based height profile for the rendered route. The public
 * Open-Meteo endpoint accepts at most 100 positions per request, so long routes
 * are sampled at even distances. No height is shown when the service is offline.
 */
export async function fetchElevationProfile(
  coordinates: [number, number][],
  totalDistanceKm: number,
  signal?: AbortSignal,
): Promise<ElevationProfileResult> {
  throwIfAborted(signal);
  const samples = sampleRouteForElevation(coordinates);
  if (samples.length < 2) return { points: [], totalAscent: 0, available: false };

  const params = new URLSearchParams({
    latitude: samples.map((sample) => sample.latitude.toFixed(6)).join(','),
    longitude: samples.map((sample) => sample.longitude.toFixed(6)).join(','),
  });
  const response = await fetchJson(`https://api.open-meteo.com/v1/elevation?${params}`, 10_000, signal) as {
    elevation?: unknown;
  } | null;
  const elevations = response?.elevation;
  if (!Array.isArray(elevations) || elevations.length !== samples.length || elevations.some((value) => !Number.isFinite(value))) {
    return { points: [], totalAscent: 0, available: false };
  }

  const points = samples.map((sample, index) => ({
    distance: Math.round((sample.distanceKm / samples[samples.length - 1].distanceKm) * totalDistanceKm * 100) / 100,
    elevation: Math.round(Number(elevations[index])),
  }));
  const totalAscent = Math.round(points.reduce((ascent, point, index) => (
    index === 0 ? ascent : ascent + Math.max(0, point.elevation - points[index - 1].elevation)
  ), 0));

  return { points, totalAscent, available: true };
}

/**
 * Generate standard GPX 1.1 XML string ready for Garmin, Wahoo, Komoot, OsmAnd, etc.
 */
export function generateGpxString(route: PlannedRoute): string {
  const dateStr = new Date().toISOString();
  
  // Format waypoints for each knooppunt
  const waypointsXml = route.nodes.map((node, index) => `
  <wpt lat="${node.lat.toFixed(6)}" lon="${node.lng.toFixed(6)}">
    <name>KP ${node.ref}${node.name ? ` - ${escapeXml(node.name)}` : ''}</name>
    <desc>Fietsknooppunt ${node.ref} (${index + 1}/${route.nodes.length})${node.highlight ? ` - ${escapeXml(node.highlight)}` : ''}</desc>
    <sym>Cycling</sym>
    <type>Fietsknooppunt</type>
  </wpt>`).join('\n');

  // Format track points
  const trackPointsXml = route.fullCoordinates.map(([lat, lng]) => `
      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">
        <time>${dateStr}</time>
      </trkpt>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Fietsroute Planner NL &amp; BE - OpenStreetMap (MGeurts/fietsroute)"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <desc>Fietsknooppuntenroute: ${route.nodes.map(n => n.ref).join(' - ')} (${route.totalDistanceKm} km)</desc>
    <time>${dateStr}</time>
    <keywords>fietsen, knooppunten, nederland, belgie, openstreetmap, gpx</keywords>
  </metadata>
${waypointsXml}
  <trk>
    <name>${escapeXml(route.name)}</name>
    <type>Cycling</type>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Trigger browser file download of GPX
 */
export function downloadGpxFile(route: PlannedRoute) {
  const gpxContent = generateGpxString(route);
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const sanitizedName = route.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  link.href = url;
  link.download = `fietsroute_${sanitizedName || 'knooppunten'}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse an uploaded GPX file to extract coordinates and name
 */
export function parseGpxFile(xmlText: string): {
  name: string;
  coordinates: [number, number][];
  waypoints: { lat: number; lng: number; name: string }[];
} {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const nameEl = xmlDoc.querySelector('metadata > name') || xmlDoc.querySelector('trk > name');
  const name = nameEl?.textContent || 'Geïmporteerde GPX route';

  const coordinates: [number, number][] = [];
  const trkpts = xmlDoc.querySelectorAll('trkpt');
  trkpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') || '0');
    const lon = parseFloat(pt.getAttribute('lon') || '0');
    if (lat && lon) {
      coordinates.push([lat, lon]);
    }
  });

  const waypoints: { lat: number; lng: number; name: string }[] = [];
  const wpts = xmlDoc.querySelectorAll('wpt');
  wpts.forEach((wpt) => {
    const lat = parseFloat(wpt.getAttribute('lat') || '0');
    const lon = parseFloat(wpt.getAttribute('lon') || '0');
    const wptName = wpt.querySelector('name')?.textContent || 'Punt';
    if (lat && lon) {
      waypoints.push({ lat, lng: lon, name: wptName });
    }
  });

  return { name, coordinates, waypoints };
}
