import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Download, Trash2, CheckCircle2, AlertTriangle, X, MapPin, HardDrive, Info } from 'lucide-react';
import { POPULAR_REGIONS, PopularRegionInfo } from '../data/knooppuntenData';
import { getCacheStatus, clearCache, saveNodesToCache, saveMetadata, CacheMetadata } from '../services/knooppuntenCacheService';
import { fetchKnooppuntenInBBox } from '../services/overpassService';
import { KnooppuntNode } from '../types';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableNodesCount: number;
  onNodesUpdated: (newNodes: KnooppuntNode[]) => void;
  onRegionSelected?: (region: PopularRegionInfo) => void;
  getCurrentMapBounds?: () => { south: number; west: number; north: number; east: number } | null;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  availableNodesCount,
  onNodesUpdated,
  onRegionSelected,
  getCurrentMapBounds,
}) => {
  const [cacheMeta, setCacheMeta] = useState<CacheMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [downloadingRegionId, setDownloadingRegionId] = useState<string | null>(null);

  const refreshMeta = async () => {
    const meta = await getCacheStatus();
    setCacheMeta(meta);
  };

  useEffect(() => {
    if (isOpen) {
      refreshMeta();
      setStatusMessage(null);
    }
  }, [isOpen, availableNodesCount]);

  if (!isOpen) return null;

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Nog niet gesynchroniseerd';
    const d = new Date(timestamp);
    return d.toLocaleString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysAgo = (timestamp: number | null) => {
    if (!timestamp) return null;
    const diffMs = Date.now() - timestamp;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const daysAgo = getDaysAgo(cacheMeta?.lastSyncTimestamp ?? null);
  const isOutdated = daysAgo !== null && daysAgo > 14;

  // Sync current map viewport
  const handleSyncCurrentMap = async () => {
    if (!getCurrentMapBounds) {
      setStatusMessage('Huidige kaartpositie niet beschikbaar.');
      setStatusType('error');
      return;
    }

    const bounds = getCurrentMapBounds();
    if (!bounds) {
      setStatusMessage('Kaart is nog aan het laden.');
      setStatusType('info');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Nieuwste fietsknooppunten ophalen via OpenStreetMap...');
    setStatusType('info');

    try {
      const nodes = await fetchKnooppuntenInBBox(bounds.south, bounds.west, bounds.north, bounds.east);
      if (nodes.length > 0) {
        await saveNodesToCache(nodes);
        await saveMetadata('lastSyncTimestamp', Date.now());
        onNodesUpdated(nodes);
        await refreshMeta();
        setStatusMessage(`${nodes.length} knooppunten gesynchroniseerd en opgeslagen in lokaal geheugen!`);
        setStatusType('success');
      } else {
        setStatusMessage('Geen nieuwe knooppunten gevonden in dit kaartgebied.');
        setStatusType('info');
      }
    } catch {
      setStatusMessage('Kon OpenStreetMap niet bereiken. Controleer je internetverbinding.');
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Download complete region
  const handleDownloadRegion = async (region: PopularRegionInfo) => {
    setDownloadingRegionId(region.id);
    setStatusMessage(`Knooppunten downloaden voor ${region.name}...`);
    setStatusType('info');

    try {
      const [south, west, north, east] = region.bbox;
      const nodes = await fetchKnooppuntenInBBox(south, west, north, east);

      if (nodes.length > 0) {
        await saveNodesToCache(nodes);
        await saveMetadata('lastSyncTimestamp', Date.now());

        const currentRegions = cacheMeta?.cachedRegions || [];
        if (!currentRegions.includes(region.name)) {
          await saveMetadata('cachedRegions', [...currentRegions, region.name]);
        }

        onNodesUpdated(nodes);
        await refreshMeta();

        if (onRegionSelected) {
          onRegionSelected(region);
        }

        setStatusMessage(`${nodes.length} knooppunten gedownload en opgeslagen voor ${region.name}!`);
        setStatusType('success');
      } else {
        setStatusMessage(`Geen knooppunten ontvangen voor ${region.name}.`);
        setStatusType('error');
      }
    } catch {
      setStatusMessage(`Fout bij het ophalen van data voor ${region.name}.`);
      setStatusType('error');
    } finally {
      setDownloadingRegionId(null);
    }
  };

  // Clear cache
  const handleClearCache = async () => {
    if (!window.confirm('Weet je zeker dat je het lokale geheugen wilt wissen? De basisknooppunten blijven bewaard.')) {
      return;
    }

    setIsLoading(true);
    try {
      await clearCache();
      await refreshMeta();
      setStatusMessage('Lokale cache succesvol gewist en teruggezet naar basisset.');
      setStatusType('success');
    } catch {
      setStatusMessage('Fout bij het wissen van de cache.');
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Knooppunten Data &amp; Cache</h2>
              <p className="text-xs text-slate-400">Offline geheugen &amp; synchronisatie voor BE &amp; NL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Sluiten"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
          
          {/* Informative explanation about why not loading entire BE + NL at once */}
          <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200/70 text-xs text-blue-900 space-y-2">
            <div className="flex items-start gap-2 font-semibold text-blue-950">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Waarom niet heel België &amp; Nederland tegelijk laden bij opstarten?</span>
            </div>
            <p className="leading-relaxed text-blue-800 text-[11.5px]">
              België en Nederland tellen samen ruim <strong>50.000 fietsknooppunten</strong> en meer dan <strong>85.000 fietspaden</strong> (samen meer dan 250 MB aan GPS-vectoren).
              Zou de browser dit bij de eerste opstart allemaal in één keer downloaden, dan duurt het opstarten 30 tot 60 seconden, verbruikt het honderden megabytes data en loopt de kaart op smartphones vast.
            </p>
            <p className="leading-relaxed text-blue-800 text-[11.5px]">
              Daarom gebruikt <strong>FietsRoute.io</strong> een slimme lokale <strong>IndexedDB-database</strong>: zodra je een regio bezoekt of zoekt, worden de knooppunten automatisch opgeslagen op je toestel. De volgende keer start alles onmiddellijk in <strong>0,05 seconde</strong> op!
            </p>
          </div>

          {/* Current Cache Status Card */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                Huidig Lokaal Geheugen
              </span>
              {isOutdated ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  <AlertTriangle className="w-3 h-3" />
                  Synchronisatie aanbevolen ({daysAgo}d oud)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  Data is up-to-date
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500">Opgeslagen knooppunten</div>
                <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                  {cacheMeta ? cacheMeta.totalNodes : availableNodesCount}
                  <span className="text-xs font-normal text-slate-500 ml-1">punten</span>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500">Laatste synchronisatie</div>
                <div className="text-xs font-medium text-slate-800 mt-1 truncate" title={formatDate(cacheMeta?.lastSyncTimestamp ?? null)}>
                  {formatDate(cacheMeta?.lastSyncTimestamp ?? null)}
                </div>
              </div>
            </div>

            {/* Sync Current Map Button */}
            <button
              onClick={handleSyncCurrentMap}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Nieuwste data ophalen voor huidig kaartgebied</span>
            </button>
          </div>

          {/* Status feedback message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-in fade-in ${
                statusType === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : statusType === 'error'
                  ? 'bg-red-50 text-red-900 border border-red-200'
                  : 'bg-blue-50 text-blue-900 border border-blue-200'
              }`}
            >
              {statusType === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {statusType === 'error' && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
              {statusType === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
              <span className="leading-snug">{statusMessage}</span>
            </div>
          )}

          {/* Pre-download Regions */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-slate-600" />
                Regio's vooraf downloaden (Offline opslaan)
              </h3>
              <span className="text-[11px] text-slate-500">1-klik opslag</span>
            </div>
            <p className="text-[11.5px] text-slate-600 leading-relaxed">
              Kies een provincie of streek om alle knooppunten vooraf op te slaan in het permanente geheugen van je browser:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {POPULAR_REGIONS.map((reg) => {
                const isDownloading = downloadingRegionId === reg.id;
                return (
                  <div
                    key={reg.id}
                    className="p-3 bg-white border border-slate-200 hover:border-emerald-300 rounded-xl transition flex flex-col justify-between group shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className="font-semibold text-xs text-slate-900 group-hover:text-emerald-800">
                          {reg.name}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                          {reg.country}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {reg.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownloadRegion(reg)}
                      disabled={isDownloading || isLoading}
                      className="mt-2.5 py-1.5 px-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                          <span>Downloaden...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3" />
                          <span>Opslaan in cache</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clear Cache */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Problemen met data of schone lei gewenst?
            </div>
            <button
              onClick={handleClearCache}
              disabled={isLoading}
              className="py-1.5 px-3 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cache legen</span>
            </button>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Sluiten
          </button>
        </div>

      </div>
    </div>
  );
};
