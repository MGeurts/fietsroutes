import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { directions, type RoundTripOption } from '../domain/roundTrips';
import type { Network, PlannedRoute } from '../domain/network';

function Preview({ route, label }: { route: PlannedRoute; label: string }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const map = L.map(element.current!, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false });
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    const points: L.LatLngTuple[] = route.steps.flatMap(s => s.coordinates.map(p => [p[1], p[0]] as L.LatLngTuple));
    L.polyline(points, { color: '#195dd4', weight: 4, interactive: false }).addTo(map);
    L.circleMarker(points[0], { radius: 6, color: '#075530', fillColor: '#16a361', fillOpacity: 1, weight: 2, interactive: false }).addTo(map);
    const fit = () => { map.invalidateSize(); map.fitBounds(L.latLngBounds(points), { padding: [16, 16], animate: false }); };
    const observer = new ResizeObserver(fit); observer.observe(element.current!); fit();
    return () => { observer.disconnect(); map.remove(); };
  }, [route]);
  return <div ref={element} className="round-trip-preview" role="img" aria-label={'Kaartvooruitzicht ' + label}/>;
}
interface Props { network: Network; start: string | undefined; targetKm: number; onDistance: (value: number) => void; speed: number; onChoose: (route: PlannedRoute) => void }
export function RoundTripChooser({ network, start, targetKm, onDistance, speed, onChoose }: Props) {
  const worker = useRef<Worker | null>(null);
  const [options, setOptions] = useState<RoundTripOption[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    worker.current?.terminate(); worker.current = null; setOptions([]); setBusy(false); setError('');
    return () => { worker.current?.terminate(); worker.current = null; };
  }, [network, start, targetKm]);
  function generate() {
    if (!start || busy) return;
    worker.current?.terminate(); setOptions([]); setError(''); setBusy(true);
    try {
      const task = new Worker(new URL('../roundTrips.worker.ts', import.meta.url), { type: 'module' }); worker.current = task;
      task.onmessage = ({ data }: MessageEvent) => {
        if (worker.current !== task) return;
        if (data.type === 'option') setOptions(current => [...current, { direction: data.direction, route: data.route }]);
        if (data.type === 'done' || data.type === 'error') {
          setBusy(false); if (data.type === 'error') setError(data.message); task.terminate(); worker.current = null;
        }
      };
      task.onerror = () => { if (worker.current === task) { setError('Rondritten berekenen is niet gelukt. Probeer opnieuw.'); setBusy(false); task.terminate(); worker.current = null; } };
      task.postMessage({ data: network.data, start, targetKm });
    } catch { worker.current?.terminate(); worker.current = null; setBusy(false); setError('Rondritten berekenen is niet beschikbaar in deze browser.'); }
  }
  return <>
    <p className="muted">Kies je afstand. We zoeken vanaf je startpunt één lus in elke windrichting.</p>
    <label className="field-label" htmlFor="distance">Gewenste afstand</label>
    <div className="distance-input"><input id="distance" type="range" min="15" max="80" step="5" value={targetKm} onChange={e => onDistance(Number(e.target.value))}/><strong>{targetKm} km</strong></div>
    <p>Start: {start ? 'knooppunt ' + network.nodes.get(start)?.number : 'kies een punt op de kaart'}</p>
    <p className="muted">Maximaal 20% afstandsverschil en zo weinig mogelijk dubbele trajecten. Als het netwerk geen geschikte lus in een richting toelaat, tonen we dat. Je route verandert pas wanneer je een voorstel kiest.</p>
    <button className="primary" disabled={!start || busy} onClick={generate}>{busy ? 'Rondritten berekenen…' : options.length ? 'Opnieuw voorstellen' : 'Rondritten voorstellen'}</button>
    {busy && <p className="round-trip-progress" role="status">{options.length} van 4 richtingen onderzocht…</p>}
    {error && <p role="alert">{error}</p>}
    {(busy || options.length > 0) && <div className="round-trip-options">{directions.map(direction => {
      const option = options.find(o => o.direction === direction.key), route = option?.route;
      const minutes = route ? Math.round(route.meters / 1000 / speed * 60) : 0;
      return <section className="round-trip-option" key={direction.key} aria-label={'Rondrit ' + direction.label}>
        <h3>{direction.label}</h3>
        {route ? <><Preview route={route} label={direction.label}/><p><strong>{(route.meters / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 1 })} km</strong><span>{Math.floor(minutes / 60)} u {minutes % 60} min</span></p><button className="primary" onClick={() => onChoose(route)}>Kies {direction.label}</button></> : <p className="round-trip-unavailable">{option ? 'Geen geschikte lus gevonden. Probeer een andere afstand of startplaats.' : busy ? 'Wordt berekend…' : 'Niet berekend.'}</p>}
      </section>;
    })}</div>}
  </>;
}
