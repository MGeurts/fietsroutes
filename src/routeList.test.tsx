// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { RoutePointList } from './components/RoutePointList';
import type { Network } from './domain/network';
import type { ItineraryPoint } from './domain/itinerary';
let root: Root, element: HTMLDivElement;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); element = document.createElement('div'); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); });
it('toont uitkijkpunten tussen de knooppunten en centreert ze zonder routebewerking', async () => {
  const network = { nodes: new Map(['1', '2'].map(id => [id, { id, number: id, position: [3, 51] }])) } as Network;
  const points: ItineraryPoint[] = [{ id: '1', role: 'start', stopIndex: 0, metersToNext: 1000, metersFromStart: 0 }, { id: '2', role: 'end', stopIndex: 1, metersToNext: null, metersFromStart: 1000 }];
  const onFocus = vi.fn(), onRemove = vi.fn();
  const props = { network, points, speed: 20, riding: false, onFocus, onRemove };
  await act(async () => root.render(<RoutePointList {...props} viewpoints={[{ place: { id: 'node/1', name: 'Panorama', kind: 'Uitkijkpunt', category: 'sight', position: [3.01, 51] }, metersFromStart: 500, metersFromRoute: 20 }]}/>));
  const rows = element.querySelectorAll('.itinerary-row');
  expect(rows[0].textContent).toContain('Panorama'); expect(rows[1].textContent).not.toContain('Panorama');
  expect(element.textContent).toContain('0,5 km vanaf start · 20 m naast de route');
  await act(async () => element.querySelector<HTMLButtonElement>('.route-viewpoint button')!.click());
  expect(onFocus).toHaveBeenCalledWith([3.01, 51]); expect(onRemove).not.toHaveBeenCalled();
  await act(async () => root.render(<RoutePointList {...props}/>));
  expect(element.querySelector('.route-viewpoint')).toBeNull();
});
it('tekent de lijst niet opnieuw bij een GPS-update en past tijden wel aan bij een ander profiel', async () => {
  const network = { nodes: new Map(['1', '2', '3'].map(id => [id, { id, number: id, position: [3, 51] }])) } as Network;
  const points: ItineraryPoint[] = [{ id: '1', role: 'start', stopIndex: 0, metersToNext: 1000 }, { id: '2', role: 'automatic', stopIndex: null, metersToNext: 1000 }, { id: '3', role: 'end', stopIndex: 1, metersToNext: null }];
  const get = vi.spyOn(network.nodes, 'get'), onRemove = vi.fn(), onFocus = vi.fn();
  function Probe({ gps, speed }: { gps: number; speed: number }) { return <><span>{gps}</span><RoutePointList network={network} points={points} riding={false} speed={speed} onFocus={onFocus} onRemove={onRemove}/></>; }
  await act(async () => root.render(<Probe gps={0} speed={20}/>)); const count = get.mock.calls.length;
  expect(element.textContent).toContain('3 min');
  await act(async () => root.render(<Probe gps={1} speed={20}/>)); expect(get).toHaveBeenCalledTimes(count);
  await act(async () => root.render(<Probe gps={2} speed={15}/>)); expect(get.mock.calls.length).toBeGreaterThan(count); expect(element.textContent).toContain('4 min');
  expect(element.querySelectorAll('.remove-stop')).toHaveLength(2);
  await act(async () => (element.querySelectorAll('.remove-stop')[1] as HTMLButtonElement).click()); expect(onRemove).toHaveBeenCalledWith(1);
});
