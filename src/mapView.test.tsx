vi.mock('leaflet-rotate', () => ({}));
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MapView } from './components/MapView';
import { createNetwork, planRoute, type Dataset } from './domain/network';
const state = vi.hoisted(() => ({ map: null as any, markers: [] as any[], lines: [] as any[], circles: [] as any[], project: vi.fn(), bounds: { west: 2.99, east: 3.03, south: 50.99, north: 51.03 } }));
vi.mock('leaflet', () => {
  const layer = (options: any = {}) => {
    const item: any = { options, addTo: vi.fn(() => item), remove: vi.fn(() => item), bindTooltip: vi.fn(() => item), bindPopup: vi.fn(() => item), openPopup: vi.fn(() => item), setIcon: vi.fn(() => item), setStyle: vi.fn(() => item), setZIndexOffset: vi.fn(() => item), setLatLng: vi.fn(() => item), setRadius: vi.fn(() => item), getElement: () => ({ setAttribute: vi.fn() }), on: vi.fn(() => item) }; return item;
  };
  return { default: {
    map: () => {
      const events = new Map<string, Set<() => void>>(); let zoom = 12;
      const map: any = { setBearing: vi.fn(), getPane: vi.fn(), createPane: () => ({ style: {} }), on: (names: string, fn: () => void) => { for (const n of names.split(' ')) { const set = events.get(n) ?? new Set(); set.add(fn); events.set(n, set); } }, off: (names: string, fn: () => void) => { for (const n of names.split(' ')) events.get(n)?.delete(fn); }, emit: (name: string) => { for (const fn of events.get(name) ?? []) fn(); }, getCenter: () => ({ lng: (state.bounds.west + state.bounds.east) / 2, lat: (state.bounds.south + state.bounds.north) / 2 }), getZoom: () => zoom, setZoom: (value: number) => { zoom = value; map.emit('zoomend'); map.emit('moveend'); }, getBounds: () => { const b: any = { pad: () => b, getWest: () => state.bounds.west, getEast: () => state.bounds.east, getSouth: () => state.bounds.south, getNorth: () => state.bounds.north }; return b; }, project: (p: number[], z: number) => { state.project(); const scale = 10000 * 2 ** (z - 12); return { x: p[1] * scale, y: p[0] * scale }; }, unproject: (p: any, z: number) => { const scale = 10000 * 2 ** (z - 12); return { lng: p.x / scale, lat: p.y / scale }; }, setView: vi.fn(), fitBounds: vi.fn(), invalidateSize: vi.fn(), remove: vi.fn(), attributionControl: { setPrefix: vi.fn(), addAttribution: vi.fn(), removeAttribution: vi.fn() } };
      state.map = map; return map;
    },
    control: { scale: () => layer() }, tileLayer: () => layer(), canvas: () => layer(), layerGroup: () => layer(),
    marker: (_position: any, options: any) => { const item = layer(options); state.markers.push(item); return item; },
    polyline: (_points: any, options: any) => { const item = layer(options); state.lines.push(item); return item; },
    circle: () => layer(), circleMarker: (_position: any, options: any) => { const item = layer(options); state.circles.push(item); return item; },
    latLng: (lat: number, lng: number) => ({ lat, lng }), latLngBounds: (points: any) => points, point: (x: number, y: number) => ({ x, y }), divIcon: (options: any) => options,
  } };
});
let root: Root, element: HTMLDivElement;
const tourismPlace = { id: 'node/123', name: 'B&B Test', kind: 'B&B', category: 'stay', position: [3.01, 51.01] };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); state.markers.length = 0; state.lines.length = 0; state.circles.length = 0; state.project.mockClear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (fn: (time: number) => void) => { fn(0); return 1; }); vi.stubGlobal('cancelAnimationFrame', () => {});
  element = document.createElement('div'); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
it('opent details van een geselecteerde toeristische plaats ook zonder een zichtbare toerismemarker', async () => {
  const place = { id: 'node/7', name: 'Museum', kind: 'Museum', category: 'sight' as const, position: [3, 51] as [number, number] };
  const props = { network: null, route: null, approach: null, accuracy: 0, onSelect: vi.fn(), onZoomChange: vi.fn(), zoomCommand: { token: 0, delta: 0 }, location: null, riding: false, tileLayer: 'network' };
  await act(async () => root.render(<MapView {...props} focus={{ token: 1, position: place.position, place }}/>));
  const marker = state.markers.find(m => m.options.opacity === 0);
  expect(marker.openPopup).toHaveBeenCalled();
  expect(marker.bindPopup.mock.calls[0][0].textContent).toContain('Museum');
});
it('markeert een aangeklikt lijstpunt vier seconden en vervangt de vorige cirkel bij een nieuwe selectie', async () => {
  vi.useFakeTimers();
  try {
    const props = { network: null, route: null, approach: null, accuracy: 0, onSelect: vi.fn(), onZoomChange: vi.fn(), zoomCommand: { token: 0, delta: 0 }, location: null, riding: false, tileLayer: 'network' };
    await act(async () => root.render(<MapView {...props} focus={{ token: 1, position: [3, 51], highlight: true }}/>));
    const first = state.circles.find(c => c.options.radius === 30);
    expect(first.options).toMatchObject({ fillColor: '#f6a3ac', interactive: false });
    await act(async () => vi.advanceTimersByTime(2000)); expect(first.remove).not.toHaveBeenCalled();
    await act(async () => root.render(<MapView {...props} focus={{ token: 2, position: [3.01, 51], highlight: true }}/>));
    expect(first.remove).toHaveBeenCalled();
    const second = state.circles.at(-1);
    await act(async () => vi.advanceTimersByTime(3999)); expect(second.remove).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1)); expect(second.remove).toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
it('laadt toerisme alleen voor de gekozen laag, toont vanaf zoom 14 en ruimt markers op bij wisselen', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, fetchedAt: '2026-11-24', places: [tourismPlace] }) });
  vi.stubGlobal('fetch', fetcher);
  const props = { network: null, route: null, approach: null, accuracy: 0, onSelect: vi.fn(), onZoomChange: vi.fn(), focus: { token: 0 }, zoomCommand: { token: 0, delta: 0 }, location: null, riding: false, tileLayer: 'network' };
  await act(async () => root.render(<MapView {...props}/>));
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => root.render(<MapView {...props} tourismEnabled={true}/>));
  expect(fetcher).toHaveBeenCalledTimes(1); expect(state.markers).toHaveLength(0);
  expect(element.querySelector('.tourism-status')).toBeNull();
  await act(async () => state.map.setZoom(14));
  const marker = state.markers.find(m => m.options.pane === 'tourism');
  expect(marker.options.title).toBe('B&B Test · B&B');
  expect(marker.bindPopup).toHaveBeenCalled();
  await act(async () => root.render(<MapView {...props}/>));
  expect(marker.remove).toHaveBeenCalled(); expect(element.querySelector('.tourism-status')).toBeNull();
  await act(async () => root.render(<MapView {...props} tourismEnabled={true}/>));
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('biedt opnieuw laden na een ontbrekende toerismesnapshot', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true, json: async () => ({ version: 1, fetchedAt: '2026-11-24', places: [] }) });
  vi.stubGlobal('fetch', fetcher);
  const props = { network: null, route: null, approach: null, accuracy: 0, onSelect: vi.fn(), onZoomChange: vi.fn(), focus: { token: 0 }, zoomCommand: { token: 0, delta: 0 }, location: null, riding: false, tileLayer: 'network', tourismEnabled: true };
  await act(async () => root.render(<MapView {...props}/>));
  expect(element.textContent).toContain('konden niet worden geladen');
  await act(async () => element.querySelector<HTMLButtonElement>('.tourism-status button')!.click());
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(element.textContent).not.toContain('konden niet worden geladen');
});
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

it('draait met de rijrichting mee, biedt noorden bovenaan en toont tijdens navigatie een grotere rode stip', async () => {
  const props = { network: null, route: null, approach: null, accuracy: 10, onSelect: vi.fn(), onZoomChange: vi.fn(), focus: { token: 0 }, zoomCommand: { token: 0, delta: 0 }, location: [3,51] as [number,number], riding: true, tileLayer: 'osm', heading: 90, headingUp: true };
  await act(async()=>root.render(<MapView {...props}/>));
  expect(state.map.setBearing).toHaveBeenLastCalledWith(-90);
  expect(state.circles[0].setRadius).toHaveBeenLastCalledWith(12);
  expect(state.circles[0].setStyle).toHaveBeenLastCalledWith(expect.objectContaining({fillColor:'#e32636',weight:5}));
  await act(async()=>root.render(<MapView {...props} headingUp={false}/>));
  expect(state.map.setBearing).toHaveBeenLastCalledWith(0);
  await act(async()=>root.render(<MapView {...props} riding={false}/>));
  expect(state.map.setBearing).toHaveBeenLastCalledWith(0);
  expect(state.circles[0].setRadius).toHaveBeenLastCalledWith(9);
});
