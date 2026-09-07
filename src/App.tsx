import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { KnooppuntNode, RouteLeg, ElevationPoint, BikeType, MapTileProvider, PlannedRoute } from './types';
import { INITIAL_NODES, POPULAR_REGIONS } from './data/knooppuntenData';
import { calculateBicycleLeg, estimateElevationProfile, downloadGpxFile } from './services/routingService';
import { MapPlanner } from './components/MapPlanner';
import { RoutePanel } from './components/RoutePanel';
import { StrookjePrintModal } from './components/StrookjePrintModal';
import { RoundTripModal } from './components/RoundTripModal';
import { LaravelAntagonistModal } from './components/LaravelAntagonistModal';
import { GpxImportModal } from './components/GpxImportModal';
import { Map, List, Bike, Sparkles, Navigation, Undo2, Redo2, X } from 'lucide-react';

export default function App() {
  // Available nodes in current state (preloaded + Overpass queried)
  const [availableNodes, setAvailableNodes] = useState<KnooppuntNode[]>(INITIAL_NODES);

  // Default initial route matching user's curated loop (64 -> 251 -> 252 -> 62 -> 65 -> 533 -> 532 -> 64)
  const defaultInitialNodes = [
    INITIAL_NODES.find((n) => n.ref === '64') || INITIAL_NODES[0],  // 64: Start (Lieteberg)
    INITIAL_NODES.find((n) => n.ref === '251') || INITIAL_NODES[1], // 251: Zutendaal
    INITIAL_NODES.find((n) => n.ref === '252') || INITIAL_NODES[2], // 252: Wiemesmeer
    INITIAL_NODES.find((n) => n.ref === '62') || INITIAL_NODES[3],  // 62: Bessemer
    INITIAL_NODES.find((n) => n.ref === '65') || INITIAL_NODES[4],  // 65: Gellik / Albertkanaal
    INITIAL_NODES.find((n) => n.ref === '533') || INITIAL_NODES[5], // 533: Eigenbilzen
    INITIAL_NODES.find((n) => n.ref === '532') || INITIAL_NODES[6], // 532: Roelen
    INITIAL_NODES.find((n) => n.ref === '64') || INITIAL_NODES[0],  // 64: End (Lieteberg)
  ];

  const [selectedNodes, setSelectedNodes] = useState<KnooppuntNode[]>(defaultInitialNodes);
  const [routeName, setRouteName] = useState<string>('Rondrit Nationaal Park Hoge Kempen & Albertkanaal');
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([]);
  const [fullCoordinates, setFullCoordinates] = useState<[number, number][]>([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number>(0);
  const [elevationGainM, setElevationGainM] = useState<number>(0);
  const [elevationPoints, setElevationPoints] = useState<ElevationPoint[]>([]);
  const [selectedBike, setSelectedBike] = useState<BikeType>('ebike');
  const [activeTileProvider, setActiveTileProvider] = useState<MapTileProvider>('cyclemap');

  // Mobile layout switcher & sidebar toggle
  const [mobileTab, setMobileTab] = useState<'map' | 'panel'>('map');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modals
  const [isStrookjeOpen, setIsStrookjeOpen] = useState(false);
  const [isRoundTripOpen, setIsRoundTripOpen] = useState(false);
  const [isLaravelModalOpen, setIsLaravelModalOpen] = useState(false);
  const [isGpxImportOpen, setIsGpxImportOpen] = useState(false);

  // Recalculate route whenever selectedNodes change
  useEffect(() => {
    let isCancelled = false;

    async function computeFullRoute() {
      if (selectedNodes.length < 2) {
        setRouteLegs([]);
        setFullCoordinates(selectedNodes.map((n) => [n.lat, n.lng]));
        setTotalDistanceKm(0);
        setElevationGainM(0);
        setElevationPoints([]);
        return;
      }

      const calculatedLegs: RouteLeg[] = [];
      let allCoords: [number, number][] = [];
      let totalDist = 0;

      for (let i = 0; i < selectedNodes.length - 1; i++) {
        const from = selectedNodes[i];
        const to = selectedNodes[i + 1];
        const leg = await calculateBicycleLeg(from, to);
        if (isCancelled) return;

        calculatedLegs.push(leg);
        totalDist += leg.distanceKm;
        allCoords = allCoords.concat(leg.coordinates);
      }

      if (isCancelled) return;

      const roundedDist = Math.round(totalDist * 10) / 10;
      const elev = estimateElevationProfile(allCoords, roundedDist);

      setRouteLegs(calculatedLegs);
      setFullCoordinates(allCoords);
      setTotalDistanceKm(roundedDist);
      setElevationGainM(elev.totalAscent);
      setElevationPoints(elev.points);
    }

    computeFullRoute();

    return () => {
      isCancelled = true;
    };
  }, [selectedNodes]);

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState<KnooppuntNode[][]>([]);
  const [redoStack, setRedoStack] = useState<KnooppuntNode[][]>([]);

  // Function to apply route changes with history preservation
  const applyRouteUpdate = useCallback((
    updater: KnooppuntNode[] | ((prev: KnooppuntNode[]) => KnooppuntNode[]),
    newRouteName?: string
  ) => {
    setSelectedNodes((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      // Do not push identical state
      if (current.length === next.length && current.every((n, i) => n.ref === next[i]?.ref)) {
        return current;
      }
      setUndoStack((prev) => [...prev, current]);
      setRedoStack([]); // New modification clears the redo tree
      return next;
    });
    if (newRouteName !== undefined) {
      setRouteName(newRouteName);
    }
  }, []);

  // Sequential undo in reverse order, down to and including removing the start point
  const handleUndo = useCallback(() => {
    if (undoStack.length > 0) {
      const prevNodes = undoStack[undoStack.length - 1];
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, selectedNodes]);
      setSelectedNodes(prevNodes);
    } else if (selectedNodes.length > 0) {
      // Step backwards by popping the last node in reverse order,
      // all the way down to removing the start point (empty route)
      setRedoStack((prev) => [...prev, selectedNodes]);
      setSelectedNodes((prev) => prev.slice(0, -1));
    }
  }, [undoStack, selectedNodes]);

  // Redo operation
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextNodes = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, selectedNodes]);
    setSelectedNodes(nextNodes);
  }, [redoStack, selectedNodes]);

  const canUndo = undoStack.length > 0 || selectedNodes.length > 0;
  const canRedo = redoStack.length > 0;
  const nextRedoNodes = redoStack.length > 0 ? redoStack[redoStack.length - 1] : undefined;
  const redoNodeRef = nextRedoNodes && nextRedoNodes.length > 0 ? nextRedoNodes[nextRedoNodes.length - 1]?.ref : undefined;

  // Keyboard shortcut support: Ctrl+Z (Undo) and Ctrl+Y or Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Click on a node: append to route
  const handleNodeClick = useCallback((node: KnooppuntNode) => {
    applyRouteUpdate((prev) => {
      // Don't add same physical node twice consecutively
      if (prev.length > 0 && String(prev[prev.length - 1].id || prev[prev.length - 1].ref) === String(node.id || node.ref)) {
        return prev;
      }
      return [...prev, node];
    });
  }, [applyRouteUpdate]);

  // Add dynamically discovered node from Overpass
  const handleAddNewNode = useCallback((node: KnooppuntNode) => {
    setAvailableNodes((prev) => {
      if (prev.some((n) => n.id === node.id || (n.ref === node.ref && Math.hypot(n.lat - node.lat, n.lng - node.lng) < 0.003))) {
        return prev;
      }
      return [...prev, node];
    });
  }, []);

  // Add/synchronize dynamically discovered nodes from Overpass with spatial deduplication
  const handleAddNewNodes = useCallback((newNodes: KnooppuntNode[]) => {
    setAvailableNodes((prev) => {
      const updated = [...prev];
      for (const node of newNodes) {
        // If an existing node has the same ref within ~1.5km (0.015 deg), align coordinates to OSM
        const existingIdx = updated.findIndex(
          (n) =>
            n.ref === node.ref &&
            Math.abs(n.lat - node.lat) < 0.015 &&
            Math.abs(n.lng - node.lng) < 0.015
        );

        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            lat: node.lat,
            lng: node.lng,
            id: node.id,
          };
        } else {
          // If no node with same ref exists nearby (within 500m), safely append
          const isDuplicateNear = updated.some(
            (n) =>
              n.ref === node.ref &&
              Math.abs(n.lat - node.lat) < 0.005 &&
              Math.abs(n.lng - node.lng) < 0.005
          );
          if (!isDuplicateNear) {
            updated.push(node);
          }
        }
      }
      return updated;
    });
  }, []);

  // Reordering and removing nodes with history tracking
  const handleRemoveNode = (index: number) => {
    applyRouteUpdate((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveNode = (index: number, direction: 'up' | 'down') => {
    applyRouteUpdate((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleReverseRoute = () => {
    applyRouteUpdate((prev) => [...prev].reverse());
  };

  const handleClearRoute = () => {
    if (selectedNodes.length === 0) return;
    applyRouteUpdate([]);
  };

  // GPX Export
  const handleExportGpx = () => {
    if (selectedNodes.length === 0) return;
    const currentRoute: PlannedRoute = {
      id: `route-${Date.now()}`,
      name: routeName || 'Fietsroute',
      nodes: selectedNodes,
      legs: routeLegs,
      fullCoordinates,
      totalDistanceKm,
      elevationGainM,
      elevationPoints,
      createdAt: new Date().toISOString(),
    };
    downloadGpxFile(currentRoute);
  };

  // GPX Import
  const handleImportGpx = (routeData: {
    name: string;
    coordinates: [number, number][];
    waypoints: { lat: number; lng: number; name: string }[];
  }) => {
    setRouteName(routeData.name);
    setFullCoordinates(routeData.coordinates);

    // If waypoints exist, map to nodes
    if (routeData.waypoints.length > 0) {
      const importedNodes: KnooppuntNode[] = routeData.waypoints.map((wpt, idx) => ({
        id: `import-${idx}`,
        ref: wpt.name.replace(/[^0-9]/g, '') || `${idx + 1}`,
        lat: wpt.lat,
        lng: wpt.lng,
        name: wpt.name,
      }));
      setAvailableNodes((prev) => [...prev, ...importedNodes]);
      applyRouteUpdate(importedNodes, routeData.name);
    }
  };

  const handleApplyRoundTrip = (nodes: KnooppuntNode[], name: string) => {
    applyRouteUpdate(nodes, name);
  };

  const handleFitRoute = useCallback(() => {
    window.dispatchEvent(new CustomEvent('map-fit-route'));
    if (mobileTab === 'panel') {
      setMobileTab('map');
    }
  }, [mobileTab]);

  const currentRouteObject: PlannedRoute = {
    id: 'active-route',
    name: routeName || 'Fietsroute',
    nodes: selectedNodes,
    legs: routeLegs,
    fullCoordinates,
    totalDistanceKm,
    elevationGainM,
    elevationPoints,
    createdAt: new Date().toISOString(),
  };

  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [showHeaderSuggestions, setShowHeaderSuggestions] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setShowHeaderSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter matching knooppunten for header search
  const headerSuggestions = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return [];

    const kpMatch = q.match(/^(?:knooppunt|kp\.?|node)?\s*([0-9a-zA-Z]+)$/i);
    const searchRef = kpMatch ? kpMatch[1].toLowerCase() : q;

    // Exact or matching ref first
    const refMatches = availableNodes.filter(
      (n) => n.ref.toLowerCase() === searchRef || n.ref.replace(/^0+/, '') === searchRef.replace(/^0+/, '')
    );

    if (refMatches.length > 0) {
      return refMatches;
    }

    // Name or Municipality matches
    return availableNodes
      .filter(
        (n) =>
          (n.name && n.name.toLowerCase().includes(q)) ||
          (n.municipality && n.municipality.toLowerCase().includes(q)) ||
          (n.highlight && n.highlight.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [headerSearchQuery, availableNodes]);

  // Center on node without adding to route
  const handleSelectHeaderNode = (node: KnooppuntNode) => {
    setHeaderSearchQuery('');
    setShowHeaderSuggestions(false);
    if (mobileTab === 'panel') {
      setMobileTab('map');
    }
    window.dispatchEvent(new CustomEvent('map-center-node', { detail: { node } }));
  };

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerSearchQuery.trim()) return;

    setShowHeaderSuggestions(false);
    if (mobileTab === 'panel') {
      setMobileTab('map');
    }

    if (headerSuggestions.length === 1) {
      handleSelectHeaderNode(headerSuggestions[0]);
    } else {
      window.dispatchEvent(new CustomEvent('map-search-query', { detail: { query: headerSearchQuery } }));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Top Main Navigation Bar - Professional Polish Theme */}
      <header className="h-16 app-header-responsive bg-slate-900 flex items-center justify-between px-4 sm:px-6 shrink-0 border-b border-slate-800 shadow-sm z-20">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-lg shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-base sm:text-lg leading-tight flex items-center gap-2">
              <span>FietsRoute.io</span>
              <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full hidden md:inline">
                NL &amp; BE Knooppunten
              </span>
            </h1>
            <p className="text-slate-400 text-xs hidden sm:block app-header-subtitle">Knooppuntennetwerk NL &amp; BE</p>
          </div>
        </div>

        {/* Center Search Pill with Dropdown */}
        <div ref={searchDropdownRef} className="relative hidden md:block">
          <form
            onSubmit={handleHeaderSearch}
            className="flex items-center bg-slate-800 rounded-full px-4 py-2 w-72 lg:w-96 border border-slate-700 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition"
          >
            <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="text"
              value={headerSearchQuery}
              onChange={(e) => {
                setHeaderSearchQuery(e.target.value);
                setShowHeaderSuggestions(true);
              }}
              onFocus={() => setShowHeaderSuggestions(true)}
              placeholder="Zoek knooppunt (bijv. 131) of adres..."
              className="bg-transparent border-none text-sm text-slate-200 placeholder-slate-500 focus:ring-0 focus:outline-none w-full"
            />
            {headerSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setHeaderSearchQuery('');
                  setShowHeaderSuggestions(false);
                }}
                className="text-slate-400 hover:text-white p-0.5 ml-1 transition cursor-pointer"
                title="Wissen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Autocomplete / Keuzelijst dropdown when typing in header */}
          {showHeaderSuggestions && headerSearchQuery.trim() && headerSuggestions.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 py-1 max-h-80 overflow-y-auto">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-700/60 flex items-center justify-between">
                <span>
                  {headerSuggestions.length > 1
                    ? `Meerdere knooppunten (${headerSuggestions.length} keuzes)`
                    : 'Gevonden knooppunt'}
                </span>
                <span className="text-[10px] text-emerald-400">Klik om te centreren</span>
              </div>
              {headerSuggestions.map((node, index) => (
                <button
                  key={node.id || `${node.ref}-${index}`}
                  type="button"
                  onClick={() => handleSelectHeaderNode(node)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700/80 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      {node.ref}
                    </span>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-white group-hover:text-emerald-300 transition truncate">
                        {node.name || `Knooppunt ${node.ref}`}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {node.municipality ? `${node.municipality} • ` : ''}
                        {node.region || 'Fietsnetwerk'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                    Centreer →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Region Bar */}
        <div className="hidden xl:flex items-center gap-1 text-xs">
          <span className="text-slate-500 mr-1 text-[11px]">Regio:</span>
          {POPULAR_REGIONS.map((reg) => (
            <button
              key={reg.id}
              onClick={() => {
                const event = new CustomEvent('fly-to-region', { detail: { center: reg.center, zoom: reg.zoom } });
                window.dispatchEvent(event);
              }}
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer border border-slate-700/60"
            >
              {reg.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleExportGpx}
            disabled={selectedNodes.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-medium px-3 sm:px-3.5 py-2 rounded-md transition-colors shadow-sm cursor-pointer tablet-touch-friendly-btn"
            title="Download GPX bestand"
          >
            Route Opslaan
          </button>

          <button
            onClick={() => setIsLaravelModalOpen(true)}
            className="hidden md:flex hide-on-mobile-or-landscape items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-md transition cursor-pointer shadow-xs tablet-touch-friendly-btn"
            title="Systeem Status & Antagonist / PHP hosting gids"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span>Antagonist / PHP</span>
          </button>

          <div
            className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 shadow-sm shrink-0"
            title="Marc Geurts - Zutendaal"
          >
            <span className="text-xs text-white font-bold">MG</span>
          </div>
        </div>
      </header>

      {/* Main Workspace (Map + Sidebar) */}
      <div className="flex-1 flex flex-col sm:flex-row relative overflow-hidden main-workspace-layout">
        {/* Left Sidebar / Panel (Desktop & Tablet visible, Mobile controlled by tabs or sidebar collapse) */}
        <div
          className={`${
            isSidebarCollapsed ? '!hidden' : ''
          } ${
            mobileTab === 'panel' ? 'flex' : 'hidden'
          } sm:flex mobile-landscape-show-sidebar w-full sm:w-80 md:w-88 lg:w-96 mobile-landscape-sidebar-width tablet-landscape-sidebar-width shrink-0 h-full overflow-hidden transition-all duration-200`}
        >
          <RoutePanel
            routeName={routeName}
            onChangeRouteName={setRouteName}
            selectedNodes={selectedNodes}
            routeLegs={routeLegs}
            totalDistanceKm={totalDistanceKm}
            elevationGainM={elevationGainM}
            elevationPoints={elevationPoints}
            selectedBike={selectedBike}
            onChangeBike={setSelectedBike}
            onRemoveNode={handleRemoveNode}
            onMoveNode={handleMoveNode}
            onReverseRoute={handleReverseRoute}
            onClearRoute={handleClearRoute}
            onFitRoute={handleFitRoute}
            onUndo={handleUndo}
            canUndo={canUndo}
            onRedo={handleRedo}
            canRedo={canRedo}
            redoNodeRef={redoNodeRef}
            onOpenStrookje={() => setIsStrookjeOpen(true)}
            onExportGpx={handleExportGpx}
            onOpenRoundTrip={() => setIsRoundTripOpen(true)}
            onOpenGpxImport={() => setIsGpxImportOpen(true)}
            onOpenLaravelModal={() => setIsLaravelModalOpen(true)}
            onSelectRegion={() => {}}
          />
        </div>

        {/* Right Map Canvas (Desktop visible, Mobile controlled by tabs) */}
        <div
          className={`${
            mobileTab === 'map' ? 'flex' : 'hidden'
          } sm:flex mobile-landscape-show-map flex-1 h-full relative overflow-hidden`}
        >
          <MapPlanner
            availableNodes={availableNodes}
            selectedNodes={selectedNodes}
            routeCoordinates={fullCoordinates}
            onNodeClick={handleNodeClick}
            onAddNewNode={handleAddNewNode}
            onAddNewNodes={handleAddNewNodes}
            activeTileProvider={activeTileProvider}
            onChangeTileProvider={setActiveTileProvider}
            onUndo={handleUndo}
            canUndo={canUndo}
            onRedo={handleRedo}
            canRedo={canRedo}
            redoNodeRef={redoNodeRef}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Screens < 640px, hidden on mobile landscape) */}
      <div className="sm:hidden mobile-bottom-nav h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 z-30 shadow-lg">
        <button
          onClick={() => setMobileTab('map')}
          className={`flex flex-col items-center justify-center w-full py-1 text-xs font-bold transition ${
            mobileTab === 'map' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <Map className="w-5 h-5" />
          <span>Kaart</span>
        </button>

        <button
          onClick={() => setMobileTab('panel')}
          className={`flex flex-col items-center justify-center w-full py-1 text-xs font-bold relative transition ${
            mobileTab === 'panel' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <div className="relative">
            <List className="w-5 h-5" />
            {selectedNodes.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-emerald-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow">
                {selectedNodes.length}
              </span>
            )}
          </div>
          <span>Route ({totalDistanceKm} km)</span>
        </button>
      </div>

      {/* Modals */}
      <StrookjePrintModal
        isOpen={isStrookjeOpen}
        onClose={() => setIsStrookjeOpen(false)}
        route={currentRouteObject}
        selectedBike={selectedBike}
        averageSpeedKmH={
          selectedBike === 'ebike' ? 20 : selectedBike === 'racefiets' ? 25 : selectedBike === 'gravel' ? 18 : 15
        }
      />

      <RoundTripModal
        isOpen={isRoundTripOpen}
        onClose={() => setIsRoundTripOpen(false)}
        availableNodes={availableNodes}
        currentNodes={selectedNodes}
        onApplyRoute={handleApplyRoundTrip}
      />

      <LaravelAntagonistModal
        isOpen={isLaravelModalOpen}
        onClose={() => setIsLaravelModalOpen(false)}
      />

      <GpxImportModal
        isOpen={isGpxImportOpen}
        onClose={() => setIsGpxImportOpen(false)}
        onImportGpx={handleImportGpx}
      />
    </div>
  );
}
