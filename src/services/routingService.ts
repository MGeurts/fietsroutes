import { KnooppuntNode, RouteLeg, ElevationPoint, PlannedRoute } from '../types';
import { ElevationProfileResult } from '../types';
import { getOfficialEdgeBetween } from './officialNetworkService';

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

/**
 * Resolve a leg that is known to exist in the verified cycle-junction network.
 *
 * This deliberately has no BRouter, OSRM, straight-line, or synthetic fallback: a general
 * bicycle route is not evidence of a signed junction-network connection.
 */
export class UnknownKnooppuntenConnectionError extends Error {
  constructor(fromRef: string, toRef: string) {
    super(`Geen officiële fietsknooppuntenverbinding gevonden tussen ${fromRef} en ${toRef}.`);
    this.name = 'UnknownKnooppuntenConnectionError';
  }
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
  if (!edge) throw new UnknownKnooppuntenConnectionError(fromNode.ref, toNode.ref);

  const leg: RouteLeg = {
    fromNode,
    toNode,
    distanceKm: edge.distanceKm,
    coordinates: edge.coordinates,
    instructions: `Geverifieerde corridor: ${edge.source}`,
  };
  legCache.set(cacheKey, leg);
  return leg;
}

/**
 * Estimate elevation profile across route
 */
export function estimateElevationProfile(_coordinates: [number, number][], _totalDistKm: number): ElevationProfileResult {
  // Never display fabricated height values. The offline importer may attach surveyed DEM
  // samples in a future dataset version; until then the UI explicitly marks elevation unknown.
  return { points: [], totalAscent: 0, available: false };
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
