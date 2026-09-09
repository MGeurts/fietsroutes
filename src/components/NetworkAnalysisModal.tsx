import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, LoaderCircle, Network, X } from 'lucide-react';
import { KnooppuntNode, OfficialNetworkValidationEntry, OfficialNetworkValidationReport, RouteConnectionAnalysis } from '../types';
import { loadNetworkValidationReport } from '../services/networkDataService';

interface NetworkAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  focusNode?: KnooppuntNode;
  connection?: RouteConnectionAnalysis;
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
  // A knooppunt number is not globally unique: "29" occurs in many regions.
  // Only coordinates of endpoints that were validated by the importer may place
  // a relation in a regional analysis.  A ref such as "29-560" alone is never
  // sufficient evidence that the relation belongs to Genk.
  return [entry.from, entry.to].some((endpoint) => endpoint && distanceKm(focus, endpoint) <= radiusKm);
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

function geometryLabel(source: RouteConnectionAnalysis['geometrySource']): string | null {
  if (source === 'official') return 'Exacte officiële geometrie';
  if (source === 'official-declared') return 'Officiële relatie, live wegvorm';
  if (source === 'brouter') return 'BRouter-fallback';
  if (source === 'osm-router') return 'OpenStreetMap-routerfallback';
  return null;
}

function geometryClass(source: RouteConnectionAnalysis['geometrySource']): string {
  if (source === 'official') return 'bg-emerald-950/70 border-emerald-700 text-emerald-300';
  if (source === 'official-declared') return 'bg-orange-950/70 border-orange-700 text-orange-300';
  return 'bg-amber-950/70 border-amber-700 text-amber-300';
}

export const NetworkAnalysisModal: React.FC<NetworkAnalysisModalProps> = ({ isOpen, onClose, focusNode, connection }) => {
  const [report, setReport] = useState<OfficialNetworkValidationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(25);
  const focus = connection?.fromNode || focusNode || DEFAULT_FOCUS;

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

  const selectedEntry = useMemo(() => connection?.relationId === undefined
    ? null
    : report?.entries.find((entry) => entry.relationId === connection.relationId) || null, [report, connection]);
  const connectionUsesVerifiedGeometry = connection?.geometrySource === 'official';
  const entries = useMemo(() => connection
    ? selectedEntry ? [selectedEntry] : []
    : (report?.entries || [])
      .filter((entry) => isNearFocus(entry, focus, radiusKm))
      .sort((a, b) => a.status.localeCompare(b.status) || a.relationId - b.relationId), [report, focus, radiusKm, connection, selectedEntry]);
  const localSummary = useMemo(() => {
    if (connection && selectedEntry) {
      const status = connectionUsesVerifiedGeometry ? 'verified-geometry' : selectedEntry.status;
      return {
        verified: status === 'verified-geometry' ? 1 : 0,
        topology: status === 'declared-topology' ? 1 : 0,
        unresolved: status === 'rejected' ? 1 : 0,
      };
    }
    return {
      verified: entries.filter((entry) => entry.status === 'verified-geometry').length,
      topology: entries.filter((entry) => entry.status === 'declared-topology').length,
      unresolved: entries.filter((entry) => entry.status === 'rejected').length,
    };
  }, [connection, connectionUsesVerifiedGeometry, entries, selectedEntry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Analyse knooppuntennetwerk">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-700">
          <div className="flex gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 shrink-0"><Network className="w-5 h-5 text-cyan-300" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">{connection ? `Analyse verbinding ${connection.fromNode.ref} → ${connection.toNode.ref}` : 'Netwerkanalyse'}</h2>
              <p className="text-sm text-slate-400">{connection ? 'De geselecteerde kaartlijn wordt rechtstreeks gekoppeld aan haar bronbewijs.' : `OSM-relaties rond knooppunt ${focus.ref}; brondata en routegeometrie worden afzonderlijk beoordeeld.`}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg" aria-label="Sluiten"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto">
          {connection ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3 mb-5 text-sm text-slate-300">
              <strong className="text-white">{connection.fromNode.name || `Knooppunt ${connection.fromNode.ref}`}</strong> → <strong className="text-white">{connection.toNode.name || `Knooppunt ${connection.toNode.ref}`}</strong>
              <span className="block mt-1 text-xs text-slate-500">Getekend door: {connection.source}</span>
              {geometryLabel(connection.geometrySource) && (
                <span className={`inline-flex mt-2 text-xs font-semibold border rounded-full px-2 py-0.5 ${geometryClass(connection.geometrySource)}`}>
                  {geometryLabel(connection.geometrySource)}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-5">
              <div className="text-sm text-slate-300">Middelpunt: <strong className="text-white">{focus.name || `Knooppunt ${focus.ref}`}</strong> <span className="text-slate-500">({focus.lat.toFixed(5)}, {focus.lng.toFixed(5)})</span></div>
              <label className="flex items-center gap-2 text-sm text-slate-300">Straal
                <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} className="bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-white">
                  <option value={5}>5 km</option><option value={25}>25 km</option><option value={50}>50 km</option>
                </select>
              </label>
            </div>
          )}

          {loading && <div className="flex items-center justify-center py-16 gap-2 text-slate-400"><LoaderCircle className="w-5 h-5 animate-spin" /> Validatierapport laden…</div>}
          {!loading && !report && (
            <div className="rounded-xl border border-amber-700/70 bg-amber-950/30 p-5 text-amber-100">
              <div className="flex gap-2 font-semibold"><AlertTriangle className="w-5 h-5 shrink-0" />Nog geen validatierapport beschikbaar</div>
              <p className="mt-2 text-sm text-amber-200/90">Start éénmaal de GitHub Action <strong>Build official cycle-network dataset</strong>. Die maakt <code>benelux_network_validation.json</code> met de analysegegevens aan. Zonder dat bestand toont deze pagina bewust geen geschatte status.</p>
            </div>
          )}
          {!loading && report && (
            <>
              {connection && connection.relationId === undefined && (
                <div className="rounded-xl border border-amber-700/70 bg-amber-950/30 p-4 text-sm text-amber-100 mb-5"><div className="flex gap-2 font-semibold"><AlertTriangle className="w-5 h-5 shrink-0" />Geen officiële OSM-relatie gekoppeld</div><p className="mt-1 text-amber-200/90">Deze lijn komt van een externe fietsrouter. Zij is zichtbaar als fallback, maar is geen bewezen knooppuntverbinding in de validatiedataset.</p></div>
              )}
              {connection && connection.relationId !== undefined && !selectedEntry && (
                <div className="rounded-xl border border-rose-700/70 bg-rose-950/30 p-4 text-sm text-rose-100 mb-5"><div className="flex gap-2 font-semibold"><AlertTriangle className="w-5 h-5 shrink-0" />Relatie niet gevonden in dit validatierapport</div><p className="mt-1 text-rose-200/90">Relatie {connection.relationId} is wel de bron van de getekende lijn, maar ontbreekt in de momenteel geladen dataset. Bouw de netwerkdataset opnieuw voordat u conclusies trekt.</p></div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl bg-emerald-950/50 border border-emerald-800 p-3"><div className="text-xl font-bold text-emerald-300">{localSummary.verified}</div><div className="text-xs text-emerald-100">geverifieerde geometrieën</div></div>
                <div className="rounded-xl bg-amber-950/50 border border-amber-800 p-3"><div className="text-xl font-bold text-amber-300">{localSummary.topology}</div><div className="text-xs text-amber-100">officiële topologieën zonder complete lijn</div></div>
                <div className="rounded-xl bg-rose-950/50 border border-rose-800 p-3"><div className="text-xl font-bold text-rose-300">{localSummary.unresolved}</div><div className="text-xs text-rose-100">onopgeloste relaties</div></div>
              </div>
              <p className="text-xs text-slate-500 mb-3">Dataset gebouwd {new Date(report.generatedAt).toLocaleString('nl-BE')}. {connection ? `${entries.length} gekoppelde relatie.` : `${entries.length} relaties binnen ${radiusKm} km.`}</p>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const displayedStatus = connection && connectionUsesVerifiedGeometry ? 'verified-geometry' : entry.status;
                  const rawStatusDiffers = displayedStatus !== entry.status;
                  return (
                  <article key={`${entry.country}-${entry.relationId}`} className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${statusClass(displayedStatus)}`}>{statusLabel(displayedStatus)}</span>
                      <a className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200" href={`https://www.openstreetmap.org/relation/${entry.relationId}`} target="_blank" rel="noreferrer">Relatie {entry.relationId}<ExternalLink className="w-3.5 h-3.5" /></a>
                      <span className="text-sm text-slate-300">{entry.from && entry.to ? `${entry.from.ref} → ${entry.to.ref}` : entry.ref || 'geen bruikbare eindpunten'}</span>
                      <span className="text-xs text-slate-500">{entry.country}</span>
                    </div>
                    {rawStatusDiffers ? (
                      <p className="mt-2 text-sm text-slate-400">De kaart gebruikt een lokaal gevalideerde corridor met exacte wegvorm. De ruwe PBF-import kon die oorspronkelijke OSM-relatie niet zelfstandig als één aaneengesloten lijn samenstellen.</p>
                    ) : entry.reason && <p className="mt-2 text-sm text-slate-400">{entry.reason}</p>}
                  </article>
                  );
                })}
                {entries.length === 0 && <div className="rounded-xl border border-slate-700 p-5 text-center text-slate-400"><FileSearch className="w-6 h-6 mx-auto mb-2" />{connection ? 'Voor deze getekende verbinding is geen analyse-item beschikbaar.' : 'Geen relaties met veilig gekoppelde eindpunten binnen deze straal. Relaties zonder geverifieerde locatie worden bewust niet op nummer alleen geplaatst.'}</div>}
              </div>
            </>
          )}
        </div>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500 flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />De routeplanner gebruikt topologie; dit scherm maakt zichtbaar wanneer alleen de detaillijn nog ontbreekt.</div>
      </div>
    </div>
  );
};
