import { useEffect, useMemo, useRef, useState } from 'react';
import L from '../leafletRuntime';
import 'leaflet-rotate';
import 'leaflet/dist/leaflet.css';
import type { Network, PlannedRoute, Position } from '../domain/network';
import type { Approach } from '../domain/approach';
import { mapPointRoles, pointRoleLabels, type PointRole } from '../domain/pointRoles';
import { SpatialGrid, lineBox, pointBox, type Box } from '../domain/spatialIndex';
import { parseTourismSnapshot, type TourismSnapshot, type TourismPlace } from '../domain/tourism';
import type { RouteViewpoint } from '../domain/routeViewpoints';
import { routeViewpoints } from '../domain/routeViewpoints';
import { addTourismLayer, tourismPopup } from './tourismLayer';

interface Props { tourismCategories?: string[]; tourismAlongRoute?: boolean; onPause?: (place: TourismPlace) => void; nearbyTourism?: RouteViewpoint[]; tourismEnabled?: boolean; onTourismData?: (data: TourismSnapshot) => void; heading?: number | null; headingUp?: boolean; network: Network | null; route: PlannedRoute | null; approach: Approach | null; accuracy: number; onSelect: (id: string) => void; focus: { position?: Position; route?: boolean; highlight?: boolean; place?: TourismPlace; token: number }; location: Position | null; riding: boolean; tileLayer: string; zoomCommand: { delta: number; token: number }; onZoomChange: (zoom: number) => void; onCenterChange?: (position: Position) => void }
const viewport = (map: L.Map): Box => { const b = map.getBounds().pad(0.15); return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }; };
const icon = (number: string, role?: PointRole) => L.divIcon({ className: 'junction-icon', html: `<span class="${role ? `point-badge role-${role}` : 'junction'}">${number.replace(/[^0-9]/g, '')}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });
export function MapView({ tourismCategories, tourismAlongRoute = false, onPause, nearbyTourism, tourismEnabled = false, onTourismData, network, route, approach, accuracy, onSelect, focus, location, riding, tileLayer, zoomCommand, onZoomChange, onCenterChange, heading = null, headingUp = true }: Props) {
  const element = useRef<HTMLDivElement>(null), mapRef = useRef<L.Map | null>(null);
  const [tourismStatus, setTourismStatus] = useState('');
  const [tourismRetry, setTourismRetry] = useState(0);
  const [tourismFailed, setTourismFailed] = useState(false);
  const tourismData = useRef<TourismSnapshot | null>(null);
  const tourismCallback = useRef(onTourismData); tourismCallback.current = onTourismData;
  const callback = useRef(onSelect); callback.current = onSelect;
  const centerCallback = useRef(onCenterChange); centerCallback.current = onCenterChange;
  const zoomCallback = useRef(onZoomChange); zoomCallback.current = onZoomChange;
  const roles = useMemo(() => route ? mapPointRoles(route) : new Map<string, PointRole>(), [route]);
  const viewState = useRef({ roles, tileLayer }); viewState.current = { roles, tileLayer };
  const refresh = useRef<() => void>(() => {});
  const index = useMemo(() => network ? {
    edges: new SpatialGrid(network.data.edges.map(edge => ({ value: edge, box: lineBox(edge.coordinates) }))),
    nodes: new SpatialGrid([...network.nodes.values()].filter(n => n.number && network.adjacency.has(n.id)).map(node => ({ value: node, box: pointBox(...node.position) }))),
  } : null, [network]);
  useEffect(() => {
    const map = L.map(element.current!, { center: [51.05, 3.73], zoom: 12, zoomControl: false, rotate: true, rotateControl: false, touchRotate: false, shiftKeyRotate: false });
    map.createPane('network-lines', map.getPane('rotatePane')).style.zIndex = '350';
    map.createPane('tourism-proximity', map.getPane('rotatePane')).style.zIndex = '540';
    map.createPane('tourism', map.getPane('rotatePane')).style.zIndex = '550';
    const directions = map.createPane('route-directions', map.getPane('norotatePane')); directions.style.zIndex = '450'; directions.style.pointerEvents = 'none';
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
    map.attributionControl.setPrefix(false);
    mapRef.current = map;
    const reportCenter = () => { const c = map.getCenter(); centerCallback.current?.([c.lng, c.lat]); }; map.on('moveend', reportCenter); reportCenter();
    const report = () => zoomCallback.current(map.getZoom()); map.on('zoomend', report); report();
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(element.current!);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);
  const proximityMarkers = useRef(new Map<string, L.Marker>());
  useEffect(() => {
    const markers = proximityMarkers.current;
    const points = riding && tourismEnabled ? nearbyTourism ?? [] : [];
    const ids = new Set(points.map(point => point.place.id));
    for (const [id, marker] of markers) if (!ids.has(id)) { marker.remove(); markers.delete(id); }
    for (const { place } of points) if (!markers.has(place.id)) {
      markers.set(place.id, L.marker([place.position[1], place.position[0]], {
        pane: 'tourism-proximity', interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'tourism-proximity-icon', html: '<span class="tourism-proximity-pulse" aria-hidden="true"></span>', iconSize: [76, 76], iconAnchor: [38, 38] }),
      }).addTo(mapRef.current!));
    }
  }, [nearbyTourism, riding, tourismEnabled]);
  useEffect(() => {
    const markers = proximityMarkers.current;
    return () => { for (const marker of markers.values()) marker.remove(); markers.clear(); };
  }, []);
  useEffect(() => { if (zoomCommand.delta) mapRef.current!.setZoom(mapRef.current!.getZoom() + zoomCommand.delta); }, [zoomCommand]);
  useEffect(() => {
    const map = mapRef.current!;
    const layer = L.tileLayer(tileLayer === 'cycle' ? 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' + (tileLayer === 'cycle' ? ' · <a href="https://www.cyclosm.org/">CyclOSM</a>' : '') }).addTo(map);
    return () => { layer.remove(); };
  }, [tileLayer]);
  useEffect(() => {
    if (!tourismEnabled) return;
    const controller = new AbortController(); let disposed = false, cleanup: (() => void) | undefined;
    setTourismFailed(false); setTourismStatus('Toeristische plaatsen laden…');
    async function load() {
      try {
        let data = tourismData.current;
        if (!data) {
          const response = await fetch('/data/tourism.json', { signal: controller.signal });
          if (!response.ok) throw Error('Toerismegegevens niet beschikbaar.');
          data = parseTourismSnapshot(await response.json());
        }
        if (disposed) return;
        tourismData.current = data;
        tourismCallback.current?.(data);
        const selected = data.places.filter(p => !tourismCategories || tourismCategories.includes(p.category));
        const filtered = tourismAlongRoute && route ? routeViewpoints(route, selected, 500, true).map(p => p.place) : tourismAlongRoute ? [] : selected;
        cleanup = addTourismLayer(mapRef.current!, { ...data, places: filtered }, setTourismStatus, !riding ? onPause : undefined);
      } catch {
        if (!disposed) { setTourismStatus('Toeristische plaatsen konden niet worden geladen.'); setTourismFailed(true); }
      }
    }
    void load();
    return () => { disposed = true; controller.abort(); cleanup?.(); };
  }, [tourismEnabled, tourismRetry, tourismCategories, tourismAlongRoute, route, riding, onPause]);
  useEffect(() => {
    if (!index) return;
    const map = mapRef.current!, renderer = L.canvas({ padding: 0.2, pane: 'network-lines' });
    const visibleEdges = new Map<string, { layer: L.Polyline; emphasized: boolean }>();
    const visibleNodes = new Map<string, { marker: L.Marker; role?: PointRole }>();
    let frame = 0;
    const draw = () => {
      const box = viewport(map), zoom = map.getZoom(), { roles, tileLayer } = viewState.current;
      const emphasized = tileLayer === 'network';
      const edges = zoom >= (emphasized ? 9 : 11) ? index.edges.query(box) : [];
      const edgeIds = new Set(edges.map(e => e.id));
      for (const [id, item] of visibleEdges) if (!edgeIds.has(id)) { item.layer.remove(); visibleEdges.delete(id); }
      for (const edge of edges) {
        const style = { color: emphasized ? '#c3444f' : '#268c67', weight: emphasized ? 3 : 2.5, opacity: emphasized ? 0.85 : 0.45 };
        const item = visibleEdges.get(edge.id);
        if (!item) visibleEdges.set(edge.id, { layer: L.polyline(edge.coordinates.map(p => L.latLng(p[1], p[0])), { ...style, renderer, interactive: false }).addTo(map), emphasized });
        else if (item.emphasized !== emphasized) { item.layer.setStyle(style); item.emphasized = emphasized; }
      }
      const nodes = zoom >= 11 ? index.nodes.query(box) : [];
      const nodeIds = new Set(nodes.map(n => n.id));
      for (const [id, item] of visibleNodes) if (!nodeIds.has(id)) { item.marker.remove(); visibleNodes.delete(id); }
      for (const node of nodes) {
        const role = roles.get(node.id), title = `${role ? pointRoleLabels[role] : 'Knooppunt'} ${node.number} · ${node.network}`, z = role ? role === 'automatic' ? 300 : 600 : 0;
        const item = visibleNodes.get(node.id);
        if (!item) {
          const marker = L.marker([node.position[1], node.position[0]], { icon: icon(node.number!, role), keyboard: true, title, zIndexOffset: z });
          marker.on('click', () => callback.current(node.id)); marker.addTo(map); visibleNodes.set(node.id, { marker, role });
        } else if (item.role !== role) {
          item.marker.setIcon(icon(node.number!, role)).setZIndexOffset(z); item.marker.options.title = title;
          item.marker.getElement()?.setAttribute('title', title); item.role = role;
        }
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    refresh.current = schedule; draw(); map.on('moveend rotate', schedule);
    return () => {
      cancelAnimationFrame(frame); refresh.current = () => {}; map.off('moveend rotate', schedule);
      for (const { layer } of visibleEdges.values()) layer.remove();
      for (const { marker } of visibleNodes.values()) marker.remove();
      renderer.remove();
    };
  }, [index]);
  useEffect(() => { refresh.current(); }, [roles, tileLayer]);
  useEffect(() => {
    const group = L.layerGroup().addTo(mapRef.current!);
    for (const step of route?.steps ?? []) {
      const points = step.coordinates.map(p => L.latLng(p[1], p[0]));
      L.polyline(points, { color: 'white', weight: 9, interactive: false }).addTo(group);
      L.polyline(points, { color: '#0759d3', weight: 5, interactive: false }).addTo(group);
    }
    return () => { group.remove(); };
  }, [route]);
  useEffect(() => {
    const map = mapRef.current!, visible = new Map<number, L.Marker>();
    let cachedZoom = -1, layout: { position: L.LatLng; angle: number; id: number }[] = [], grid = new SpatialGrid<typeof layout[number]>([]), frame = 0;
    const draw = () => {
      const zoom = map.getZoom();
      if (cachedZoom !== zoom) {
        for (const marker of visible.values()) marker.remove(); visible.clear(); layout = [];
        let untilArrow = 45;
        for (const step of route?.steps ?? []) {
          const points = step.coordinates.map(p => map.project([p[1], p[0]], zoom));
          for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
            if (!length) continue;
            while (untilArrow <= length) {
              layout.push({ id: layout.length, position: map.unproject(L.point(a.x + dx * untilArrow / length, a.y + dy * untilArrow / length), zoom), angle: Math.atan2(dy, dx) * 180 / Math.PI }); untilArrow += 90;
            }
            untilArrow -= length;
          }
        }
        grid = new SpatialGrid(layout.map(a => ({ value: a, box: pointBox(a.position.lng, a.position.lat) }))); cachedZoom = zoom;
      }
      const arrows = grid.query(viewport(map)), ids = new Set(arrows.map(a => a.id));
      for (const [id, marker] of visible) if (!ids.has(id)) { marker.remove(); visible.delete(id); }
      for (const arrow of arrows) if (!visible.has(arrow.id)) visible.set(arrow.id, L.marker(arrow.position, {
        pane: 'route-directions', rotateWithView: true, interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'route-direction-icon', iconSize: [24, 24], iconAnchor: [12, 12], html: `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${arrow.angle}deg)"><path d="M5 5 L19 12 L5 19 L9 12 Z" fill="white" stroke="#0759d3" stroke-width="2" stroke-linejoin="round"/></svg>` }),
      }).addTo(map));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    draw(); map.on('moveend', schedule);
    return () => { cancelAnimationFrame(frame); map.off('moveend', schedule); for (const marker of visible.values()) marker.remove(); };
  }, [route]);
  useEffect(() => {
    const group = L.layerGroup().addTo(mapRef.current!);
    if (approach) {
      const points = approach.coordinates.map(p => L.latLng(p[1], p[0]));
      L.polyline(points, { color: 'white', weight: 8, dashArray: '5 9', lineCap: 'round', interactive: false }).addTo(group);
      L.polyline(points, { color: '#a55313', weight: 4, dashArray: '5 9', lineCap: 'round', className: 'approach-route' }).bindTooltip('Fietsaanrijroute naar het startpunt · BRouter / OpenStreetMap').addTo(group);
    }
    return () => { group.remove(); };
  }, [approach]);
  useEffect(() => {
    if (focus.position) mapRef.current!.setView([focus.position[1], focus.position[0]], 14);
    else if (focus.route && route?.steps.length) mapRef.current!.fitBounds(L.latLngBounds(route.steps.flatMap(s => s.coordinates.map(p => L.latLng(p[1], p[0])))), { padding: [50, 50] });
  }, [focus]);
  useEffect(() => {
    if (!focus.highlight || !focus.position) return;
    const circle = L.circleMarker([focus.position[1], focus.position[0]], {
      radius: 30, color: '#e76570', weight: 2, opacity: .7,
      fillColor: '#f6a3ac', fillOpacity: .28, interactive: false,
    }).addTo(mapRef.current!);
    const timer = window.setTimeout(() => circle.remove(), 4000);
    return () => { window.clearTimeout(timer); circle.remove(); };
  }, [focus]);
  useEffect(() => {
    if (!focus.place) return;
    const marker = L.marker([focus.place.position[1], focus.place.position[0]], { opacity: 0, interactive: false });
    marker.bindPopup(tourismPopup(focus.place, !riding ? onPause : undefined)).addTo(mapRef.current!).openPopup();
    return () => { marker.remove(); };
  }, [focus, riding, onPause]);
  useEffect(() => {
    // A clockwise travel bearing requires the opposite map rotation.
    mapRef.current!.setBearing(riding && headingUp && heading !== null ? -heading : 0);
  }, [riding, headingUp, heading]);
  const userMarker = useRef<L.CircleMarker | null>(null), accuracyCircle = useRef<L.Circle | null>(null);
  useEffect(() => {
    const map = mapRef.current!; userMarker.current = L.circleMarker([0, 0], { radius: 9, fillColor: '#1865e8', fillOpacity: 1, color: 'white', weight: 4, className: 'current-location' }).bindTooltip('Je huidige locatie');
    accuracyCircle.current = L.circle([0, 0], { radius: 0, fillColor: '#1865e8', fillOpacity: 0.07, color: '#1865e8', opacity: 0.2, weight: 1, interactive: false });
    return () => { userMarker.current?.remove(); accuracyCircle.current?.remove(); };
  }, []);
  useEffect(() => {
    const map = mapRef.current!, marker = userMarker.current!, circle = accuracyCircle.current!;
    if (!location) { marker.remove(); circle.remove(); return; }
    marker.setRadius(riding ? 12 : 9).setStyle({ fillColor: riding ? '#e32636' : '#1865e8', color: 'white', weight: riding ? 5 : 4, fillOpacity: 1 });
    circle.setStyle({ fillColor: riding ? '#f8bbd0' : '#1865e8', fillOpacity: riding ? 0.3 : 0.07, color: riding ? '#e78ba5' : '#1865e8' });
    const latLng = L.latLng(location[1], location[0]); circle.setLatLng(latLng).setRadius(accuracy * (riding ? 2 : 1)).addTo(map); marker.setLatLng(latLng).addTo(map);
    if (riding) map.setView(latLng, 16, { animate: false });
  }, [location, accuracy, riding]);
  return <><div className="map-canvas" ref={element} aria-label="Kaart van het Vlaamse fietsknooppuntennetwerk" />{tourismEnabled && tourismFailed && <div className={`tourism-status ${riding ? 'during-ride' : ''}`} role="status">{tourismStatus}{tourismFailed && <button onClick={() => setTourismRetry(n => n + 1)}>Opnieuw</button>}</div>}</>;
}
