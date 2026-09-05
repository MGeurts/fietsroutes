import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { KnooppuntNode, MapTileProvider } from '../types';
import { fetchKnooppuntenInBBox } from '../services/overpassService';
import { getAllOfficialCorridors } from '../data/officialGisCorridors';
import { Search, Loader2, Layers, Crosshair, ZoomIn, ZoomOut, Compass, Sparkles, Route } from 'lucide-react';

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
  const networkLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeDecoratorsLayerRef = useRef<L.LayerGroup | null>(null);
  const currentLocationMarkerRef = useRef<L.Marker | null>(null);
  const currentLocationCircleRef = useRef<L.Circle | null>(null);

  const [isSearchingNodes, setIsSearchingNodes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showNetworkLines, setShowNetworkLines] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(13);

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
    // 2. Official Network connections (blue): zIndex 350
    // 3. Active user route (red): zIndex 450
    // 4. Markers & Knooppunten badges: zIndex 600 (default markerPane)
    if (!map.getPane('networkPane')) {
      const networkPane = map.createPane('networkPane');
      networkPane.style.zIndex = '350';
    }
    if (!map.getPane('activeRoutePane')) {
      const activeRoutePane = map.createPane('activeRoutePane');
      activeRoutePane.style.zIndex = '450';
    }

    mapInstanceRef.current = map;
    networkLayerGroupRef.current = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = L.layerGroup().addTo(map);

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      networkLayerGroupRef.current = null;
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

    // Render each node with authentic badge design and role pins (start, inbetween, end)
    uniqueNodes.forEach((node) => {
      const isSelected = selectedIndices.has(node.ref);
      const isStart = selectedNodes.length > 0 && selectedNodes[0].ref === node.ref;
      const isEnd = selectedNodes.length > 1 && selectedNodes[selectedNodes.length - 1].ref === node.ref;

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

  // Render Official Blue Network Connections (OSM RCN Corridors)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const networkGroup = networkLayerGroupRef.current;
    if (!map || !networkGroup) return;

    networkGroup.clearLayers();
    if (!showNetworkLines) return;

    const corridors = getAllOfficialCorridors();

    corridors.forEach((corridor) => {
      if (!corridor.coordinates || corridor.coordinates.length < 2) return;

      // Clean blue line as seen in official OpenStreetMap Cycle map
      const polyline = L.polyline(corridor.coordinates, {
        color: '#2563eb', // Authentic cycling network blue
        weight: 3.5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
        pane: 'networkPane',
      });

      // Hover feedback
      polyline.on('mouseover', () => {
        polyline.setStyle({
          color: '#1d4ed8',
          weight: 5.5,
          opacity: 1,
        });
      });

      polyline.on('mouseout', () => {
        polyline.setStyle({
          color: '#2563eb',
          weight: 3.5,
          opacity: 0.8,
        });
      });

      // Detailed tooltip
      polyline.bindTooltip(
        `<div class="p-1 font-sans text-slate-900">
           <div class="flex items-center gap-1.5 font-bold text-xs text-blue-900">
             <span class="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
             <span>Verbinding ${corridor.from} ↔ ${corridor.to}</span>
           </div>
           <div class="text-[11px] text-slate-600 mt-0.5">
             <span class="font-semibold text-slate-800">${corridor.distanceKm} km</span> &bull; Officieel Fietsnetwerk
           </div>
           <div class="text-[10px] text-emerald-700 font-medium mt-1">
             Klik om toe te voegen aan route
           </div>
         </div>`,
        {
          sticky: true,
          opacity: 0.95,
        }
      );

      // On click: append node to route
      polyline.on('click', () => {
        const nodeA = availableNodes.find((n) => n.ref === corridor.from);
        const nodeB = availableNodes.find((n) => n.ref === corridor.to);
        if (!nodeA && !nodeB) return;

        const lastSelected = selectedNodes[selectedNodes.length - 1];
        if (lastSelected?.ref === corridor.from && nodeB) {
          onNodeClick(nodeB);
        } else if (lastSelected?.ref === corridor.to && nodeA) {
          onNodeClick(nodeA);
        } else if (nodeA && nodeB) {
          onNodeClick(nodeA);
          onNodeClick(nodeB);
        }
      });

      networkGroup.addLayer(polyline);
    });
  }, [showNetworkLines, availableNodes, selectedNodes, onNodeClick]);

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
      // Vivid red polyline matching professional cycling network applications
      const polyline = L.polyline(routeCoordinates, {
        color: '#dc2626', // Vibrant red route corridor
        weight: 5.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        pane: 'activeRoutePane',
      }).addTo(map);

      routePolylineRef.current = polyline;

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
  }, [routeCoordinates, selectedNodes]);

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

  // Place distinct red dot on current location with pulse animation
  const placeCurrentLocationDot = (lat: number, lng: number, accuracy?: number) => {
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
      <div class="p-1 font-sans text-xs min-w-[170px]">
        <div class="font-bold text-red-600 flex items-center gap-1.5 mb-1 text-sm">
          <span class="w-2.5 h-2.5 rounded-full bg-red-600 shadow-xs"></span>
          Mijn huidige locatie
        </div>
        <div class="text-slate-500 text-[11px] mb-2 font-mono">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        <button id="btn-find-nearest-node" class="w-full py-1 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition cursor-pointer">
          Vind dichtstbijzijnde knooppunt
        </button>
      </div>
    `, { offset: [0, -10] });

    marker.on('popupopen', () => {
      const btn = document.getElementById('btn-find-nearest-node');
      if (btn) {
        btn.onclick = () => {
          let nearestNode: KnooppuntNode | null = null;
          let minDist = Infinity;
          availableNodes.forEach((n) => {
            const d = Math.hypot(n.lat - lat, n.lng - lng);
            if (d < minDist) {
              minDist = d;
              nearestNode = n;
            }
          });
          if (nearestNode) {
            onNodeClick(nearestNode);
            map.flyTo([(nearestNode as KnooppuntNode).lat, (nearestNode as KnooppuntNode).lng], 14);
            marker.closePopup();
            setSearchMessage(`Dichtstbijzijnde knooppunt ${(nearestNode as KnooppuntNode).ref} toegevoegd`);
            setTimeout(() => setSearchMessage(null), 3500);
          }
        };
      }
    });

    currentLocationMarkerRef.current = marker;
  };

  // Center on user geolocation and place red dot
  const handleLocateMe = () => {
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
          {/* Toggle Official Blue Network Lines */}
          <button
            onClick={() => setShowNetworkLines(!showNetworkLines)}
            className={`flex items-center gap-1.5 px-3 py-1.5 backdrop-blur text-xs font-semibold rounded-md border shadow-xs transition active:scale-95 cursor-pointer ${
              showNetworkLines
                ? 'bg-blue-50/95 border-blue-300 text-blue-700 ring-1 ring-blue-400/30'
                : 'bg-white/95 border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Schakel weergave van officiële knooppuntverbindingen (blauwe lijnen) in/uit"
          >
            <div className="flex items-center gap-1">
              <span className={`w-3 h-1 rounded-full ${showNetworkLines ? 'bg-blue-600' : 'bg-slate-300'}`} />
              <Route className={`w-3.5 h-3.5 ${showNetworkLines ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <span>Netwerk {showNetworkLines ? 'Aan' : 'Uit'}</span>
          </button>

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
        <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 text-[11px] text-slate-700 rounded-md border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="flex items-center gap-1.5" title="Officiële verbindingen tussen knooppunten">
            <span className="w-3.5 h-1 bg-blue-600 rounded-full inline-block"></span>
            <span className="font-semibold text-blue-900">Fietsnetwerk (OSM)</span>
          </div>
          <div className="flex items-center gap-1.5" title="Jouw geplande route">
            <span className="w-3.5 h-1 bg-red-600 rounded-full inline-block"></span>
            <span className="font-semibold text-red-900">Geplande route</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-md border border-slate-200 text-[11px] font-medium text-slate-600 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Klik op knooppunten of blauwe lijnen om route uit te breiden</span>
        </div>
      </div>
    </div>
  );
};
