import React, { useState } from 'react';
import { KnooppuntNode } from '../types';
import { Sparkles, RotateCw, X, Check, MapPin } from 'lucide-react';
import { calculateHaversineDistanceKm } from '../services/routingService';

interface RoundTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableNodes: KnooppuntNode[];
  currentNodes: KnooppuntNode[];
  onApplyRoute: (nodes: KnooppuntNode[], name: string) => void;
}

export const RoundTripModal: React.FC<RoundTripModalProps> = ({
  isOpen,
  onClose,
  availableNodes,
  currentNodes,
  onApplyRoute,
}) => {
  const defaultStart = currentNodes[0] || availableNodes[0];
  const [startNodeId, setStartNodeId] = useState(defaultStart?.id || availableNodes[0]?.id || '');
  const [targetKm, setTargetKm] = useState<number>(35);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const startNode =
      availableNodes.find((n) => n.id === startNodeId) ||
      availableNodes.find((n) => n.ref === startNodeId) ||
      availableNodes[0];
    if (!startNode) return;

    // Approximate circuit: find 4-7 nearby nodes forming a loop
    // Distance roughly targetKm / 1.2
    const desiredRadiusKm = Math.max(3, targetKm / 6.2);

    // Filter nodes within viable radius
    const candidates = availableNodes.filter(n => {
      if (n.ref === startNode.ref) return false;
      const d = calculateHaversineDistanceKm(startNode.lat, startNode.lng, n.lat, n.lng);
      return d >= desiredRadiusKm * 0.4 && d <= desiredRadiusKm * 1.8;
    });

    if (candidates.length < 2) {
      // Fallback: pick any 3 closest distinct nodes
      const sorted = [...availableNodes]
        .filter(n => n.ref !== startNode.ref)
        .sort((a, b) => {
          const dA = calculateHaversineDistanceKm(startNode.lat, startNode.lng, a.lat, a.lng);
          const dB = calculateHaversineDistanceKm(startNode.lat, startNode.lng, b.lat, b.lng);
          return dA - dB;
        });
      const loop = [startNode, ...sorted.slice(0, 3), startNode];
      onApplyRoute(loop, `Rondrit vanuit KP ${startNode.ref} (${targetKm} km)`);
      onClose();
      return;
    }

    // Sort candidates by polar angle relative to start node to form a smooth circular loop
    const withAngles = candidates.map(n => {
      const angle = Math.atan2(n.lat - startNode.lat, n.lng - startNode.lng);
      return { node: n, angle };
    });

    withAngles.sort((a, b) => a.angle - b.angle);

    // Pick 3-5 well-spaced angular nodes
    const step = Math.max(1, Math.floor(withAngles.length / 4));
    const picked: KnooppuntNode[] = [];
    for (let i = 0; i < withAngles.length && picked.length < 4; i += step) {
      picked.push(withAngles[i].node);
    }

    // Form circular loop starting and ending at startNode
    const loopNodes = [startNode, ...picked, startNode];
    const routeTitle = `Rondrit ${startNode.name ? startNode.name : `KP ${startNode.ref}`} (${targetKm} km)`;
    onApplyRoute(loopNodes, routeTitle);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <RotateCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Rondrit Generator</h2>
              <p className="text-[11px] text-slate-500">Automatische lus langs fietsknooppunten</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Start- en eindknooppunt:
            </label>
            <select
              value={startNodeId}
              onChange={(e) => setStartNodeId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {availableNodes.map((n) => (
                <option key={n.id || `${n.ref}-${n.lat}-${n.lng}`} value={n.id}>
                  KP {n.ref} - {n.name || 'Knooppunt'} ({n.region || n.municipality || 'Limburg/BE/NL'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Gewenste afstand:</label>
              <span className="text-sm font-black text-emerald-700">{targetKm} km</span>
            </div>
            <input
              type="range"
              min="15"
              max="90"
              step="5"
              value={targetKm}
              onChange={(e) => setTargetKm(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>15 km (kort)</span>
              <span>35 km (gemiddeld)</span>
              <span>60 km (dagtocht)</span>
              <span>90 km</span>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[20, 35, 45, 65].map(km => (
              <button
                key={km}
                type="button"
                onClick={() => setTargetKm(km)}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold border transition cursor-pointer ${
                  targetKm === km
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {km} km
              </button>
            ))}
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-900">
            De generator stelt een gesloten lus samen die terugkeert naar je vertrekpunt langs verharde en veilige fietsknooppunten.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Annuleren
          </button>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Genereer rondrit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
