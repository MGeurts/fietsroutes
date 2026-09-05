import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { KnooppuntNode, MapTileProvider } from '../types';
import { fetchKnooppuntenInBBox } from '../services/overpassService';
import { Search, Loader2, Layers, Crosshair, ZoomIn, ZoomOut, Compass, Sparkles } from 'lucide-react';

interface MapPlannerProps {
  availableNodes: KnooppuntNode[];
  selectedNodes: KnooppuntNode[];
  routeCoordinates: [number, number][];
  onNodeClick: (node: KnooppuntNode) => void;
  onAddNewNode?: (node: KnooppuntNode) => void;
  onAddNewNodes?: (nodes: KnooppuntNode[]) => void;
  activeTileProvider: MapTileProvider;
  onChangeTileProvider: (provider: MapTileProvider) => void;
}

export const MapPlanner: React.FC<MapPlannerProps> = ({
  availableNodes,
  selectedNodes,
  routeCoordinates,
  onNodeClick,
  onAddNewNode,
  onAddNewNodes,
  activeTileProvider,
  onChangeTileProvider,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const [isSearchingNodes, setIsSearchingNodes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(13);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: Zutendaal Centrum (50.9337, 5.5757)
    const map = L.map(mapContainerRef.current, {
      center: [50.9337, 5.5757],
      zoom: 13,
      zoomControl: false,
    });

    mapInstanceRef.current = map;
    markersLayerGroupRef.current = L.layerGroup().addTo(map);

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Map Tile Layer based on activeTileProvider
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (overlayTileLayerRef.current) {
      map.removeLayer(overlayTileLayerRef.current);
      overlayTileLayerRef.current = null;
    }

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    let maxZoom = 19;
    let subdomains = 'abc';

    if (activeTileProvider === 'cyclosm') {
      tileUrl = 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &bull; CyclOSM';
      maxZoom = 18;
    } else if (activeTileProvider === 'voyager_waymarked') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      attribution = '&copy; OpenStreetMap &copy; CARTO';
      maxZoom = 19;
      subdomains = 'abcd';
    } else if (activeTileProvider === 'topo') {
      tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors, SRTM | OpenTopoMap';
      maxZoom = 17;
    }

    const baseLayer = L.tileLayer(tileUrl, {
      attribution,
      maxZoom,
      subdomains,
    }).addTo(map);
    baseTileLayerRef.current = baseLayer;

    // Add Waymarked Trails cycling network overlay for OSM & Voyager modes
    if (activeTileProvider === 'osm_waymarked' || activeTileProvider === 'voyager_waymarked') {
      const waymarkedLayer = L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://cycling.waymarkedtrails.org">Waymarked Trails Cycling</a>',
        maxZoom: 18,
        opacity: 0.85,
      }).addTo(map);
      overlayTileLayerRef.current = waymarkedLayer;
    }
  }, [activeTileProvider]);

  // Render Knooppunten Markers
  useEffect(() => {
    const markersGroup = markersLayerGroupRef.current;
    if (!markersGroup) return;

    markersGroup.clearLayers();

    // Map of selected node order indices
    const selectedIndices = new Map<string, number[]>();
    selectedNodes.forEach((node, idx) => {
      const arr = selectedIndices.get(node.ref) || [];
      arr.push(idx + 1);
      selectedIndices.set(node.ref, arr);
    });

    // Deduplicate nodes spatially so that duplicate badges (e.g. 62, 64) are NEVER rendered twice
    const uniqueNodes: KnooppuntNode[] = [];
    const seenSpatial = new Map<string, [number, number]>();

    availableNodes.forEach((node) => {
      const existingCoords = seenSpatial.get(node.ref);
      if (existingCoords) {
        if (
          Math.abs(existingCoords[0] - node.lat) < 0.005 &&
          Math.abs(existingCoords[1] - node.lng) < 0.005
        ) {
          return; // Skip duplicate marker
        }
      }
      seenSpatial.set(node.ref, [node.lat, node.lng]);
      uniqueNodes.push(node);
    });

    // Render each node with authentic green badge design
    uniqueNodes.forEach((node) => {
      const isSelected = selectedIndices.has(node.ref);
      const orders = selectedIndices.get(node.ref);

      // Icon HTML with authentic Professional Polish styling (clean white circle with emerald border & font)
      const isHighlight = !!node.highlight;
      const ringClass = isSelected
        ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-white shadow-xl scale-110 z-30'
        : 'hover:scale-115 hover:shadow-lg transition-transform';

      const bgClass = isSelected
        ? 'bg-emerald-500 text-white font-black border-2 border-emerald-600'
        : isHighlight
        ? 'bg-white text-emerald-800 font-extrabold border-2 border-emerald-500 ring-2 ring-amber-300'
        : 'bg-white text-emerald-800 font-bold border-2 border-emerald-500';

      const badgeHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-md transition-all cursor-pointer ${bgClass} ${ringClass}">
            ${node.ref}
          </div>
          ${isSelected && orders ? `
            <div class="absolute -top-2 -right-2 bg-slate-900 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
              ${orders.join(',')}
            </div>
          ` : ''}
          ${isHighlight && !isSelected ? `
            <div class="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-900 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-xs">
              ★
            </div>
          ` : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        html: badgeHtml,
        className: 'custom-knooppunt-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([node.lat, node.lng], { icon: customIcon });

      const popupContent = `
        <div class="p-1 font-sans text-slate-900 min-w-[200px]">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              ${node.ref}
            </span>
            <div>
              <div class="font-bold text-sm leading-tight text-slate-900">${node.name || `Knooppunt ${node.ref}`}</div>
              <div class="text-[11px] text-slate-500">${node.municipality ? `${node.municipality} &bull; ` : ''}${node.region || 'Fietsnetwerk'}</div>
            </div>
          </div>
          ${node.highlight ? `
            <div class="my-1.5 p-1.5 bg-amber-50 text-amber-950 text-xs rounded border border-amber-200">
              ${node.highlight}
            </div>
          ` : ''}
          <div class="mt-2 pt-2 border-t border-slate-200 flex justify-end">
            <button id="btn-add-node-${node.ref}" class="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer">
              ${isSelected ? '＋ Nogmaals toevoegen' : '＋ Toevoegen aan fietsroute'}
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 260, offset: [0, -10] });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-add-node-${node.ref}`);
        if (btn) {
          btn.onclick = () => {
            onNodeClick(node);
            marker.closePopup();
          };
        }
      });

      // Quick click to add
      marker.on('click', () => {
        onNodeClick(node);
      });

      markersGroup.addLayer(marker);
    });
  }, [availableNodes, selectedNodes, onNodeClick]);

  // Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (routeCoordinates && routeCoordinates.length > 1) {
      // Create glowing dual-layer polyline for high visibility
      const polyline = L.polyline(routeCoordinates, {
        color: '#10b981',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      routePolylineRef.current = polyline;
    }
  }, [routeCoordinates]);

  // Fetch real knooppunten from OpenStreetMap via Overpass for current map viewport
  const handleScanBBoxForKnooppunten = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    setIsSearchingNodes(true);
    setSearchMessage(null);

    try {
      const fetchedNodes = await fetchKnooppuntenInBBox(south, west, north, east);
      if (fetchedNodes.length > 0) {
        if (onAddNewNodes) {
          onAddNewNodes(fetchedNodes);
        } else if (onAddNewNode) {
          fetchedNodes.forEach((node) => onAddNewNode(node));
        }
        setSearchMessage(`${fetchedNodes.length} knooppunten gesynchroniseerd vanuit OpenStreetMap`);
      } else {
        setSearchMessage('Geen extra knooppunten gevonden in dit venster. Zoom eventueel verder in.');
      }
    } catch {
      setSearchMessage('Kon Overpass API momenteel niet bereiken.');
    } finally {
      setIsSearchingNodes(false);
      setTimeout(() => setSearchMessage(null), 5000);
    }
  }, [onAddNewNodes, onAddNewNode]);

  // Search places / addresses via OpenStreetMap Nominatim
  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;

    // Check if query is a knooppunt number directly
    const matchingNode = availableNodes.find(
      (n) => n.ref.toLowerCase() === searchQuery.trim().toLowerCase()
    );
    if (matchingNode) {
      mapInstanceRef.current.flyTo([matchingNode.lat, matchingNode.lng], 14, { duration: 1.2 });
      onNodeClick(matchingNode);
      setSearchQuery('');
      return;
    }

    setIsSearchingLocation(true);
    setSearchMessage(null);

    try {
      const query = encodeURIComponent(searchQuery.trim());
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=nl,be&limit=3`;
      const res = await fetch(url);
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const top = results[0];
          const lat = parseFloat(top.lat);
          const lon = parseFloat(top.lon);
          mapInstanceRef.current.flyTo([lat, lon], 13, { duration: 1.5 });
          setSearchMessage(`Gevonden: ${top.display_name.split(',')[0]}`);
          setSearchQuery('');
          // Automatically trigger knooppunten discovery for this new area after fly animation
          setTimeout(() => {
            handleScanBBoxForKnooppunten();
          }, 1600);
        } else {
          setSearchMessage('Geen locatie gevonden in NL/BE. Probeer een andere naam.');
        }
      }
    } catch {
      setSearchMessage('Zoeken mislukt. Controleer netwerkverbinding.');
    } finally {
      setIsSearchingLocation(false);
      setTimeout(() => setSearchMessage(null), 4000);
    }
  };

  // Listen for header search events dispatched by App.tsx
  useEffect(() => {
    const handleHeaderSearchEvent = (e: any) => {
      if (e.detail?.query) {
        setSearchQuery(e.detail.query);
        const queryStr: string = e.detail.query;
        const matchingNode = availableNodes.find(
          (n) => n.ref.toLowerCase() === queryStr.trim().toLowerCase()
        );
        if (matchingNode && mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([matchingNode.lat, matchingNode.lng], 14, { duration: 1.2 });
          onNodeClick(matchingNode);
          return;
        }

        setIsSearchingLocation(true);
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr.trim())}&countrycodes=nl,be&limit=3`)
          .then((res) => res.json())
          .then((results) => {
            if (results && results.length > 0 && mapInstanceRef.current) {
              const top = results[0];
              mapInstanceRef.current.flyTo([parseFloat(top.lat), parseFloat(top.lon)], 13, { duration: 1.5 });
              setSearchMessage(`Gevonden: ${top.display_name.split(',')[0]}`);
              setTimeout(() => {
                handleScanBBoxForKnooppunten();
              }, 1600);
            } else {
              setSearchMessage('Geen locatie gevonden in NL/BE.');
            }
          })
          .catch(() => {
            setSearchMessage('Zoeken mislukt.');
          })
          .finally(() => {
            setIsSearchingLocation(false);
            setTimeout(() => setSearchMessage(null), 3500);
          });
      }
    };

    window.addEventListener('map-search-query', handleHeaderSearchEvent);
    return () => {
      window.removeEventListener('map-search-query', handleHeaderSearchEvent);
    };
  }, [availableNodes, onNodeClick, handleScanBBoxForKnooppunten]);

  // Center on user geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current?.flyTo([latitude, longitude], 13);
      },
      () => {
        setSearchMessage('Locatietoegang geweigerd of niet beschikbaar.');
        setTimeout(() => setSearchMessage(null), 3000);
      }
    );
  };

  // Zoom to entire planned route
  const handleFitRoute = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeCoordinates.length > 0) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (selectedNodes.length > 0) {
      const bounds = L.latLngBounds(selectedNodes.map((n) => [n.lat, n.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search Bar */}
        <form
          onSubmit={handleSearchLocation}
          className="pointer-events-auto flex items-center bg-white/95 backdrop-blur shadow-sm rounded-md border border-slate-200 px-3 py-1.5 max-w-md w-full sm:w-80 transition-all focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500"
        >
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            id="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek plaats of knooppunt (bijv. Zutendaal, 64, 91)..."
            className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none font-medium"
          />
          {isSearchingLocation ? (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
          ) : (
            <button
              type="submit"
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 px-2 py-0.5 rounded hover:bg-emerald-50 shrink-0 cursor-pointer"
            >
              Ga
            </button>
          )}
        </form>

        {/* Action Pills & Layer Switcher */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Overpass Query Trigger */}
          <button
            onClick={handleScanBBoxForKnooppunten}
            disabled={isSearchingNodes}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur hover:bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-md border border-emerald-200 shadow-xs transition active:scale-95 disabled:opacity-60 cursor-pointer"
            title="Scan dit kaartgebied met Overpass API voor actuele fietsknooppunten"
          >
            {isSearchingNodes ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Laden OSM knooppunten...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Scan knooppunten in beeld</span>
                <span className="sm:hidden">Scan OSM</span>
              </>
            )}
          </button>

          {/* Quick Map Tile Style Switcher - Professional Polish Theme */}
          <div className="bg-white/90 backdrop-blur-sm p-1 rounded-md shadow-sm border border-slate-200 flex gap-1">
            <button
              onClick={() => onChangeTileProvider('cyclosm')}
              className={`px-2.5 py-1 text-xs rounded transition cursor-pointer ${
                activeTileProvider === 'cyclosm'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100 font-medium'
              }`}
              title="CyclOSM fietskaart"
            >
              Fiets
            </button>
            <button
              onClick={() => onChangeTileProvider('osm_waymarked')}
              className={`px-2.5 py-1 text-xs rounded transition cursor-pointer ${
                activeTileProvider === 'osm_waymarked'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100 font-medium'
              }`}
              title="OpenStreetMap met knooppuntennetwerk"
            >
              OSM
            </button>
            <button
              onClick={() => onChangeTileProvider('voyager_waymarked')}
              className={`px-2.5 py-1 text-xs rounded transition cursor-pointer hidden md:inline-block ${
                activeTileProvider === 'voyager_waymarked'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100 font-medium'
              }`}
              title="Carto Voyager strakke kaart"
            >
              Rustig
            </button>
            <button
              onClick={() => onChangeTileProvider('topo')}
              className={`px-2.5 py-1 text-xs rounded transition cursor-pointer ${
                activeTileProvider === 'topo'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100 font-medium'
              }`}
              title="OpenTopoMap met reliëf & hoogtelijnen"
            >
              Reliëf
            </button>
          </div>
        </div>
      </div>

      {/* Floating Status Notification */}
      {searchMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur text-white text-xs px-4 py-2 rounded-full shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-2">
          {searchMessage}
        </div>
      )}

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Floating Right Navigation Buttons - Professional Polish Theme */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-auto">
        {/* Zoom controls */}
        <div className="bg-white shadow-xl rounded-lg p-1 border border-slate-200 flex flex-col">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-9 h-9 border-b border-slate-100 flex items-center justify-center hover:bg-slate-50 text-slate-600 hover:text-emerald-600 transition cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 text-slate-600 hover:text-emerald-600 transition cursor-pointer"
            title="Zoom uit"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {/* Locate me button */}
        <button
          onClick={handleLocateMe}
          className="w-11 h-11 bg-white shadow-xl rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:text-emerald-600 transition cursor-pointer"
          title="Mijn huidige locatie"
        >
          <Crosshair className="w-5 h-5" />
        </button>

        {/* Fit route button */}
        {selectedNodes.length > 0 && (
          <button
            onClick={handleFitRoute}
            className="w-11 h-11 bg-white shadow-xl rounded-full border border-slate-200 flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition cursor-pointer font-bold"
            title="Toon volledige route op kaart"
          >
            <Compass className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Map Bottom-Left Attribution & Helper Badge */}
      <div className="absolute bottom-6 left-6 z-[1000] flex flex-col sm:flex-row items-start sm:items-center gap-2 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-md px-3 py-1 text-[10px] text-slate-500 rounded border border-slate-200 shadow-xs">
          © OpenStreetMap contributors | Knooppuntdata NL/BE 2024
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1 rounded border border-slate-200 text-[10px] font-medium text-slate-600 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Klik op knooppunten om te verbinden</span>
        </div>
      </div>
    </div>
  );
};
