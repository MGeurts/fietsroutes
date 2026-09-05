import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KnooppuntNode, RouteLeg, ElevationPoint, BikeType, MapTileProvider, PlannedRoute } from './types';
import { INITIAL_NODES, POPULAR_REGIONS } from './data/knooppuntenData';
import { calculateBicycleLeg, estimateElevationProfile, downloadGpxFile } from './services/routingService';
import { MapPlanner } from './components/MapPlanner';
import { RoutePanel } from './components/RoutePanel';
import { StrookjePrintModal } from './components/StrookjePrintModal';
import { RoundTripModal } from './components/RoundTripModal';
import { LaravelAntagonistModal } from './components/LaravelAntagonistModal';
import { GpxImportModal } from './components/GpxImportModal';
import { Map, List, Bike, Sparkles, Navigation } from 'lucide-react';

export default function App() {
  // Available nodes in current state (preloaded + Overpass queried)
  const [availableNodes, setAvailableNodes] = useState<KnooppuntNode[]>(INITIAL_NODES);

  // Default initial route: Scenic Hoge Kempen loop around Zutendaal & Maasmechelen
  const defaultInitialNodes = [
    INITIAL_NODES.find((n) => n.ref === '64') || INITIAL_NODES[0], // Zutendaal
    INITIAL_NODES.find((n) => n.ref === '65') || INITIAL_NODES[1], // Papendaal
    INITIAL_NODES.find((n) => n.ref === '66') || INITIAL_NODES[2], // Kattevennen
    INITIAL_NODES.find((n) => n.ref === '550') || INITIAL_NODES[3], // Fietsen door de Heide
    INITIAL_NODES.find((n) => n.ref === '60') || INITIAL_NODES[10], // Terhills / Connecterra
  ];

  const [selectedNodes, setSelectedNodes] = useState<KnooppuntNode[]>(defaultInitialNodes);
  const [routeName, setRouteName] = useState<string>('Nationaal Park Hoge Kempen & Heide');
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([]);
  const [fullCoordinates, setFullCoordinates] = useState<[number, number][]>([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number>(0);
  const [elevationGainM, setElevationGainM] = useState<number>(0);
  const [elevationPoints, setElevationPoints] = useState<ElevationPoint[]>([]);
  const [selectedBike, setSelectedBike] = useState<BikeType>('ebike');
  const [activeTileProvider, setActiveTileProvider] = useState<MapTileProvider>('cyclosm');

  // Mobile layout switcher
  const [mobileTab, setMobileTab] = useState<'map' | 'panel'>('map');

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

  // Click on a node: append to route
  const handleNodeClick = useCallback((node: KnooppuntNode) => {
    setSelectedNodes((prev) => {
      // Don't add same node twice consecutively
      if (prev.length > 0 && prev[prev.length - 1].ref === node.ref) {
        return prev;
      }
      return [...prev, node];
    });
  }, []);

  // Add dynamically discovered node from Overpass
  const handleAddNewNode = useCallback((node: KnooppuntNode) => {
    setAvailableNodes((prev) => [...prev, node]);
  }, []);

  // Reordering and removing nodes
  const handleRemoveNode = (index: number) => {
    setSelectedNodes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveNode = (index: number, direction: 'up' | 'down') => {
    setSelectedNodes((prev) => {
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
    setSelectedNodes((prev) => [...prev].reverse());
  };

  const handleClearRoute = () => {
    setSelectedNodes([]);
    setRouteLegs([]);
    setFullCoordinates([]);
    setTotalDistanceKm(0);
    setElevationGainM(0);
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
      setSelectedNodes(importedNodes);
    }
  };

  const handleApplyRoundTrip = (nodes: KnooppuntNode[], name: string) => {
    setSelectedNodes(nodes);
    setRouteName(name);
  };

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

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerSearchQuery.trim()) return;
    window.dispatchEvent(new CustomEvent('map-search-query', { detail: { query: headerSearchQuery } }));
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Top Main Navigation Bar - Professional Polish Theme */}
      <header className="h-16 bg-slate-900 flex items-center justify-between px-4 sm:px-6 shrink-0 border-b border-slate-800 shadow-sm z-20">
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
            <p className="text-slate-400 text-xs hidden sm:block">Knooppuntennetwerk NL &amp; BE</p>
          </div>
        </div>

        {/* Center Search Pill */}
        <form
          onSubmit={handleHeaderSearch}
          className="hidden md:flex items-center bg-slate-800 rounded-full px-4 py-2 w-72 lg:w-96 border border-slate-700 focus-within:border-emerald-500 transition"
        >
          <svg className="w-4 h-4 text-slate-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            onChange={(e) => setHeaderSearchQuery(e.target.value)}
            placeholder="Zoek knooppunt of adres..."
            className="bg-transparent border-none text-sm text-slate-200 placeholder-slate-500 focus:ring-0 focus:outline-none w-full"
          />
        </form>

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
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportGpx}
            disabled={selectedNodes.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-md transition-colors shadow-sm cursor-pointer"
            title="Download GPX bestand"
          >
            Route Opslaan
          </button>

          <button
            onClick={() => setIsLaravelModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-md transition cursor-pointer"
            title="Antagonist hosting & Laravel broncode"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
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
      <div className="flex-1 flex flex-col sm:flex-row relative overflow-hidden">
        {/* Left Sidebar / Panel (Desktop visible, Mobile controlled by tabs) */}
        <div
          className={`${
            mobileTab === 'panel' ? 'flex' : 'hidden'
          } sm:flex w-full sm:w-80 md:w-96 shrink-0 h-full overflow-hidden`}
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
          } sm:flex flex-1 h-full relative overflow-hidden`}
        >
          <MapPlanner
            availableNodes={availableNodes}
            selectedNodes={selectedNodes}
            routeCoordinates={fullCoordinates}
            onNodeClick={handleNodeClick}
            onAddNewNode={handleAddNewNode}
            activeTileProvider={activeTileProvider}
            onChangeTileProvider={setActiveTileProvider}
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Screens < 640px) */}
      <div className="sm:hidden h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 z-30 shadow-lg">
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
