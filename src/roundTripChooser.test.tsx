// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RoundTripChooser } from './components/RoundTripChooser';
import { createNetwork, planRoute } from './domain/network';
vi.mock('leaflet', () => {
  const layer = { addTo: vi.fn() };
  return { default: { map: () => ({ attributionControl: { setPrefix: vi.fn() }, invalidateSize: vi.fn(), fitBounds: vi.fn(), remove: vi.fn() }), tileLayer: () => layer, polyline: () => layer, circleMarker: () => layer, latLngBounds: vi.fn() } };
});
const network = createNetwork({ version: 1, fetchedAt: '', attribution: '', report: { skippedEdges: 0, ambiguousIds: 0, invalidGeometry: 0 }, junctions: [{ id: '1', number: '1', position: [5.5,51], network: '', owner: '' }, { id: '2', number: '2', position: [5.6,51], network: '', owner: '' }], edges: [{ id: 'a', from: '1', to: '2', coordinates: [[5.5,51],[5.6,51]] }] });
const route = planRoute(network, ['1','2','1']);
let root: Root, element: HTMLDivElement;
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null; onerror: (() => void) | null = null;
  postMessage = vi.fn(); terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  send(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  element = document.createElement('div'); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
it('toont vooruitzichten en verandert de route pas na een bewuste keuze', async () => {
  const choose = vi.fn();
  await act(async () => root.render(<RoundTripChooser network={network} start="1" targetKm={30} onDistance={vi.fn()} speed={20} onChoose={choose}/>));
  await act(async () => element.querySelector('button')!.click());
  const worker = FakeWorker.instances[0];
  expect(worker.postMessage).toHaveBeenCalledWith({ data: network.data, start: '1', targetKm: 30 });
  await act(async () => { worker.send({ type: 'option', direction: 'north', route }); worker.send({ type: 'option', direction: 'east', route: null }); });
  expect(element.querySelector('[aria-label="Kaartvooruitzicht Noord"]')).not.toBeNull();
  expect(element.textContent).toContain('Geen geschikte lus gevonden'); expect(choose).not.toHaveBeenCalled();
  await act(async () => { worker.send({ type: 'done' }); });
  const button = [...element.querySelectorAll('button')].find(b => b.textContent === 'Kies Noord')!;
  await act(async () => button.click()); expect(choose).toHaveBeenCalledWith(route);
});
it('annuleert oude resultaten zodra de gekozen afstand verandert', async () => {
  const props = { network, start: '1', onDistance: vi.fn(), speed: 20, onChoose: vi.fn() };
  await act(async () => root.render(<RoundTripChooser {...props} targetKm={30}/>));
  await act(async () => element.querySelector('button')!.click()); const worker = FakeWorker.instances[0];
  await act(async () => root.render(<RoundTripChooser {...props} targetKm={40}/>));
  expect(worker.terminate).toHaveBeenCalled();
  await act(async () => worker.send({ type: 'option', direction: 'north', route }));
  expect(element.querySelector('.round-trip-options')).toBeNull(); expect(props.onChoose).not.toHaveBeenCalled();
});
