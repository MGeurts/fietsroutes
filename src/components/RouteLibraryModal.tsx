import React, { useEffect, useState } from 'react';
import { BookOpen, Copy, FolderOpen, Save, Trash2, X } from 'lucide-react';
import { SavedRoute } from '../services/routeLibraryService';

interface RouteLibraryModalProps {
  isOpen: boolean;
  routes: SavedRoute[];
  canSave: boolean;
  feedback: string | null;
  onClose: () => void;
  onSave: () => void;
  onOpen: (route: SavedRoute) => void;
  onDelete: (route: SavedRoute) => void;
  onCopyShareUrl: () => void;
}

export const RouteLibraryModal: React.FC<RouteLibraryModalProps> = ({
  isOpen, routes, canSave, feedback, onClose, onSave, onOpen, onDelete, onCopyShareUrl,
}) => {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  useEffect(() => { if (!isOpen) setPendingDelete(null); }, [isOpen]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" aria-label="Lokale routebibliotheek">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><BookOpen className="h-4 w-4" /></span>
            <div><h2 className="text-sm font-bold text-slate-900">Mijn routebibliotheek</h2><p className="text-[11px] text-slate-500">Alleen op dit apparaat opgeslagen.</p></div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200 cursor-pointer" aria-label="Sluit routebibliotheek"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onSave} disabled={!canSave} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"><Save className="h-3.5 w-3.5" />Bewaar huidige route</button>
            <button type="button" onClick={onCopyShareUrl} disabled={!canSave} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"><Copy className="h-3.5 w-3.5" />Kopieer deellink</button>
          </div>
          {feedback && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{feedback}</p>}
          <p className="text-[11px] leading-relaxed text-slate-500">Deellinks bevatten alleen de knooppuntvolgorde en routenaam. De ontvanger berekent de actuele route zelf; er wordt niets naar een server gestuurd.</p>
          <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {routes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">Nog geen lokaal bewaarde routes.</div>
            ) : routes.map((route) => (
              <article key={route.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="truncate text-xs font-bold text-slate-900">{route.name}</h3><p className="mt-0.5 text-[11px] text-slate-500">{route.nodes.length} knooppunten · {route.totalDistanceKm} km · {new Date(route.savedAt).toLocaleDateString('nl-BE')}</p></div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => onOpen(route)} className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700 cursor-pointer"><FolderOpen className="h-3 w-3" />Open</button>
                    <button type="button" onClick={() => setPendingDelete(route.id)} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer" aria-label={`Verwijder ${route.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {pendingDelete === route.id && <div className="mt-2 flex items-center justify-between rounded-md bg-rose-50 px-2 py-1.5 text-[11px] text-rose-900"><span>Definitief verwijderen?</span><span className="flex gap-1"><button type="button" onClick={() => setPendingDelete(null)} className="rounded px-1.5 py-0.5 hover:bg-white cursor-pointer">Nee</button><button type="button" onClick={() => { onDelete(route); setPendingDelete(null); }} className="rounded bg-rose-600 px-1.5 py-0.5 font-bold text-white cursor-pointer">Ja</button></span></div>}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
