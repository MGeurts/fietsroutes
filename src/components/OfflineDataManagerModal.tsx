import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Upload,
  X,
  MapPin,
  Wifi,
  WifiOff,
  HardDrive,
  FileJson,
  Sparkles,
} from 'lucide-react';
import {
  GridSectorInfo,
  getGridSectorsStatus,
  syncSectorLive,
  importPrepackagedBeneluxDataset,
  exportDatabaseToJson,
  importDatabaseFromJson,
  resetDatabaseToDefault,
} from '../services/offlineDataService';
import { getCacheStatus } from '../services/knooppuntenCacheService';

interface OfflineDataManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataUpdated?: () => void;
}

export const OfflineDataManagerModal: React.FC<OfflineDataManagerModalProps> = ({
  isOpen,
  onClose,
  onDataUpdated,
}) => {
  const [sectors, setSectors] = useState<GridSectorInfo[]>([]);
  const [totalCachedNodes, setTotalCachedNodes] = useState<number>(0);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [countryFilter, setCountryFilter] = useState<'ALL' | 'BE' | 'NL'>('ALL');

  // Batch import progress state
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [importProgressPercent, setImportProgressPercent] = useState(0);
  const [importStatusMessage, setImportStatusMessage] = useState('');

  // Single sector syncing state
  const [syncingSectorId, setSyncingSectorId] = useState<string | null>(null);
  const [sectorError, setSectorError] = useState<{ id: string; msg: string } | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load sectors and cache status
  const loadStatus = async () => {
    try {
      const [secList, cacheMeta] = await Promise.all([
        getGridSectorsStatus(),
        getCacheStatus(),
      ]);
      setSectors(secList);
      setTotalCachedNodes(cacheMeta.totalNodes);
      setLastSyncTimestamp(cacheMeta.lastSyncTimestamp);
    } catch (err) {
      console.error('Fout bij ophalen offline status:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Full 1-Click Import
  const handleStartFullImport = async () => {
    setIsImportingAll(true);
    setImportProgressPercent(5);
    setImportStatusMessage('Voorbereiden van download...');
    setSectorError(null);

    try {
      const importedCount = await importPrepackagedBeneluxDataset(
        (pct, msg) => {
          setImportProgressPercent(pct);
          setImportStatusMessage(msg);
        }
      );

      setActionSuccessMessage(`Succesvol ${importedCount.toLocaleString('nl-NL')} knooppunten lokaal opgeslagen voor offline gebruik.`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
      await loadStatus();
      onDataUpdated?.();
    } catch (err: any) {
      setSectorError({ id: 'all', msg: err?.message || 'Fout tijdens importeren van knooppunten.' });
    } finally {
      setIsImportingAll(false);
      setImportProgressPercent(0);
      setImportStatusMessage('');
    }
  };

  // Handle Syncing Single Sector
  const handleSyncSector = async (sector: GridSectorInfo) => {
    if (syncingSectorId || isImportingAll) return;
    setSyncingSectorId(sector.id);
    setSectorError(null);

    try {
      const res = await syncSectorLive(sector.id, (msg) => {
        setActionSuccessMessage(msg);
      });

      setActionSuccessMessage(`${sector.name}: ${res.count} knooppunten bijgewerkt.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
      await loadStatus();
      onDataUpdated?.();
    } catch (err: any) {
      setSectorError({ id: sector.id, msg: err?.message || `Fout bij synchroniseren van ${sector.name}` });
    } finally {
      setSyncingSectorId(null);
    }
  };

  // Handle Export Backup
  const handleExportBackup = async () => {
    try {
      await exportDatabaseToJson();
      setActionSuccessMessage('Database succesvol geëxporteerd als JSON-bestand.');
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setSectorError({ id: 'export', msg: err?.message || 'Fout bij exporteren.' });
    }
  };

  // Handle Import Backup File
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const count = await importDatabaseFromJson(file);
      setActionSuccessMessage(`${count} knooppunten succesvol hersteld uit backup.`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
      await loadStatus();
      onDataUpdated?.();
    } catch (err: any) {
      setSectorError({ id: 'import', msg: err?.message || 'Kon backup bestand niet importeren.' });
    } finally {
      e.target.value = '';
    }
  };

  // Handle Reset to Default Seed
  const handleReset = async () => {
    if (window.confirm('Weet u zeker dat u de lokale database wilt resetten naar de basis dataset?')) {
      await resetDatabaseToDefault();
      setActionSuccessMessage('Database gereset naar de basisconfiguratie.');
      setTimeout(() => setActionSuccessMessage(null), 4000);
      await loadStatus();
      onDataUpdated?.();
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Nooit';
    const d = new Date(timestamp);
    return `${d.toLocaleDateString('nl-NL')} ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white border border-slate-700/80 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Offline Knooppunten Databeheer
                </h2>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                    isOnline
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
                      : 'bg-amber-950/60 text-amber-400 border-amber-700/60'
                  }`}
                >
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Volledige knooppuntennetwerken &amp; verbindingen voor België en Nederland lokaal in uw browser (IndexedDB).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Sluiten"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 divide-y divide-slate-800">
          
          {/* Top Status & 1-Click Import Callout */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 font-medium block">Lokaal opgeslagen</span>
                <span className="text-lg sm:text-xl font-bold text-emerald-400">
                  {totalCachedNodes.toLocaleString('nl-NL')}
                </span>
                <span className="text-[11px] text-slate-500 block">fietsknooppunten</span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 font-medium block">Grid Dekking</span>
                <span className="text-lg sm:text-xl font-bold text-blue-400">
                  {sectors.filter((s) => s.nodeCount > 0).length} / {sectors.length}
                </span>
                <span className="text-[11px] text-slate-500 block">sectoren geladen</span>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 font-medium block">Laatste Synchronisatie</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-200 block truncate mt-1">
                  {formatDate(lastSyncTimestamp)}
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Offline gereed
                </span>
              </div>
            </div>

            {/* Notification Messages */}
            {actionSuccessMessage && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-700/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{actionSuccessMessage}</span>
              </div>
            )}

            {sectorError && (
              <div className="p-3 bg-rose-950/60 border border-rose-700/60 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{sectorError.msg}</span>
              </div>
            )}

            {/* Prominent 1-Click Import Routine */}
            <div className="p-4 bg-gradient-to-br from-emerald-950/40 via-slate-800 to-slate-850 border border-emerald-500/30 rounded-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">
                      1-Klik Volledige Import (België &amp; Nederland)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-md leading-relaxed">
                    Installeer in één keer alle fietsknooppunten en verbindingen voor heel Vlaanderen en de Nederlandse provincies lokaal in uw browser. Daarna werkt de hele planner offline.
                  </p>
                </div>

                <button
                  onClick={handleStartFullImport}
                  disabled={isImportingAll}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 transition flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isImportingAll ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Importeren...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Start 1-malige import</span>
                    </>
                  )}
                </button>
              </div>

              {/* Progress bar during full import */}
              {isImportingAll && (
                <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-medium">{importStatusMessage}</span>
                    <span className="text-slate-400 font-bold">{importProgressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-750 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${importProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grid / Region Overview */}
          <div className="pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span>Grid Sectoren &amp; Update-controle ({sectors.length})</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  U kunt per provincie of deelsector de meest recente wijzigingen ophalen via OpenStreetMap.
                </p>
              </div>

              {/* Country Tabs */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCountryFilter('ALL')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    countryFilter === 'ALL'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Alle ({sectors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCountryFilter('BE')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    countryFilter === 'BE'
                      ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700/50 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>🇧🇪 België</span>
                  <span className="text-[10px] opacity-80">({sectors.filter((s) => s.country === 'BE').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCountryFilter('NL')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    countryFilter === 'NL'
                      ? 'bg-orange-950/80 text-orange-200 border border-orange-700/50 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>🇳🇱 Nederland</span>
                  <span className="text-[10px] opacity-80">({sectors.filter((s) => s.country === 'NL').length})</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {sectors
                .filter((sector) => countryFilter === 'ALL' || sector.country === countryFilter)
                .map((sector) => {
                const isSyncing = syncingSectorId === sector.id;
                const hasNodes = sector.nodeCount > 0;

                return (
                  <div
                    key={sector.id}
                    className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {sector.name}
                        </span>
                        <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                          {sector.country === 'BE' ? '🇧🇪 BE' : '🇳🇱 NL'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {sector.description}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                        <span className={hasNodes ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          {sector.nodeCount.toLocaleString('nl-NL')} knooppunten
                        </span>
                        <span>&bull;</span>
                        <span>{formatDate(sector.lastSyncTimestamp)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSyncSector(sector)}
                      disabled={isSyncing || isImportingAll || !isOnline}
                      className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                      title="Controleer op updates voor deze sector"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                      <span className="hidden sm:inline">{isSyncing ? 'Sync...' : 'Update'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Backup & Tools */}
          <div className="pt-4 space-y-3">
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
              Geavanceerd Databeheer
            </h3>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer"
              >
                <FileJson className="w-4 h-4 text-amber-400" />
                <span>Exporteer backup (JSON)</span>
              </button>

              <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-blue-400" />
                <span>Importeer backup (JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2 bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700 text-slate-400 hover:text-rose-300 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer ml-auto"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Reset naar basis</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-700/80 bg-slate-800/40 flex items-center justify-between text-xs text-slate-400">
          <span>
            Dataopslag: IndexedDB (HTML5 persistent lokaal geheugen)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-750 hover:bg-slate-700 text-white font-medium text-xs rounded-xl transition cursor-pointer"
          >
            Sluiten
          </button>
        </div>

      </div>
    </div>
  );
};
