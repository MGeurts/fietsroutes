import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bike, Settings2, Zap, Compass, MapPin, Search, Undo2, Redo2, RotateCcw, ArrowDownUp, Save, FolderOpen, Download, Upload, Navigation, LocateFixed, X, Trash2, Star, Plus, Route as RouteIcon, Layers, ZoomIn, ZoomOut, Share2, Printer, Info, Check, Menu, WifiOff } from 'lucide-react';
import { createNetwork, locateOnRoute, planRoute, type Dataset, type Network, type Position, type Progress } from './domain/network';
import { mergeLibrary, parseBackup, readLibrary, writeLibrary, type SavedRoute } from './domain/storage';
import { downloadFile, exportGpx, importGpx } from './domain/gpx';
import { copyRouteName, gpxFilename, roundTripName, suggestedRouteName } from './domain/routeNames';
import { MapView } from './components/MapView';
import { useDeviceLocation } from './useDeviceLocation';
import { useApproach } from './useApproach';
import { usePlaces } from './usePlaces';
import { normalizeSearch, searchJunctions } from './domain/places';
import { pointRoleLabels } from './domain/pointRoles';
import { routeItinerary } from './domain/itinerary';
import { nearbyRouteTourism } from './domain/tourismProximity';
import { routeViewpoints } from './domain/routeViewpoints';
import { fetchApproach } from './domain/approach';
import { pauseAnchor, withPauses, type PauseStop } from './domain/pauseStops';
import { tourismCategories } from './domain/tourism';
import type { TourismPlace, TourismSnapshot } from './domain/tourism';
import { RoutePointList } from './components/RoutePointList';
import { RidePanels } from './components/RidePanels';
import { RoundTripChooser } from './components/RoundTripChooser';
import { UpdateNotice } from './components/UpdateNotice';
import { readRecovery, type RouteDraft } from './domain/draft';
import { useRouteDraft } from './useRouteDraft';

const ShareRoute = lazy(() => import('./components/ShareRoute').then(module => ({ default: module.ShareRoute })));

const km = (m: number) => (m / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 1 });
const meters = (m: number) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${km(m)} km`;

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current!.showModal(); }, []);
  return <dialog ref={dialog} onCancel={close} className="modal"><div className="modal-heading"><h2>{title}</h2><button aria-label="Sluiten" onClick={close}><X size={21}/></button></div>{children}</dialog>;
}

export default function App() {
  const [recovery] = useState(readRecovery);
  const initial = useRef(new URLSearchParams(window.location.hash.slice(1)).has('route') ? null : recovery.draft).current;
  const [tourism, setTourism] = useState<TourismSnapshot | null>(null);
  const [baseNetwork, setNetwork] = useState<Network | null>(null), [loadingError, setLoadingError] = useState('');
  const [pauses, setPauses] = useState<PauseStop[]>(initial?.pauses ?? []);
  const network = useMemo(() => baseNetwork ? withPauses(baseNetwork, pauses) : null, [baseNetwork, pauses]);
  const [tourismFilter, setTourismFilter] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem('fietsroutes:tourism-filter') || 'null'); return Array.isArray(value?.categories) ? value.categories.filter((c: string) => Object.hasOwn(tourismCategories, c)) : ['food', 'sight', 'service']; } catch { return ['food', 'sight', 'service']; } });
  const [alongRoute, setAlongRoute] = useState(() => { try { return JSON.parse(localStorage.getItem('fietsroutes:tourism-filter') || 'null')?.alongRoute !== false; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('fietsroutes:tourism-filter', JSON.stringify({ categories: tourismFilter, alongRoute })); } catch { /* Preferences are optional. */ } }, [tourismFilter, alongRoute]);
  const [pausePlace, setPausePlace] = useState<TourismPlace | null>(null), [pauseMinutes, setPauseMinutes] = useState(20);
  const [pauseProposal, setPauseProposal] = useState<{ pause: PauseStop; stops: string[]; extra: number } | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false), [pauseError, setPauseError] = useState('');
  const openPause = useCallback((place: TourismPlace) => { setPausePlace(place); setPauseProposal(null); setPauseError(''); }, []);
  const [routeReady, setRouteReady] = useState(false);
  const [history, setHistory] = useState<string[][]>(() => [initial?.stops ?? []]), [cursor, setCursor] = useState(0);
  const stops = history[cursor];
  const [name, setName] = useState(initial?.name ?? 'Mijn fietsroute'), [activeId, setActiveId] = useState<string | null>(initial?.activeId ?? null);
  const [library, setLibrary] = useState<SavedRoute[]>([]), [libraryError, setLibraryError] = useState('');
  const [modal, setModal] = useState<'library' | 'round' | 'info' | 'layers' | 'share' | 'tourism' | null>(null);
  const [replacementError, setReplacementError] = useState('');
  const [pendingReplacement, setPendingReplacement] = useState<{ run: () => void } | null>(null);
  const [notice, setNotice] = useState(recovery.error || (initial?.stops.length ? 'Je vorige werkroute is hersteld.' : '')), [query, setQuery] = useState(''), [libraryQuery, setLibraryQuery] = useState('');
  const [speed, setSpeed] = useState(initial?.speed ?? 20), [targetKm, setTargetKm] = useState(30);
  const [tourismEnabled, setTourismEnabled] = useState(initial?.tourismEnabled ?? true);
  const [tileLayer, setTileLayer] = useState(initial?.tileLayer === 'tourism' ? 'network' : initial?.tileLayer ?? 'network'), [mobilePanel, setMobilePanel] = useState(false);
  const [headingUp, setHeadingUp] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(12);
  const [mapCenter, setMapCenter] = useState<Position | null>(null);
  const [zoomCommand, setZoomCommand] = useState({ delta: 0, token: 0 });
  const [focus, setFocus] = useState<{ position?: Position; route?: boolean; highlight?: boolean; place?: TourismPlace; token: number }>({ token: 0 });
  const [riding, setRiding] = useState(false), [progress, setProgress] = useState<Progress | null>(null);
  const [clock, setClock] = useState(Date.now());
  const { location, accuracy, lastFix, heading, currentSpeed, status: locationStatus, locate } = useDeviceLocation(position => setFocus({ position, token: Date.now() }));
  const [online, setOnline] = useState(navigator.onLine);
  const places = usePlaces(query, online);
  const progressRef = useRef(0), upload = useRef<HTMLInputElement>(null);
  const routeResult = useMemo(() => {
    if (!network) return { route: null, error: '' };
    try { return { route: planRoute(network, stops), error: '' }; }
    catch (error) { return { route: null, error: (error as Error).message }; }
  }, [network, stops]);
  const route = routeResult.route;
  const valid = Boolean(route?.steps.length);
  const start = network?.nodes.get(stops[0])?.position ?? null;
  const approach = useApproach(location, start, online, riding, progress?.meters ?? 0, accuracy);
  const savedRoute = library.find(r => r.id === activeId);
  const dirty = stops.length > 0 && (!savedRoute || savedRoute.name !== name || (savedRoute.speed ?? 20) !== speed || JSON.stringify(savedRoute.stops) !== JSON.stringify(stops) || JSON.stringify(savedRoute.pauses ?? []) !== JSON.stringify(pauses.filter(p => stops.includes(p.id))));
  const isSaved = Boolean(savedRoute) && !dirty && stops.length > 0;
  const draft = useMemo<RouteDraft>(() => ({ version: 1, name, stops, activeId, speed, tileLayer, tourismEnabled, pauses }), [name, stops, activeId, speed, tileLayer, tourismEnabled, pauses]);
  const draftBackup = useRouteDraft(draft, routeReady && !routeResult.error && !recovery.error, dirty);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/network.json', { signal: controller.signal }).then(r => { if (!r.ok) throw Error('Het netwerk kon niet worden geladen.'); return r.json(); }).then((data: Dataset) => {
      const next = createNetwork(data);
      const sharedParameters = new URLSearchParams(locationHash());
      const shared = sharedParameters.get('route');
      if (shared) {
        const ids = shared.split(',');
        if (ids.length < 2 || ids.length > 200 || ids.some(id => !next.nodes.has(id))) throw Error('Deze deellink bevat onbekende knooppunten.');
        planRoute(next, ids); setName(sharedParameters.get('name')?.trim().slice(0, 120) || 'Mijn fietsroute'); setActiveId(null); setHistory([[], ids]); setCursor(1); const cleanUrl = new URL(window.location.href); const parameters = new URLSearchParams(cleanUrl.hash.slice(1)); parameters.delete('route'); parameters.delete('name'); cleanUrl.hash = parameters.toString(); window.history.replaceState(null, '', cleanUrl);
      } else if (initial?.stops.length) { planRoute(withPauses(next, initial.pauses ?? []), initial.stops); }
      setNetwork(next); setRouteReady(true);
    }).catch(error => { if (error.name !== 'AbortError') setLoadingError(error.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const load = () => { try { setLibrary(readLibrary()); setLibraryError(''); } catch { setLibraryError('De bibliotheek is niet leesbaar. Opslaan is geblokkeerd om je gegevens te bewaren.'); } };
    load(); window.addEventListener('storage', load); return () => window.removeEventListener('storage', load);
  }, []);
  useEffect(() => { const change = () => setOnline(navigator.onLine); window.addEventListener('online', change); window.addEventListener('offline', change); return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); }; }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 9000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!riding || !route) return;
    progressRef.current = 0; setProgress(null);
    const interval = setInterval(() => setClock(Date.now()), 5000);
    let wakeLock: WakeLockSentinel | null = null, disposed = false;
    const wake = async () => { if ('wakeLock' in navigator && document.visibilityState === 'visible') { try { const lock = await navigator.wakeLock.request('screen'); if (disposed) await lock.release(); else wakeLock = lock; } catch { /* Screen wake lock is optional. */ } } };
    void wake(); document.addEventListener('visibilitychange', wake);
    return () => { disposed = true; clearInterval(interval); document.removeEventListener('visibilitychange', wake); void wakeLock?.release(); };
  }, [riding, route]);
  useEffect(() => {
    if (!riding || !route || !location || accuracy > 75) return;
    const next = locateOnRoute(route, location, progressRef.current, network!);
    progressRef.current = next.meters; setProgress(next);
  }, [riding, route, location, accuracy, lastFix, network]);

  const edit = useCallback((ids: string[]) => {
    if (riding || !network) return;
    try {
      if (ids.length > 200) throw Error('Een route kan maximaal 200 gekozen knooppunten bevatten.');
      planRoute(network, ids);
      setHistory(h => [...h.slice(0, cursor + 1), ids]); setCursor(cursor + 1); setRouteReady(true); setNotice('');
    } catch (error) { setNotice((error as Error).message); }
  }, [riding, network, cursor]);
  const focusTourism = useCallback((place: TourismPlace) => { setMobilePanel(false); setFocus({ position: place.position, place, highlight: true, token: Date.now() }); }, []);
  const focusPoint = useCallback((position: Position) => setFocus({ position, highlight: true, token: Date.now() }), []);
  const removeStop = useCallback((index: number) => edit(stops.filter((_, i) => i !== index)), [stops, edit]);
  function select(id: string) {
    if (riding) return;
    if (stops.at(-1) === id) { setNotice('Dit is al het laatste knooppunt. Kies een ander punt om verder te plannen.'); return; }
    edit([...stops, id]);
  }
  function confirmReplacement(run: () => void) {
    setReplacementError('');
    if (dirty && (savedRoute || stops.length > 1)) setPendingReplacement({ run });
    else run();
  }
  function clearRoute() {
    confirmReplacement(() => { edit([]); setActiveId(null); setName('Mijn fietsroute'); setNotice('Werkroute verwijderd. Je kunt dit ongedaan maken.'); });
  }
  function replace(ids: string[], title: string, id: string | null = null, profileSpeed?: number, message = '', nextPauses: PauseStop[] = []) {
    if (!network) return;
    try {
      planRoute(withPauses(baseNetwork!, nextPauses), ids);
      confirmReplacement(() => { setPauses(current => [...current.filter(p => !nextPauses.some(next => next.id === p.id)), ...nextPauses]); setHistory(h => [...h.slice(0, cursor + 1), ids]); setCursor(cursor + 1); setRouteReady(true); setName(title); setActiveId(id); if (profileSpeed !== undefined) setSpeed(profileSpeed); setModal(null); setNotice(message); setFocus({ route: true, token: Date.now() }); });
    }
    catch (error) { setNotice((error as Error).message); }
  }
  function persist(next: SavedRoute[]) {
    try { if (libraryError) throw Error(libraryError); writeLibrary(next); setLibrary(next); return true; }
    catch { setNotice('Opslaan lukt niet. Controleer de browseropslag of exporteer een backup.'); return false; }
  }
  function save(copy = false) {
    if (!valid) return false;
    try {
      const current = readLibrary(), id = !copy && activeId ? activeId : crypto.randomUUID();
      const saved: SavedRoute = { id, name: copy ? copyRouteName(name, current.map(r => r.name)) : name.trim() || 'Mijn fietsroute', stops, speed, pauses: pauses.filter(p => stops.includes(p.id)), favorite: current.find(r => r.id === id)?.favorite ?? false, updatedAt: new Date().toISOString() };
      if (persist([...current.filter(r => r.id !== id), saved])) { setActiveId(id); setName(saved.name); setNotice(copy ? 'Een kopie is bewaard op dit apparaat.' : 'Route bewaard op dit apparaat.'); return true; }
    } catch { setNotice('De bibliotheek is niet leesbaar. Je bestaande gegevens zijn behouden.'); }
    return false;
  }
  async function importFile(file?: File) {
    if (!file || !network) return;
    try {
      if (file.size > 10000000) throw Error('Kies een bestand kleiner dan 10 MB.');
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const imported = parseBackup(text);
        for (const r of imported) planRoute(withPauses(baseNetwork!, r.pauses ?? []), r.stops);
        if (persist(mergeLibrary(readLibrary(), imported))) setNotice('Backup toegevoegd aan je bibliotheek.');
      } else { const imported = importGpx(text); replace(imported.stops, imported.name, null, undefined, 'GPX ingelezen en opnieuw berekend op het huidige netwerk.', imported.pauses); }
    } catch (error) { setNotice((error as Error).message); }
    if (upload.current) upload.current.value = '';
  }
  const pauseTask = useRef<AbortController | null>(null);
  useEffect(() => () => pauseTask.current?.abort(), []);
  function closePause() { pauseTask.current?.abort(); pauseTask.current = null; setPausePlace(null); setPauseBusy(false); }
  async function proposePause() {
    if (!network || !route || !pausePlace || riding) return;
    setPauseError(''); setPauseBusy(true); pauseTask.current?.abort();
    const controller = new AbortController(); pauseTask.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      if (!online) throw Error('Voor een nieuwe pauzeverbinding is internet nodig.');
      if (pauses.filter(p => stops.includes(p.id)).length >= 20 || stops.length >= 200) throw Error('Deze route heeft het maximum aantal pauzeplaatsen of punten bereikt.');
      if (pauses.some(p => stops.includes(p.id) && p.place.id === pausePlace.id)) throw Error('Deze plaats is al een pauzeplaats.');
      const { anchor, insertAt } = pauseAnchor(network, route, pausePlace);
      const position = network.nodes.get(anchor)!.position;
      const [outward, returning] = await Promise.all([fetchApproach(position, pausePlace.position, controller.signal), fetchApproach(pausePlace.position, position, controller.signal)]);
      if (controller.signal.aborted) return;
      const pause: PauseStop = { id: '9' + Date.now(), anchor, place: pausePlace, minutes: pauseMinutes, outward: outward.coordinates, returning: returning.coordinates };
      const ids = [...stops.slice(0, insertAt), pause.id, ...stops.slice(insertAt)];
      const next = planRoute(withPauses(baseNetwork!, [...pauses, pause]), ids);
      setPauseProposal({ pause, stops: ids, extra: Math.max(0, next.meters - route.meters) });
    } catch (error) { if (pauseTask.current === controller) setPauseError(controller.signal.aborted ? 'Berekenen duurde te lang. Probeer opnieuw.' : (error as Error).message); }
    finally { window.clearTimeout(timeout); if (pauseTask.current === controller) setPauseBusy(false); }
  }
  const searchResults = useMemo(() => {
    const q = normalizeSearch(query); if (!q) return [];
    return [
      ...places.results,
      ...(network ? searchJunctions(network, q, mapCenter ?? location ?? [3.73, 51.05]) : []),
    ];
  }, [query, network, places.results, mapCenter, location]);
  const displayedPoints = useMemo(() => route && network ? routeItinerary(network, route) : [], [route, network]);
  const pauseVisits = useMemo(() => route ? routeViewpoints(route, pauses.filter(p => stops.includes(p.id)).map(p => p.place), 50, true) : [], [route, pauses, stops]);
  const viewpoints = useMemo(() => tourismEnabled && route && tourism ? [...routeViewpoints(route, tourism.places.filter(p => tourismFilter.includes(p.category))).filter(v => !pauseVisits.some(p => p.place.id === v.place.id)), ...pauseVisits].sort((a, b) => a.metersFromStart - b.metersFromStart) : [], [tourismEnabled, route, tourism, tourismFilter, pauseVisits]);
  const displayedNodes = useMemo(() => displayedPoints.map(point => point.id), [displayedPoints]);
  const gpsStale = !lastFix || clock - lastFix > 20000;
  const nearbyTourism = useMemo(() => riding && tourismEnabled && location && !gpsStale && accuracy <= 75 ? nearbyRouteTourism(viewpoints, progress) : [], [riding, tourismEnabled, location, gpsStale, accuracy, viewpoints, progress]);

  return <div className={`app ${riding ? 'is-riding' : ''}`}>
    <UpdateNotice riding={riding} preserve={draftBackup.flush} allowReload={draftBackup.allowReload}/>
    <header className="header"><a className="brand" href="/" aria-label="Fietsroutes startpagina" onClick={e => { e.preventDefault(); setMobilePanel(false); if (valid) setFocus({ route: true, token: Date.now() }); else locate(); }}><span className="brand-icon"><Bike size={27}/></span><span>Fietsroutes<span className="brand-sub">VLAANDEREN</span></span></a><span className="header-tag">Buiten begint hier.</span><div className="header-actions">{!online && <span className="offline"><WifiOff size={16}/> Offline</span>}<span className="header-version">v{__APP_VERSION__}</span><button onClick={() => setModal('info')} title="Over deze app" aria-label="Over de app"><Info size={20}/></button><button title="Bewaarde routes" aria-label="Mijn routes" disabled={riding} onClick={() => setModal('library')}><FolderOpen size={19}/><span>Mijn routes</span><span className="count">{library.length}</span></button></div></header>
    <main className="workspace">
      <aside className={`sidebar ${mobilePanel ? 'mobile-open' : ''}`}>
        <div className="panel-heading"><div><span className="eyebrow">JOUW VOLGENDE FIETSTOCHT</span><h1>Plan je route</h1></div><span className="heading-icon"><RouteIcon size={25}/></span></div>
        <div className="panel-scroll">
          <div className="route-name-heading"><label className="field-label" htmlFor="route-name">Naam van je route</label><button type="button" disabled={!valid || riding} onClick={() => { if (route && network) setName(suggestedRouteName(network.nodes.get(stops[0])?.number ?? 'Start', network.nodes.get(stops.at(-1)!)?.number ?? 'Einde', route.meters, stops[0] === stops.at(-1))); }}>Suggestie</button></div><input id="route-name" className="name-input" maxLength={120} value={name} disabled={riding} onChange={e => setName(e.target.value)}/>
          {stops.length > 0 && <div className={`route-save-status ${isSaved ? 'is-saved' : 'is-unsaved'}`} role="status">{isSaved ? <Check size={13} aria-hidden="true"/> : <span aria-hidden="true">●</span>}{isSaved ? 'Bewaard op dit apparaat' : 'Niet bewaard'}</div>}
          <div className="stats"><div><strong>{km(route?.meters ?? 0)}<small> km</small></strong><span>Afstand</span></div><div><strong>{Math.floor((route?.meters ?? 0) / 1000 / speed)}<small> u </small>{Math.round((route?.meters ?? 0) / 1000 / speed * 60) % 60}<small> min</small></strong><span>Geschatte fietstijd</span></div></div>
          <label className="field-label" htmlFor="bike">Ik fiets met een</label><div className="bike-select"><Bike size={20}/><select id="bike" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={15}>Stadsfiets · 15 km/u</option><option value={18}>Toerfiets · 18 km/u</option><option value={20}>E-bike · 20 km/u</option><option value={25}>Racefiets · 25 km/u</option></select></div>
          <div className="section-title"><h2>Knooppunten <span>{displayedNodes.length}</span></h2><div className="small-actions"><button title="Ongedaan maken" aria-label="Ongedaan maken" disabled={!cursor || riding} onClick={() => setCursor(cursor - 1)}><Undo2 size={18}/></button><button title="Opnieuw" aria-label="Opnieuw" disabled={cursor >= history.length - 1 || riding} onClick={() => setCursor(cursor + 1)}><Redo2 size={18}/></button><button className="route-fit-action" title="Volledige route centreren" aria-label="Volledige route centreren" disabled={!stops.length} onClick={() => { setMobilePanel(false); setFocus(valid ? { route: true, token: Date.now() } : { position: network!.nodes.get(stops[0])!.position, token: Date.now() }); }}><LocateFixed size={18}/></button><button title="Route omkeren" aria-label="Route omkeren" disabled={!valid || riding} onClick={() => edit([...stops].reverse())}><ArrowDownUp size={18}/></button><button className="route-delete-action" title="Route verwijderen" aria-label="Route verwijderen" disabled={!stops.length || riding} onClick={clearRoute}><Trash2 size={18}/></button></div></div>
          {stops.length > 0 && <div className="point-legend" aria-label="Betekenis knooppuntmarkeringen">{(['start', 'manual', 'automatic', 'end'] as const).map(role => <span key={role}><b className={`point-badge role-${role}`}>{({ start: 'S', manual: 'M', automatic: 'A', end: 'E' })[role]}</b>{({ start: 'Start', manual: 'Manueel', automatic: 'Automatisch', end: 'Einde' })[role]}</span>)}</div>}
          {stops.length === 0 ? <div className="empty-route"><div className="empty-symbol"><MapPin size={27}/></div><h3>Waar start je?</h3><p>Klik op een groen knooppunt op de kaart. Kies daarna je volgende punt; wij verbinden ze via het netwerk.</p><span className="example-nodes"><b>12</b><i/><b>28</b><i/><b>36</b></span></div> : (network && <RoutePointList onPlaceFocus={focusTourism} viewpoints={viewpoints} network={network} points={displayedPoints} speed={speed} riding={riding} onFocus={focusPoint} onRemove={removeStop}/>)}
          {displayedNodes.length > 0 && <div className="via-strip"><span>Volledige knooppuntvolgorde</span><div>{displayedPoints.map(({ id, role }, i) => <b className={`point-badge role-${role}`} title={`${pointRoleLabels[role]} · ${network!.nodes.get(id)!.number}`} key={`${id}-${i}`}>{network!.nodes.get(id)!.number}</b>)}</div></div>}
          {pauses.filter(p => stops.includes(p.id)).length > 0 && <div className="pause-summary"><strong>Pauzeplaatsen</strong>{pauses.filter(p => stops.includes(p.id)).map(p => <div key={p.id}><button className="text-button" onClick={() => focusTourism(p.place)}>{p.place.name} · {p.minutes} min</button><button aria-label={p.place.name + ' als pauzeplaats verwijderen'} disabled={riding} onClick={() => edit(stops.filter(id => id !== p.id))}><X size={16}/></button></div>)}<small>Geschatte totale tijd inclusief pauzes: {Math.round((route?.meters ?? 0) / 1000 / speed * 60) + pauses.filter(p => stops.includes(p.id)).reduce((sum, p) => sum + p.minutes, 0)} min</small></div>}
          <button className="round-button" disabled={!network || riding} onClick={() => setModal('round')}><RotateCcw size={19}/><span><strong>Maak er een rondrit van</strong><small>Een lus op maat van jouw afstand</small></span><Plus size={19}/></button>
          <div className="tool-grid"><button className={isSaved ? 'save-button is-saved' : 'save-button'} disabled={!valid || riding || Boolean(libraryError) || isSaved} onClick={() => save()}>{isSaved ? <Check size={18}/> : <Save size={18}/>}<span>{isSaved ? 'Bewaard' : savedRoute ? 'Wijzigingen bewaren' : 'Bewaren'}</span></button><button disabled={!valid} onClick={() => setModal('share')}><Share2 size={18}/>Delen</button><button disabled={!valid} onClick={() => downloadFile(exportGpx(route!, name, network!, pauses.filter(p => stops.includes(p.id))), gpxFilename(name), 'application/gpx+xml')}><Download size={18}/>GPX Export</button><button disabled={riding} onClick={() => upload.current?.click()}><Upload size={18}/>GPX Import</button><button disabled={!valid} onClick={() => window.print()}><Printer size={18}/>Strookje</button><button disabled={!stops.length || riding} onClick={clearRoute}><Plus size={18}/>Nieuwe route</button></div>
          {activeId && <button className="text-button" disabled={riding || !valid} onClick={() => save(true)}>Als nieuwe kopie bewaren</button>}
          
        </div>
        <div className="panel-bottom"><button className="primary ride-button" disabled={!valid || riding} onClick={() => { if (!navigator.geolocation) { setNotice('GPS wordt niet ondersteund.'); return; } setClock(Date.now()); setHeadingUp(true); setRiding(true); setMobilePanel(false); }}><Navigation size={20}/>Start met fietsen</button></div>
      </aside>
      <section className="map-section" aria-label="Routekaart"><MapView tourismCategories={tourismFilter} tourismAlongRoute={alongRoute} onPause={openPause} nearbyTourism={nearbyTourism} tourismEnabled={tourismEnabled} onTourismData={setTourism} heading={heading ?? null} headingUp={headingUp} network={network} route={route} approach={approach.route} accuracy={accuracy} onSelect={select} focus={focus} location={location} riding={riding} tileLayer={tileLayer} zoomCommand={zoomCommand} onCenterChange={setMapCenter} onZoomChange={setZoomLevel}/>
        <div className={`map-feedback ${riding ? 'during-ride' : ''}`} aria-live="polite">
          {locationStatus && <div><LocateFixed size={17}/><span>{locationStatus}</span>{!locationStatus.endsWith('…') && <button onClick={locate}>Opnieuw</button>}</div>}
        </div>
        {!riding && <><div className="map-top"><div className="search-box"><Search size={20}/><input aria-label="Zoek een plaats of knooppunt" placeholder="Zoek plaats, netwerk of knooppunt…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Zoekopdracht wissen" onClick={() => setQuery('')}><X size={18}/></button>}{query && <div className="search-results">{searchResults.length ? searchResults.map(r => <button key={r.key} onClick={() => { setFocus({ position: r.position, token: Date.now() }); setQuery(''); }}><MapPin size={18}/><span><strong>{r.label}</strong><small>{r.sub}</small></span></button>) : !places.loading && !places.error && <p>{query.trim().length < 2 ? 'Typ minstens twee letters voor een plaats, of zoek een knooppuntnummer.' : 'Geen plaats, knooppunt of netwerk gevonden.'}</p>}{places.loading && <p role="status">Plaatsen zoeken…</p>}{places.error && <p role="status">{places.error} <button onClick={places.retry}>Opnieuw</button></p>}</div>}</div></div>
        </>}
        {riding && <RidePanels pauseMinutes={pauses.filter(p => stops.includes(p.id) && (pauseVisits.find(v => v.place.id === p.place.id)?.metersFromStart ?? Infinity) >= (progress?.meters ?? 0)).reduce((sum, p) => sum + p.minutes, 0)} nearbyTourism={nearbyTourism} network={network} progress={progress} totalMeters={route?.meters ?? 0} currentSpeed={currentSpeed ?? null} profileSpeed={speed} accuracy={accuracy} gpsStale={gpsStale} now={clock} onStop={() => { setRiding(false); setProgress(null); }}/> }
        <div className={`map-control-stack ${riding ? 'during-ride' : ''}`} role="group" aria-label="Kaartbediening">
          {riding && <button className="map-button orientation-button" onClick={() => setHeadingUp(value => !value)} title={headingUp ? 'Rijrichting bovenaan — schakel naar noorden bovenaan' : 'Noorden bovenaan — schakel naar rijrichting bovenaan'} aria-label={headingUp ? 'Rijrichting bovenaan' : 'Noorden bovenaan'} aria-pressed={headingUp}>{headingUp ? <Navigation size={18}/> : <Compass size={18}/>}</button>}
          <button className="map-button" onClick={locate} title="Centreren op mijn locatie" aria-label="Kaart centreren"><LocateFixed size={20}/></button>
          <div className="tourism-controls" role="group" aria-label="Toerismebediening">
          <button className="map-button tourism-settings" aria-label="Toerisme instellen" title="Toerisme instellen" onClick={() => setModal('tourism')}><Settings2 size={18}/></button>
          <button className="map-button tourism-toggle" onContextMenu={e => { e.preventDefault(); setModal('tourism'); }} aria-label="Toerisme" title={tourismEnabled ? 'Toerisme uitschakelen' : 'Toerisme inschakelen'} aria-pressed={tourismEnabled} onClick={() => setTourismEnabled(value => !value)}><Info size={20}/></button>
          </div>
          <div className="map-zoom-group"><div className="map-zoom-level" aria-label={`Zoomniveau ${zoomLevel}`}><strong>z {zoomLevel}</strong><small>detail</small></div><button aria-label="Inzoomen" title="Inzoomen" onClick={() => setZoomCommand(c => ({ delta: 1, token: c.token + 1 }))} disabled={zoomLevel >= 19}><ZoomIn size={19}/></button><button aria-label="Uitzoomen" title="Uitzoomen" onClick={() => setZoomCommand(c => ({ delta: -1, token: c.token + 1 }))} disabled={zoomLevel <= 0}><ZoomOut size={19}/></button>
          <button onClick={() => setModal('layers')} aria-label="Kaartlagen kiezen" title="Kaartlagen kiezen" aria-haspopup="dialog"><Layers size={20}/></button></div>
        </div>
      </section>
    </main>
    {!riding && <nav className="mobile-nav"><button className={!mobilePanel ? 'active' : ''} onClick={() => setMobilePanel(false)}><MapPin size={20}/>Kaart</button><button className={mobilePanel ? 'active' : ''} onClick={() => setMobilePanel(true)}><Menu size={20}/>Mijn route <b>{stops.length}</b></button></nav>}
    {(notice || loadingError || routeResult.error || libraryError || draftBackup.error || recovery.error) && <div role="status" className="toast"><Info size={20}/><span>{notice || loadingError || routeResult.error || libraryError || draftBackup.error || recovery.error}</span>{notice && <button aria-label="Melding sluiten" onClick={() => setNotice('')}><X size={18}/></button>}</div>}
    <input ref={upload} type="file" accept=".gpx,.json" hidden onChange={e => void importFile(e.target.files?.[0])}/>
    {modal === 'layers' && <Modal title="Kaartlagen" close={() => setModal(null)}><p className="muted">Kies je favoriete achtergrondkaart.</p><div className="layer-options">{[{ id: 'osm', title: 'Standard (OSM)', badge: 'Basiskaart', description: 'Klassieke kaartweergave van OpenStreetMap.' }, { id: 'network', title: 'OSM + Fietsnetwerk', badge: 'Standaard', description: 'OpenStreetMap met de officiële fietsknooppuntverbindingen.' }, { id: 'cycle', title: 'CyclOSM', badge: 'Fietskaart', description: 'Fietsgerichte kaart met fietsinfrastructuur en reliëf.' }].map(layer => <button key={layer.id} className={`layer-option ${layer.id}`} aria-pressed={tileLayer === layer.id} onClick={() => { setTileLayer(layer.id); setModal(null); }}><span className="layer-option-title"><strong>{layer.title}</strong><small>{layer.badge}</small>{tileLayer === layer.id && <Check size={20}/>}</span><span className="layer-option-description">{layer.description}</span></button>)}</div></Modal>}
    {modal === 'library' && <Modal title="Mijn routes" close={() => setModal(null)}><p className="muted">Je routes worden op dit apparaat bewaard. Gebruik een backup om ze over te zetten.</p><input className="name-input" placeholder="Zoek in je routes" aria-label="Zoek in je routes" value={libraryQuery} onChange={e => setLibraryQuery(e.target.value)}/><div className="library-list">{library.length === 0 && <div className="empty-route"><FolderOpen size={32}/><h3>Je eerste route wacht op je</h3><p>Plan een tocht en kies Bewaren.</p></div>}{library.filter(r => r.name.toLowerCase().includes(libraryQuery.toLowerCase())).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt)).map(r => <div className={`library-item ${r.id === activeId ? 'is-active' : ''}`} key={r.id}><button aria-label={r.favorite ? 'Favoriet verwijderen' : 'Favoriet maken'} onClick={() => persist(library.map(item => item.id === r.id ? { ...item, favorite: !item.favorite } : item))}><Star size={20} fill={r.favorite ? '#f4bd42' : 'none'}/></button><button className="library-open" onClick={() => replace(r.stops, r.name, r.id, r.speed ?? 20, '', r.pauses ?? [])}><strong>{r.name}</strong><span className="library-bike-profile" title={`Bewaard met ${r.speed === undefined ? 'standaardprofiel: ' : ''}${({15: 'Stadsfiets', 18: 'Toerfiets', 20: 'E-bike', 25: 'Racefiets'} as Record<number, string>)[r.speed ?? 20]} · ${r.speed ?? 20} km/u`}><span className="library-bike-icon" aria-hidden="true"><Bike size={18}/>{(r.speed ?? 20) === 20 && <Zap size={10}/>}</span>{({15: 'Stadsfiets', 18: 'Toerfiets', 20: 'E-bike', 25: 'Racefiets'} as Record<number, string>)[r.speed ?? 20]}</span>{r.id === activeId && <span className="library-active-label"><Check size={12} aria-hidden="true"/>Geopend</span>}<small>{r.stops.length} gekozen knooppunten · {new Date(r.updatedAt).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</small></button><button aria-label={`Route ${r.name} verwijderen`} onClick={() => { if (window.confirm(`“${r.name}” verwijderen uit de bibliotheek?`)) { if (persist(library.filter(item => item.id !== r.id)) && activeId === r.id) setActiveId(null); } }}><Trash2 size={18}/></button></div>)}</div><div className="modal-actions"><button onClick={() => upload.current?.click()}><Upload size={18}/>Backup importeren</button><button disabled={!library.length} onClick={() => downloadFile(JSON.stringify({ version: 1, routes: library }, null, 2), 'fietsroutes-backup.json', 'application/json')}><Download size={18}/>Backup downloaden</button></div></Modal>}
    {modal === 'share' && valid && <Modal title="Deel je route" close={() => setModal(null)}><Suspense fallback={<p role="status">QR-code laden…</p>}>{pauses.some(p => stops.includes(p.id)) ? <><p>Deel deze route als GPX om de pauzeplaatsen en hun verbindingen mee te nemen.</p><button onClick={() => downloadFile(exportGpx(route!, name, network!, pauses.filter(p => stops.includes(p.id))), gpxFilename(name), 'application/gpx+xml')}><Download size={18}/>GPX met pauzeplaatsen</button></> : <ShareRoute stops={stops} name={name}/>}</Suspense></Modal>}
    {modal === 'round' && network && <Modal title="Kies jouw rondrit" close={() => setModal(null)}><RoundTripChooser network={network} start={stops[0]} targetKm={targetKm} onDistance={setTargetKm} speed={speed} onChoose={(result, direction) => replace(result.stops, roundTripName(network.nodes.get(result.stops[0])!.number, result.meters, direction))}/></Modal>}
    {modal === 'tourism' && <Modal title="Toerisme" close={() => setModal(null)}><label className="tourism-choice"><input type="checkbox" checked={tourismEnabled} onChange={e => setTourismEnabled(e.target.checked)}/>Toeristische plaatsen tonen</label><fieldset className="tourism-options"><legend>Wat wil je zien?</legend>{Object.entries(tourismCategories).map(([key, category]) => <label className="tourism-choice" key={key}><input type="checkbox" checked={tourismFilter.includes(key)} onChange={e => setTourismFilter(current => e.target.checked ? [...current, key] : current.filter(c => c !== key))}/><span aria-hidden="true">{category.symbol}</span>{category.label}</label>)}</fieldset><label className="tourism-choice"><input type="checkbox" checked={alongRoute} onChange={e => setAlongRoute(e.target.checked)}/>Alleen langs mijn route (binnen 500 m)</label>{alongRoute && !valid && <p className="muted">Plan eerst een route om plaatsen erlangs te zien.</p>}<p className="muted">De routelijst toont bezienswaardigheden, toiletten en drinkwater binnen 50 meter. Een gekozen pauzeplaats blijft altijd in je route.</p><button className="primary" onClick={() => setModal(null)}>Klaar</button></Modal>}
    {pausePlace && <Modal title="Pauzeplaats toevoegen" close={closePause}><p className="unsaved-route-name">{pausePlace.name}</p><label className="field-label" htmlFor="pause-minutes">Pauzetijd</label><select className="pause-time-select" id="pause-minutes" value={pauseMinutes} disabled={pauseBusy} onChange={e => { setPauseMinutes(Number(e.target.value)); setPauseProposal(null); }}>{[0, 10, 15, 20, 30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{n === 0 ? 'Geen pauzetijd' : n + ' minuten'}</option>)}</select>{!valid && <p className="muted">Plan eerst een route met minstens twee knooppunten.</p>}<p className="muted">We berekenen een fietsbare verbinding vanaf een routeknooppunt naar deze plaats en terug. De extra afstand en pauzetijd tellen mee. Nieuwe verbindingen worden via BRouter berekend.</p>{pauseError && <p role="alert" className="missing-start">{pauseError}</p>}{pauseProposal && <p>Extra fietsafstand: <strong>{km(pauseProposal.extra)} km</strong> · Pauze: <strong>{pauseMinutes} min</strong></p>}<div className="modal-actions"><button onClick={closePause}>Annuleren</button>{pauseProposal ? <button className="primary" onClick={() => { setPauses(current => [...current, pauseProposal.pause]); setHistory(h => [...h.slice(0, cursor + 1), pauseProposal.stops]); setCursor(cursor + 1); setRouteReady(true); setPausePlace(null); setNotice('Pauzeplaats toegevoegd.'); }}>Pauzeplaats toevoegen</button> : <button className="primary" disabled={pauseBusy || !valid || riding} onClick={() => void proposePause()}>{pauseBusy ? 'Verbinding berekenen…' : 'Verbinding bekijken'}</button>}</div></Modal>}
    {modal === 'info' && <Modal title="Fietsroutes Vlaanderen" close={() => setModal(null)}><p className="app-version">v{__APP_VERSION__}</p><p>Plan via de officiële aansluitingen van Toerisme Vlaanderen en de provinciale toeristische organisaties. De blauwe lijn volgt de meegeleverde trajectgeometrie.</p><h3>Netwerkgegevens</h3><ul className="network-details"><li>Netwerk gedownload op {network ? new Date(baseNetwork!.data.fetchedAt).toLocaleDateString('nl-BE') : '…'}</li><li>{baseNetwork?.data.junctions.filter(n => n.number).length.toLocaleString('nl-BE') ?? '…'} knooppunten</li><li>{baseNetwork?.data.edges.length.toLocaleString('nl-BE') ?? '…'} beschikbare trajecten</li><li>{baseNetwork?.data.report.oneWayEdges ?? 0} éénrichtingstrajecten</li><li>{__TOURISM_METADATA__.count.toLocaleString('nl-BE')} toeristische plaatsen (OpenStreetMap)</li><li>Toerisme gedownload op {new Date(__TOURISM_METADATA__.fetchedAt).toLocaleDateString('nl-BE')}</li></ul><p className="muted">Eénrichtingstrajecten worden in hun toegestane rijrichting gebruikt. Ontbrekende of onduidelijke aansluitingen, onbekende richtingscodes en geometriefouten worden uitgesloten. {network && baseNetwork!.data.report.skippedEdges + baseNetwork!.data.report.invalidGeometry} brontrajecten zijn uitgesloten. Daardoor is niet elke officiële verbinding routeerbaar.</p><h3>Op je mobiele telefoon</h3><p>Installeer via je browsermenu (Toevoegen aan beginscherm). Na de eerste volledige online laadbeurt zijn de app en het netwerk offline beschikbaar in de productieversie. Bewaarde routes blijven op dit apparaat.</p><p>Kaarttegels vereisen internet. De gestippelde aanrijroute volgt fietsbare wegen via BRouter; daarvoor worden je locatie en het startpunt naar BRouter gestuurd. GPS werkt zolang de app op de voorgrond staat; achtergrondnavigatie en gesproken afslagaanwijzingen zijn nog niet beschikbaar.</p><h3>Uitwisseling</h3><p>GPX exporteert het traject en de gekozen knooppunten. GPX uit deze app kan opnieuw worden bewerkt; externe GPX-koppeling volgt later. Deellinks bevatten de gekozen punten en worden opnieuw berekend.</p><ul className="source-links"><li><a href="https://metadata.vlaanderen.be/srv/api/records/c91e9b9d-6465-4dec-beeb-16fdc6d759a0" target="_blank" rel="noopener noreferrer">Officiële netwerkbron en licentie</a></li><li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap-bijdragers</a></li><li><a href="https://toerismevlaanderen.be/nl/cijfers/open-data" target="_blank" rel="noopener noreferrer">Toerisme Vlaanderen &amp; provincies</a></li><li><a href="https://www.cyclosm.org/" target="_blank" rel="noopener noreferrer">CyclOSM</a></li><li><a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a></li></ul></Modal>}
    {pendingReplacement && <Modal title="Niet bewaarde wijzigingen" close={() => setPendingReplacement(null)}><p className="unsaved-route-name">{name.trim() || 'Mijn fietsroute'}</p><p>Deze route is nog niet bewaard.<br/>Wil je ze bewaren voordat je verdergaat?</p>{!valid && <p className="muted">Kies minstens twee verbonden knooppunten om deze route te kunnen bewaren.</p>}{replacementError && <p role="alert" className="missing-start">{replacementError}</p>}<div className="modal-actions unsaved-actions"><button onClick={() => setPendingReplacement(null)}>Annuleren</button><button onClick={() => { const next = pendingReplacement; setPendingReplacement(null); next.run(); }}>Verwerpen</button><button className="primary" disabled={!valid || Boolean(libraryError)} onClick={() => { if (save()) { const next = pendingReplacement; setPendingReplacement(null); next.run(); } else setReplacementError('Bewaren is niet gelukt. Je huidige route blijft behouden. Probeer opnieuw of exporteer een GPX.'); }}>Bewaren en doorgaan</button></div></Modal>}
    <section className="print-strip"><h1>{name}</h1><p>{km(route?.meters ?? 0)} km · {new Date().toLocaleDateString('nl-BE')}</p><div>{displayedNodes.map((id, i) => <b key={`${id}-${i}`}>{network?.nodes.get(id)?.number}</b>)}</div></section>
  </div>;
}
function locationHash() { return window.location.hash.slice(1); }
























