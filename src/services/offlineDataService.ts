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
import { loadPrepackagedOfficialNetwork } from './networkDataService';

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
  // ==================== BELGIË (10 provincies + Brussel) ====================
  {
    id: 'limburg_be',
    name: 'Belgisch Limburg',
    country: 'BE',
    description: 'Zutendaal, Hoge Kempen, Bokrijk, Maasland, Hasselt, Genk & Haspengouw',
    bbox: [50.72, 5.08, 51.30, 5.85],
    center: [50.9337, 5.5757],
  },
  {
    id: 'antwerpen',
    name: 'Provincie Antwerpen',
    country: 'BE',
    description: 'Antwerpen stad, Mechelen, Turnhout, Lier, Kalmthout & Antwerpse Kempen',
    bbox: [51.02, 4.22, 51.52, 5.20],
    center: [51.2194, 4.4025],
  },
  {
    id: 'west_vlaanderen',
    name: 'West-Vlaanderen & Kust',
    country: 'BE',
    description: 'Brugge, Kuststrook, Oostende, Westhoek, Kortrijk, Ieper & Damme',
    bbox: [50.72, 2.52, 51.40, 3.50],
    center: [51.2093, 3.2247],
  },
  {
    id: 'oost_vlaanderen',
    name: 'Oost-Vlaanderen',
    country: 'BE',
    description: 'Gent, Aalst, Sint-Niklaas, Dendermonde, Waasland & Vlaamse Ardennen',
    bbox: [50.70, 3.45, 51.30, 4.28],
    center: [51.0543, 3.7174],
  },
  {
    id: 'vlaams_brabant_bxl',
    name: 'Vlaams-Brabant & Brussel',
    country: 'BE',
    description: 'Leuven, Hageland, Pajottenland, Zoniënwoud, Halle-Vilvoorde & Brussel',
    bbox: [50.68, 4.10, 51.05, 5.12],
    center: [50.8798, 4.7005],
  },
  {
    id: 'waals_brabant',
    name: 'Waals-Brabant (Brabant wallon)',
    country: 'BE',
    description: 'Waver, Waterloo, Louvain-la-Neuve, Nijvel, Villers-la-Ville & Jodoigne',
    bbox: [50.55, 4.12, 50.82, 5.02],
    center: [50.7167, 4.6167],
  },
  {
    id: 'luik_liege',
    name: 'Luik & Oostkantons / Vennbahn',
    country: 'BE',
    description: 'Luik, Verviers, Spa, Hoge Venen, Malmedy, Eupen, St. Vith & Vennbahn',
    bbox: [50.15, 5.15, 50.80, 6.45],
    center: [50.6326, 5.5684],
  },
  {
    id: 'namen_namur',
    name: 'Namen & Maasvallei (RAVeL)',
    country: 'BE',
    description: 'Namen, Dinant, Ciney, Rochefort, Sambre-et-Meuse & RAVeL fietswegen',
    bbox: [49.95, 4.42, 50.65, 5.22],
    center: [50.4674, 4.8720],
  },
  {
    id: 'henegouwen',
    name: 'Henegouwen (Hainaut)',
    country: 'BE',
    description: 'Bergen (Mons), Charleroi, Doornik (Tournai), La Louvière, Aat & Chimay',
    bbox: [49.95, 3.15, 50.75, 4.65],
    center: [50.4542, 3.9567],
  },
  {
    id: 'luxemburg_be',
    name: 'Belgisch Luxemburg & Ardennen',
    country: 'BE',
    description: 'Aarlen (Arlon), Bastogne, Bouillon, Durbuy, La Roche-en-Ardenne & Semois',
    bbox: [49.50, 5.20, 50.40, 6.05],
    center: [49.8833, 5.5500],
  },

  // ==================== NEDERLAND (12 provincies) ====================
  {
    id: 'limburg_nl',
    name: 'Nederlands Limburg',
    country: 'NL',
    description: 'Maastricht, Valkenburg, Heuvelland, Roermond, Weert & Venlo',
    bbox: [50.72, 5.55, 51.75, 6.25],
    center: [50.8514, 5.6909],
  },
  {
    id: 'noord_brabant',
    name: 'Noord-Brabant & De Kempen',
    country: 'NL',
    description: 'Eindhoven, Breda, Tilburg, \'s-Hertogenbosch, Helmond & Grenskempen',
    bbox: [51.28, 4.20, 51.85, 6.00],
    center: [51.4416, 5.4697],
  },
  {
    id: 'zeeland',
    name: 'Zeeland & Scheldedelta',
    country: 'NL',
    description: 'Middelburg, Vlissingen, Goes, Schouwen-Duiveland & Zeeuws-Vlaanderen',
    bbox: [51.20, 3.35, 51.75, 4.30],
    center: [51.4988, 3.6109],
  },
  {
    id: 'zuid_holland',
    name: 'Zuid-Holland & Rijnmond',
    country: 'NL',
    description: 'Rotterdam, Den Haag, Delft, Leiden, Gouda, Dordrecht & Biesbosch',
    bbox: [51.70, 3.90, 52.32, 5.15],
    center: [51.9244, 4.4777],
  },
  {
    id: 'utrecht',
    name: 'Utrecht & Heuvelrug',
    country: 'NL',
    description: 'Utrecht stad, Amersfoort, Utrechtse Heuvelrug, Zeist & Vechtstreek',
    bbox: [51.92, 4.80, 52.32, 5.55],
    center: [52.0907, 5.1214],
  },
  {
    id: 'noord_holland',
    name: 'Noord-Holland & Texel',
    country: 'NL',
    description: 'Amsterdam, Haarlem, Alkmaar, Zaanstreek, West-Friesland & Texel',
    bbox: [52.25, 4.50, 53.20, 5.35],
    center: [52.3676, 4.9041],
  },
  {
    id: 'gelderland',
    name: 'Gelderland & Veluwe',
    country: 'NL',
    description: 'Arnhem, Nijmegen, Apeldoorn, Hoge Veluwe, Achterhoek & Betuwe',
    bbox: [51.72, 5.05, 52.55, 6.85],
    center: [52.0000, 5.9500],
  },
  {
    id: 'overijssel',
    name: 'Overijssel & Twente',
    country: 'NL',
    description: 'Zwolle, Enschede, Deventer, Salland, Twente, Giethoorn & Weerribben',
    bbox: [52.10, 5.90, 52.75, 7.10],
    center: [52.5168, 6.0830],
  },
  {
    id: 'flevoland',
    name: 'Flevoland & Polders',
    country: 'NL',
    description: 'Almere, Lelystad, Oostvaardersplassen, Dronten, Zeewolde & Urk',
    bbox: [52.25, 5.15, 52.85, 5.95],
    center: [52.5200, 5.4700],
  },
  {
    id: 'drenthe',
    name: 'Drenthe & Hondsrug',
    country: 'NL',
    description: 'Assen, Emmen, Hoogeveen, Dwingelderveld, Drents-Friese Wold & Hondsrug',
    bbox: [52.60, 6.15, 53.25, 7.05],
    center: [52.9925, 6.5644],
  },
  {
    id: 'friesland',
    name: 'Friesland / Fryslân & Waddeneilanden',
    country: 'NL',
    description: 'Leeuwarden, Sneek, Friese Meren, Terschelling, Ameland & Vlieland',
    bbox: [52.80, 4.80, 53.55, 6.45],
    center: [53.2012, 5.7999],
  },
  {
    id: 'groningen',
    name: 'Groningen & Ommelanden',
    country: 'NL',
    description: 'Groningen stad, Delfzijl, Winschoten, Hogeland, Lauwersmeer & Westerwolde',
    bbox: [53.05, 6.15, 53.58, 7.25],
    center: [53.2194, 6.5665],
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
    const network = await loadPrepackagedOfficialNetwork();
    if (network?.nodes.length) nodesToImport = network.nodes;
  } catch {
    // Fall through to the legacy node-only dataset.
  }

  if (nodesToImport.length === 0) {
    try {
      const res = await fetch('/data/benelux_knooppunten.json');
      if (res.ok) nodesToImport = await res.json();
    } catch {
      // ignore
    }
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
