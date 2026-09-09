import React, { useState, useMemo } from 'react';
import { KnooppuntNode, RouteLeg, BikeType, BikeProfile, ElevationPoint } from '../types';
import {
  Bike,
  Download,
  Printer,
  RotateCcw,
  Trash2,
  Sparkles,
  X,
  Upload,
  Server,
  Share2,
  Clock,
  Compass,
  ArrowUpDown,
  Zap,
  Undo2,
  Redo2,
  ChevronDown,
} from 'lucide-react';
import { ElevationProfile } from './ElevationProfile';

interface RoutePanelProps {
  routeName: string;
  onChangeRouteName: (name: string) => void;
  selectedNodes: KnooppuntNode[];
  routeLegs: RouteLeg[];
  totalDistanceKm: number;
  elevationGainM: number;
  elevationPoints: ElevationPoint[];
  elevationAvailable: boolean;
  elevationLoading: boolean;
  routeError: string | null;
  selectedBike: BikeType;
  onChangeBike: (bike: BikeType) => void;
  onRemoveNode: (index: number) => void;
  onMoveNode?: (index: number, direction: 'up' | 'down') => void;
  onReverseRoute: () => void;
  onClearRoute: () => void;
  onFitRoute?: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  redoNodeRef?: string;
  onOpenStrookje: () => void;
  onExportGpx: () => void;
  canExportRoute: boolean;
  onOpenRoundTrip: () => void;
  onOpenGpxImport: () => void;
  onOpenLaravelModal: () => void;
  onSelectRegion: (center: [number, number], zoom: number) => void;
}

const BIKE_PROFILES: BikeProfile[] = [
  { id: 'stadsfiets', label: 'Stadsfiets', averageSpeedKmH: 15, iconName: 'bike' },
  { id: 'ebike', label: 'E-Bike', averageSpeedKmH: 20, iconName: 'zap' },
  { id: 'racefiets', label: 'Racefiets', averageSpeedKmH: 25, iconName: 'activity' },
  { id: 'gravel', label: 'Gravel / Toerfiets', averageSpeedKmH: 18, iconName: 'compass' },
];

export const RoutePanel: React.FC<RoutePanelProps> = ({
  routeName,
  onChangeRouteName,
  selectedNodes,
  routeLegs,
  totalDistanceKm,
  elevationGainM,
  elevationPoints,
  elevationAvailable,
  elevationLoading,
  routeError,
  selectedBike,
  onChangeBike,
  onRemoveNode,
  onReverseRoute,
  onClearRoute,
  onFitRoute,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  redoNodeRef,
  onOpenStrookje,
  onExportGpx,
  canExportRoute,
  onOpenRoundTrip,
  onOpenGpxImport,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'nodes' | 'elevation'>('nodes');

  // Cumulative distances up to each node (except node 0 which is the start)
  const cumulativeDistances = useMemo(() => {
    let running = 0;
    return selectedNodes.map((_, idx) => {
      if (idx === 0) return 0;
      running += routeLegs[idx - 1]?.distanceKm || 0;
      return Math.round(running * 10) / 10;
    });
  }, [selectedNodes, routeLegs]);

  const currentProfile = BIKE_PROFILES.find((p) => p.id === selectedBike) || BIKE_PROFILES[0];
  const durationHours = totalDistanceKm / currentProfile.averageSpeedKmH;
  const hours = Math.floor(durationHours);
  const minutes = Math.round((durationHours - hours) * 60);

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 w-full shrink-0 shadow-sm z-10 overflow-hidden font-sans">
      {/* Streamlined Unified Header (Clean & compact across Mobile, Tablet, and Desktop) */}
      <div className="shrink-0 bg-white border-b border-slate-200">
        {/* Row 1: Route Name Input + Live indicator */}
        <div className="p-2 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between gap-2">
          <input
            type="text"
            value={routeName}
            onChange={(e) => onChangeRouteName(e.target.value)}
            placeholder="Naam van je fietsroute..."
            className="flex-1 min-w-0 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
          />
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Live Netwerk</span>
            <span className="sm:hidden">Live</span>
          </span>
        </div>

        {/* Row 2: Compact Metrics Bar */}
        <div className="px-3 py-1.5 flex items-center justify-between text-xs bg-white border-b border-slate-100">
          <div className="flex items-center gap-2 sm:gap-3 text-slate-700">
            <div title="Totale afstand">
              <span className="text-[9px] text-slate-400 block uppercase font-bold leading-tight">Afstand</span>
              <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{totalDistanceKm} km</span>
            </div>
            <div className="h-5 w-px bg-slate-200" />
            <div title={`Geschatte duur bij ${currentProfile.averageSpeedKmH} km/u`}>
              <span className="text-[9px] text-slate-400 block uppercase font-bold leading-tight">Duur</span>
              <span className="font-bold text-slate-700 text-xs sm:text-sm">{hours > 0 ? `${hours}u ` : ''}{minutes}m</span>
            </div>
            <div className="h-5 w-px bg-slate-200" />
            <div title="Hoogtemeters klimmen">
              <span className="text-[9px] text-slate-400 block uppercase font-bold leading-tight">Hoogte</span>
              <span className="font-bold text-slate-700 text-xs sm:text-sm">
                {elevationAvailable ? `+${elevationGainM}m` : elevationLoading ? '…' : 'n/b'}
              </span>
            </div>
            <div className="h-5 w-px bg-slate-200" />
            <div title="Aantal knooppunten">
              <span className="text-[9px] text-slate-400 block uppercase font-bold leading-tight">KP</span>
              <span className="font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded text-[11px]">
                {selectedNodes.length}
              </span>
            </div>
          </div>

          {/* Bike profile toggle */}
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="text-[11px] font-semibold text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition shrink-0"
            title="Kies fiets type en snelheid"
          >
            <span>{currentProfile.label.split(' ')[0]}</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expandable Bike Profile selector */}
        {isProfileOpen && (
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1">
            <span className="text-[11px] font-semibold text-slate-500">Profiel:</span>
            <div className="flex gap-1">
              {BIKE_PROFILES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onChangeBike(p.id);
                    setIsProfileOpen(false);
                  }}
                  className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-medium transition cursor-pointer ${
                    selectedBike === p.id
                      ? 'bg-white text-emerald-700 font-bold shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {p.label.split(' ')[0]} ({p.averageSpeedKmH} km/u)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row 3: Quick Action Buttons */}
        <div className="p-2 bg-slate-50/60 flex items-center gap-1.5">
          <button
            onClick={onOpenStrookje}
            disabled={!canExportRoute}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold shadow-2xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
            title="Print strookje voor stuur"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Strookje</span>
          </button>

          <button
            onClick={onExportGpx}
            disabled={!canExportRoute}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-2xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
            title="Download GPX bestand"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>GPX</span>
          </button>

          <button
            onClick={onOpenRoundTrip}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200 shadow-2xs transition active:scale-95 cursor-pointer"
            title="Automatische rondrit generator"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline text-[11px]">Rondrit</span>
          </button>

          <button
            onClick={onOpenGpxImport}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200 shadow-2xs transition active:scale-95 cursor-pointer"
            title="Importeer GPX bestand"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline text-[11px]">Import</span>
          </button>
        </div>
      </div>

      {/* Scrollable Middle Content: Nodes Sequence & Elevation */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 bg-slate-50/50">
        {/* Lijn 1: Knooppunten / Hoogte Toggle (steeds op de eerste lijn) */}
        <div className="w-full">
          <div className="w-full grid grid-cols-2 gap-1 bg-slate-200/70 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('nodes')}
              className={`py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex flex-col items-center justify-center leading-tight ${
                activeTab === 'nodes'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Toon lijst van gekozen knooppunten"
            >
              <span>Knooppunten</span>
              <span className={`text-[10px] ${activeTab === 'nodes' ? 'text-emerald-700 font-semibold' : 'text-slate-400 font-normal'}`}>
                ({selectedNodes.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('elevation')}
              disabled={totalDistanceKm <= 0 || !elevationAvailable}
              className={`py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex flex-col items-center justify-center leading-tight disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'elevation'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={elevationAvailable
                ? 'Toon interactief hoogteprofiel'
                : elevationLoading
                  ? 'Hoogtegegevens worden opgehaald…'
                  : 'Hoogtegegevens konden niet worden opgehaald. Controleer je internetverbinding.'}
            >
              <span>Hoogte</span>
              <span className={`text-[10px] ${activeTab === 'elevation' ? 'text-emerald-700 font-semibold' : 'text-slate-400 font-normal'}`}>
                {elevationAvailable ? `(+${elevationGainM}m)` : elevationLoading ? '(laden…)': '(niet beschikbaar)'}
              </span>
            </button>
          </div>
        </div>

        {/* Lijn 2: Rest van de acties (Ongedaan, Opnieuw, Omdraaien, Verwijderen steeds op de 2e lijn) */}
        <div className="flex items-center justify-between text-xs px-0.5 pt-0.5 pb-0.5">
          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo && selectedNodes.length === 0}
              className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              title={selectedNodes.length > 0 ? `Knooppunt ${selectedNodes[selectedNodes.length - 1].ref} ongedaan maken (Ctrl+Z)` : 'Ongedaan maken (Ctrl+Z)'}
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-700" />
              {selectedNodes.length > 0 && (
                <span className="font-mono text-[11px] font-bold text-amber-800">
                  ({selectedNodes[selectedNodes.length - 1].ref})
                </span>
              )}
            </button>

            {canRedo && onRedo && (
              <button
                onClick={onRedo}
                className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md transition active:scale-95 cursor-pointer"
                title={redoNodeRef ? `Knooppunt ${redoNodeRef} opnieuw toevoegen (Ctrl+Y)` : 'Opnieuw uitvoeren (Ctrl+Y)'}
              >
                <Redo2 className="w-3.5 h-3.5 text-slate-600" />
                {redoNodeRef && (
                  <span className="font-mono text-[11px] font-bold text-slate-800">
                    ({redoNodeRef})
                  </span>
                )}
              </button>
            )}
          </div>

          {selectedNodes.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={onFitRoute}
                className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer transition flex items-center justify-center"
                title="Toon (en centreer) de volledige route op de kaart"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
              </button>

              {selectedNodes.length > 1 && (
                <button
                  onClick={onReverseRoute}
                  className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded cursor-pointer transition"
                  title="Draai rijrichting om"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer transition"
                title="Verwijder alle knooppunten"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {routeError && (
          <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] leading-relaxed text-amber-950">
            <strong>Route niet beschikbaar.</strong> {routeError}
          </div>
        )}

        {routeLegs.some((leg) => leg.isVerified === false) && !routeError && (
          <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] leading-relaxed text-amber-950">
            <strong>Controle nodig.</strong> Een of meer delen zijn met live fietsroutering berekend omdat de exacte officiële weggeometrie ontbreekt.
          </div>
        )}

        {/* Tab 2: Hoogteprofiel view */}
        {activeTab === 'elevation' && totalDistanceKm > 0 && elevationAvailable ? (
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 text-xs">
              <span className="font-bold text-slate-800">Hoogteprofiel van route</span>
              <span className="text-[11px] text-emerald-700 font-semibold">+{elevationGainM}m klimmen</span>
            </div>
            <ElevationProfile
              elevationPoints={elevationPoints}
              totalDistanceKm={totalDistanceKm}
              totalAscentM={elevationGainM}
            />
            <button
              onClick={() => setActiveTab('nodes')}
              className="w-full py-1.5 text-xs text-center text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded border border-emerald-200 font-medium transition cursor-pointer"
            >
              ← Terug naar knooppuntenlijst
            </button>
          </div>
        ) : (
          /* Tab 1: Knooppunten Sequence */
          <div className="space-y-1.5">
            {/* Confirm Clear Route Dialog */}
            {showClearConfirm && (
              <div className="fixed inset-0 z-[1600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900">Route verwijderen?</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Weet je zeker dat je de volledige route met <strong>{selectedNodes.length} knooppunten</strong> ({totalDistanceKm} km) wilt verwijderen?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={() => {
                        onClearRoute();
                        setShowClearConfirm(false);
                      }}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-xs cursor-pointer"
                    >
                      Ja, route verwijderen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedNodes.length === 0 ? (
              <div className="p-6 bg-white rounded-xl border border-dashed border-slate-300 text-center space-y-2 shadow-xs">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Compass className="w-5 h-5 animate-spin-slow" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Nog geen knooppunten gekozen</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Klik op knooppunten op de kaart om je route op te bouwen, of gebruik de <strong>Rondrit generator</strong>.
                </p>
                {canRedo && onRedo && (
                  <div className="pt-1">
                    <button
                      onClick={onRedo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      <Redo2 className="w-3.5 h-3.5 text-amber-700" />
                      <span>Herstel verwijderde route</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {selectedNodes.map((node, index) => {
                    const nextLeg = routeLegs[index];
                    const nextLegNeedsReview = nextLeg?.isVerified === false;
                    const isStart = index === 0;
                    const isEnd = index === selectedNodes.length - 1;
                    const isInBetween = !isStart && !isEnd;

                    return (
                      <div key={`${node.ref}-${index}`} className="flex flex-col">
                        <div className="flex items-center gap-2.5 bg-white p-2 mobile-landscape-compact-card border border-slate-200 rounded-md shadow-xs hover:border-slate-300 transition group">
                          <div className="relative shrink-0 flex items-center justify-center">
                            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-black text-xs bg-white ${
                              isStart
                                ? 'border-lime-500 text-stone-900 ring-2 ring-lime-400/40'
                                : isEnd
                                ? 'border-rose-500 text-stone-900 ring-2 ring-rose-400/40'
                                : 'border-slate-400 text-stone-800'
                            }`}>
                              {node.ref}
                            </div>
                            {isStart && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-lime-500 text-white flex items-center justify-center text-[8px] font-bold shadow-xs" title="Start">
                                ▶
                              </span>
                            )}
                            {isEnd && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[7px] font-bold shadow-xs" title="Einde">
                                ■
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1.5">
                              {isStart && (
                                <span className="text-[10px] uppercase font-bold text-lime-700 bg-lime-50 px-1.5 py-0.2 rounded border border-lime-200">
                                  Start
                                </span>
                              )}
                              {isEnd && (
                                <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  Eind
                                </span>
                              )}
                              {isInBetween && (
                                <span className="text-[10px] font-medium text-slate-400">
                                  Via
                                </span>
                              )}
                              <span>Knooppunt {node.ref}</span>
                              {node.highlight && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded shrink-0" title={node.highlight}>
                                  ★ Highlight
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-1 text-[11px] mt-0.5">
                              <div className="flex items-center gap-1 min-w-0 truncate">
                                <span className="text-slate-500 truncate text-[11px]">
                                  {node.name || node.municipality || node.region || 'Fietsnetwerk'}
                                </span>
                                {node.highlight && (
                                  <span className="text-[10px] text-amber-700 font-medium truncate hidden sm:inline" title={node.highlight}>
                                    &bull; {node.highlight}
                                  </span>
                                )}
                              </div>
                              {index > 0 && (
                                <span
                                  className="shrink-0 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full text-[10px]"
                                  title={`Gereden afstand vanaf het startpunt tot knooppunt ${node.ref}`}
                                >
                                  {cumulativeDistances[index]} km
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Item remove control */}
                          <div className="flex items-center shrink-0 opacity-70 group-hover:opacity-100">
                            <button
                              onClick={() => onRemoveNode(index)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded cursor-pointer"
                              title="Verwijder knooppunt uit route"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Distance connector badge between nodes */}
                        {nextLeg && (
                          <div
                            className={`flex items-center gap-2 pl-4 py-0.5 text-[10px] font-semibold ${
                              nextLegNeedsReview ? 'text-amber-950' : 'text-emerald-700'
                            }`}
                          >
                            <div className={`w-0.5 h-2 ml-3 ${nextLegNeedsReview ? 'bg-amber-300' : 'bg-emerald-300'}`} />
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] border ${
                                nextLegNeedsReview
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-emerald-50 border-emerald-100'
                              }`}
                              title={nextLegNeedsReview ? 'Controle nodig: berekend met live fietsroutering.' : undefined}
                            >
                              + {nextLeg.distanceKm} km naar KP {selectedNodes[index + 1]?.ref}
                              {nextLegNeedsReview && ' · Controle nodig'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom link to view elevation profile */}
                {totalDistanceKm > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>92% verhard fietspad</span>
                    <button
                      onClick={() => setActiveTab('elevation')}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer flex items-center gap-1 hover:underline"
                    >
                      Bekijk hoogteprofiel (+{elevationGainM}m) →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
