import React, { useState } from 'react';
import { PlannedRoute, BikeType } from '../types';
import { Printer, Copy, Check, X, Share2, Bike, ExternalLink } from 'lucide-react';

interface StrookjePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: PlannedRoute;
  selectedBike: BikeType;
  averageSpeedKmH: number;
}

export const StrookjePrintModal: React.FC<StrookjePrintModalProps> = ({
  isOpen,
  onClose,
  route,
  averageSpeedKmH,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const durationHours = route.totalDistanceKm / averageSpeedKmH;
  const hours = Math.floor(durationHours);
  const minutes = Math.round((durationHours - hours) * 60);

  // Generate plain text format for easy sharing
  const textSummary = `🚴 ${route.name} (${route.totalDistanceKm} km - ca. ${hours}u${minutes > 0 ? ` ${minutes}m` : ''})\n` +
    `Knooppunten: ${route.nodes.map(n => n.ref).join(' ➔ ')}\n\n` +
    route.legs.map((leg, i) => `${i + 1}. [${leg.fromNode.ref}] ➔ ${leg.distanceKm} km ➔ [${leg.toNode.ref}]${leg.toNode.name ? ` (${leg.toNode.name})` : ''}`).join('\n') +
    `\n\nGemaakt met Fietsroute Planner NL & BE (OpenStreetMap & Knooppuntennetwerk)`;

  const handleCopy = () => {
    navigator.clipboard.writeText(textSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              KP
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Fietsknooppunten-strookje</h2>
              <p className="text-[11px] text-slate-500">Klassiek stuurbordstrookje om op je fietsstuur te bevestigen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Printable Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Printable Strip Card */}
          <div
            id="printable-strookje"
            className="border-2 border-dashed border-emerald-500 rounded-xl p-5 bg-white shadow-xs space-y-4 print:border-solid print:m-0 print:p-4"
          >
            {/* Strip Header */}
            <div className="flex items-start justify-between border-b pb-3 border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Knooppuntenroute
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">{route.name}</h3>
                <p className="text-xs text-slate-500">
                  {route.nodes[0]?.municipality || 'Vertrek'} &bull; OpenStreetMap Netwerk
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-emerald-700">{route.totalDistanceKm} <span className="text-sm font-semibold">km</span></div>
                <div className="text-xs text-slate-500 font-medium">ca. {hours}u {minutes}m</div>
              </div>
            </div>

            {/* Visual Node Badges Flow */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Volgorde op het stuur ({route.nodes.length} knooppunten)
              </div>
              <div className="flex flex-wrap items-center gap-2 py-2">
                {route.nodes.map((node, index) => {
                  const nextLeg = route.legs[index];
                  return (
                    <React.Fragment key={`${node.ref}-${index}`}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-white text-emerald-700 font-bold text-sm flex items-center justify-center shadow-xs border-2 border-emerald-500 shrink-0">
                          {node.ref}
                        </div>
                        {nextLeg && (
                          <div className="flex flex-col items-center px-1">
                            <span className="text-[10px] font-bold text-slate-600 leading-none">➔</span>
                            <span className="text-[9px] font-medium text-slate-500">{nextLeg.distanceKm} km</span>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Detailed Legs List */}
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs text-slate-700">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Afstanden tussen knooppunten
              </div>
              {route.legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50 text-xs border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {leg.fromNode.ref}
                    </span>
                    <span className="text-slate-400 font-bold">➔</span>
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {leg.toNode.ref}
                    </span>
                    <span className="text-slate-600 truncate max-w-[200px]">
                      {leg.toNode.name || leg.toNode.municipality || ''}
                    </span>
                    {leg.toNode.highlight && (
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1 rounded border border-amber-200">
                        {leg.toNode.highlight}
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-slate-800 shrink-0">{leg.distanceKm} km</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>https://github.com/MGeurts/fietsroute</span>
              <span>OpenStreetMap &bull; Fietsknooppunten NL &amp; BE</span>
            </div>
          </div>

          {/* Quick instructions */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">💡 Tip voor onderweg:</div>
            <div>Print dit strookje af, knip het uit en plak het met een stukje plakband op je stuurpen of stuurtas. Zo heb je altijd de knooppuntennummers direct in het zicht zonder batterijverbruik van je smartphone!</div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition shadow-xs cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Gekopieerd!' : 'Kopieer tekstlijst'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Sluiten
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print strookje</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
