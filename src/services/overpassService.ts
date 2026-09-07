import { KnooppuntNode } from '../types';

interface OverpassElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: {
    rcn_ref?: string;
    lcn_ref?: string;
    ref?: string;
    name?: string;
    network?: string;
    operator?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// In-memory cache to prevent redundant Overpass queries
const bboxCache = new Map<string, KnooppuntNode[]>();

/**
 * Fetch cycle network nodes (fietsknooppunten) from OpenStreetMap via Overpass API.
 * Query looks for nodes tagged with rcn_ref (Regional Cycle Network reference),
 * which is the standard OSM tag for Belgian and Dutch cycle nodes.
 */
export async function fetchKnooppuntenInBBox(
  south: number,
  west: number,
  north: number,
  east: number,
  signal?: AbortSignal
): Promise<KnooppuntNode[]> {
  // Round coordinates to ~0.02 deg to enable caching for nearby pans
  const cacheKey = `${south.toFixed(2)},${west.toFixed(2)},${north.toFixed(2)},${east.toFixed(2)}`;
  if (bboxCache.has(cacheKey)) {
    return bboxCache.get(cacheKey)!;
  }

  // Overpass QL query: find all cycle network nodes in bbox
  const query = `
    [out:json][timeout:8];
    (
      node["rcn_ref"](${south},${west},${north},${east});
      node["network:type"="node_network"]["ref"](${south},${west},${north},${east});
      node["network"="rcn"]["ref"](${south},${west},${north},${east});
    );
    out body;
  `.replace(/\s+/g, ' ').trim();

  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];

  for (const endpoint of endpoints) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 7000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: signal || timeoutController.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const data: OverpassResponse = await response.json();
      if (!data.elements || data.elements.length === 0) continue;

      const nodes: KnooppuntNode[] = [];

      for (const el of data.elements) {
        if (!el.lat || !el.lon) continue;
        const ref = el.tags?.rcn_ref || el.tags?.ref || el.tags?.lcn_ref;
        if (!ref) continue;

        // Clean ref (keep only short node numbers like "01", "64", "550", "A")
        const cleanRef = ref.trim();

        // Spatial deduplication: in OSM, multi-lane roads or dual intersections often have
        // 2 or more nodes with the same rcn_ref (e.g. node 62 or 567).
        // Only keep one authoritative node per physical intersection (within ~300m / 0.003 deg).
        const isDuplicateNearby = nodes.some(
          (existing) =>
            existing.ref === cleanRef &&
            Math.abs(existing.lat - el.lat) < 0.003 &&
            Math.abs(existing.lng - el.lon) < 0.003
        );
        if (isDuplicateNearby) continue;

        nodes.push({
          id: `osm-${el.id}`,
          ref: cleanRef,
          lat: el.lat,
          lng: el.lon,
          name: el.tags?.name || `Knooppunt ${cleanRef}`,
          region: el.tags?.operator || (el.lat < 51.05 && el.lon > 5.2 ? 'Belgisch Limburg' : 'OSM Knooppuntennetwerk')
        });
      }

      if (nodes.length > 0) {
        bboxCache.set(cacheKey, nodes);
        return nodes;
      }
    } catch {
      clearTimeout(timeoutId);
      // Try next endpoint if available
      continue;
    }
  }

  return [];
}
