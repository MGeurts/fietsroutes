import { useEffect, useRef, useState } from 'react';
import { distance, type Position } from './domain/network';
import { fetchApproach, type Approach } from './domain/approach';

export function useApproach(location: Position | null, start: Position | null, online: boolean, riding = false, progressMeters = 0, accuracy = 0) {
  const [origin, setOrigin] = useState<Position | null>(null), [retry, setRetry] = useState(0);
  const [reachedStart, setReachedStart] = useState<string | null>(null);
  const [state, setState] = useState<{ route: Approach | null; status: string; destination: string; origin: Position | null }>({ route: null, status: '', destination: '', origin: null });
  const cache = useRef(new Map<string, Approach>());
  const destination = start?.join(',') ?? '';
  const atStart = Boolean(location && start && distance(location, start) <= 25);
  const followingRoute = riding && (reachedStart === destination || (atStart && accuracy <= 75) || progressMeters > 35);
  useEffect(() => {
    if (!riding) setReachedStart(null);
    else if (destination && ((atStart && accuracy <= 75) || progressMeters > 35)) setReachedStart(destination);
  }, [riding, destination, atStart, accuracy, progressMeters]);
  useEffect(() => { if (!followingRoute && location && (!origin || distance(origin, location) >= 50)) setOrigin(location); }, [location, origin, followingRoute]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const set = (route: Approach | null, status: string) => { if (active) setState({ route, status, destination, origin }); };
    if (!origin || !destination || atStart || followingRoute) { set(null, ''); return; }
    const to = destination.split(',').map(Number) as Position;
    const key = `${origin.join(',')}|${destination}`;
    const saved = cache.current.get(key);
    if (saved) { set(saved, ''); return; }
    if (!online) { set(null, 'Aanrijroute niet beschikbaar: internetverbinding nodig.'); return; }
    set(null, 'Fietsaanrijroute berekenen…');
    let timeout: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      timeout = setTimeout(() => controller.abort(), 30000);
      fetchApproach(origin, to, controller.signal).then(route => {
        if (!active) return;
        if (cache.current.size >= 12) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(key, route); set(route, '');
      }).catch(error => { if (active) set(null, error.name === 'AbortError' ? 'De aanrijroute berekenen duurt te lang. Probeer opnieuw.' : error.message || 'De fietsaanrijroute is niet beschikbaar.'); }).finally(() => clearTimeout(timeout));
    }, 500);
    return () => { active = false; clearTimeout(timer); clearTimeout(timeout); controller.abort(); };
  }, [origin, destination, online, retry, atStart, followingRoute]);
  const current = state.destination === destination && state.origin === origin && !atStart && !followingRoute;
  return { route: current ? state.route : null, status: current ? state.status : '', atStart, retry: () => setRetry(value => value + 1) };
}
