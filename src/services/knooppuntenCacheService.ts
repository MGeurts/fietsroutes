import { KnooppuntNode, OfficialNetworkDataset } from '../types';
import { enrichKnooppuntLocality } from './localityService';

const DB_NAME = 'FietsknooppuntenDB';
const DB_VERSION = 2;
const STORE_NODES = 'nodes';
const STORE_META = 'metadata';
const STORE_DATASETS = 'datasets';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB niet beschikbaar'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NODES)) {
        const nodeStore = db.createObjectStore(STORE_NODES, { keyPath: 'id' });
        nodeStore.createIndex('ref', 'ref', { unique: false });
        nodeStore.createIndex('lat', 'lat', { unique: false });
        nodeStore.createIndex('lng', 'lng', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_DATASETS)) {
        db.createObjectStore(STORE_DATASETS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export interface CacheMetadata {
  totalNodes: number;
  lastSyncTimestamp: number | null;
  cachedRegions: string[];
}

/**
 * Initialize an empty cache. Network data is always supplied by the packaged dataset.
 */
export async function initializeCache(): Promise<KnooppuntNode[]> {
  try {
    const db = await openDB();
    const existing = await getAllNodesFromCache();

    if (existing.length === 0) {
      return [];
    }

    return existing;
  } catch (err) {
    console.warn('IndexedDB initialisatiefout:', err);
    return [];
  }
}

/**
 * Retrieve all nodes from local IndexedDB
 */
export async function getAllNodesFromCache(): Promise<KnooppuntNode[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NODES, 'readonly');
      const store = tx.objectStore(STORE_NODES);
      const request = store.getAll();

      request.onsuccess = () => {
        const raw: KnooppuntNode[] = request.result || [];
        const enriched = raw.map((n) => (!n.municipality || n.name === `Knooppunt ${n.ref}` ? enrichKnooppuntLocality(n) : n));
        resolve(enriched);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

export const getAllCachedNodes = getAllNodesFromCache;

const OFFICIAL_NETWORK_DATASET_KEY = 'official-network';

/**
 * Return the complete static graph only when it belongs to the manifest that is
 * currently deployed. This avoids downloading and parsing the 60+ MB JSON file
 * again on every application start.
 */
export async function getCachedOfficialNetwork(generatedAt: string): Promise<OfficialNetworkDataset | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_DATASETS, 'readonly');
      const request = tx.objectStore(STORE_DATASETS).get(OFFICIAL_NETWORK_DATASET_KEY);
      request.onsuccess = () => {
        const dataset = request.result?.dataset as OfficialNetworkDataset | undefined;
        resolve(dataset?.version === 1 && dataset.generatedAt === generatedAt ? dataset : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Persist one versioned graph. New dataset builds replace, rather than append to, the old graph. */
export async function cacheOfficialNetwork(dataset: OfficialNetworkDataset): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_DATASETS, 'readwrite');
      tx.objectStore(STORE_DATASETS).put({
        key: OFFICIAL_NETWORK_DATASET_KEY,
        generatedAt: dataset.generatedAt,
        dataset,
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // IndexedDB can be unavailable or out of quota. The app can still use the
    // packaged data for this session and will retry caching later.
  }
}

/**
 * Save or merge a batch of nodes into IndexedDB with spatial deduplication
 */
export async function saveNodesToCache(nodes: KnooppuntNode[]): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NODES, 'readwrite');
      const store = tx.objectStore(STORE_NODES);

      let savedCount = 0;
      for (const node of nodes) {
        // Ensure valid node ID
        const id = node.id || `local-${node.ref}-${node.lat.toFixed(4)}-${node.lng.toFixed(4)}`;
        const record = { ...node, id, updatedAt: Date.now() };
        store.put(record);
        savedCount++;
      }

      tx.oncomplete = () => {
        resolve(savedCount);
      };

      tx.onerror = () => {
        resolve(savedCount);
      };
    });
  } catch {
    return 0;
  }
}

/** Replace the cache with the packaged dataset, removing stale discovery and legacy records. */
export async function replaceCachedNodes(nodes: KnooppuntNode[]): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NODES, STORE_META], 'readwrite');
      const store = tx.objectStore(STORE_NODES);
      store.clear();
      for (const node of nodes) {
        store.put({ ...node, id: node.id, updatedAt: Date.now() });
      }
      const meta = tx.objectStore(STORE_META);
      meta.put({ key: 'lastSyncTimestamp', value: Date.now(), updatedAt: Date.now() });
      meta.put({ key: 'cachedRegions', value: ['Ingebouwde netwerkdataset'], updatedAt: Date.now() });
      tx.oncomplete = () => resolve(nodes.length);
      tx.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Save key-value metadata
 */
export async function saveMetadata(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      store.put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

/**
 * Get metadata value
 */
export async function getMetadata<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result?.value ?? null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Get overall cache status (node count, last sync date, regions)
 */
export async function getCacheStatus(): Promise<CacheMetadata> {
  try {
    const nodes = await getAllNodesFromCache();
    const lastSync = await getMetadata<number>('lastSyncTimestamp');
    const regions = (await getMetadata<string[]>('cachedRegions')) || [];

    return {
      totalNodes: nodes.length,
      lastSyncTimestamp: lastSync,
      cachedRegions: regions,
    };
  } catch {
    return {
      totalNodes: 0,
      lastSyncTimestamp: null,
      cachedRegions: [],
    };
  }
}

/**
 * Clear the entire node cache.
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NODES, STORE_META, STORE_DATASETS], 'readwrite');
      tx.objectStore(STORE_NODES).clear();
      tx.objectStore(STORE_META).clear();
      tx.objectStore(STORE_DATASETS).clear();
      tx.oncomplete = async () => {
        resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}
