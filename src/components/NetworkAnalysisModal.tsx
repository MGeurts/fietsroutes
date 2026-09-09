import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, LoaderCircle, Network, X } from 'lucide-react';
import { KnooppuntNode, OfficialNetworkValidationEntry, OfficialNetworkValidationReport } from '../types';
import { loadNetworkValidationReport } from '../services/networkDataService';

interface NetworkAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  focusNode?: KnooppuntNode;
}

const DEFAULT_FOCUS: KnooppuntNode = {
  id: 'analysis-genk-29', ref: '29', lat: 50.9455188, lng: 5.5460142, name: 'Knooppunt 29',
};

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function isNearFocus(entry: OfficialNetworkValidationEntry, focus: KnooppuntNode, radiusKm: number): boolean {
  if ([entry.from, entry.to].some((endpoint) => endpoint && distanceKm(focus, endpoint) <= radiusKm)) return true;
  // An unresolved relation has no safe coordinates.  Its `ref` may still name
  // the focused junction (for example 29-560), so retain it for investigation
  // without pretending that its location was validated.
  const refs = (entry.ref || '').split(/[-–]/).map((value) => value.trim());
  return refs.includes(focus.ref);
}

function statusLabel(status: OfficialNetworkValidationEntry['status']): string {
  if (status === 'verified-geometry') return 'Geometrie geverifieerd';
  if (status === 'declared-topology') return 'Officiële topologie';
  return 'Onopgelost';
}

function statusClass(status: OfficialNetworkValidationEntry['status']): string {
  if (status === 'verified-geometry') return 'bg-emerald-950/70 border-emerald-700 text-emerald-300';
  if (status === 'declared-topology') return 'bg-amber-950/70 border-amber-700 text-amber-300';
  return 'bg-rose-950/70 border-rose-700 text-rose-300';
}

export const NetworkAnalysisModal: React.FC<NetworkAnalysisModalProps> = ({ isOpen, onClose, focusNode }) => {
  const [report, setReport] = useState<OfficialNetworkValidationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(25);
  const focus = focusNode || DEFAULT_FOCUS;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    loadNetworkValidationReport().then((result) => {
      if (active) {
        setReport(result);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [isOpen]);

  const entries = useMemo(() => (report?.entries || [])
    .filter((entry) => isNearFocus(entry, focus, radiusKm))
    .sort((a, b) => a.status.localeCompare(b.status) || a.relationId - b.relationId), [report, focus, radiusKm]);
  const localSummary = useMemo(() => ({
    verified: entries.filter((entry) => entry.status === 'verified-geometry').length,
    topology: entries.filter((entry) => entry.status === 'declared-topology').length,
    unresolved: entries.filter((entry) => entry.status === 'rejected').length,
  }), [entries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Analyse knooppuntennetwerk">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-700">
          <div className="flex gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 shrink-0"><Network className="w-5 h-5 text-cyan-300" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Netwerkanalyse</h2>
              <p className="text-sm text-slate-400">OSM-relaties rond knooppunt {focus.ref}; brondata en routegeometrie worden afzonderlijk beoordeeld.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg" aria-label="Sluiten"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-5">
            <div className="text-sm text-slate-300">Middelpunt: <strong className="text-white">{focus.name || `Knooppunt ${focus.ref}`}</strong> <span className="text-slate-500">({focus.lat.toFixed(5)}, {focus.lng.toFixed(5)})</span></div>
            <label className="flex items-center gap-2 text-sm text-slate-300">Straal
              <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} className="bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-white">
                <option value={5}>5 km</option><option value={25}>25 km</option><option value={50}>50 km</option>
              </select>
            </label>
          </div>

          {loading && <div className="flex items-center justify-center py-16 gap-2 text-slate-400"><LoaderCircle className="w-5 h-5 animate-spin" /> Validatierapport laden…</div>}
          {!loading && !report && (
            <div className="rounded-xl border border-amber-700/70 bg-amber-950/30 p-5 text-amber-100">
              <div className="flex gap-2 font-semibold"><AlertTriangle className="w-5 h-5 shrink-0" />Nog geen validatierapport beschikbaar</div>
              <p className="mt-2 text-sm text-amber-200/90">Start éénmaal de GitHub Action <strong>Build official cycle-network dataset</strong>. Die maakt <code>benelux_network_validation.json</code> met de analysegegevens aan. Zonder dat bestand toont deze pagina bewust geen geschatte status.</p>
            </div>
          )}
          {!loading && report && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl bg-emerald-950/50 border border-emerald-800 p-3"><div className="text-xl font-bold text-emerald-300">{localSummary.verified}</div><div className="text-xs text-emerald-100">geverifieerde geometrieën</div></div>
                <div className="rounded-xl bg-amber-950/50 border border-amber-800 p-3"><div className="text-xl font-bold text-amber-300">{localSummary.topology}</div><div className="text-xs text-amber-100">officiële topologieën zonder complete lijn</div></div>
                <div className="rounded-xl bg-rose-950/50 border border-rose-800 p-3"><div className="text-xl font-bold text-rose-300">{localSummary.unresolved}</div><div className="text-xs text-rose-100">onopgeloste relaties</div></div>
              </div>
              <p className="text-xs text-slate-500 mb-3">Dataset gebouwd {new Date(report.generatedAt).toLocaleString('nl-BE')}. {entries.length} relaties binnen {radiusKm} km.</p>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <article key={`${entry.country}-${entry.relationId}`} className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${statusClass(entry.status)}`}>{statusLabel(entry.status)}</span>
                      <a className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200" href={`https://www.openstreetmap.org/relation/${entry.relationId}`} target="_blank" rel="noreferrer">Relatie {entry.relationId}<ExternalLink className="w-3.5 h-3.5" /></a>
                      <span className="text-sm text-slate-300">{entry.from && entry.to ? `${entry.from.ref} → ${entry.to.ref}` : entry.ref || 'geen bruikbare eindpunten'}</span>
                      <span className="text-xs text-slate-500">{entry.country}</span>
                    </div>
                    {entry.reason && <p className="mt-2 text-sm text-slate-400">{entry.reason}</p>}
                  </article>
                ))}
                {entries.length === 0 && <div className="rounded-xl border border-slate-700 p-5 text-center text-slate-400"><FileSearch className="w-6 h-6 mx-auto mb-2" />Geen relaties met veilig gekoppelde eindpunten binnen deze straal.</div>}
              </div>
            </>
          )}
        </div>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500 flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />De routeplanner gebruikt topologie; dit scherm maakt zichtbaar wanneer alleen de detaillijn nog ontbreekt.</div>
      </div>
    </div>
  );
};
