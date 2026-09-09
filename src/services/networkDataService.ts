import { OfficialNetworkDataset, OfficialNetworkValidationReport } from '../types';
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
