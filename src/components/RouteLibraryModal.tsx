import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BookOpen, Copy, Download, FolderOpen, LoaderCircle, QrCode, Save, Search, Star, Trash2, Upload, X } from 'lucide-react';
import { SavedRoute } from '../services/routeLibraryService';

interface RouteLibraryModalProps {
  isOpen: boolean;
  routes: SavedRoute[];
  canSave: boolean;
  activeRouteId: string | null;
  shareUrl: string | null;
  feedback: string | null;
  onClose: () => void;
  onSave: () => void;
  onSaveCopy: () => void;
  onOpen: (route: SavedRoute) => void;
  onDelete: (route: SavedRoute) => void;
  onToggleFavorite: (routeId: string) => void;
  onCopyShareUrl: () => void;
  onExportLibrary: () => void;
  onImportLibrary: (file: File) => Promise<void>;
}

const buttonClass = 'inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer';

function searchable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-BE').trim();
}

export const RouteLibraryModal: React.FC<RouteLibraryModalProps> = ({
  isOpen, routes, canSave, activeRouteId, shareUrl, feedback, onClose, onSave, onSaveCopy,
  onOpen, onDelete, onToggleFavorite, onCopyShareUrl, onExportLibrary, onImportLibrary,
}) => {
  const titleId = useId();
  const searchId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importRequestRef = useRef(0);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrResult, setQrResult] = useState<{ source: string; dataUrl: string } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const activeRoute = routes.find((route) => route.id === activeRouteId);
  const visibleRoutes = useMemo(() => {
    const term = searchable(query);
    return routes.filter((route) => (!favoritesOnly || route.favorite)
      && (!term || searchable(route.name).includes(term) || route.nodes.some((node) => searchable(node.ref).includes(term))));
  }, [routes, query, favoritesOnly]);

  useEffect(() => {
    if (!isOpen) {
      setPendingDelete(null);
      setShowQr(false);
      setImportError(null);
      return;
    }
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    setQrResult(null);
    setQrError(null);
    if (isOpen && showQr && shareUrl) {
      void import('qrcode')
        .then((encoder) => encoder.toDataURL(shareUrl, { errorCorrectionLevel: 'L', width: 512, margin: 4 }))
        .then((dataUrl) => { if (!cancelled) setQrResult({ source: shareUrl, dataUrl }); })
        .catch(() => {
          if (!cancelled) setQrError('Deze deellink is te lang voor een QR-code of kon niet worden omgezet. Kopieer de deellink of deel het GPX-bestand via de planner.');
        });
    }
    return () => { cancelled = true; };
  }, [isOpen, showQr, shareUrl]);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const request = ++importRequestRef.current;
    setImporting(true);
    setImportError(null);
    try {
      await onImportLibrary(file);
    } catch (error) {
      if (request === importRequestRef.current) setImportError(error instanceof Error ? error.message : 'De backup kon niet worden geïmporteerd.');
    } finally {
      if (request === importRequestRef.current) setImporting(false);
    }
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from<HTMLElement>(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]') ?? [])
      .filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleDialogKeyDown} className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><BookOpen className="h-4 w-4" aria-hidden="true" /></span>
            <div className="min-w-0"><h2 id={titleId} className="text-sm font-bold text-slate-900">Mijn routebibliotheek</h2><p className="text-[11px] text-slate-500">Lokaal in deze browser, niet gesynchroniseerd.</p></div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="shrink-0 rounded p-2 text-slate-500 hover:bg-slate-200 cursor-pointer" aria-label="Sluit routebibliotheek"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <div className="space-y-2">
            {activeRoute && <p className="break-words text-xs text-slate-600">Geopend uit de bibliotheek: <span className="font-semibold text-slate-900">{activeRoute.name}</span></p>}
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <button type="button" onClick={onSave} disabled={!canSave} className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"><Save className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{activeRoute ? 'Werk bewaarde route bij' : 'Bewaar huidige route'}</button>
              {activeRoute && <button type="button" onClick={onSaveCopy} disabled={!canSave} className={buttonClass}><Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Bewaar als nieuwe route</button>}
              <button type="button" onClick={onCopyShareUrl} disabled={!canSave || !shareUrl} className={buttonClass}><Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Kopieer deellink</button>
              <button type="button" onClick={() => setShowQr((value) => !value)} disabled={!canSave || !shareUrl} aria-expanded={showQr} className={buttonClass}><QrCode className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{showQr ? 'Verberg QR-code' : 'Toon QR-code'}</button>
            </div>
            {feedback && <p role="status" className="break-words rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{feedback}</p>}
            <p className="text-[11px] leading-relaxed text-slate-500">Deellinks en QR-codes bevatten de knooppuntvolgorde en routenaam. De ontvanger berekent de actuele route zelf. De QR-code wordt op dit apparaat gemaakt, zonder externe QR-dienst.</p>
            {showQr && shareUrl && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <h3 className="text-xs font-semibold text-slate-900">Scan om de huidige route te openen</h3>
                {qrError ? <p role="alert" className="mt-2 text-xs leading-relaxed text-amber-800">{qrError}</p> : qrResult?.source === shareUrl ? (
                  <>
                    <img src={qrResult.dataUrl} width={512} height={512} alt="QR-code met de deellink van de huidige fietsroute" className="mx-auto mt-2 h-auto w-full max-w-64 bg-white" />
                    <a href={qrResult.dataUrl} download="fietsroute-qr.png" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline underline-offset-2"><Download className="h-3.5 w-3.5" aria-hidden="true" />Download QR-code</a>
                  </>
                ) : <p role="status" className="mt-3 inline-flex items-center gap-2 text-xs text-slate-600"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />QR-code wordt gemaakt…</p>}
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">De website in de link moet bereikbaar zijn op het andere apparaat. Een lokaal Herd-adres werkt niet buiten je eigen omgeving.</p>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onExportLibrary} disabled={routes.length === 0} className={buttonClass}><Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Backup maken</button>
              <button type="button" onClick={() => importInputRef.current?.click()} disabled={importing} className={buttonClass}>{importing ? <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}{importing ? 'Importeren…' : 'Backup importeren'}</button>
              <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={handleImport} aria-label="Kies een routebibliotheek-backup" />
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">Een backup bevat de volledige bibliotheek met routegegevens en favorieten. Bewaar die buiten je browser: browsergegevens wissen verwijdert ook je lokaal bewaarde routes.</p>
            {importError && <p role="alert" className="break-words rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{importError}</p>}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <label htmlFor={searchId} className="block text-xs font-semibold text-slate-700">Zoek in je routes</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" aria-hidden="true" />
              <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Routenaam of knooppuntnummer" className="w-full min-w-0 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold cursor-pointer ${favoritesOnly ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-current' : ''}`} aria-hidden="true" />Alleen favorieten</button>
              <p role="status" className="text-[11px] text-slate-500">{visibleRoutes.length} van {routes.length} routes</p>
            </div>
          </div>

          <div className="space-y-2">
            {visibleRoutes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">{routes.length === 0 ? 'Nog geen lokaal bewaarde routes.' : 'Geen routes gevonden. Pas je zoekterm of favorietenfilter aan.'}</div>
            ) : visibleRoutes.map((route) => (
              <article key={route.id} className={`rounded-lg border p-3 shadow-xs ${route.id === activeRouteId ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 title={route.name} className="break-words text-xs font-bold text-slate-900">{route.name}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{route.nodes.length} knooppunten · {route.totalDistanceKm.toLocaleString('nl-BE', { maximumFractionDigits: 1 })} km · {new Date(route.savedAt).toLocaleDateString('nl-BE')}</p>
                    {route.id === activeRouteId && <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-700">Momenteel geopend</span>}
                  </div>
                  <button type="button" onClick={() => onToggleFavorite(route.id)} aria-pressed={Boolean(route.favorite)} aria-label={route.favorite ? `Verwijder ${route.name} uit favorieten` : `Maak ${route.name} favoriet`} title={route.favorite ? 'Verwijder uit favorieten' : 'Maak favoriet'} className={`shrink-0 rounded-md p-2 cursor-pointer ${route.favorite ? 'text-amber-600 hover:bg-amber-100' : 'text-slate-400 hover:bg-slate-100 hover:text-amber-600'}`}><Star className={`h-4 w-4 ${route.favorite ? 'fill-current' : ''}`} aria-hidden="true" /></button>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => onOpen(route)} aria-label={`Open ${route.name}`} className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700 cursor-pointer"><FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />Open</button>
                  <button type="button" onClick={() => setPendingDelete(route.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer" aria-label={`Verwijder ${route.name}`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Verwijder</button>
                </div>
                {pendingDelete === route.id && (
                  <div role="group" aria-label={`Bevestig verwijderen van ${route.name}`} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-rose-50 px-2 py-2 text-[11px] text-rose-900">
                    <span>Deze bewaarde route definitief verwijderen?</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPendingDelete(null)} className="rounded px-2 py-1 hover:bg-white cursor-pointer">Annuleren</button>
                      <button type="button" onClick={() => { onDelete(route); setPendingDelete(null); }} className="rounded bg-rose-600 px-2 py-1 font-bold text-white cursor-pointer">Verwijderen</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
