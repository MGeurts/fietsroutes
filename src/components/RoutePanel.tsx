import React from 'react';
import { KnooppuntNode, RouteLeg, BikeType, BikeProfile, ElevationPoint } from '../types';
import {
  Bike,
  Download,
  Printer,
  RotateCcw,
  Trash2,
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
  Upload,
  Server,
  Share2,
  Clock,
  Compass,
  ArrowUpDown,
  Zap,
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
  onMoveNode: (index: number, direction: 'up' | 'down') => void;
  onReverseRoute: () => void;
  onClearRoute: () => void;
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
  onMoveNode,
  onReverseRoute,
  onClearRoute,
  onOpenStrookje,
  onExportGpx,
  onOpenRoundTrip,
  onOpenGpxImport,
  onOpenLaravelModal,
}) => {
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
            {selectedNodes.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={onReverseRoute}
                  className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-emerald-700 font-semibold p-1 hover:bg-slate-100 rounded cursor-pointer"
                  title="Draai rijrichting om"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  <span>Draai om</span>
                </button>
                <button
                  onClick={onClearRoute}
                  className="text-[11px] text-red-500 hover:text-red-700 font-semibold p-1 hover:bg-red-50 rounded cursor-pointer"
                  title="Verwijder alle knooppunten"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {selectedNodes.length === 0 ? (
            <div className="p-6 bg-white rounded-xl border border-dashed border-slate-300 text-center space-y-2 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Compass className="w-5 h-5 animate-spin-slow" />
              </div>
              <h4 className="text-xs font-bold text-slate-800">Nog geen knooppunten gekozen</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Klik op de knooppunten op de kaart om je route op te bouwen, of gebruik de knop <strong>Rondrit generator</strong>.
              </p>
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
                    <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-md shadow-xs hover:border-slate-300 transition group">
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
                        <span className="text-slate-400 text-[11px] block truncate">
                          {node.name || node.municipality || node.region || 'Fietsnetwerk'}
                        </span>
                      </div>

                      {/* Item controls */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100">
                        {index > 0 && (
                          <button
                            onClick={() => onMoveNode(index, 'up')}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                            title="Verplaats omhoog"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {index < selectedNodes.length - 1 && (
                          <button
                            onClick={() => onMoveNode(index, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                            title="Verplaats omlaag"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onRemoveNode(index)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded cursor-pointer"
                          title="Verwijder knooppunt"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Distance connector badge between nodes */}
                    {nextLeg && (
                      <div className="flex items-center gap-2 pl-6 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <div className="w-0.5 h-2.5 bg-emerald-300 ml-3" />
                        <span className="bg-emerald-50 px-2 py-0.2 rounded text-[10px] border border-emerald-100">
                          {nextLeg.distanceKm} km
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* System Status footer card - Professional Polish Theme */}
        <div className="pt-2">
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-bold tracking-wide">Systeem Status</span>
              </div>
              <button
                onClick={onOpenLaravelModal}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
              >
                PHP / Laravel
              </button>
            </div>
            <p className="text-[10px] text-slate-400">Hosting: Antagonist Standard PHP (8.2)</p>
            <p className="text-[10px] text-slate-400">Engine: Laravel OSS Core &amp; OpenStreetMap</p>
          </div>
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
