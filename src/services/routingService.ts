import { KnooppuntNode, RouteLeg, ElevationPoint, PlannedRoute } from '../types';

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
 * Calculate real bicycle routing geometry between two knooppunten using OpenStreetMap Bicycle Routing API.
 * Falls back gracefully to interpolated road track if network/OSRM is unavailable.
 */
export async function calculateBicycleLeg(
  fromNode: KnooppuntNode,
  toNode: KnooppuntNode
): Promise<RouteLeg> {
  const straightDist = calculateHaversineDistanceKm(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);

  try {
    // OpenStreetMap routed-bike service (public instance)
    const url = `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${fromNode.lng},${fromNode.lat};${toNode.lng},${toNode.lat}?overview=full&geometries=geojson&steps=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const rawCoords: [number, number][] = route.geometry.coordinates; // [lng, lat]
        // Convert to Leaflet [lat, lng]
        const leafletCoords: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;

        return {
          fromNode,
          toNode,
          distanceKm: distanceKm > 0 ? distanceKm : Math.round(straightDist * 1.2 * 10) / 10,
          coordinates: leafletCoords
        };
      }
    }
  } catch {
    // Fallback on network delay/error
  }

  // Fallback: create realistic road path curved slightly between nodes
  const roadFactor = 1.22; // typical cycling network road bend factor
  const distanceKm = Math.round(straightDist * roadFactor * 10) / 10;
  
  // Generate 5 intermediate points with gentle curve
  const coords: [number, number][] = [];
  const steps = 7;
  const perpLat = -(toNode.lng - fromNode.lng) * 0.05;
  const perpLng = (toNode.lat - fromNode.lat) * 0.05;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curve = Math.sin(t * Math.PI) * 0.4;
    const lat = fromNode.lat + (toNode.lat - fromNode.lat) * t + perpLat * curve;
    const lng = fromNode.lng + (toNode.lng - fromNode.lng) * t + perpLng * curve;
    coords.push([lat, lng]);
  }

  return {
    fromNode,
    toNode,
    distanceKm: Math.max(0.4, distanceKm),
    coordinates: coords
  };
}

/**
 * Estimate elevation profile across route
 */
export function estimateElevationProfile(coordinates: [number, number][], totalDistKm: number): {
  points: ElevationPoint[];
  totalAscent: number;
} {
  if (coordinates.length === 0) return { points: [], totalAscent: 0 };

  const points: ElevationPoint[] = [];
  let totalAscent = 0;
  const samples = Math.min(30, coordinates.length);
  const step = Math.max(1, Math.floor(coordinates.length / samples));

  let prevElev = 45; // baseline elevation (Limburg/Kempen average)
  
  for (let i = 0; i < coordinates.length; i += step) {
    const [lat, lng] = coordinates[i];
    const dist = (i / coordinates.length) * totalDistKm;
    
    // Realistic regional topography modeling:
    // South Limburg (lat < 50.88, lng > 5.7) has rolling hills (Cauberg, Vaals up to 320m)
    // Kempen / Zutendaal plateau sits around 60m-100m (Hesselsberg, Mechelse Heide)
    // Flanders / Holland plains sit 5m-30m
    let base = 40;
    if (lat < 50.88 && lng > 5.75) {
      base = 110 + Math.sin(lat * 150) * 60 + Math.cos(lng * 120) * 50;
    } else if (lat > 50.93 && lat < 51.05 && lng > 5.55 && lng < 5.72) {
      // Hoge Kempen plateau
      base = 75 + Math.sin((lat - 50.95) * 200) * 25;
    } else {
      base = 35 + Math.sin(lat * 80 + lng * 60) * 15;
    }
    
    const elev = Math.max(5, Math.round(base));
    if (points.length > 0 && elev > prevElev) {
      totalAscent += (elev - prevElev);
    }
    prevElev = elev;
    points.push({ distance: Math.round(dist * 10) / 10, elevation: elev });
  }

  return { points, totalAscent: Math.round(totalAscent) };
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
