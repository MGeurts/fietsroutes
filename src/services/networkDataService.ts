import { OfficialNetworkDataset, OfficialNetworkDatasetManifest, OfficialNetworkValidationReport } from '../types';
import { registerOfficialNetworkDataset } from './officialNetworkService';
import { cacheOfficialNetwork, getCachedOfficialNetwork } from './knooppuntenCacheService';

export interface LoadedOfficialNetwork {
  dataset: OfficialNetworkDataset;
  fromCache: boolean;
}

function isDataset(dataset: unknown): dataset is OfficialNetworkDataset {
  return !!dataset
    && typeof dataset === 'object'
    && (dataset as OfficialNetworkDataset).version === 1
    && Array.isArray((dataset as OfficialNetworkDataset).nodes)
    && Array.isArray((dataset as OfficialNetworkDataset).edges);
}

async function loadManifest(): Promise<OfficialNetworkDatasetManifest | null> {
  try {
    // This tiny request is conditionally revalidated by the browser, while the
    // graph itself remains in IndexedDB until the build timestamp changes.
    const response = await fetch('/data/benelux_network_meta.json', { cache: 'no-cache' });
    if (!response.ok) return null;
    const manifest: unknown = await response.json();
    return manifest
      && typeof manifest === 'object'
      && (manifest as OfficialNetworkDatasetManifest).version === 1
      && typeof (manifest as OfficialNetworkDatasetManifest).generatedAt === 'string'
      ? manifest as OfficialNetworkDatasetManifest
      : null;
  } catch {
    return null;
  }
}

/** Load only build-time validated network data. A missing file is a safe, supported fallback. */
export async function loadPrepackagedOfficialNetwork(): Promise<LoadedOfficialNetwork | null> {
  try {
    const manifest = await loadManifest();
    if (manifest) {
      const cached = await getCachedOfficialNetwork(manifest.generatedAt);
      if (cached) {
        registerOfficialNetworkDataset(cached);
        return { dataset: cached, fromCache: true };
      }
    }
    const response = await fetch('/data/benelux_network.json');
    if (!response.ok) return null;
    const dataset: unknown = await response.json();
    if (!isDataset(dataset)) return null;
    registerOfficialNetworkDataset(dataset);
    // A mismatched or unavailable manifest must not prevent a safe first load.
    // The dataset timestamp remains the cache key once the accompanying manifest
    // is deployed.
    if (!manifest || manifest.generatedAt === dataset.generatedAt) {
      await cacheOfficialNetwork(dataset);
    }
    return { dataset, fromCache: false };
  } catch {
    return null;
  }
}

/** The audit report is optional so deployments can upgrade before their first data build. */
export async function loadNetworkValidationReport(): Promise<OfficialNetworkValidationReport | null> {
  try {
    const response = await fetch('/data/benelux_network_validation.json');
    if (!response.ok) return null;
    const report: OfficialNetworkValidationReport = await response.json();
    if (report.version !== 1 || !Array.isArray(report.entries) || !report.summary) return null;
    return report;
  } catch {
    return null;
  }
}
