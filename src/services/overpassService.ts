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

  // Overpass QL query: find all nodes with rcn_ref or network:type=node_network
  const query = `
    [out:json][timeout:12];
    (
      node["rcn_ref"](${south},${west},${north},${east});
      node["network:type"="node_network"]["ref"](${south},${west},${north},${east});
    );
    out body 200;
  `.replace(/\s+/g, ' ').trim();

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal
      });

      if (!response.ok) {
        continue;
      }

      const data: OverpassResponse = await response.json();
      if (!data.elements) continue;

      const nodes: KnooppuntNode[] = [];
      const seen = new Set<string>();

      for (const el of data.elements) {
        if (!el.lat || !el.lon) continue;
        const ref = el.tags?.rcn_ref || el.tags?.ref || el.tags?.lcn_ref;
        if (!ref) continue;

        // Clean ref (keep only short node numbers like "01", "64", "550", "A")
        const cleanRef = ref.trim();
        const key = `${cleanRef}-${el.lat.toFixed(4)}-${el.lon.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        nodes.push({
          id: `osm-${el.id}`,
          ref: cleanRef,
          lat: el.lat,
          lng: el.lon,
          name: el.tags?.name || `Knooppunt ${cleanRef}`,
          region: el.tags?.operator || (el.lat < 51.05 && el.lon > 5.2 ? 'Limburg' : 'OSM Knooppuntennetwerk')
        });
      }

      bboxCache.set(cacheKey, nodes);
      return nodes;
    } catch {
      // Try next endpoint if available
      continue;
    }
  }

  return [];
}
