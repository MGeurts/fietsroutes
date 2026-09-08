import { OfficialNetworkDataset } from '../types';
import { registerOfficialNetworkDataset } from './officialNetworkService';

/** Load only build-time validated network data. A missing file is a safe, supported fallback. */
export async function loadPrepackagedOfficialNetwork(): Promise<OfficialNetworkDataset | null> {
  try {
    const response = await fetch('/data/benelux_network.json');
    if (!response.ok) return null;
    const dataset: OfficialNetworkDataset = await response.json();
    if (dataset.version !== 1 || !Array.isArray(dataset.nodes) || !Array.isArray(dataset.edges)) return null;
    registerOfficialNetworkDataset(dataset);
    return dataset;
  } catch {
    return null;
  }
}
