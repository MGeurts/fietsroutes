import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, HardDrive, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { CacheMetadata, clearCache, getCacheStatus } from '../services/knooppuntenCacheService';

interface NetworkDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableNodesCount: number;
  onCacheChanged?: () => void;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return 'nog niet lokaal bewaard';
  return new Date(timestamp).toLocaleString('nl-BE', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** A compact, honest status view. Routing data is bundled with the application; IndexedDB only caches nodes. */
export const NetworkDataModal: React.FC<NetworkDataModalProps> = ({
  isOpen,
  onClose,
  availableNodesCount,
  onCacheChanged,
}) => {
  const [cache, setCache] = useState<CacheMetadata | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => setCache(await getCacheStatus());

  useEffect(() => {
    if (!isOpen) return;
    refresh();
  }, [isOpen]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  if (!isOpen) return null;

  const resetCache = async () => {
    if (!window.confirm('Lokale knooppunten-cache wissen? De ingebouwde netwerkdataset wordt bij een herlaadbeurt opnieuw geladen. Je huidige route blijft zichtbaar.')) return;
    setIsResetting(true);
    try {
      await clearCache();
      await refresh();
      onCacheChanged?.();
      setMessage('De lokale browsercache is gewist.');
    } catch {
      setMessage('De lokale browsercache kon niet worden teruggezet.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 text-white border border-slate-700/80 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <header className="p-4 sm:p-5 border-b border-slate-700/80 flex items-start justify-between gap-3 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Netwerkdata</h2>
              <p className="text-xs text-slate-400 mt-0.5">Routegegevens en lokale browsercache</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center" title="Sluiten">
            <X className="w-4 h-4" />
          </button>
        </header>

        <main className="p-4 sm:p-5 space-y-4">
          <section className="rounded-xl border border-emerald-800/70 bg-emerald-950/30 p-4">
            <div className="flex items-center gap-2 text-emerald-200 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Ingebouwd knooppuntennetwerk
            </div>
            <p className="mt-2 text-xs leading-relaxed text-emerald-100/85">
              Knooppuntverbindingen en hun validatiestatus worden automatisch uit de ingebouwde netwerkdataset geladen. Hiervoor hoeft u geen regio te downloaden of te synchroniseren.
            </p>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm"><HardDrive className="w-4 h-4 text-cyan-300" /> Lokale browsercache</div>
              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${isOnline ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60' : 'bg-amber-950/60 text-amber-300 border-amber-700/60'}`}>
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}{isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="rounded-lg bg-slate-900/70 border border-slate-700 p-3"><div className="text-[11px] text-slate-400">Lokaal bewaard</div><div className="mt-1 text-lg font-bold text-cyan-300">{(cache?.totalNodes ?? availableNodesCount).toLocaleString('nl-BE')}</div><div className="text-[10px] text-slate-500">knooppunten</div></div>
              <div className="rounded-lg bg-slate-900/70 border border-slate-700 p-3"><div className="text-[11px] text-slate-400">Laatst lokaal gewijzigd</div><div className="mt-1 text-xs font-semibold text-slate-200 leading-snug">{formatDate(cache?.lastSyncTimestamp ?? null)}</div></div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Deze cache bewaart knooppuntmarkeringen die eerder zijn geladen. Kaartachtergronden en live fietsroutering hebben nog steeds internet nodig.</p>
          </section>

          {message && <p className="rounded-lg border border-cyan-800 bg-cyan-950/40 px-3 py-2 text-xs text-cyan-100">{message}</p>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-1">
            <button onClick={resetCache} disabled={isResetting} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-200 hover:text-white border border-rose-900/80 hover:bg-rose-950/50 rounded-lg disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> {isResetting ? 'Cache wissen…' : 'Lokale cache wissen'}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 rounded-lg">Sluiten</button>
          </div>
        </main>
      </div>
    </div>
  );
};
