import { useEffect, useRef, useState } from 'react';
import { normalizeSearch, searchPlaces, type PlaceResult } from './domain/places';

const emptyResults: PlaceResult[] = [];

export function usePlaces(query: string, online: boolean) {
  const key = normalizeSearch(query);
  const cache = useRef(new Map<string, PlaceResult[]>());
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; results: PlaceResult[]; loading: boolean; error: string }>({ key: '', results: [], loading: false, error: '' });
  const eligible = key.length >= 2 && /\p{L}/u.test(key);
  useEffect(() => {
    if (!eligible) return;
    let active = true;
    const controller = new AbortController();
    const saved = cache.current.get(key);
    if (saved) { setState({ key, results: saved, loading: false, error: '' }); return; }
    if (!online) { setState({ key, results: [], loading: false, error: 'Plaatsen zoeken vereist internet. Knooppunten en netwerken blijven lokaal doorzoekbaar.' }); return; }
    setState({ key, results: [], loading: true, error: '' });
    const timer = setTimeout(() => {
      const timeout = setTimeout(() => controller.abort(), 10000);
      searchPlaces(query, controller.signal).then(results => {
        if (!active) return;
        if (cache.current.size >= 50) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(key, results); setState({ key, results, loading: false, error: '' });
      }).catch(error => {
        if (active) setState({ key, results: [], loading: false, error: error.name === 'AbortError' ? 'Plaatsen zoeken duurt te lang. Probeer opnieuw.' : 'Plaatsen zoeken is tijdelijk niet beschikbaar. Probeer opnieuw.' });
      }).finally(() => clearTimeout(timeout));
    }, 450);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [key, online, retry, eligible]);
  return { results: eligible && state.key === key ? state.results : emptyResults, loading: eligible && (state.key !== key || state.loading), error: eligible && state.key === key ? state.error : '', retry: () => setRetry(n => n + 1) };
}

