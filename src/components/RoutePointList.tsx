import { memo } from 'react';
import type { RouteViewpoint } from '../domain/routeViewpoints';
import type { TourismPlace } from '../domain/tourism';
import { tourismCategories } from '../domain/tourism';
import { X } from 'lucide-react';
import type { Network, Position } from '../domain/network';
import { cyclingTime, type ItineraryPoint } from '../domain/itinerary';
import { pointRoleLabels } from '../domain/pointRoles';
interface Props { onPlaceFocus?: (place: TourismPlace) => void; viewpoints?: RouteViewpoint[]; network: Network; points: ItineraryPoint[]; speed: number; riding: boolean; onFocus: (position: Position) => void; onRemove: (index: number) => void }
export const RoutePointList = memo(function RoutePointList({ onPlaceFocus, viewpoints, network, points, speed, riding, onFocus, onRemove }: Props) {
  return <ol className="stop-list">{points.map(({ id, role, stopIndex, metersToNext }, index) => {
    const from = points[index].metersFromStart ?? points.slice(0, index).reduce((sum, p) => sum + (p.metersToNext ?? 0), 0);
    const until = points[index + 1]?.metersFromStart ?? (index + 1 < points.length ? from + (metersToNext ?? 0) : Infinity);
    const nearby = viewpoints?.filter(v => v.metersFromStart >= from && v.metersFromStart < until) ?? [];
    const node = network.nodes.get(id)!, next = points[index + 1];
    const length = metersToNext === null ? '' : metersToNext < 1000 ? `${Math.round(metersToNext)} m` : `${(metersToNext / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 1 })} km`;
    return <li className="itinerary-row" key={`${id}-${index}`}><div className="itinerary-point"><span className={`point-badge role-${role}`} title={pointRoleLabels[role]}>{node.number}</span><button className="stop-label" onClick={() => onFocus(node.position)}><strong>{role === 'start' ? 'Start' : role === 'end' ? 'Einde' : role === 'automatic' ? 'Automatisch' : 'Via'} · {node.number}</strong></button>{stopIndex !== null && <button className="remove-stop" aria-label={`Knooppunt ${node.number} verwijderen`} disabled={riding} onClick={() => onRemove(stopIndex)}><X size={17}/></button>}</div>{metersToNext !== null && next && <div className="itinerary-leg"><span>Naar {network.nodes.get(next.id)!.number}</span><strong>{length}</strong><span>·</span><span>{cyclingTime(metersToNext, speed)}</span></div>}{nearby.map(viewpoint => <div className="route-viewpoint" key={viewpoint.place.id}><span className={`tourism-pin tourism-${viewpoint.place.category}`} aria-hidden="true">{tourismCategories[viewpoint.place.category].symbol}</span><button className="stop-label" onClick={() => onPlaceFocus ? onPlaceFocus(viewpoint.place) : onFocus(viewpoint.place.position)}><strong>{viewpoint.place.name}</strong><small>{viewpoint.place.kind} · {(viewpoint.metersFromStart / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 1 })} km vanaf start · {viewpoint.metersFromRoute < 5 ? 'op de route' : Math.round(viewpoint.metersFromRoute) + ' m naast de route'}</small></button></div>)}</li>;
  })}</ol>;
});
