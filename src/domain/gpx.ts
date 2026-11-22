import type { Network, PlannedRoute } from './network';

const escape = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
export function exportGpx(route: PlannedRoute, name: string, network: Network): string {
  const waypoints = route.stops.map(id => {
    const n = network.nodes.get(id)!;
    return `<rtept lat="${n.position[1]}" lon="${n.position[0]}"><name>${escape(n.number ?? 'Verbindingspunt')}</name><extensions><fr:node>${id}</fr:node></extensions></rtept>`;
  }).join('');
  // Separate segments preserve the original source geometry without inventing gap connections.
  const track = route.steps.map(step => `<trkseg>${step.coordinates.map(p => `<trkpt lat="${p[1]}" lon="${p[0]}"/>`).join('')}</trkseg>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Fietsroutes Vlaanderen" xmlns="http://www.topografix.com/GPX/1/1" xmlns:fr="https://fietsroutes.app/schema/1"><metadata><name>${escape(name)}</name><copyright author="Toerisme Vlaanderen en provinciale toeristische organisaties"/></metadata><rte><name>${escape(name)}</name>${waypoints}</rte><trk><name>${escape(name)}</name>${track}</trk></gpx>`;
}
export function importGpx(text: string): { name: string; stops: string[] } {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'gpx') throw Error('Dit is geen geldig GPX-bestand.');
  const stops = [...doc.getElementsByTagNameNS('https://fietsroutes.app/schema/1', 'node')].map(n => n.textContent ?? '');
  if (stops.length < 2 || stops.length > 200 || stops.some(s => !/^\d{1,16}$/.test(s))) throw Error('Deze eerste versie kan GPX-routes uit deze app opnieuw bewerken. Een externe GPX koppelen aan het knooppuntennetwerk volgt later.');
  return { name: (doc.getElementsByTagName('name')[0]?.textContent || 'Geïmporteerde route').slice(0, 120), stops };
}
export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
