// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { usePlaces } from './usePlaces';
import { searchPlaces, type PlaceResult } from './domain/places';
vi.mock('./domain/places', async importOriginal => ({ ...await importOriginal<typeof import('./domain/places')>(), searchPlaces: vi.fn() }));
let root: Root, element: HTMLDivElement, state: ReturnType<typeof usePlaces>;
function Probe({ query, online = true }: { query: string; online?: boolean }) { state = usePlaces(query, online); return null; }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers(); element = document.createElement('div'); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); vi.resetAllMocks(); });
it('toont geen oud Genk-resultaat nadat naar Zutendaal wordt gezocht', async () => {
  let resolveOld!: (results: PlaceResult[]) => void;
  vi.mocked(searchPlaces).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce([{ key: 'zutendaal', label: 'Zutendaal', sub: 'Limburg', position: [5.57, 50.93] }]);
  await act(async () => root.render(<Probe query="Genk"/>));
  await act(async () => vi.advanceTimersByTime(450));
  const signal = vi.mocked(searchPlaces).mock.calls[0][1];
  await act(async () => root.render(<Probe query="Zutendaal"/>));
  expect(signal.aborted).toBe(true); expect(state.results).toEqual([]);
  await act(async () => vi.advanceTimersByTime(450));
  expect(state.results[0].label).toBe('Zutendaal');
  await act(async () => resolveOld([{ key: 'genk', label: 'Genk', sub: '', position: [5.5, 50.96] }]));
  expect(state.results[0].label).toBe('Zutendaal');
});
it('doet geen online zoekopdrachten voor nummers, korte tekst of zonder internet', async () => {
  await act(async () => root.render(<Probe query="12"/>));
  await act(async () => vi.advanceTimersByTime(500));
  await act(async () => root.render(<Probe query="Z"/>));
  await act(async () => vi.advanceTimersByTime(500));
  await act(async () => root.render(<Probe query="Zutendaal" online={false}/>));
  expect(state.error).toContain('internet'); expect(searchPlaces).not.toHaveBeenCalled();
});
