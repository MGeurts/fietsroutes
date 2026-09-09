import { KnooppuntNode, RouteConnectionAnalysis, RouteDisplaySegment, RouteGeometrySource, RouteLeg, ElevationPoint, PlannedRoute } from '../types';
import { ElevationProfileResult } from '../types';
import { findOfficialNetworkPath, getOfficialEdgeBetween } from './officialNetworkService';

// In-memory cache for resolved legs to make route rendering instantaneous
const legCache = new Map<string, RouteLeg>();

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

function relationIdFromSource(source: string): number | undefined {
  const value = /(?:relation|relatie|rel)\s+(\d+)/i.exec(source)?.[1];
  return value ? Number(value) : undefined;
}

function analysisForConnection(fromNode: KnooppuntNode, toNode: KnooppuntNode, source: string): RouteConnectionAnalysis {
  return { fromNode, toNode, source, relationId: relationIdFromSource(source) };
}

function asLeafletCoordinates(rawCoordinates: unknown): [number, number][] | null {
  if (!Array.isArray(rawCoordinates)) return null;
  const coordinates = rawCoordinates
    .filter((coordinate): coordinate is [number, number] => Array.isArray(coordinate)
      && coordinate.length >= 2 && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]))
    .map(([lng, lat]) => [lat, lng] as [number, number]);
  return coordinates.length >= 2 ? coordinates : null;
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Return real road geometry when an otherwise valid selected pair is missing from our
 * local node graph. This keeps the planner usable while making the provenance visible;
 * it never fabricates a straight or curved line.
 */
async function fetchLiveBicycleRoute(fromNode: KnooppuntNode, toNode: KnooppuntNode): Promise<LiveRouterResult | null> {
  const brouterUrl = `https://brouter.de/brouter?lonlats=${fromNode.lng},${fromNode.lat}|${toNode.lng},${toNode.lat}&profile=trekking&format=geojson`;
  const brouter = await fetchJson(brouterUrl, 8_000) as {
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
  const osrm = await fetchJson(osrmUrl, 8_000) as {
    routes?: { distance?: number; geometry?: { coordinates?: unknown } }[];
  } | null;
  const osrmRoute = osrm?.routes?.[0];
  const osrmCoordinates = asLeafletCoordinates(osrmRoute?.geometry?.coordinates);
  if (!osrmCoordinates) return null;
  const metres = Number(osrmRoute.distance);
  if (!Number.isFinite(metres) || metres <= 0) return null;
  return { coordinates: osrmCoordinates, distanceKm: Math.round((metres / 1_000) * 100) / 100, source: 'OpenStreetMap fietsroutering', geometrySource: 'osm-router' };
}

export async function calculateBicycleLeg(
  fromNode: KnooppuntNode,
  toNode: KnooppuntNode
): Promise<RouteLeg> {
  const cacheKey = `${fromNode.id || fromNode.ref}_${toNode.id || toNode.ref}`;
  if (legCache.has(cacheKey)) {
    return legCache.get(cacheKey)!;
  }

  const edge = getOfficialEdgeBetween(fromNode, toNode);
  if (edge) {
    const leg: RouteLeg = {
      fromNode,
      toNode,
      distanceKm: edge.distanceKm,
      coordinates: edge.coordinates,
      instructions: `Geverifieerde corridor: ${edge.source}`,
      isVerified: true,
      displaySegments: [{ coordinates: edge.coordinates, source: 'official', analysis: analysisForConnection(fromNode, toNode, edge.source) }],
    };
    legCache.set(cacheKey, leg);
    return leg;
  }

  const path = findOfficialNetworkPath(fromNode, toNode);
  if (path) {
    const viaRefs = path.nodes.slice(1, -1).map((node) => node.ref);
    if (path.requiresLiveGeometry) {
      const segments: (RouteDisplaySegment & { distanceKm: number })[] = [];
      for (let index = 0; index < path.edges.length; index += 1) {
        const edge = path.edges[index];
        const segmentFrom = path.nodes[index] || fromNode;
        const segmentTo = path.nodes[index + 1] || toNode;
        if (edge.coordinates.length >= 2) {
          segments.push({ coordinates: edge.coordinates, distanceKm: edge.distanceKm, source: 'official', analysis: analysisForConnection(segmentFrom, segmentTo, edge.source) });
          continue;
        }
        const liveRoute = await fetchLiveBicycleRoute(segmentFrom, segmentTo);
        if (!liveRoute) throw new UnknownKnooppuntenConnectionError(segmentFrom.ref, segmentTo.ref);
        // The OSM Node-to-Node relation establishes this as an official connection.
        // Only its detailed road geometry comes from the live router.
        segments.push({ coordinates: liveRoute.coordinates, distanceKm: liveRoute.distanceKm, source: 'official-declared', analysis: analysisForConnection(segmentFrom, segmentTo, edge.source) });
      }
      const leg: RouteLeg = {
        fromNode, toNode,
        distanceKm: Math.round(segments.reduce((total, segment) => total + segment.distanceKm, 0) * 100) / 100,
        coordinates: segments.flatMap((segment, index) => index === 0 ? segment.coordinates : segment.coordinates.slice(1)),
        instructions: viaRefs.length > 0
          ? `Knooppuntvolgorde uit OSM-relaties via ${viaRefs.join(' → ')}; ontbrekende weggeometrie is live berekend.`
          : 'Knooppuntverbinding uit een OSM-relatie; ontbrekende weggeometrie is live berekend.',
        isVerified: false,
        displaySegments: segments,
      };
      legCache.set(cacheKey, leg);
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
      displaySegments: path.edges.map((edge, index) => ({
        coordinates: edge.coordinates,
        source: 'official',
        analysis: analysisForConnection(path.nodes[index] || fromNode, path.nodes[index + 1] || toNode, edge.source),
      })),
    };
    legCache.set(cacheKey, leg);
    return leg;
  }

  const liveRoute = await fetchLiveBicycleRoute(fromNode, toNode);
  if (!liveRoute) throw new UnknownKnooppuntenConnectionError(fromNode.ref, toNode.ref);
  const leg: RouteLeg = {
    fromNode, toNode, distanceKm: liveRoute.distanceKm, coordinates: liveRoute.coordinates,
    instructions: `${liveRoute.source}; knooppuntverbinding niet geverifieerd.`,
    isVerified: false,
    displaySegments: [{ coordinates: liveRoute.coordinates, source: liveRoute.geometrySource, analysis: analysisForConnection(fromNode, toNode, liveRoute.source) }],
  };
  legCache.set(cacheKey, leg);
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
): Promise<ElevationProfileResult> {
  const samples = sampleRouteForElevation(coordinates);
  if (samples.length < 2) return { points: [], totalAscent: 0, available: false };

  const params = new URLSearchParams({
    latitude: samples.map((sample) => sample.latitude.toFixed(6)).join(','),
    longitude: samples.map((sample) => sample.longitude.toFixed(6)).join(','),
  });
  const response = await fetchJson(`https://api.open-meteo.com/v1/elevation?${params}`, 10_000) as {
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
