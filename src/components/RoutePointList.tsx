import { memo } from 'react';
import { X } from 'lucide-react';
import type { Network, Position } from '../domain/network';
import { cyclingTime, type ItineraryPoint } from '../domain/itinerary';
import { pointRoleLabels } from '../domain/pointRoles';
interface Props { network: Network; points: ItineraryPoint[]; speed: number; riding: boolean; onFocus: (position: Position) => void; onRemove: (index: number) => void }
export const RoutePointList = memo(function RoutePointList({ network, points, speed, riding, onFocus, onRemove }: Props) {
  return <ol className="stop-list">{points.map(({ id, role, stopIndex, metersToNext }, index) => {
    const node = network.nodes.get(id)!, next = points[index + 1];
    const length = metersToNext === null ? '' : metersToNext < 1000 ? `${Math.round(metersToNext)} m` : `${(metersToNext / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 1 })} km`;
    return <li className="itinerary-row" key={`${id}-${index}`}><div className="itinerary-point"><span className={`point-badge role-${role}`} title={pointRoleLabels[role]}>{node.number}</span><button className="stop-label" onClick={() => onFocus(node.position)}><strong>{role === 'start' ? 'Start' : role === 'end' ? 'Einde' : role === 'automatic' ? 'Automatisch' : 'Via'} · {node.number}</strong></button>{stopIndex !== null && <button className="remove-stop" aria-label={`Knooppunt ${node.number} verwijderen`} disabled={riding} onClick={() => onRemove(stopIndex)}><X size={17}/></button>}</div>{metersToNext !== null && next && <div className="itinerary-leg"><span>Naar {network.nodes.get(next.id)!.number}</span><strong>{length}</strong><span>·</span><span>{cyclingTime(metersToNext, speed)}</span></div>}</li>;
  })}</ol>;
});
