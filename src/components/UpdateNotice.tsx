import { useEffect, useState } from 'react';
import { activateUpdate } from '../activateUpdate';
import { useRegisterSW } from 'virtual:pwa-register/react';
interface Props { riding: boolean; preserve: () => boolean; allowReload: React.MutableRefObject<boolean> }
export function UpdateNotice({ riding, preserve, allowReload }: Props) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const { needRefresh: [needRefresh, setNeedRefresh] } = useRegisterSW({ immediate: true, onNeedReload: () => {}, onRegisterError: () => setError('Controleren op app-updates is niet gelukt.') });
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const check = async () => { if (navigator.onLine && document.visibilityState === 'visible') { try { const registration = await navigator.serviceWorker.getRegistration(); await registration?.update(); } catch { /* An offline update check must not interrupt a ride. */ } } };
    const interval = setInterval(() => { void check(); }, 60 * 60 * 1000);
    window.addEventListener('online', check); document.addEventListener('visibilitychange', check);
    return () => { clearInterval(interval); window.removeEventListener('online', check); document.removeEventListener('visibilitychange', check); };
  }, []);
  if (!needRefresh && !error) return null;
  async function update() {
    if (riding || busy) return;
    if (!preserve()) { setError('De werkroute kon niet veilig worden bewaard. Bewaar of exporteer haar eerst.'); return; }
    setError(''); setBusy(true); allowReload.current = true;
    try { await activateUpdate(); }
    catch (cause) { allowReload.current = false; setBusy(false); const detail = cause instanceof Error ? cause.message : 'Onbekende updatefout.'; setError(`Bijwerken is niet afgerond: ${detail} Je werkroute is bewaard. Probeer opnieuw of ververs de pagina.`); }
  }
  return <div className="update-banner" role="status"><span>{error || (busy ? 'De update wordt geactiveerd. De app herstart zodra hij klaar is (maximaal 15 seconden).' : riding ? 'Nieuwe versie beschikbaar. Stop de navigatie om bij te werken.' : 'Nieuwe versie beschikbaar. Je werkroute wordt hersteld na de update.')}</span>{needRefresh && <button disabled={riding || busy} onClick={() => void update()}>{busy ? 'Bijwerken…' : 'Bijwerken'}</button>}<button disabled={busy} onClick={() => { setNeedRefresh(false); setError(''); }}>Later</button></div>;
}
