import fs from 'fs';
import path from 'path';
import { enrichKnooppuntLocality } from '../src/services/localityService';
import { INITIAL_NODES } from '../src/data/knooppuntenData';
import { KnooppuntNode } from '../src/types';

interface SectorDef {
  id: string;
  name: string;
  country: 'BE' | 'NL';
  bbox: [number, number, number, number]; // [south, west, north, east]
}

const SECTORS: SectorDef[] = [
  { id: 'limburg_be', name: 'Belgisch Limburg', country: 'BE', bbox: [50.72, 5.10, 51.28, 5.85] },
  { id: 'antwerpen', name: 'Provincie Antwerpen', country: 'BE', bbox: [51.02, 4.25, 51.48, 5.15] },
  { id: 'west_vlaanderen', name: 'West-Vlaanderen & Kust', country: 'BE', bbox: [50.75, 2.60, 51.38, 3.45] },
  { id: 'oost_vlaanderen', name: 'Oost-Vlaanderen & Gent', country: 'BE', bbox: [50.75, 3.50, 51.28, 4.25] },
  { id: 'vlaams_brabant_bxl', name: 'Vlaams-Brabant & Brussel', country: 'BE', bbox: [50.72, 4.15, 51.00, 5.05] },
  { id: 'limburg_nl', name: 'Nederlands Limburg', country: 'NL', bbox: [50.75, 5.65, 51.45, 6.20] },
  { id: 'noord_brabant', name: 'Noord-Brabant & De Kempen', country: 'NL', bbox: [51.30, 4.30, 51.75, 5.80] },
  { id: 'zeeland', name: 'Zeeland & Delta', country: 'NL', bbox: [51.22, 3.40, 51.70, 4.20] },
];

async function fetchSectorNodes(sector: SectorDef): Promise<KnooppuntNode[]> {
  const [south, west, north, east] = sector.bbox;
  const query = `[out:json][timeout:20];
  node["rcn_ref"](${south},${west},${north},${east});
  out body;`;

  console.log(`Fetching ${sector.name} [${sector.id}]...`);

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const ep of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'FietsknooppuntenApp/1.0 (contact: info@fietsknooppunten.app)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.elements || data.elements.length === 0) continue;

      const nodes: KnooppuntNode[] = [];
      for (const el of data.elements) {
        if (!el.lat || !el.lon) continue;
        const ref = (el.tags?.rcn_ref || el.tags?.ref || el.tags?.lcn_ref || '').trim();
        if (!ref || ref.length > 5) continue;

        // Spatial deduplication
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

        const enriched = enrichKnooppuntLocality(baseNode);
        nodes.push(enriched);
      }

      console.log(`✓ ${sector.name}: ${nodes.length} nodes parsed`);
      return nodes;
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn(`Attempt failed on ${ep} for ${sector.name}:`, err.message);
    }
  }

  console.log(`! Sector completed without extra nodes: ${sector.name}`);
  return [];
}

async function main() {
  const publicDataDir = path.join(process.cwd(), 'public', 'data');
  if (!fs.existsSync(publicDataDir)) {
    fs.mkdirSync(publicDataDir, { recursive: true });
  }

  const outputPath = path.join(publicDataDir, 'benelux_knooppunten.json');
  const allNodesMap = new Map<string, KnooppuntNode>();

  // If previous partial data exists, load it first
  if (fs.existsSync(outputPath)) {
    try {
      const prevData: KnooppuntNode[] = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      for (const n of prevData) {
        allNodesMap.set(`${n.ref}-${n.lat.toFixed(3)}-${n.lng.toFixed(3)}`, n);
      }
      console.log(`Loaded ${allNodesMap.size} existing nodes from previous run.`);
    } catch {}
  }

  // 1. Add all initial curated nodes
  for (const node of INITIAL_NODES) {
    const enriched = enrichKnooppuntLocality(node);
    allNodesMap.set(`${enriched.ref}-${enriched.lat.toFixed(3)}-${enriched.lng.toFixed(3)}`, enriched);
  }

  // 2. Fetch each sector and incrementally save
  for (const sector of SECTORS) {
    const nodes = await fetchSectorNodes(sector);
    for (const n of nodes) {
      const key = `${n.ref}-${n.lat.toFixed(3)}-${n.lng.toFixed(3)}`;
      if (!allNodesMap.has(key)) {
        allNodesMap.set(key, n);
      }
    }

    // Save incrementally
    const currentList = Array.from(allNodesMap.values());
    fs.writeFileSync(outputPath, JSON.stringify(currentList), 'utf-8');
    console.log(`Saved ${currentList.length} nodes after ${sector.name}`);

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 800));
  }

  const combinedNodes = Array.from(allNodesMap.values());
  console.log(`\n=== SUCCESS: Total unique knooppunten compiled: ${combinedNodes.length} ===`);
  console.log(`Saved compiled database to: ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
