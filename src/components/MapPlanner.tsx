import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { KnooppuntNode, MapTileProvider, RouteDisplaySegment, RouteGeometrySource, RouteLeg } from '../types';
import { fetchKnooppuntenInBBox, fetchKnooppuntenAroundPoint } from '../services/overpassService';
import { calculateHaversineDistanceKm } from '../services/routingService';
import { searchPlacesAndAddresses, isKnooppuntQuery, PlaceSearchResult } from '../services/geocodingService';
import { enrichKnooppuntLocality } from '../services/localityService';
import { Search, Loader2, Layers, Crosshair, ZoomIn, ZoomOut, Compass, Sparkles, Undo2, Redo2, X, Info, Check, PanelLeftClose, PanelLeftOpen, MapPin, Key, ExternalLink, HelpCircle, Database } from 'lucide-react';

export interface SearchedAddressItem {
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  type?: string;
  isCity?: boolean;
}

export interface SearchCandidatesState {
  query: string;
  nodes?: KnooppuntNode[];
  addresses?: SearchedAddressItem[];
}

interface MapPlannerProps {
  availableNodes: KnooppuntNode[];
  selectedNodes: KnooppuntNode[];
  routeCoordinates: [number, number][];
  routeLegs: RouteLeg[];
  onNodeClick: (node: KnooppuntNode) => void;
  onAddNewNode?: (node: KnooppuntNode) => void;
  onAddNewNodes?: (nodes: KnooppuntNode[]) => void;
  activeTileProvider: MapTileProvider;
  onChangeTileProvider: (provider: MapTileProvider) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  redoNodeRef?: string;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenDataModal?: () => void;
  onRouteSegmentClick?: (segment: RouteDisplaySegment) => void;
}

// Calculate bearing angle between two coordinates
function calculateBearing(p1: [number, number], p2: [number, number]): number {
  const lat1 = (p1[0] * Math.PI) / 180;
  const lon1 = (p1[1] * Math.PI) / 180;
  const lat2 = (p2[0] * Math.PI) / 180;
  const lon2 = (p2[1] * Math.PI) / 180;
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function routeStyle(source: RouteGeometrySource): L.PolylineOptions {
  // A red solid line is geometry that was verified in the local official dataset.
  // An orange dash remains an official node-to-node relation, but its road shape
  // had to be fetched live and must never look equivalent to verified geometry.
  if (source === 'official-declared') {
    return { color: '#f97316', dashArray: '2 15', weight: 7, opacity: 1, lineCap: 'round', lineJoin: 'round' };
  }
  if (source === 'brouter') {
    return { color: '#a16207', dashArray: '12 18', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' };
  }
  if (source === 'osm-router') {
    return { color: '#7c3aed', dashArray: '10 6 2 6', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' };
  }
  return { color: '#dc2626', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' };
}

// Marker pin SVGs matching authentic cycling maps (screenshot)
const startPinSvg = `
  <div class="flex flex-col items-center drop-shadow-sm" title="Start knooppunt">
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 27.5C12 27.5 2.5 18 2.5 11C2.5 5.8 6.7 1.5 12 1.5C17.3 1.5 21.5 5.8 21.5 11C21.5 18 12 27.5 12 27.5Z" fill="#84cc16" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
      <polygon points="10,7.5 16,11 10,14.5" fill="#ffffff"/>
    </svg>
  </div>
`;

const endPinSvg = `
  <div class="flex flex-col items-center drop-shadow-sm" title="Eind knooppunt">
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 27.5C12 27.5 2.5 18 2.5 11C2.5 5.8 6.7 1.5 12 1.5C17.3 1.5 21.5 5.8 21.5 11C21.5 18 12 27.5 12 27.5Z" fill="#e11d48" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="8.5" y="7.5" width="7" height="7" rx="1.5" fill="#ffffff"/>
    </svg>
  </div>
`;

export const MapPlanner: React.FC<MapPlannerProps> = ({
  availableNodes,
  selectedNodes,
  routeCoordinates,
  routeLegs,
  onNodeClick,
  onAddNewNode,
  onAddNewNodes,
  activeTileProvider,
  onChangeTileProvider,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  redoNodeRef,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenDataModal,
  onRouteSegmentClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.LayerGroup | null>(null);
  const routeDecoratorsLayerRef = useRef<L.LayerGroup | null>(null);
  const currentLocationMarkerRef = useRef<L.Marker | null>(null);
  const currentLocationCircleRef = useRef<L.Circle | null>(null);
  const searchedAddressMarkerRef = useRef<L.Marker | null>(null);
  const hasAutoLocatedOnStartRef = useRef(false);
  const nodeMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  // Keep a current reference to availableNodes for async event listeners & popups
  const availableNodesRef = useRef<KnooppuntNode[]>(availableNodes);
  useEffect(() => {
    availableNodesRef.current = availableNodes;
  }, [availableNodes]);

  const [isSearchingNodes, setIsSearchingNodes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchCandidates, setSearchCandidates] = useState<SearchCandidatesState | null>(null);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [activeInfoLayer, setActiveInfoLayer] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState(13);

  // Thunderforest API key management for OpenCycleMap
  const [thunderforestApiKey, setThunderforestApiKey] = useState(() => {
    try {
      return localStorage.getItem('thunderforest_api_key') || '';
    } catch {
      return '';
    }
  });
  const [tempApiKeyInput, setTempApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const handleSaveApiKey = (newKey: string) => {
    const trimmed = newKey.trim();
    setThunderforestApiKey(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem('thunderforest_api_key', trimmed);
      } else {
        localStorage.removeItem('thunderforest_api_key');
      }
    } catch {
      // ignore
    }
    setShowApiKeyInput(false);
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: Zutendaal & Hoge Kempen cycle loop (50.912, 5.590)
    const map = L.map(mapContainerRef.current, {
      center: [50.912, 5.590],
      zoom: 13,
      zoomControl: false,
    });

    // Explicit custom panes for strict layering:
    // 1. Base tiles: zIndex 200 (default tilePane)
    // 2. Active user route (red): zIndex 450
    // 3. Markers & Knooppunten badges: zIndex 600 (default markerPane)
    if (!map.getPane('activeRoutePane')) {
      const activeRoutePane = map.createPane('activeRoutePane');
      activeRoutePane.style.zIndex = '450';
    }

    mapInstanceRef.current = map;
    markersLayerGroupRef.current = L.layerGroup().addTo(map);

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerGroupRef.current = null;
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

    let tileUrl = 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png';
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &bull; CyclOSM';
    let maxZoom = 18;
    let subdomains = 'abc';

    if (activeTileProvider === 'cyclosm') {
      tileUrl = 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &bull; CyclOSM';
      maxZoom = 18;
      subdomains = 'abc';
    } else if (activeTileProvider === 'osm_waymarked') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';
      maxZoom = 19;
      subdomains = 'abc';
    } else if (activeTileProvider === 'standard') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';
      maxZoom = 19;
      subdomains = 'abc';
    } else if (activeTileProvider === 'voyager_waymarked') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      attribution = '&copy; OpenStreetMap &copy; CARTO';
      maxZoom = 19;
      subdomains = 'abcd';
    } else if (activeTileProvider === 'topo') {
      tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors, SRTM | OpenTopoMap';
      maxZoom = 17;
    } else if (activeTileProvider === 'cyclemap') {
      let thunderforestKey = '';
      try {
        thunderforestKey = localStorage.getItem('thunderforest_api_key') || '';
      } catch {
        // ignore
      }
      if (thunderforestKey) {
        tileUrl = `https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=${encodeURIComponent(thunderforestKey)}`;
      } else {
        // Note: without key, Thunderforest embeds the "API KEY REQUIRED" watermark
        tileUrl = 'https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png';
      }
      attribution = '&copy; <a href="https://www.opencyclemap.org" target="_blank" rel="noreferrer">OpenCycleMap</a> &bull; &copy; <a href="https://www.thunderforest.com" target="_blank" rel="noreferrer">Thunderforest</a>';
      maxZoom = 18;
      subdomains = 'abc';
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
  }, [activeTileProvider, thunderforestApiKey]);

  // Render Knooppunten Markers
  useEffect(() => {
    const markersGroup = markersLayerGroupRef.current;
    if (!markersGroup) return;

    markersGroup.clearLayers();
    nodeMarkersRef.current.clear();

    // Map of selected node order indices by unique ID
    const selectedIndices = new Map<string, number[]>();
    selectedNodes.forEach((node, idx) => {
      const idKey = String(node.id || node.ref);
      const arr = selectedIndices.get(idKey) || [];
      arr.push(idx + 1);
      selectedIndices.set(idKey, arr);
    });

    // Deduplicate nodes spatially so that immediate duplicates (e.g. multi-lane OSM nodes of 62, 64)
    // are merged, while distinct geographic nodes that happen to share a ref number (e.g. 131 in Bilzen
    // and 131 in Lanaken, ~12km apart) are BOTH preserved and rendered!
    const uniqueNodes: KnooppuntNode[] = [];
    const seenByRef = new Map<string, KnooppuntNode[]>();

    availableNodes.forEach((node) => {
      const existingList = seenByRef.get(node.ref) || [];
      const isMicroDuplicate = existingList.some(
        (ex) => Math.hypot(ex.lat - node.lat, ex.lng - node.lng) < 0.003
      );
      if (isMicroDuplicate) return;

      existingList.push(node);
      seenByRef.set(node.ref, existingList);
      uniqueNodes.push(node);
    });

    // Render each node with authentic badge design and role pins (start, inbetween, end)
    uniqueNodes.forEach((node) => {
      const idKey = String(node.id || node.ref);
      const isSelected = selectedIndices.has(idKey);
      const isStart = selectedNodes.length > 0 && String(selectedNodes[0].id || selectedNodes[0].ref) === idKey;
      const isEnd = selectedNodes.length > 1 && String(selectedNodes[selectedNodes.length - 1].id || selectedNodes[selectedNodes.length - 1].ref) === idKey;

      let rolePinHtml = '';
      if (isStart && isEnd) {
        // Loop: start and end on same node
        rolePinHtml = `<div class="flex items-center gap-0.5 pointer-events-none">${startPinSvg}${endPinSvg}</div>`;
      } else if (isStart) {
        rolePinHtml = startPinSvg;
      } else if (isEnd) {
        rolePinHtml = endPinSvg;
      }

      // Icon HTML with authentic styling (white circle with crisp red border on active route, emerald for available)
      const isHighlight = !!node.highlight;
      const ringClass = isSelected
        ? 'ring-3 ring-red-500/40 shadow-lg scale-105 z-20'
        : 'hover:scale-110 hover:shadow-md transition-transform';

      const bgClass = isSelected
        ? 'bg-white text-stone-950 font-black border-[2.5px] border-red-600'
        : isHighlight
        ? 'bg-white text-emerald-800 font-extrabold border-2 border-emerald-500 ring-2 ring-amber-300'
        : 'bg-white text-emerald-800 font-bold border-2 border-emerald-500';

      const badgeHtml = `
        <div class="relative flex flex-col items-center justify-center">
          ${rolePinHtml ? `
            <div class="absolute bottom-[100%] mb-0.5 left-1/2 -translate-x-1/2 pointer-events-none z-30">
              ${rolePinHtml}
            </div>
          ` : ''}
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-md transition-all cursor-pointer ${bgClass} ${ringClass}">
            ${node.ref}
          </div>
          ${isHighlight ? `
            <div class="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shadow-xs z-30 ring-1.5 ring-white" title="${node.highlight ? node.highlight.replace(/"/g, '&quot;') : 'Bezienswaardigheid / Highlight'}">
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
        <div class="p-1 font-sans text-slate-900 min-w-[210px]">
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
            <div class="my-1.5 p-2 bg-amber-50 text-amber-950 text-xs rounded-lg border border-amber-300 shadow-xs flex items-start gap-1.5">
              <span class="text-amber-500 font-black text-sm shrink-0 leading-none">★</span>
              <div>
                <span class="font-bold text-amber-900 block text-[10px] uppercase tracking-wider">Highlight / Bezienswaardigheid</span>
                <span class="text-slate-800 text-xs font-medium">${node.highlight}</span>
              </div>
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

      nodeMarkersRef.current.set(idKey, marker);
      markersGroup.addLayer(marker);
    });
  }, [availableNodes, selectedNodes, onNodeClick]);

  // Update Route Polyline and Directional Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    if (routeDecoratorsLayerRef.current) {
      map.removeLayer(routeDecoratorsLayerRef.current);
      routeDecoratorsLayerRef.current = null;
    }

    if (routeCoordinates && routeCoordinates.length > 1) {
      const routeLayer = L.layerGroup().addTo(map);
      const displaySegments = routeLegs.flatMap((leg) => leg.displaySegments
        || [{ coordinates: leg.coordinates, source: leg.isVerified === false ? 'brouter' as const : 'official' as const }]);
      // Imported GPX tracks have no individual route legs but remain visible as a solid line.
      if (displaySegments.length === 0) displaySegments.push({ coordinates: routeCoordinates, source: 'official' });
      for (const segment of displaySegments) {
        if (segment.coordinates.length < 2) continue;
        const line = L.polyline(segment.coordinates, { ...routeStyle(segment.source), pane: 'activeRoutePane' }).addTo(routeLayer);
        if (onRouteSegmentClick) {
          line.bindTooltip('Klik voor verbindingsanalyse', { sticky: true, direction: 'top' });
          line.on('click', () => onRouteSegmentClick(segment));
        }
      }
      routePolylineRef.current = routeLayer;

      // Add directional arrow indicators along the route (as seen in screenshot)
      const decoratorsGroup = L.layerGroup().addTo(map);
      routeDecoratorsLayerRef.current = decoratorsGroup;

      const totalPoints = routeCoordinates.length;
      const step = Math.max(12, Math.floor(totalPoints / Math.min(8, Math.max(2, selectedNodes.length))));
      
      for (let i = Math.floor(step / 2); i < totalPoints - 1; i += step) {
        const p1 = routeCoordinates[i];
        const p2 = routeCoordinates[Math.min(i + 2, totalPoints - 1)];
        if (!p1 || !p2) continue;

        const angle = calculateBearing(p1, p2);

        const arrowIcon = L.divIcon({
          className: 'route-direction-arrow',
          html: `
            <div class="w-4 h-4 rounded-full bg-red-600 border border-white flex items-center justify-center shadow-xs" style="transform: rotate(${angle}deg);" title="Fietsrichting">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 1L7 5H5V7H3V5H1L4 1Z" fill="white"/>
              </svg>
            </div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const arrowMarker = L.marker([p1[0], p1[1]], {
          icon: arrowIcon,
          interactive: false,
          pane: 'activeRoutePane',
          zIndexOffset: 500,
        });

        decoratorsGroup.addLayer(arrowMarker);
      }
    }
  }, [routeCoordinates, routeLegs, selectedNodes, onRouteSegmentClick]);

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

  // Center map on a knooppunt without adding it to the route
  const centerOnKnooppunt = useCallback((node: KnooppuntNode) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.flyTo([node.lat, node.lng], 15, { duration: 1.2 });
    setSearchMessage(`Knooppunt ${node.ref} (${node.municipality || node.name || 'Gecentreerd'})`);
    setTimeout(() => setSearchMessage(null), 3500);

    // Open popup after fly animation completes
    setTimeout(() => {
      const idKey = String(node.id || node.ref);
      const marker = nodeMarkersRef.current.get(idKey);
      if (marker) {
        marker.openPopup();
      }
    }, 1200);

    setSearchCandidates(null);
    setSearchQuery('');
  }, []);

  // Find closest knooppunt to specific coordinates (e.g. address or current location)
  // If not loaded in local cache within 5 km, dynamically fetches from Overpass around coordinates
  // to strictly avoid jumping across the country to a distant preloaded node!
  const handleFindNearestToCoordinates = useCallback(async (lat: number, lng: number, label: string = 'locatie') => {
    const currentNodes = availableNodesRef.current;

    // 1. Check if any node in local memory is already within 4.5 km
    let bestExisting: KnooppuntNode | null = null;
    let minExistingDistKm = Infinity;

    for (const n of currentNodes) {
      const dKm = calculateHaversineDistanceKm(lat, lng, n.lat, n.lng);
      if (dKm < minExistingDistKm) {
        minExistingDistKm = dKm;
        bestExisting = n;
      }
    }

    // If we already have a genuine nearby node (<= 4.5 km), jump to it directly!
    if (bestExisting && minExistingDistKm <= 4.5) {
      centerOnKnooppunt(bestExisting);
      setSearchMessage(`Dichtstbijzijnde knooppunt ${(bestExisting as KnooppuntNode).ref} (${minExistingDistKm.toFixed(1)} km van ${label})`);
      setTimeout(() => setSearchMessage(null), 4000);
      return;
    }

    // 2. Otherwise: do NOT jump across the country!
    // Dynamically fetch knooppunten around this location (radius 6.5 km)
    setSearchMessage(`Knooppunten ophalen in de buurt van ${label}...`);
    setIsSearchingNodes(true);

    try {
      const fetched = await fetchKnooppuntenAroundPoint(lat, lng, 6.5);
      if (fetched.length > 0) {
        if (onAddNewNodes) {
          onAddNewNodes(fetched);
        } else if (onAddNewNode) {
          fetched.forEach((n) => onAddNewNode(n));
        }

        // Find closest among newly fetched
        let bestFetched: KnooppuntNode | null = null;
        let minFetchedDistKm = Infinity;
        for (const n of fetched) {
          const dKm = calculateHaversineDistanceKm(lat, lng, n.lat, n.lng);
          if (dKm < minFetchedDistKm) {
            minFetchedDistKm = dKm;
            bestFetched = n;
          }
        }

        if (bestFetched) {
          centerOnKnooppunt(bestFetched);
          setSearchMessage(`Dichtstbijzijnde knooppunt ${(bestFetched as KnooppuntNode).ref} gevonden (${minFetchedDistKm.toFixed(1)} km van ${label})`);
        }
      } else {
        setSearchMessage(`Geen fietsknooppunt gevonden binnen 6.5 km van ${label}.`);
      }
    } catch {
      // Fallback: only use bestExisting if reasonably close (within 10 km)
      if (bestExisting && minExistingDistKm <= 10.0) {
        centerOnKnooppunt(bestExisting);
        setSearchMessage(`Knooppunt ${(bestExisting as KnooppuntNode).ref} (${minExistingDistKm.toFixed(1)} km)`);
      } else {
        setSearchMessage(`Kon knooppunten rond ${label} momenteel niet ophalen.`);
      }
    } finally {
      setIsSearchingNodes(false);
      setTimeout(() => setSearchMessage(null), 4500);
    }
  }, [centerOnKnooppunt, onAddNewNodes, onAddNewNode]);

  // Place distinct red dot on current location with pulse animation
  const placeCurrentLocationDot = useCallback((lat: number, lng: number, accuracy?: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentLocationMarkerRef.current) {
      map.removeLayer(currentLocationMarkerRef.current);
      currentLocationMarkerRef.current = null;
    }
    if (currentLocationCircleRef.current) {
      map.removeLayer(currentLocationCircleRef.current);
      currentLocationCircleRef.current = null;
    }

    if (accuracy && accuracy < 2000) {
      const circle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#ef4444',
        weight: 1.5,
        fillColor: '#ef4444',
        fillOpacity: 0.12,
      }).addTo(map);
      currentLocationCircleRef.current = circle;
    }

    const redDotIcon = L.divIcon({
      className: 'current-location-red-dot',
      html: `
        <div class="relative flex items-center justify-center w-8 h-8 pointer-events-auto cursor-pointer" title="Mijn huidige locatie">
          <span class="absolute w-7 h-7 rounded-full bg-red-500 opacity-60 animate-ping"></span>
          <span class="absolute w-5 h-5 rounded-full bg-red-500/25"></span>
          <span class="relative w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full shadow-md"></span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([lat, lng], {
      icon: redDotIcon,
      zIndexOffset: 3000,
    }).addTo(map);

    marker.bindPopup(`
      <div class="p-1 font-sans text-xs min-w-[180px]">
        <div class="font-bold text-red-600 flex items-center gap-1.5 mb-1 text-sm">
          <span class="w-2.5 h-2.5 rounded-full bg-red-600 shadow-xs"></span>
          Mijn huidige locatie
        </div>
        <div class="text-slate-500 text-[11px] mb-2 font-mono">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        <button id="btn-find-nearest-node" class="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1">
          <span>📍</span> Vind dichtstbijzijnde knooppunt
        </button>
      </div>
    `, { offset: [0, -10] });

    marker.on('popupopen', () => {
      const btn = document.getElementById('btn-find-nearest-node');
      if (btn) {
        btn.onclick = () => {
          handleFindNearestToCoordinates(lat, lng, 'huidige locatie');
        };
      }
    });

    currentLocationMarkerRef.current = marker;
  }, [handleFindNearestToCoordinates]);

  // Center on user geolocation and place red dot
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation || !mapInstanceRef.current) {
      setSearchMessage('Geolocatie wordt niet ondersteund door deze browser.');
      setTimeout(() => setSearchMessage(null), 3000);
      return;
    }

    setIsSearchingLocation(true);
    setSearchMessage('Huidige locatie bepalen...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsSearchingLocation(false);
        const { latitude, longitude, accuracy } = pos.coords;
        placeCurrentLocationDot(latitude, longitude, accuracy);
        mapInstanceRef.current?.flyTo([latitude, longitude], 14, { duration: 1.2 });
        setSearchMessage('Huidige locatie gemarkeerd met rode stip');
        setTimeout(() => setSearchMessage(null), 4000);
      },
      (err) => {
        setIsSearchingLocation(false);
        console.warn('Geolocation error:', err);
        setSearchMessage('Locatietoegang niet beschikbaar of geweigerd.');
        setTimeout(() => setSearchMessage(null), 3500);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [placeCurrentLocationDot]);

  // Center map on a searched address, zoom in, and place prominent marker
  const centerOnAddress = useCallback((addr: SearchedAddressItem) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove any previous address marker
    if (searchedAddressMarkerRef.current) {
      map.removeLayer(searchedAddressMarkerRef.current);
      searchedAddressMarkerRef.current = null;
    }

    const { lat, lng } = addr;

    const addressPinIcon = L.divIcon({
      className: 'searched-address-pin-icon',
      html: `
        <div class="relative flex flex-col items-center cursor-pointer group" style="transform: translate(-50%, -100%);">
          <div class="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl border-2 border-white ring-2 ring-blue-500/40 group-hover:scale-110 transition-transform">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="w-2.5 h-2.5 bg-blue-700 rotate-45 -mt-1 shadow-xs"></div>
          <div class="w-4 h-1.5 bg-black/25 rounded-full blur-[1px] mt-0.5"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([lat, lng], {
      icon: addressPinIcon,
      zIndexOffset: 2500,
    }).addTo(map);

    marker.bindPopup(`
      <div class="p-1 font-sans text-xs min-w-[220px]">
        <div class="font-bold text-blue-700 flex items-center gap-1.5 mb-1 text-sm">
          <span class="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
          <span>${addr.title}</span>
        </div>
        ${addr.subtitle ? `<div class="text-slate-600 text-[11px] mb-2 leading-relaxed">${addr.subtitle}</div>` : ''}
        <div class="text-slate-400 text-[10px] font-mono mb-2">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        <div class="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100">
          <button id="btn-find-nearest-node-addr" class="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5">
            <span>📍</span>
            <span>Vind dichtstbijzijnde knooppunt</span>
          </button>
          <button id="btn-remove-addr-pin" class="w-full py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-medium transition cursor-pointer">
            Markering verwijderen
          </button>
        </div>
      </div>
    `, { offset: [0, -36] });

    marker.on('popupopen', () => {
      const btn = document.getElementById('btn-find-nearest-node-addr');
      if (btn) {
        btn.onclick = () => {
          handleFindNearestToCoordinates(lat, lng, addr.title);
        };
      }
      const removeBtn = document.getElementById('btn-remove-addr-pin');
      if (removeBtn) {
        removeBtn.onclick = () => {
          if (searchedAddressMarkerRef.current) {
            map.removeLayer(searchedAddressMarkerRef.current);
            searchedAddressMarkerRef.current = null;
          }
        };
      }
    });

    searchedAddressMarkerRef.current = marker;

    // Navigate to result, center and zoom in
    map.flyTo([lat, lng], 15, { duration: 1.2 });
    setSearchMessage(`Adres: ${addr.title}`);
    setTimeout(() => setSearchMessage(null), 3500);

    setTimeout(() => {
      marker.openPopup();
    }, 1200);

    // Eagerly pre-load knooppunten around the searched address immediately
    fetchKnooppuntenAroundPoint(lat, lng, 6.5)
      .then((nearby) => {
        if (nearby.length > 0) {
          if (onAddNewNodes) {
            onAddNewNodes(nearby);
          } else if (onAddNewNode) {
            nearby.forEach((n) => onAddNewNode(n));
          }
          setSearchMessage(`${addr.title} gevonden • ${nearby.length} fietsknooppunten geladen`);
          setTimeout(() => setSearchMessage(null), 4000);
        }
      })
      .catch(() => {});

    setSearchCandidates(null);
    setSearchQuery('');
  }, [onAddNewNodes, onAddNewNode, handleFindNearestToCoordinates]);

  // Process search query for knooppunten or addresses
  const handleProcessSearchQuery = useCallback(async (queryRaw: string) => {
    const queryStr = queryRaw.trim();
    if (!queryStr || !mapInstanceRef.current) return;

    // 1. Check if query is a knooppunt reference (e.g. "131", "kp 131", "42a")
    if (isKnooppuntQuery(queryStr)) {
      const kpMatch = queryStr.match(/^(?:knooppunt|kp\.?|node)?\s*([a-z]?\d{1,4}[a-z]?)$/i);
      const searchRef = kpMatch ? kpMatch[1].toLowerCase() : queryStr.toLowerCase();

      // Find all nodes in availableNodes that match this ref
      const matchingByRef = availableNodes.filter(
        (n) => n.ref.toLowerCase() === searchRef || n.ref.replace(/^0+/, '') === searchRef.replace(/^0+/, '')
      );

      if (matchingByRef.length === 1) {
        centerOnKnooppunt(matchingByRef[0]);
        return;
      }

      if (matchingByRef.length > 1) {
        const mapCenter = mapInstanceRef.current.getCenter();
        const sorted = [...matchingByRef].sort((a, b) => {
          const distA = Math.hypot(a.lat - mapCenter.lat, a.lng - mapCenter.lng);
          const distB = Math.hypot(b.lat - mapCenter.lat, b.lng - mapCenter.lng);
          return distA - distB;
        });
        setSearchCandidates({ query: searchRef, nodes: sorted });
        return;
      }

      setSearchMessage(`Knooppunt ${searchRef} niet gevonden in de momenteel geladen kaart.`);
      setTimeout(() => setSearchMessage(null), 3500);
      return;
    }

    // 2. City, Place, or Address search (e.g. "Brugge", "Gent", "Antwerpen", "Steenstraat")
    setIsSearchingLocation(true);
    setSearchMessage(`Zoeken naar "${queryStr}"...`);

    try {
      const results = await searchPlacesAndAddresses(queryStr, 6);
      if (results && results.length > 0 && mapInstanceRef.current) {
        const formattedAddresses: SearchedAddressItem[] = results.map((r) => ({
          lat: r.lat,
          lng: r.lng,
          title: r.title,
          subtitle: r.subtitle,
          type: r.type,
          isCity: r.isCity,
        }));

        if (formattedAddresses.length === 1) {
          centerOnAddress(formattedAddresses[0]);
        } else {
          // If query exactly matches a city name (e.g. "Brugge"), fly to it directly
          const exactCity = formattedAddresses.find(
            (r) => r.title.toLowerCase() === queryStr.toLowerCase() && r.isCity
          );
          if (exactCity) {
            centerOnAddress(exactCity);
          } else {
            const mapCenter = mapInstanceRef.current.getCenter();
            const sorted = [...formattedAddresses].sort((a, b) => {
              const distA = Math.hypot(a.lat - mapCenter.lat, a.lng - mapCenter.lng);
              const distB = Math.hypot(b.lat - mapCenter.lat, b.lng - mapCenter.lng);
              return distA - distB;
            });
            setSearchCandidates({ query: queryStr, addresses: sorted });
          }
        }
      } else {
        // Fallback: check if any node has municipality/name strictly matching
        const matchingByName = availableNodes.filter(
          (n) =>
            (n.name && n.name.toLowerCase() === queryStr.toLowerCase()) ||
            (n.municipality && n.municipality.toLowerCase() === queryStr.toLowerCase())
        );
        if (matchingByName.length > 0) {
          centerOnKnooppunt(matchingByName[0]);
        } else {
          setSearchMessage(`Geen stad, adres of knooppunt gevonden voor "${queryStr}".`);
        }
      }
    } catch {
      setSearchMessage(`Zoeken naar "${queryStr}" mislukt.`);
    } finally {
      setIsSearchingLocation(false);
      setTimeout(() => setSearchMessage(null), 3500);
    }
  }, [availableNodes, centerOnKnooppunt, centerOnAddress]);

  // Form submit for mobile search bar
  const handleSearchLocation = (e: React.FormEvent) => {
    e.preventDefault();
    handleProcessSearchQuery(searchQuery);
  };

  // Listen for search and center events dispatched by header and controls
  useEffect(() => {
    const handleHeaderSearchEvent = (e: any) => {
      if (e.detail?.query) {
        setSearchQuery(e.detail.query);
        handleProcessSearchQuery(e.detail.query);
      }
    };

    const handleCenterNodeEvent = (e: any) => {
      if (e.detail?.node) {
        centerOnKnooppunt(e.detail.node);
      }
    };

    const handleCenterAddressEvent = (e: any) => {
      if (e.detail?.address) {
        centerOnAddress(e.detail.address);
      }
    };

    window.addEventListener('map-search-query', handleHeaderSearchEvent);
    window.addEventListener('map-center-node', handleCenterNodeEvent);
    window.addEventListener('map-center-address', handleCenterAddressEvent);
    return () => {
      window.removeEventListener('map-search-query', handleHeaderSearchEvent);
      window.removeEventListener('map-center-node', handleCenterNodeEvent);
      window.removeEventListener('map-center-address', handleCenterAddressEvent);
    };
  }, [handleProcessSearchQuery, centerOnKnooppunt, centerOnAddress]);

  // On startup: automatically determine current location, zoom and center on map
  useEffect(() => {
    if (!mapInstanceRef.current || hasAutoLocatedOnStartRef.current) return;
    hasAutoLocatedOnStartRef.current = true;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          placeCurrentLocationDot(latitude, longitude, accuracy);
          mapInstanceRef.current?.flyTo([latitude, longitude], 14, { duration: 1.2 });
          setSearchMessage('Huidige locatie bepaald en gecentreerd');
          setTimeout(() => setSearchMessage(null), 3500);
          setTimeout(() => {
            handleScanBBoxForKnooppunten();
          }, 1500);
        },
        (err) => {
          console.warn('Geolocatie bij opstarten niet beschikbaar of geweigerd:', err.message);
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
      );
    }
  }, [placeCurrentLocationDot, handleScanBBoxForKnooppunten]);

  // Zoom to entire planned route
  const handleFitRoute = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeCoordinates.length > 0) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (selectedNodes.length > 0) {
      const bounds = L.latLngBounds(selectedNodes.map((n) => [n.lat, n.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [routeCoordinates, selectedNodes]);

  // Listen for external trigger to fit and center route
  useEffect(() => {
    const handleFitEvent = () => {
      handleFitRoute();
    };
    window.addEventListener('map-fit-route', handleFitEvent);
    return () => {
      window.removeEventListener('map-fit-route', handleFitEvent);
    };
  }, [handleFitRoute]);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-4 right-4 map-floating-controls-compact z-[1000] flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto max-w-full">
          {/* Sidebar Toggle button for tablet landscape and desktop */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur shadow-sm rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-emerald-700 transition cursor-pointer shrink-0 tablet-touch-friendly-btn"
              title={isSidebarCollapsed ? "Routepaneel weergeven" : "Routepaneel verbergen (kaart vergroten)"}
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-emerald-600" />
                  <span className="hidden md:inline text-xs font-semibold text-slate-800">Routepaneel</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-slate-500" />
                  <span className="hidden md:inline text-xs font-medium text-slate-600">Volledig scherm</span>
                </>
              )}
            </button>
          )}

          {/* Search Bar - only shown on mobile where header search is not visible */}
          <form
            onSubmit={handleSearchLocation}
            className="md:hidden flex items-center bg-white/95 backdrop-blur shadow-sm rounded-md border border-slate-200 px-2.5 py-1.5 w-48 sm:w-60 transition-all focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <input
              type="text"
              id="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek plaats..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none font-medium"
            />
            {isSearchingLocation ? (
              <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
            ) : (
              <button
                type="submit"
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50 shrink-0 cursor-pointer"
              >
                Ga
              </button>
            )}
          </form>
        </div>

        {/* Action Pills & Undo Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Map Undo / Redo buttons right on map for quick planning */}
          {onUndo && (
            <div className="flex items-center gap-1">
              <button
                onClick={onUndo}
                disabled={!canUndo && selectedNodes.length === 0}
                className="flex items-center gap-1 px-2 py-1.5 bg-white/95 backdrop-blur-sm text-slate-700 hover:text-amber-900 hover:bg-amber-50 border border-slate-200 rounded-md text-xs font-semibold shadow-xs transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title={selectedNodes.length > 0 ? `Knooppunt ${selectedNodes[selectedNodes.length - 1].ref} ongedaan maken (Ctrl+Z)` : 'Laatste knooppunt ongedaan maken (Ctrl+Z)'}
              >
                <Undo2 className="w-3.5 h-3.5 text-amber-600" />
                {selectedNodes.length > 0 && (
                  <span className="font-mono text-[11px] font-bold text-amber-900">
                    ({selectedNodes[selectedNodes.length - 1].ref})
                  </span>
                )}
              </button>

              {canRedo && onRedo && (
                <button
                  onClick={onRedo}
                  className="flex items-center gap-1 px-2 py-1.5 bg-white/95 backdrop-blur-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                  title={redoNodeRef ? `Knooppunt ${redoNodeRef} opnieuw toevoegen (Ctrl+Y)` : 'Opnieuw uitvoeren (Ctrl+Y)'}
                >
                  <Redo2 className="w-3.5 h-3.5 text-slate-600" />
                  {redoNodeRef && (
                    <span className="font-mono text-[11px] font-bold text-slate-800">
                      ({redoNodeRef})
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Overpass Query Trigger */}
          <button
            onClick={handleScanBBoxForKnooppunten}
            disabled={isSearchingNodes}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur hover:bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-md border border-emerald-200 shadow-xs transition active:scale-95 disabled:opacity-60 cursor-pointer"
            title="Scan dit kaartgebied voor fietsknooppunten"
          >
            {isSearchingNodes ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span className="text-[11px]">Laden...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Scan knooppunten</span>
                <span className="sm:hidden">Scan</span>
              </>
            )}
          </button>

          {/* Network data and local browser-cache status */}
          {onOpenDataModal && (
            <button
              onClick={onOpenDataModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur hover:bg-blue-50 text-slate-700 hover:text-blue-800 text-xs font-semibold rounded-md border border-slate-200 shadow-xs transition active:scale-95 cursor-pointer"
              title="Netwerkgegevens en lokale browsercache"
            >
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Netwerkdata</span>
              <span className="sm:hidden">Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Map Layers Modal / Popover (Matching exact OpenStreetMap styling from screenshot) */}
      {showLayerMenu && (
        <div className="absolute top-16 right-4 sm:right-6 z-[1200] w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 animate-in fade-in slide-in-from-top-2 font-sans select-none max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Kaartlagen (Map Layers)</h2>
              <p className="text-[11px] text-slate-500">Kies je favoriete achtergrondkaart</p>
            </div>
            <button
              onClick={() => setShowLayerMenu(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Sluiten"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Notice about Watermark */}
          <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-amber-950 mb-0.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Watermerk "API key required" op de achtergrond?</span>
            </div>
            <span>
              Dit watermerk verschijnt alleen bij <strong>OpenCycleMap (Thunderforest)</strong> omdat deze externe dienst tegenwoordig een API-sleutel vereist. 
              Kies hieronder simpelweg <strong>CyclOSM</strong> of <strong>OSM + Fietsnetwerk</strong>: deze zijn <strong>100% gratis en zónder watermerk</strong>!
            </span>
          </div>

          {/* Layer Options List */}
          <div className="space-y-2.5">
            {/* CyclOSM (Aanbevolen) */}
            <div
              onClick={() => onChangeTileProvider('cyclosm')}
              className={`relative h-16 rounded-xl overflow-hidden cursor-pointer transition border ${
                activeTileProvider === 'cyclosm'
                  ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="absolute inset-0 bg-[#f0f9f3]">
                <svg className="w-full h-full object-cover" viewBox="0 0 240 60" preserveAspectRatio="none">
                  <path d="M0,20 Q80,10 140,40 T240,20" fill="none" stroke="#10b981" strokeWidth="3" />
                  <path d="M30,0 Q70,60 110,30 T180,60" fill="none" stroke="#059669" strokeWidth="2.5" />
                  <path d="M120,10 Q160,35 220,15" fill="none" stroke="#d97706" strokeWidth="2.5" strokeDasharray="3,2" />
                </svg>
              </div>

              <div className="absolute top-2 left-0 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-r-lg shadow-xs border-y border-r border-slate-200/60 flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-xs">CyclOSM</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">Aanbevolen</span>
              </div>

              <div className="absolute bottom-1.5 left-3 text-[10px] text-slate-600 font-medium bg-white/80 px-1.5 py-0.5 rounded">
                Geen watermerk &bull; Fietsinfrastructuur &amp; reliëf
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveInfoLayer(activeInfoLayer === 'cyclosm' ? null : 'cyclosm');
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-900/15 hover:bg-slate-900/30 text-slate-800 flex items-center justify-center transition cursor-pointer"
                title="Info over CyclOSM"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* OSM + Fietsnetwerk (Waymarked Trails) */}
            <div
              onClick={() => onChangeTileProvider('osm_waymarked')}
              className={`relative h-16 rounded-xl overflow-hidden cursor-pointer transition border ${
                activeTileProvider === 'osm_waymarked'
                  ? 'border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="absolute inset-0 bg-[#eef2f6]">
                <svg className="w-full h-full object-cover" viewBox="0 0 240 60" preserveAspectRatio="none">
                  <path d="M0,0 Q60,30 120,10 T240,40 L240,60 L0,60 Z" fill="#d9e6d0" opacity="0.8" />
                  <path d="M0,35 Q60,10 120,30 T240,15" fill="none" stroke="#2563eb" strokeWidth="3" />
                  <circle cx="60" cy="20" r="5" fill="#2563eb" />
                  <circle cx="160" cy="20" r="5" fill="#2563eb" />
                </svg>
              </div>

              <div className="absolute top-2 left-0 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-r-lg shadow-xs border-y border-r border-slate-200/60 flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-xs">OSM + Fietsnetwerk</span>
                <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">Gratis</span>
              </div>

              <div className="absolute bottom-1.5 left-3 text-[10px] text-slate-600 font-medium bg-white/80 px-1.5 py-0.5 rounded">
                Geen watermerk &bull; Officiële knooppuntenlijnen
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveInfoLayer(activeInfoLayer === 'osm_waymarked' ? null : 'osm_waymarked');
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-900/15 hover:bg-slate-900/30 text-slate-800 flex items-center justify-center transition cursor-pointer"
                title="Info over OSM + Fietsnetwerk"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Standard OpenStreetMap */}
            <div
              onClick={() => onChangeTileProvider('standard')}
              className={`relative h-16 rounded-xl overflow-hidden cursor-pointer transition border ${
                activeTileProvider === 'standard'
                  ? 'border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="absolute inset-0 bg-[#e8ece9]">
                <svg className="w-full h-full object-cover" viewBox="0 0 240 60" preserveAspectRatio="none">
                  <path d="M0,0 Q60,30 120,10 T240,40 L240,60 L0,60 Z" fill="#cbe3bb" opacity="0.85" />
                  <path d="M40,0 Q90,50 160,20 T240,10" fill="none" stroke="#ffffff" strokeWidth="4" />
                  <path d="M0,45 Q100,20 200,55" fill="none" stroke="#fcd6a4" strokeWidth="3" />
                </svg>
              </div>

              <div className="absolute top-2 left-0 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-r-lg shadow-xs border-y border-r border-slate-200/60">
                <span className="font-bold text-slate-900 text-xs">Standard (OSM)</span>
              </div>

              <div className="absolute bottom-1.5 left-3 text-[10px] text-slate-600 font-medium bg-white/80 px-1.5 py-0.5 rounded">
                Geen watermerk &bull; Klassieke kaartweergave
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveInfoLayer(activeInfoLayer === 'standard' ? null : 'standard');
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-900/15 hover:bg-slate-900/30 text-slate-800 flex items-center justify-center transition cursor-pointer"
                title="Info over Standard"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* CartoDB Voyager + Fietsnetwerk */}
            <div
              onClick={() => onChangeTileProvider('voyager_waymarked')}
              className={`relative h-16 rounded-xl overflow-hidden cursor-pointer transition border ${
                activeTileProvider === 'voyager_waymarked'
                  ? 'border-2 border-purple-500 ring-2 ring-purple-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="absolute inset-0 bg-[#fafafa]">
                <svg className="w-full h-full object-cover" viewBox="0 0 240 60" preserveAspectRatio="none">
                  <path d="M0,25 Q120,45 240,20" fill="none" stroke="#9333ea" strokeWidth="2.5" />
                  <path d="M40,0 L70,60" fill="none" stroke="#e2e8f0" strokeWidth="2" />
                  <circle cx="120" cy="35" r="4" fill="#9333ea" />
                </svg>
              </div>

              <div className="absolute top-2 left-0 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-r-lg shadow-xs border-y border-r border-slate-200/60 flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-xs">CartoDB Voyager</span>
                <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">Rustig</span>
              </div>

              <div className="absolute bottom-1.5 left-3 text-[10px] text-slate-600 font-medium bg-white/80 px-1.5 py-0.5 rounded">
                Geen watermerk &bull; Rustige lichte kaart met routes
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveInfoLayer(activeInfoLayer === 'voyager_waymarked' ? null : 'voyager_waymarked');
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-900/15 hover:bg-slate-900/30 text-slate-800 flex items-center justify-center transition cursor-pointer"
                title="Info over CartoDB Voyager"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Cycle Map (OpenCycleMap / Thunderforest) */}
            <div
              onClick={() => onChangeTileProvider('cyclemap')}
              className={`relative h-20 rounded-xl overflow-hidden cursor-pointer transition border ${
                activeTileProvider === 'cyclemap'
                  ? 'border-2 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="absolute inset-0 bg-[#eaf2e8]">
                <svg className="w-full h-full object-cover" viewBox="0 0 240 60" preserveAspectRatio="none">
                  <path d="M0,15 Q60,5 120,25 T240,10" fill="none" stroke="#d5dec5" strokeWidth="1" />
                  <path d="M0,40 Q45,25 70,30 T140,15 T220,35" fill="none" stroke="#9333ea" strokeWidth="2.5" />
                  <circle cx="70" cy="30" r="8" fill="#f3e8ff" stroke="#9333ea" strokeWidth="1.5" />
                </svg>
              </div>

              <div className="absolute top-2 left-0 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-r-lg shadow-xs border-y border-r border-slate-200/60 flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-xs">OpenCycleMap</span>
                {thunderforestApiKey ? (
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Sleutel actief
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                    Watermerk actief
                  </span>
                )}
              </div>

              <div className="absolute bottom-2 left-3 right-10 text-[10px] text-slate-600 font-medium bg-white/90 px-1.5 py-0.5 rounded leading-tight">
                {thunderforestApiKey ? 'Eigen Thunderforest API-key ingesteld' : 'Bevat watermerk zonder eigen Thunderforest API-key'}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveInfoLayer(activeInfoLayer === 'cyclemap' ? null : 'cyclemap');
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-900/15 hover:bg-slate-900/30 text-slate-800 flex items-center justify-center transition cursor-pointer"
                title="Info over OpenCycleMap"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Thunderforest API Key Configuration Collapsible */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 p-1 rounded hover:bg-slate-50 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-600" />
                <span>Eigen Thunderforest API-sleutel instellen</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {showApiKeyInput ? 'Verbergen' : (thunderforestApiKey ? 'Bewerken' : 'Optioneel')}
              </span>
            </button>

            {showApiKeyInput && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs animate-in fade-in">
                <p className="text-[11px] text-slate-600">
                  Als je per se OpenCycleMap zonder watermerk wilt, kun je op{' '}
                  <a
                    href="https://www.thunderforest.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:underline font-semibold inline-flex items-center gap-0.5"
                  >
                    thunderforest.com <ExternalLink className="w-2.5 h-2.5" />
                  </a>{' '}
                  een gratis account aanmaken en hieronder je API key invoeren:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="bijv. abcd1234efgh5678"
                    defaultValue={thunderforestApiKey}
                    onChange={(e) => setTempApiKeyInput(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveApiKey(tempApiKeyInput || thunderforestApiKey)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    Opslaan
                  </button>
                </div>
                {thunderforestApiKey && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-emerald-700 font-medium">Huidige sleutel opgeslagen</span>
                    <button
                      type="button"
                      onClick={() => handleSaveApiKey('')}
                      className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Sleutel wissen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info Card if user clicked (i) */}
          {activeInfoLayer && (
            <div className="mt-3 p-2.5 bg-blue-50 rounded-lg text-xs text-blue-900 border border-blue-200 animate-in fade-in">
              <div className="font-semibold mb-1">
                {activeInfoLayer === 'cyclosm' && 'CyclOSM (Aanbevolen fietskaart)'}
                {activeInfoLayer === 'osm_waymarked' && 'OSM + Fietsnetwerk (Waymarked Trails)'}
                {activeInfoLayer === 'standard' && 'Standard (OpenStreetMap)'}
                {activeInfoLayer === 'voyager_waymarked' && 'CartoDB Voyager + Fietsnetwerk'}
                {activeInfoLayer === 'cyclemap' && 'OpenCycleMap (Thunderforest)'}
              </div>
              <p className="text-[11px] leading-relaxed text-blue-800">
                {activeInfoLayer === 'cyclosm' &&
                  'Kaartstijl specifiek ontworpen voor fietsers. Toont fietspaden, gravelwegen, hoogtelijnen en wegdekkwaliteit. Helemaal gratis en zonder watermerk.'}
                {activeInfoLayer === 'osm_waymarked' &&
                  'Standaard OpenStreetMap verrijkt met de officiële fietsknooppunten- en routenetwerken van Waymarked Trails. Gratis en zonder watermerk.'}
                {activeInfoLayer === 'standard' &&
                  'De standaard OpenStreetMap kaartweergave met volledige topografie, straten en dorpen. Gratis en zonder watermerk.'}
                {activeInfoLayer === 'voyager_waymarked' &&
                  'Lichte, moderne cartografie van CartoDB gecombineerd met de fietsknooppuntenlijnen. Rustig voor het oog.'}
                {activeInfoLayer === 'cyclemap' &&
                  'De klassieke OpenCycleMap. Toont heuvelreliëf en knooppunten. Omdat Thunderforest tegenwoordig een commerciële dienst is, plaatsen zij standaard een watermerk tenzij je een gratis of betaalde API-key invoert.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Floating Status Notification */}
      {searchMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur text-white text-xs px-4 py-2 rounded-full shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-2">
          {searchMessage}
        </div>
      )}

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {routeLegs.length > 0 && (
        <aside className="hidden md:block absolute bottom-6 right-24 z-[1000] pointer-events-none rounded-lg border border-slate-300 bg-white/95 backdrop-blur px-3 py-2 shadow-lg text-[10px] text-slate-700">
          <div className="flex items-center gap-2 font-semibold">
            <i className="inline-block w-7 border-t-[4px] border-red-600" />
            Officiële geometrie
          </div>
          <div className="mt-1 flex items-center gap-2 font-semibold">
            <i className="inline-block w-7 border-t-[5px] border-dotted border-orange-500" />
            Officiële relatie, live wegvorm
          </div>
        </aside>
      )}

      {/* Map Floating Right Navigation Buttons - Professional Polish Theme */}
      <div className="absolute bottom-6 right-6 map-floating-actions-compact z-[1000] flex flex-col gap-2 pointer-events-auto">
        {/* Map Layers toggle button */}
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className={`w-11 h-11 bg-white shadow-xl rounded-full border flex items-center justify-center transition cursor-pointer tablet-touch-friendly-btn ${
            showLayerMenu
              ? 'text-blue-600 bg-blue-50 border-blue-400 ring-2 ring-blue-400/30'
              : 'text-slate-700 hover:text-blue-600 border-slate-200 hover:border-slate-300'
          }`}
          title="Kaartlagen kiezen (Map Layers)"
        >
          <Layers className="w-5 h-5" />
        </button>

        {/* Zoom controls */}
        <div className="bg-white shadow-xl rounded-lg p-1 border border-slate-200 flex flex-col">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-9 h-9 border-b border-slate-100 flex items-center justify-center hover:bg-slate-50 text-slate-600 hover:text-emerald-600 transition cursor-pointer tablet-touch-friendly-btn"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 text-slate-600 hover:text-emerald-600 transition cursor-pointer tablet-touch-friendly-btn"
            title="Zoom uit"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {/* Locate me button */}
        <button
          onClick={handleLocateMe}
          className="w-11 h-11 bg-white shadow-xl rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:text-emerald-600 transition cursor-pointer tablet-touch-friendly-btn"
          title="Mijn huidige locatie"
        >
          <Crosshair className="w-5 h-5" />
        </button>

        {/* Fit route button */}
        {selectedNodes.length > 0 && (
          <button
            onClick={handleFitRoute}
            className="w-11 h-11 bg-white shadow-xl rounded-full border border-slate-200 flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition cursor-pointer font-bold tablet-touch-friendly-btn"
            title="Toon volledige route op kaart"
          >
            <Compass className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Keuzelijst modal when searched knooppunt or address returns multiple candidates */}
      {searchCandidates && (
        <div className="absolute inset-0 z-[2000] bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-20 px-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[82vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {searchCandidates.nodes && searchCandidates.nodes.length > 0 ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                    {searchCandidates.query}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                    {searchCandidates.nodes && searchCandidates.nodes.length > 0
                      ? `Kies een knooppunt (${searchCandidates.nodes.length} gevonden)`
                      : `Kies een adres of locatie (${(searchCandidates.addresses || []).length} gevonden)`}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    {searchCandidates.nodes && searchCandidates.nodes.length > 0
                      ? `Knooppunt "${searchCandidates.query}" komt meermaals voor. Kies de gewenste locatie:`
                      : `Meerdere resultaten gevonden voor "${searchCandidates.query}":`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSearchCandidates(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
                title="Sluiten"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of candidates: Knooppunten */}
            {searchCandidates.nodes && searchCandidates.nodes.length > 0 && (
              <div className="p-3 overflow-y-auto divide-y divide-slate-100 space-y-1">
                {searchCandidates.nodes.map((rawNode, index) => {
                  const node = enrichKnooppuntLocality(rawNode);
                  const mapCenter = mapInstanceRef.current?.getCenter();
                  const distKm = mapCenter
                    ? Math.round(
                        Math.hypot(
                          (node.lat - mapCenter.lat) * 111,
                          (node.lng - mapCenter.lng) * 111 * Math.cos((node.lat * Math.PI) / 180)
                        ) * 10
                      ) / 10
                    : null;

                  return (
                    <div
                      key={node.id || `${node.ref}-${index}`}
                      onClick={() => centerOnKnooppunt(node)}
                      className="p-3 rounded-xl hover:bg-emerald-50/90 border border-transparent hover:border-emerald-200 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 border-2 border-emerald-500 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                          {node.ref}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-emerald-900 truncate flex items-center gap-1.5">
                            <span>{node.name || `Knooppunt ${node.ref}`}</span>
                            {node.municipality && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium border border-emerald-300 shrink-0">
                                {node.municipality}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            <span>{node.region || 'Fietsnetwerk'}</span>
                          </div>
                          {node.highlight && (
                            <div className="text-[11px] text-amber-700 font-medium mt-0.5 flex items-center gap-1 truncate">
                              <span>★</span> {node.highlight}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                        {distKm !== null && (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            📍 {distKm} km
                          </span>
                        )}
                        <span className="text-xs font-semibold text-emerald-700 group-hover:underline">
                          Centreer kaart →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* List of candidates: Addresses */}
            {searchCandidates.addresses && searchCandidates.addresses.length > 0 && (
              <div className="p-3 overflow-y-auto divide-y divide-slate-100 space-y-1">
                {searchCandidates.addresses.map((addr, index) => {
                  const mapCenter = mapInstanceRef.current?.getCenter();
                  const distKm = mapCenter
                    ? Math.round(
                        Math.hypot(
                          (addr.lat - mapCenter.lat) * 111,
                          (addr.lng - mapCenter.lng) * 111 * Math.cos((addr.lat * Math.PI) / 180)
                        ) * 10
                      ) / 10
                    : null;

                  return (
                    <div
                      key={`addr-${index}`}
                      onClick={() => centerOnAddress(addr)}
                      className="p-3 rounded-xl hover:bg-blue-50/90 border border-transparent hover:border-blue-200 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 border-2 border-blue-500 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-blue-900 truncate">
                            {addr.title}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {addr.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                        {distKm !== null && (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            📍 {distKm} km
                          </span>
                        )}
                        <span className="text-xs font-semibold text-blue-700 group-hover:underline">
                          Centreer kaart →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span>
                {searchCandidates.nodes && searchCandidates.nodes.length > 0
                  ? 'Het knooppunt wordt gecentreerd zonder het aan uw route toe te voegen.'
                  : 'Het adres wordt gemarkeerd en gecentreerd op de kaart.'}
              </span>
              <button
                onClick={() => setSearchCandidates(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded hover:bg-slate-200 transition cursor-pointer"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
