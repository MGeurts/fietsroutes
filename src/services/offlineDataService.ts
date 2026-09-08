import { KnooppuntNode } from '../types';
import {
  getAllNodesFromCache,
  saveNodesToCache,
  getMetadata,
  saveMetadata,
  clearCache,
} from './knooppuntenCacheService';
import { enrichKnooppuntLocality } from './localityService';
import { INITIAL_NODES } from '../data/knooppuntenData';

export interface GridSectorInfo {
  id: string;
  name: string;
  country: 'BE' | 'NL';
  description: string;
  bbox: [number, number, number, number]; // [south, west, north, east]
  center: [number, number]; // [lat, lng]
  nodeCount: number;
  lastSyncTimestamp: number | null;
  status: 'idle' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
}

export const GRID_SECTORS: Omit<GridSectorInfo, 'nodeCount' | 'lastSyncTimestamp' | 'status'>[] = [
  {
    id: 'limburg_be',
    name: 'Belgisch Limburg',
    country: 'BE',
    description: 'Zutendaal, Hoge Kempen, Bokrijk, Maasland, Hasselt & Genk',
    bbox: [50.72, 5.08, 51.30, 5.85],
    center: [50.9337, 5.5757],
  },
  {
    id: 'antwerpen',
    name: 'Provincie Antwerpen',
    country: 'BE',
    description: 'Antwerpen, Mechelen, Turnhout, Lier & Antwerpse Kempen',
    bbox: [51.02, 4.25, 51.50, 5.20],
    center: [51.2194, 4.4025],
  },
  {
    id: 'west_vlaanderen',
    name: 'West-Vlaanderen & Kust',
    country: 'BE',
    description: 'Brugge, Kuststrook, Westhoek, Kortrijk, Ieper & Damme',
    bbox: [50.72, 2.55, 51.40, 3.50],
    center: [51.2093, 3.2247],
  },
  {
    id: 'oost_vlaanderen',
    name: 'Oost-Vlaanderen & Gent',
    country: 'BE',
    description: 'Gent, Aalst, Sint-Niklaas, Dendermonde & Vlaamse Ardennen',
    bbox: [50.72, 3.48, 51.30, 4.28],
    center: [51.0543, 3.7174],
  },
  {
    id: 'vlaams_brabant_bxl',
    name: 'Vlaams-Brabant & Brussel',
    country: 'BE',
    description: 'Leuven, Hageland, Pajottenland, Zoniënwoud & Brussel',
    bbox: [50.70, 4.10, 51.02, 5.10],
    center: [50.8798, 4.7005],
  },
  {
    id: 'limburg_nl',
    name: 'Nederlands Limburg',
    country: 'NL',
    description: 'Maastricht, Valkenburg, Heuvelland, Roermond & Venlo',
    bbox: [50.74, 5.60, 51.55, 6.25],
    center: [50.8514, 5.6909],
  },
  {
    id: 'noord_brabant',
    name: 'Noord-Brabant & De Kempen',
    country: 'NL',
    description: 'Eindhoven, Breda, Tilburg, \'s-Hertogenbosch & Grenskempen',
    bbox: [51.28, 4.25, 51.78, 5.90],
    center: [51.4416, 5.4697],
  },
  {
    id: 'zeeland',
    name: 'Zeeland & Scheldedelta',
    country: 'NL',
    description: 'Middelburg, Vlissingen, Goes, Schouwen & Zeeuws-Vlaanderen',
    bbox: [51.20, 3.35, 51.72, 4.25],
    center: [51.4988, 3.6109],
  },
  {
    id: 'zuid_holland_utrecht',
    name: 'Zuid-Holland & Utrecht',
    country: 'NL',
    description: 'Rotterdam, Den Haag, Delft, Gouda, Utrecht & Heuvelrug',
    bbox: [51.75, 4.10, 52.25, 5.45],
    center: [52.0000, 4.8000],
  },
  {
    id: 'gelderland_overijssel',
    name: 'Gelderland & Overijssel',
    country: 'NL',
    description: 'Veluwe, Arnhem, Nijmegen, Achterhoek & Sallandse Heuvelrug',
    bbox: [51.75, 5.40, 52.55, 6.85],
    center: [52.1326, 5.9288],
  },
];

/**
 * Checks if coordinates fall within a bounding box [south, west, north, east]
 */
function isInsideBbox(lat: number, lng: number, bbox: [number, number, number, number]): boolean {
  return lat >= bbox[0] && lat <= bbox[2] && lng >= bbox[1] && lng <= bbox[3];
}

/**
 * Get live status of all grid sectors, including node counts from IndexedDB and sync timestamps
 */
export async function getGridSectorsStatus(): Promise<GridSectorInfo[]> {
  const allNodes = await getAllNodesFromCache();
  const syncMeta = (await getMetadata<Record<string, number>>('sectorSyncTimestamps')) || {};

  return GRID_SECTORS.map((sector) => {
    // Count nodes inside this sector
    const sectorNodes = allNodes.filter((n) => isInsideBbox(n.lat, n.lng, sector.bbox));
    const lastSync = syncMeta[sector.id] || null;

    return {
      ...sector,
      nodeCount: sectorNodes.length,
      lastSyncTimestamp: lastSync,
      status: sectorNodes.length > 0 ? 'synced' : 'idle',
    };
  });
}

/**
 * Live sync an individual grid sector from OpenStreetMap Overpass
 */
export async function syncSectorLive(
  sectorId: string,
  onProgress?: (message: string) => void
): Promise<{ count: number; nodes: KnooppuntNode[] }> {
  const sector = GRID_SECTORS.find((s) => s.id === sectorId);
  if (!sector) {
    throw new Error(`Sector '${sectorId}' niet gevonden`);
  }

  onProgress?.(`Gegevens ophalen voor ${sector.name}...`);
  const [south, west, north, east] = sector.bbox;
  const query = `[out:json][timeout:35];
  node["rcn_ref"](${south},${west},${north},${east});
  out body;`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  let fetchedElements: any[] = [];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'FietsknooppuntenApp/1.0 (contact: info@fietsknooppunten.app)',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) continue;
      const data = await res.json();
      if (data.elements && data.elements.length > 0) {
        fetchedElements = data.elements;
        break;
      }
    } catch {
      // try next endpoint
    }
  }

  if (fetchedElements.length === 0) {
    throw new Error(`Geen knooppunten kunnen ophalen voor ${sector.name}. Controleer uw internetverbinding.`);
  }

  onProgress?.(`Knooppunten verrijken en dedupliceren voor ${sector.name}...`);
  const nodes: KnooppuntNode[] = [];
  for (const el of fetchedElements) {
    if (!el.lat || !el.lon) continue;
    const ref = (el.tags?.rcn_ref || el.tags?.ref || el.tags?.lcn_ref || '').trim();
    if (!ref || ref.length > 5) continue;

    // Deduplicate nearby nodes with same ref
    const isNearbyDup = nodes.some(
      (n) => n.ref === ref && Math.hypot(n.lat - el.lat, n.lng - el.lon) < 0.002
    );
    if (isNearbyDup) continue;

    const baseNode: KnooppuntNode = {
      id: `osm-${el.id}`,
      ref,
      lat: Math.round(el.lat * 100000) / 100000,
      lng: Math.round(el.lon * 100000) / 100000,
      name: el.tags?.name,
      municipality: el.tags?.['addr:city'] || el.tags?.city,
      region: el.tags?.operator,
      highlight: el.tags?.description || el.tags?.note,
    };

    nodes.push(enrichKnooppuntLocality(baseNode));
  }

  onProgress?.(`${nodes.length} knooppunten opslaan in lokale database...`);
  await saveNodesToCache(nodes);

  // Update sector timestamp
  const syncMeta = (await getMetadata<Record<string, number>>('sectorSyncTimestamps')) || {};
  syncMeta[sectorId] = Date.now();
  await saveMetadata('sectorSyncTimestamps', syncMeta);
  await saveMetadata('lastSyncTimestamp', Date.now());

  return { count: nodes.length, nodes };
}

/**
 * Import pre-packaged offline dataset covering Belgium and the Netherlands.
 * Loads /data/benelux_knooppunten.json if available, or falls back to curated nodes.
 */
export async function importPrepackagedBeneluxDataset(
  onProgress?: (progressPercent: number, statusMessage: string) => void
): Promise<number> {
  onProgress?.(10, 'Offline databestand downloaden...');

  let nodesToImport: KnooppuntNode[] = [];

  try {
    const res = await fetch('/data/benelux_knooppunten.json');
    if (res.ok) {
      nodesToImport = await res.json();
    }
  } catch {
    // ignore
  }

  if (!nodesToImport || nodesToImport.length === 0) {
    onProgress?.(30, 'Vooraf geconfigureerde knooppunten laden...');
    nodesToImport = INITIAL_NODES.map((n) => enrichKnooppuntLocality(n));
  }

  onProgress?.(50, `${nodesToImport.length} knooppunten valideren en verrijken...`);

  // Enrich any node that doesn't have a locality yet
  const enrichedNodes = nodesToImport.map((n) =>
    !n.municipality || n.name === `Knooppunt ${n.ref}` ? enrichKnooppuntLocality(n) : n
  );

  onProgress?.(75, 'Opslaan in IndexedDB lokale opslag...');
  const savedCount = await saveNodesToCache(enrichedNodes);

  // Mark all sectors as synced
  const now = Date.now();
  const syncMeta: Record<string, number> = {};
  for (const s of GRID_SECTORS) {
    syncMeta[s.id] = now;
  }
  await saveMetadata('sectorSyncTimestamps', syncMeta);
  await saveMetadata('lastSyncTimestamp', now);

  onProgress?.(100, `Klaar! ${savedCount} knooppunten succesvol lokaal opgeslagen.`);
  return savedCount;
}

/**
 * Export the entire IndexedDB database to a downloadable JSON file
 */
export async function exportDatabaseToJson(): Promise<void> {
  const nodes = await getAllNodesFromCache();
  const metaLastSync = await getMetadata<number>('lastSyncTimestamp');
  const metaSectorSync = await getMetadata<Record<string, number>>('sectorSyncTimestamps');

  const exportPayload = {
    appName: 'Fietsknooppunten Planner Vlaanderen & Nederland',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    totalNodes: nodes.length,
    metadata: {
      lastSyncTimestamp: metaLastSync,
      sectorSyncTimestamps: metaSectorSync,
    },
    nodes,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `fietsknooppunten-database-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import database from an uploaded JSON file
 */
export async function importDatabaseFromJson(file: File): Promise<number> {
  const text = await file.text();
  const data = JSON.parse(text);

  const nodes: KnooppuntNode[] = Array.isArray(data) ? data : data.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('Ongeldig JSON bestand: geen knooppunten gevonden.');
  }

  const enriched = nodes.map((n) => enrichKnooppuntLocality(n));
  const savedCount = await saveNodesToCache(enriched);

  await saveMetadata('lastSyncTimestamp', Date.now());
  return savedCount;
}

/**
 * Clear all cached data and restore default seed
 */
export async function resetDatabaseToDefault(): Promise<void> {
  await clearCache();
}
