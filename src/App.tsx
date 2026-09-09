import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { KnooppuntNode, RouteConnectionAnalysis, RouteLeg, ElevationPoint, BikeType, MapTileProvider, PlannedRoute } from './types';
import { INITIAL_NODES } from './data/knooppuntenData';
import { calculateBicycleLeg, fetchElevationProfile, downloadGpxFile, UnknownKnooppuntenConnectionError } from './services/routingService';
import { getAllCachedNodes, saveNodesToCache } from './services/knooppuntenCacheService';
import { searchPlacesAndAddresses, isKnooppuntQuery, PlaceSearchResult, PRELOADED_MAJOR_PLACES } from './services/geocodingService';
import { MapPlanner } from './components/MapPlanner';
import { RoutePanel } from './components/RoutePanel';
import { StrookjePrintModal } from './components/StrookjePrintModal';
import { RoundTripModal } from './components/RoundTripModal';
import { LaravelAntagonistModal } from './components/LaravelAntagonistModal';
import { GpxImportModal } from './components/GpxImportModal';
import { NetworkDataModal } from './components/NetworkDataModal';
import { NetworkAnalysisModal } from './components/NetworkAnalysisModal';
import { enrichKnooppuntLocality } from './services/localityService';
import { loadPrepackagedOfficialNetwork } from './services/networkDataService';
import { Map, List, Bike, Sparkles, Navigation, Undo2, Redo2, X, Search, MapPin, Database, Wifi, WifiOff, Network } from 'lucide-react';

export default function App() {
  // Available nodes in current state (preloaded + Overpass queried)
  const [availableNodes, setAvailableNodes] = useState<KnooppuntNode[]>(INITIAL_NODES);

  // Clean initial state without default route (starts fresh on current location)
  const [selectedNodes, setSelectedNodes] = useState<KnooppuntNode[]>([]);
  const [routeName, setRouteName] = useState<string>('Mijn Fietsroute');
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([]);
  const [fullCoordinates, setFullCoordinates] = useState<[number, number][]>([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number>(0);
  const [elevationGainM, setElevationGainM] = useState<number>(0);
  const [elevationPoints, setElevationPoints] = useState<ElevationPoint[]>([]);
  const [elevationAvailable, setElevationAvailable] = useState(false);
  const [elevationLoading, setElevationLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedBike, setSelectedBike] = useState<BikeType>('ebike');
  // Default to cyclosm (dedicated cycling map, 100% free, no API key required, no watermark)
  const [activeTileProvider, setActiveTileProvider] = useState<MapTileProvider>(() => {
    try {
      const saved = localStorage.getItem('preferred_tile_provider') as MapTileProvider | null;
      if (saved && saved !== 'cyclemap') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'cyclosm';
  });

  const handleTileProviderChange = (provider: MapTileProvider) => {
    setActiveTileProvider(provider);
    try {
      localStorage.setItem('preferred_tile_provider', provider);
    } catch {
      // ignore
    }
  };

  // Mobile layout switcher & sidebar toggle
  const [mobileTab, setMobileTab] = useState<'map' | 'panel'>('map');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modals
  const [isStrookjeOpen, setIsStrookjeOpen] = useState(false);
  const [isRoundTripOpen, setIsRoundTripOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isLaravelModalOpen, setIsLaravelModalOpen] = useState(false);
  const [isGpxImportOpen, setIsGpxImportOpen] = useState(false);
  const [isNetworkAnalysisOpen, setIsNetworkAnalysisOpen] = useState(false);
  const [selectedConnectionAnalysis, setSelectedConnectionAnalysis] = useState<RouteConnectionAnalysis | undefined>();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const routeConnectionAnalyses = useMemo(() => routeLegs.flatMap((leg) => (
    leg.displaySegments?.flatMap((segment) => segment.analysis ? [segment.analysis] : []) || []
  )), [routeLegs]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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
        setElevationAvailable(false);
        setElevationLoading(false);
        setRouteError(null);
        return;
      }

      // Keep the old profile from being shown while the newly selected route is
      // resolving and its terrain samples are loading.
      setElevationGainM(0);
      setElevationPoints([]);
      setElevationAvailable(false);
      setElevationLoading(true);

      const calculatedLegs: RouteLeg[] = [];
      let allCoords: [number, number][] = [];
      let totalDist = 0;

      try {
        for (let i = 0; i < selectedNodes.length - 1; i++) {
          const from = selectedNodes[i];
          const to = selectedNodes[i + 1];
          const leg = await calculateBicycleLeg(from, to);
          if (isCancelled) return;
          calculatedLegs.push(leg);
          totalDist += leg.distanceKm;
          allCoords = allCoords.concat(leg.coordinates);
        }
      } catch (error) {
        if (isCancelled) return;
        // Keep every preceding verified segment visible. Only the missing segment is
        // withheld; clearing the full route made a later invalid choice appear to erase
        // already validated connections.
        const partialDistance = Math.round(totalDist * 10) / 10;
        setRouteLegs(calculatedLegs);
        setFullCoordinates(allCoords);
        setTotalDistanceKm(partialDistance);
        setRouteError(error instanceof UnknownKnooppuntenConnectionError
          ? error.message
          : 'De officiële knooppuntenroute kon niet worden berekend.');
        const partialElevation = await fetchElevationProfile(allCoords, partialDistance);
        if (isCancelled) return;
        setElevationGainM(partialElevation.totalAscent);
        setElevationPoints(partialElevation.points);
        setElevationAvailable(partialElevation.available);
        setElevationLoading(false);
        return;
      }

      if (isCancelled) return;

      const roundedDist = Math.round(totalDist * 10) / 10;
      setRouteLegs(calculatedLegs);
      setFullCoordinates(allCoords);
      setTotalDistanceKm(roundedDist);
      setRouteError(null);

      const elev = await fetchElevationProfile(allCoords, roundedDist);
      if (isCancelled) return;
      setElevationGainM(elev.totalAscent);
      setElevationPoints(elev.points);
      setElevationAvailable(elev.available);
      setElevationLoading(false);
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

  // Merge nodes with spatial deduplication. Cached nodes must never replace an identity
  // from the verified network dataset: its OSM id is the key used by the route graph.
  const handleAddNewNodes = useCallback((newNodes: KnooppuntNode[], preserveOfficialIdentity = false) => {
    if (!newNodes || newNodes.length === 0) return;
    if (!preserveOfficialIdentity) saveNodesToCache(newNodes).catch(() => {});
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
          const existing = updated[existingIdx];
          if (preserveOfficialIdentity && String(existing.id).startsWith('osm-')) {
            continue;
          }
          updated[existingIdx] = {
            ...existing,
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

  // Function to reload all nodes from IndexedDB cache
  const refreshNodesFromCache = useCallback(async () => {
    try {
      const cached = await getAllCachedNodes();
      if (cached && cached.length > 0) {
        handleAddNewNodes(cached, true);
      }
    } catch (err) {
      console.warn('Kon lokale knooppunten-cache niet verversen:', err);
    }
  }, [handleAddNewNodes]);

  // Load persisted knooppunten from local IndexedDB cache on startup
  useEffect(() => {
    getAllCachedNodes()
      .then(async (cached) => {
        // Register verified edges even when nodes were already cached during an earlier session.
        const network = await loadPrepackagedOfficialNetwork();
        if (network?.nodes.length) {
          handleAddNewNodes(network.nodes);
        }
        if (cached && cached.length > 50) {
          handleAddNewNodes(cached, true);
        } else {
          // Live/browser Overpass discovery only adds markers; it can never turn a
          // discovered proximity into a route edge.
          try {
            if (network && network.nodes.length > 0) {
              await saveNodesToCache(network.nodes);
              return;
            }
            const res = await fetch('/data/benelux_knooppunten.json');
            if (res.ok) {
              const nodes: KnooppuntNode[] = await res.json();
              if (Array.isArray(nodes) && nodes.length > 0) {
                await saveNodesToCache(nodes);
                handleAddNewNodes(nodes);
                return;
              }
            }
          } catch {
            // fallback
          }
          saveNodesToCache(INITIAL_NODES).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('Kon lokale knooppunten-cache niet laden:', err);
      });
  }, [handleAddNewNodes]);

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
    const hasCompleteRoute = selectedNodes.length >= 2
      && routeLegs.length === selectedNodes.length - 1
      && !routeError;
    if (!hasCompleteRoute) return;
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
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSearchResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
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
  const headerNodeSuggestions = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return [];

    let results: KnooppuntNode[] = [];

    // Knooppunt number check (e.g. '131', 'kp 42', '12a')
    if (isKnooppuntQuery(q)) {
      const match = q.match(/^(?:knooppunt|kp\.?|node)?\s*([a-z]?\d{1,4}[a-z]?)$/i);
      const searchRef = match ? match[1].toLowerCase() : q;

      results = availableNodes.filter(
        (n) => n.ref.toLowerCase() === searchRef || n.ref.replace(/^0+/, '') === searchRef.replace(/^0+/, '')
      );
    } else {
      // Name or Municipality matches (DO NOT match highlight to avoid false hits like Maasbruggen -> Brugge)
      results = availableNodes
        .filter(
          (n) =>
            (n.name && n.name.toLowerCase().includes(q)) ||
            (n.municipality && n.municipality.toLowerCase().includes(q))
        )
        .slice(0, 8);
    }

    return results.map((n) => enrichKnooppuntLocality(n));
  }, [headerSearchQuery, availableNodes]);

  // Place & Address search (cities like Brugge, Gent, addresses, etc.)
  useEffect(() => {
    const q = headerSearchQuery.trim();
    if (!q || isKnooppuntQuery(q)) {
      setPlaceSuggestions([]);
      setIsSearchingPlaces(false);
      return;
    }

    // 1. Instant local matches from preloaded major hubs (0ms latency for Brugge, Gent, etc.)
    const instantMatches = PRELOADED_MAJOR_PLACES.filter(
      (p) =>
        p.title.toLowerCase().startsWith(q.toLowerCase()) ||
        p.title.toLowerCase().includes(q.toLowerCase()) ||
        p.subtitle.toLowerCase().includes(q.toLowerCase())
    );
    setPlaceSuggestions(instantMatches.slice(0, 5));

    // 2. Debounced remote query to Nominatim for streets/villages
    const controller = new AbortController();
    setIsSearchingPlaces(true);
    const timer = setTimeout(() => {
      searchPlacesAndAddresses(q, 5, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) {
            setPlaceSuggestions(results);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearchingPlaces(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [headerSearchQuery]);

  // Center on knooppunt without adding to route
  const handleSelectHeaderNode = (node: KnooppuntNode) => {
    setHeaderSearchQuery('');
    setShowHeaderSuggestions(false);
    if (mobileTab === 'panel') {
      setMobileTab('map');
    }
    window.dispatchEvent(new CustomEvent('map-center-node', { detail: { node } }));
  };

  // Center on place / city / address
  const handleSelectHeaderPlace = (place: PlaceSearchResult) => {
    setHeaderSearchQuery('');
    setShowHeaderSuggestions(false);
    if (mobileTab === 'panel') {
      setMobileTab('map');
    }
    window.dispatchEvent(new CustomEvent('map-center-address', { detail: { address: place } }));
  };

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = headerSearchQuery.trim();
    if (!q) return;

    setShowHeaderSuggestions(false);
    if (mobileTab === 'panel') {
      setMobileTab('map');
    }

    // 1. If it is a knooppunt query and we have a matching node:
    if (isKnooppuntQuery(q) && headerNodeSuggestions.length > 0) {
      handleSelectHeaderNode(headerNodeSuggestions[0]);
      return;
    }

    // 2. If places / cities matched (e.g. "Brugge"):
    if (!isKnooppuntQuery(q) && placeSuggestions.length > 0) {
      handleSelectHeaderPlace(placeSuggestions[0]);
      return;
    }

    // 3. If knooppunt by name matched:
    if (headerNodeSuggestions.length === 1) {
      handleSelectHeaderNode(headerNodeSuggestions[0]);
      return;
    }

    // 4. Fallback: dispatch search query to map
    window.dispatchEvent(new CustomEvent('map-search-query', { detail: { query: q } }));
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
          {showHeaderSuggestions && headerSearchQuery.trim() && (placeSuggestions.length > 0 || headerNodeSuggestions.length > 0 || isSearchingPlaces) && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 py-1 max-h-80 overflow-y-auto">
              {/* Places & Cities Section */}
              {placeSuggestions.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-blue-400 border-b border-slate-700/60 flex items-center justify-between bg-slate-800/80">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-blue-400" />
                      <span>Steden &amp; Locaties</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Klik om te navigeren</span>
                  </div>
                  {placeSuggestions.map((place, idx) => (
                    <button
                      key={`place-${idx}-${place.lat}-${place.lng}`}
                      type="button"
                      onClick={() => handleSelectHeaderPlace(place)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700/80 transition flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-white group-hover:text-blue-300 transition truncate flex items-center gap-1.5">
                            <span>{place.title}</span>
                            {place.isCity && (
                              <span className="text-[9px] bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded font-medium border border-blue-700/50">
                                Stad
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {place.subtitle}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                        Naartoe →
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Knooppunten Section */}
              {headerNodeSuggestions.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-emerald-400 border-t border-b border-slate-700/60 flex items-center justify-between bg-slate-800/80">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Fietsknooppunten ({headerNodeSuggestions.length})</span>
                    </span>
                    <span className="text-[10px] text-emerald-400">Klik om te centreren</span>
                  </div>
                  {headerNodeSuggestions.map((node, index) => (
                    <button
                      key={node.id || `${node.ref}-${index}`}
                      type="button"
                      onClick={() => handleSelectHeaderNode(node)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700/80 transition flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                            {node.ref}
                          </span>
                          {node.highlight && (
                            <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black shadow-xs ring-1 ring-slate-800" title={node.highlight}>
                              ★
                            </span>
                          )}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition truncate flex items-center gap-1.5">
                            <span>{node.name || `Knooppunt ${node.ref}`}</span>
                            {node.municipality && (
                              <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded font-medium border border-emerald-700/60 shrink-0">
                                {node.municipality}
                              </span>
                            )}
                            {node.highlight && (
                              <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-500/40 shrink-0 flex items-center gap-0.5" title={node.highlight}>
                                ★ Highlight
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <span>{node.region || 'Fietsnetwerk'}</span>
                            {node.highlight && (
                              <>
                                <span>&bull;</span>
                                <span className="text-amber-300 font-medium truncate">{node.highlight}</span>
                              </>
                            )}
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

              {/* Address / Location manual search option */}
              <button
                type="button"
                onClick={() => {
                  setShowHeaderSuggestions(false);
                  if (mobileTab === 'panel') setMobileTab('map');
                  window.dispatchEvent(new CustomEvent('map-search-query', { detail: { query: headerSearchQuery } }));
                }}
                className="w-full text-left px-3 py-2 bg-slate-750 hover:bg-slate-700/90 border-t border-slate-700 transition flex items-center justify-between group cursor-pointer text-xs text-slate-300"
              >
                <div className="flex items-center gap-2 text-slate-300 group-hover:text-white min-w-0">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">
                    Zoek op kaart naar: <strong className="text-white">"{headerSearchQuery}"</strong>
                  </span>
                </div>
                <span className="text-[11px] text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                  Zoeken →
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsDataModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-md transition cursor-pointer shadow-xs tablet-touch-friendly-btn"
            title="Netwerkgegevens en lokale browsercache"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden lg:inline">Netwerkdata</span>
          </button>

          <button
            onClick={() => {
              setSelectedConnectionAnalysis(undefined);
              setIsNetworkAnalysisOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-200 border border-cyan-800/70 text-xs font-medium rounded-md transition cursor-pointer shadow-xs tablet-touch-friendly-btn"
            title={routeConnectionAnalyses.length > 0
              ? 'Analyseer alleen de verbindingen in de actieve route'
              : 'Analyseer OSM-knooppuntrelaties en datakwaliteit'}
          >
            <Network className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden lg:inline">Analyse</span>
          </button>

          <button
            onClick={handleExportGpx}
            disabled={selectedNodes.length < 2 || routeLegs.length !== selectedNodes.length - 1 || Boolean(routeError)}
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
            elevationAvailable={elevationAvailable}
            elevationLoading={elevationLoading}
            routeError={routeError}
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
            canExportRoute={selectedNodes.length >= 2 && routeLegs.length === selectedNodes.length - 1 && !routeError}
            onOpenRoundTrip={() => setIsRoundTripOpen(true)}
            onOpenGpxImport={() => setIsGpxImportOpen(true)}
            onOpenLaravelModal={() => setIsLaravelModalOpen(true)}
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
            routeLegs={routeLegs}
            onNodeClick={handleNodeClick}
            onAddNewNode={handleAddNewNode}
            onAddNewNodes={handleAddNewNodes}
            activeTileProvider={activeTileProvider}
            onChangeTileProvider={handleTileProviderChange}
            onUndo={handleUndo}
            canUndo={canUndo}
            onRedo={handleRedo}
            canRedo={canRedo}
            redoNodeRef={redoNodeRef}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onOpenDataModal={() => setIsDataModalOpen(true)}
            onRouteSegmentClick={(segment) => {
              setSelectedConnectionAnalysis(segment.analysis);
              setIsNetworkAnalysisOpen(true);
            }}
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

      <NetworkDataModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        availableNodesCount={availableNodes.length}
        onCacheChanged={refreshNodesFromCache}
      />

      <NetworkAnalysisModal
        isOpen={isNetworkAnalysisOpen}
        onClose={() => setIsNetworkAnalysisOpen(false)}
        focusNode={selectedNodes[selectedNodes.length - 1]}
        connection={selectedConnectionAnalysis}
        routeConnections={routeConnectionAnalyses}
      />
    </div>
  );
}
