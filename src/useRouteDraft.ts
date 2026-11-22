import { useCallback, useEffect, useRef, useState } from 'react';
import { writeDraft, type RouteDraft } from './domain/draft';
export function useRouteDraft(draft: RouteDraft, enabled: boolean, dirty: boolean) {
  const current = useRef({ draft, enabled, dirty }); current.current = { draft, enabled, dirty };
  const allowReload = useRef(false);
  const [error, setError] = useState('');
  const flush = useCallback(() => {
    if (!current.current.enabled) return !current.current.dirty;
    try { writeDraft(current.current.draft); setError(''); return true; }
    catch { setError('Je werkroute kon niet automatisch worden bewaard. Bewaar of exporteer de route voordat je afsluit.'); return false; }
  }, []);
  useEffect(() => { if (enabled) flush(); }, [draft, enabled, flush]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (current.current.dirty && !allowReload.current) { event.preventDefault(); event.returnValue = ''; }
    };
    const hide = () => { flush(); };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', hide); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', visibility); };
  }, [flush]);
  return { error, flush, allowReload };
}
