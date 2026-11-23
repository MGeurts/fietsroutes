// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MapView } from './components/MapView';
import { createNetwork, planRoute, type Dataset } from './domain/network';
const state = vi.hoisted(() => ({ map: null as any, markers: [] as any[], lines: [] as any[], circles: [] as any[], project: vi.fn(), bounds: { west: 2.99, east: 3.03, south: 50.99, north: 51.03 } }));
vi.mock('leaflet', () => {
  const layer = (options: any = {}) => {
    const item: any = { options, addTo: vi.fn(() => item), remove: vi.fn(() => item), bindTooltip: vi.fn(() => item), setIcon: vi.fn(() => item), setStyle: vi.fn(() => item), setZIndexOffset: vi.fn(() => item), setLatLng: vi.fn(() => item), setRadius: vi.fn(() => item), getElement: () => ({ setAttribute: vi.fn() }), on: vi.fn(() => item) }; return item;
  };
  return { default: {
    map: () => {
      const events = new Map<string, Set<() => void>>(); let zoom = 12;
      const map: any = { createPane: () => ({ style: {} }), on: (names: string, fn: () => void) => { for (const n of names.split(' ')) { const set = events.get(n) ?? new Set(); set.add(fn); events.set(n, set); } }, off: (names: string, fn: () => void) => { for (const n of names.split(' ')) events.get(n)?.delete(fn); }, emit: (name: string) => { for (const fn of events.get(name) ?? []) fn(); }, getCenter: () => ({ lng: (state.bounds.west + state.bounds.east) / 2, lat: (state.bounds.south + state.bounds.north) / 2 }), getZoom: () => zoom, setZoom: (value: number) => { zoom = value; map.emit('zoomend'); map.emit('moveend'); }, getBounds: () => { const b: any = { pad: () => b, getWest: () => state.bounds.west, getEast: () => state.bounds.east, getSouth: () => state.bounds.south, getNorth: () => state.bounds.north }; return b; }, project: (p: number[], z: number) => { state.project(); const scale = 10000 * 2 ** (z - 12); return { x: p[1] * scale, y: p[0] * scale }; }, unproject: (p: any, z: number) => { const scale = 10000 * 2 ** (z - 12); return { lng: p.x / scale, lat: p.y / scale }; }, setView: vi.fn(), fitBounds: vi.fn(), invalidateSize: vi.fn(), remove: vi.fn(), attributionControl: { setPrefix: vi.fn(), addAttribution: vi.fn(), removeAttribution: vi.fn() } };
      state.map = map; return map;
    },
    control: { scale: () => layer() }, tileLayer: () => layer(), canvas: () => layer(), layerGroup: () => layer(),
    marker: (_position: any, options: any) => { const item = layer(options); state.markers.push(item); return item; },
    polyline: (_points: any, options: any) => { const item = layer(options); state.lines.push(item); return item; },
    circle: () => layer(), circleMarker: () => { const item = layer(); state.circles.push(item); return item; },
    latLng: (lat: number, lng: number) => ({ lat, lng }), latLngBounds: (points: any) => points, point: (x: number, y: number) => ({ x, y }), divIcon: (options: any) => options,
  } };
});
let root: Root, element: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); state.markers.length = 0; state.lines.length = 0; state.circles.length = 0; state.project.mockClear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (fn: (time: number) => void) => { fn(0); return 1; }); vi.stubGlobal('cancelAnimationFrame', () => {});
  element = document.createElement('div'); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
it('hergebruikt zichtbare knooppunten, netwerkgeometrie en locatiestip tijdens verschuiven en GPS-updates', async () => {
  const data: Dataset = { version: 1, fetchedAt: '', attribution: '', report: { skippedEdges: 0, ambiguousIds: 0, invalidGeometry: 0 }, junctions: [{ id: '1', number: '1', position: [3, 51], owner: 'Test', network: 'Test' }, { id: '2', number: '2', position: [3.01, 51], owner: 'Test', network: 'Test' }], edges: [{ id: 'edge', from: '1', to: '2', coordinates: [[3, 51], [3.01, 51]] }] };
  const network = createNetwork(data), onSelect = vi.fn(), onZoomChange = vi.fn(), focus = { token: 0 }, zoomCommand = { token: 0, delta: 0 };
  const props = { network, route: null, approach: null, accuracy: 10, onSelect, onZoomChange, focus, zoomCommand, location: null, riding: false, tileLayer: 'network' };
  await act(async () => root.render(<MapView {...props}/>));
  expect(state.markers.filter(m => m.options.keyboard)).toHaveLength(2); expect(state.lines).toHaveLength(1);
  const first = state.markers[0];
  await act(async () => state.map.emit('moveend'));
  await act(async () => root.render(<MapView {...props} location={[3.001, 51]}/>));
  expect(state.markers.filter(m => m.options.keyboard)).toHaveLength(2); expect(state.lines).toHaveLength(1); expect(state.circles).toHaveLength(1); expect(first.remove).not.toHaveBeenCalled();
  const route = planRoute(network, ['1', '2']);
  await act(async () => root.render(<MapView {...props} route={route}/>));
  expect(state.markers.filter(m => m.options.keyboard)).toHaveLength(2); expect(first.setIcon).toHaveBeenCalledTimes(1);
  const projections = state.project.mock.calls.length;
  await act(async () => state.map.emit('moveend')); expect(state.project).toHaveBeenCalledTimes(projections);
  await act(async () => state.map.setZoom(13)); expect(state.project.mock.calls.length).toBeGreaterThan(projections);
});
