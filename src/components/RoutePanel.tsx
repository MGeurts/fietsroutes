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
  selectedBike: BikeType;
  onChangeBike: (bike: BikeType) => void;
  onRemoveNode: (index: number) => void;
  onMoveNode?: (index: number, direction: 'up' | 'down') => void;
  onReverseRoute: () => void;
  onClearRoute: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  onOpenStrookje: () => void;
  onExportGpx: () => void;
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
  selectedBike,
  onChangeBike,
  onRemoveNode,
  onReverseRoute,
  onClearRoute,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onOpenStrookje,
  onExportGpx,
  onOpenRoundTrip,
  onOpenGpxImport,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
      {/* Route Planning Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Route Planning
          </h2>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Live Netwerk
          </span>
        </div>

        {/* Route Name Input */}
        <input
          type="text"
          value={routeName}
          onChange={(e) => onChangeRouteName(e.target.value)}
          placeholder="Naam van je fietsroute..."
          className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
        />
      </div>

      {/* Route Statistieken Grid - Professional Polish Theme */}
      <div className="p-4 border-b border-slate-100 bg-white">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Route Statistieken
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Afstand</span>
            <span className="text-lg font-bold text-slate-800">{totalDistanceKm} km</span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
              Duur ({currentProfile.averageSpeedKmH} km/u)
            </span>
            <span className="text-lg font-bold text-slate-800">
              {hours > 0 ? `${hours}u ` : ''}{minutes}m
            </span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Hoogte</span>
            <span className="text-lg font-bold text-slate-800">+{elevationGainM} m</span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Knooppunten</span>
            <span className="text-lg font-bold text-slate-800">{selectedNodes.length}</span>
          </div>
        </div>

        {/* Ondergrond / Wegtype Progress */}
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-600 font-medium">Verhard / Fietspad</span>
            <span className="font-bold text-slate-800">92%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '92%' }} />
          </div>
        </div>
      </div>

      {/* Bike Type Selector */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
        <span className="text-[11px] font-semibold text-slate-500">Profiel:</span>
        <div className="flex gap-1">
          {BIKE_PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => onChangeBike(p.id)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                selectedBike === p.id
                  ? 'bg-white text-emerald-700 font-bold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={`${p.label} (~${p.averageSpeedKmH} km/u)`}
            >
              {p.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="p-3 bg-white border-b border-slate-200 grid grid-cols-2 gap-2">
        <button
          onClick={onOpenStrookje}
          disabled={selectedNodes.length === 0}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print strookje</span>
        </button>

        <button
          onClick={onExportGpx}
          disabled={selectedNodes.length === 0}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Download GPX</span>
        </button>

        <button
          onClick={onOpenRoundTrip}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200 transition active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Rondrit generator</span>
        </button>

        <button
          onClick={onOpenGpxImport}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200 transition active:scale-95 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-slate-500" />
          <span>Importeer GPX</span>
        </button>
      </div>

      {/* Scrollable Middle Content: Nodes Sequence & Elevation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
        {/* Elevation Profile widget if available */}
        {totalDistanceKm > 0 && (
          <ElevationProfile
            elevationPoints={elevationPoints}
            totalDistanceKm={totalDistanceKm}
            totalAscentM={elevationGainM}
          />
        )}

        {/* Selected Knooppunten List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              Knooppunten ({selectedNodes.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={onUndo}
                disabled={!canUndo && selectedNodes.length === 0}
                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Laatste wijziging in omgekeerde volgorde ongedaan maken tot en met het startpunt (Ctrl+Z)"
              >
                <Undo2 className="w-3 h-3 text-amber-700" />
                <span>Ongedaan</span>
                {selectedNodes.length > 0 && (
                  <span className="text-[10px] text-amber-700 font-normal">
                    ({selectedNodes[selectedNodes.length - 1].ref})
                  </span>
                )}
              </button>

              {canRedo && onRedo && (
                <button
                  onClick={onRedo}
                  className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded transition active:scale-95 cursor-pointer"
                  title="Opnieuw uitvoeren (Ctrl+Y)"
                >
                  <Redo2 className="w-3 h-3 text-slate-600" />
                  <span className="hidden sm:inline">Opnieuw</span>
                </button>
              )}

              {selectedNodes.length > 1 && (
                <>
                  <button
                    onClick={onReverseRoute}
                    className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-emerald-700 font-semibold p-1 hover:bg-slate-100 rounded cursor-pointer"
                    title="Draai rijrichting om"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="text-[11px] text-red-500 hover:text-red-700 font-semibold p-1 hover:bg-red-50 rounded cursor-pointer"
                    title="Verwijder alle knooppunten"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

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
                Klik op de knooppunten op de kaart om je route op te bouwen, of gebruik de knop <strong>Rondrit generator</strong>.
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
            <div className="space-y-1.5">
              {selectedNodes.map((node, index) => {
                const nextLeg = routeLegs[index];
                const isStart = index === 0;
                const isEnd = index === selectedNodes.length - 1;
                const isInBetween = !isStart && !isEnd;

                return (
                  <div key={`${node.ref}-${index}`} className="flex flex-col">
                    <div className="flex items-center gap-3 bg-white p-2.5 border border-slate-200 rounded-md shadow-xs hover:border-slate-300 transition group">
                      <div className="relative shrink-0 flex items-center justify-center">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-xs bg-white ${
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
                            <span className="text-[10px] uppercase font-bold text-lime-700 bg-lime-50 px-1.5 py-0.5 rounded border border-lime-200">
                              Start
                            </span>
                          )}
                          {isEnd && (
                            <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              Eind
                            </span>
                          )}
                          {isInBetween && (
                            <span className="text-[10px] font-medium text-slate-500">
                              Via
                            </span>
                          )}
                          <span>Knooppunt {node.ref}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 text-[11px] mt-0.5">
                          <span className="text-slate-500 truncate">
                            {node.name || node.municipality || node.region || 'Fietsnetwerk'}
                          </span>
                          {index > 0 && (
                            <span
                              className="shrink-0 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full text-[10px]"
                              title={`Gereden afstand vanaf het startpunt tot knooppunt ${node.ref}`}
                            >
                              {cumulativeDistances[index]} km gereden
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Item remove control (omhoog/omlaag knoppen verwijderd) */}
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
                      <div className="flex items-center gap-2 pl-6 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <div className="w-0.5 h-2.5 bg-emerald-300 ml-3" />
                        <span className="bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-100 flex items-center gap-1.5">
                          <span>+ {nextLeg.distanceKm} km naar KP {selectedNodes[index + 1]?.ref}</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
        <span>© OpenStreetMap contributors | Knooppuntdata NL/BE</span>
        <a
          href="https://github.com/MGeurts/fietsroute"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-600 hover:text-emerald-700 font-medium"
        >
          MGeurts/fietsroute
        </a>
      </div>
    </div>
  );
};
