import { Clock3, Gauge, Route, Square, Navigation } from 'lucide-react';
import type { Network, Progress } from '../domain/network';
interface Props { network: Network | null; progress: Progress | null; totalMeters: number; currentSpeed: number | null; profileSpeed: number; accuracy: number; gpsStale: boolean; now: number; onStop: () => void }
const km = (meters: number) => (meters / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 1 });
const nextDistance = (meters: number) => meters < 1000 ? Math.round(meters / 10) * 10 + ' m' : km(meters) + ' km';
export function RidePanels({ network, progress, totalMeters, currentSpeed, profileSpeed, accuracy, gpsStale, now, onStop }: Props) {
  const reliable = !gpsStale && accuracy <= 75, offRoute = Boolean(progress && progress.offRoute > 75);
  const remaining = progress?.remaining ?? totalMeters;
  const eta = reliable && !offRoute && progress ? new Date(now + remaining / (profileSpeed * 1000) * 3600000).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }) : '—';
  const status = gpsStale ? 'WACHTEN OP GPS' : accuracy > 75 ? 'GPS ONNAUWKEURIG' : progress?.arrived ? 'EINDE BEREIKT' : offRoute ? 'JE WIJKT AF VAN DE ROUTE' : '';
  return <>
    <div className="ride-card">
      {status && <span className="eyebrow" role="status">{status}</span>}
      {progress?.arrived && reliable ? <div className="ride-arrived"><Navigation size={24}/><strong>Aangekomen</strong></div> : <div className="ride-next-row">
        <b className="ride-next-node" aria-label="Volgend knooppunt">{network?.nodes.get(progress?.next ?? '')?.number ?? '…'}</b>
        <strong className="ride-next-distance" aria-label="Afstand tot volgend knooppunt">{reliable && progress ? nextDistance(progress.nextDistance) : '—'}</strong>
        <span className="ride-after"><small>Daarna</small><b aria-label="Daaropvolgend knooppunt">{network?.nodes.get(progress?.nextAfter ?? '')?.number ?? '—'}</b></span>
      </div>}
      {status && !progress?.arrived && <p>{gpsStale ? 'Wacht op je locatie.' : accuracy > 75 ? 'Voortgang staat stil tot GPS nauwkeuriger is.' : 'Keer terug naar de blauwe lijn.'}</p>}
    </div>
    <div className="ride-footer">
      <span className="ride-metric" aria-label="Actuele snelheid" title="Actuele snelheid"><Gauge size={17} aria-hidden="true"/><strong>{reliable && currentSpeed !== null ? currentSpeed.toLocaleString('nl-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}<small> km/u</small></strong></span>
      <span className="ride-metric" aria-label="Resterende afstand" title="Resterende afstand"><Route size={17} aria-hidden="true"/><strong>{km(remaining)}<small> km</small></strong></span>
      <span className="ride-metric" aria-label="Geschatte aankomsttijd" title="Geschatte aankomsttijd op basis van je fietsprofiel"><Clock3 size={17} aria-hidden="true"/><strong>{eta}</strong></span>
      <button className="ride-stop" onClick={onStop} aria-label="Navigatie stoppen" title="Navigatie stoppen"><Square size={16} fill="currentColor" aria-hidden="true"/></button>
    </div>
  </>;
}
