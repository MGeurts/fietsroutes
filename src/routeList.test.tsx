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
