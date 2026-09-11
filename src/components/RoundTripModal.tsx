import React, { useState, useMemo, useEffect } from 'react';
import { KnooppuntNode } from '../types';
import { Sparkles, RotateCw, X, Check, MapPin, Compass, Navigation, ArrowRight } from 'lucide-react';
import { findNearestRoundTripStart, findRoundTrips, GeneratedLoop } from '../services/roundTripService';

interface RoundTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableNodes: KnooppuntNode[];
  center: { lat: number; lng: number };
  centerLabel: string;
  onApplyRoute: (nodes: KnooppuntNode[], name: string) => void;
}

export const RoundTripModal: React.FC<RoundTripModalProps> = ({
  isOpen,
  onClose,
  availableNodes,
  center,
  centerLabel,
  onApplyRoute,
}) => {
  const [startNodeId, setStartNodeId] = useState<string>('');
  const [targetKm, setTargetKm] = useState<number>(35);
  const [selectedLoopIndex, setSelectedLoopIndex] = useState<number>(0);

  const nearestStart = useMemo(
    () => findNearestRoundTripStart(center, availableNodes),
    [center, availableNodes],
  );

  // Initialize or update start node when modal opens
  useEffect(() => {
    if (isOpen) {
      const preferred = nearestStart?.node;
      if (preferred) {
        setStartNodeId(preferred.id || preferred.ref);
      }
      setSelectedLoopIndex(0);
    }
  }, [isOpen, nearestStart]);

  const activeStartNode = useMemo(() => {
    return (
      availableNodes.find((n) => n.id === startNodeId) ||
      availableNodes.find((n) => n.ref === startNodeId) ||
      nearestStart?.node ||
      availableNodes[0]
    );
  }, [startNodeId, availableNodes, nearestStart]);

  // Compute authentic closed loops matching target distance
  const candidateLoops: GeneratedLoop[] = useMemo(() => {
    if (!activeStartNode) return [];
    return findRoundTrips(activeStartNode, availableNodes, targetKm);
  }, [activeStartNode, availableNodes, targetKm]);

  // Ensure selected loop index is within bounds
  const currentLoop: GeneratedLoop | undefined = candidateLoops[selectedLoopIndex] || candidateLoops[0];

  if (!isOpen) return null;

  const handleApply = () => {
    if (!currentLoop || currentLoop.nodes.length < 2) return;
    const title = `Rondrit ${activeStartNode?.name ? activeStartNode.name : `KP ${activeStartNode?.ref}`} (${currentLoop.distanceKm} km)`;
    onApplyRoute(currentLoop.nodes, title);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Rondrit Generator</h2>
              <p className="text-[11px] text-slate-500">
                Gesloten lus langs opeenvolgende fietsknooppunten
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-950">
            <span className="font-bold">Centrum: </span>{centerLabel}.{' '}
            {nearestStart
              ? <>Start automatisch bij dichtstbijzijnde verbonden KP {nearestStart.node.ref} ({nearestStart.distanceKm.toFixed(1)} km).</>
              : 'Er is nog geen verbonden knooppunt in de geladen netwerkdata.'}
          </div>

          {/* Start Point Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Start- en eindknooppunt:</span>
            </label>
            <select
              value={startNodeId}
              onChange={(e) => {
                setStartNodeId(e.target.value);
                setSelectedLoopIndex(0);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              {availableNodes.map((n) => (
                <option key={n.id || `${n.ref}-${n.lat}-${n.lng}`} value={n.id || n.ref}>
                  KP {n.ref} &bull; {n.name || 'Knooppunt'} ({n.municipality || n.region || 'Limburg'})
                </option>
              ))}
            </select>
          </div>

          {/* Distance Slider & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                <span>Gewenste afstand:</span>
              </label>
              <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {targetKm} km
              </span>
            </div>
            <input
              type="range"
              min="15"
              max="90"
              step="5"
              value={targetKm}
              onChange={(e) => {
                setTargetKm(Number(e.target.value));
                setSelectedLoopIndex(0);
              }}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>15 km (kort)</span>
              <span>35 km (gemiddeld)</span>
              <span>60 km (dagtocht)</span>
              <span>90 km</span>
            </div>

            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              {[20, 30, 35, 45, 60].map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => {
                    setTargetKm(km);
                    setSelectedLoopIndex(0);
                  }}
                  className={`px-3 py-1 text-xs rounded-lg font-bold border transition cursor-pointer ${
                    targetKm === km
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>

          {/* Loop Alternatives / Selection */}
          {candidateLoops.length > 0 ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Gevonden gesloten lussen ({candidateLoops.length}):</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-medium">
                  Zonder doodlopende takken
                </span>
              </div>

              {/* Loop Options Cards */}
              <div className="grid grid-cols-1 gap-2">
                {candidateLoops.map((loop, idx) => {
                  const isSelected = idx === (selectedLoopIndex < candidateLoops.length ? selectedLoopIndex : 0);
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedLoopIndex(idx)}
                      className={`p-3 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'border-2 border-emerald-600 bg-emerald-50/60 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-bold text-xs text-slate-900">
                            {loop.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                            {loop.distanceKm} km
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {loop.nodeCount} knopen
                          </span>
                        </div>
                      </div>

                      {/* Node sequence preview badges */}
                      <div className="flex items-center flex-wrap gap-1 mt-2">
                        {loop.nodes.map((node, nodeIdx) => {
                          const isStartOrEnd = nodeIdx === 0 || nodeIdx === loop.nodes.length - 1;
                          return (
                            <React.Fragment key={nodeIdx}>
                              <span
                                className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  isStartOrEnd
                                    ? 'bg-emerald-700 text-white shadow-2xs'
                                    : 'bg-white text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                {node.ref}
                              </span>
                              {nodeIdx < loop.nodes.length - 1 && (
                                <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Explanatory banner */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-emerald-950 mb-0.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Echte doorlopende rondrit gegarandeerd</span>
                </div>
                <span>
                  Deze route volgt de officiële fietsknooppunten in één vloeiende ronde en keert terug naar KP{' '}
                  {activeStartNode?.ref}. Er zijn <strong>geen stervormige doodlopende wegen</strong> of stukken waar je moet omkeren.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
              <p className="font-bold mb-1">Geen gesloten lus gevonden voor exact deze afstand</p>
              <p>
                Probeer een andere afstand via de schuifbalk (bijvoorbeeld 20 km of 35 km) of kies een ander startknooppunt in het netwerk.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Annuleren
          </button>
          <button
            onClick={handleApply}
            disabled={!currentLoop}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>
              {currentLoop ? `Pas rondrit toe (${currentLoop.distanceKm} km)` : 'Genereer rondrit'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
