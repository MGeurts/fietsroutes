// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import App from './App';
import { readDraft, writeDraft, type RouteDraft } from './domain/draft';
const captured = vi.hoisted(() => ({ map: null as any }));
vi.mock('./components/MapView', () => ({ MapView: (props: any) => { captured.map = props; return null; } }));
vi.mock('./components/UpdateNotice', () => ({ UpdateNotice: () => null }));
vi.mock('./useDeviceLocation', () => ({ useDeviceLocation: () => ({ location: null, accuracy: 0, lastFix: 0, status: '', locate: vi.fn() }) }));
vi.mock('./useApproach', () => ({ useApproach: () => ({ route: null, status: '', atStart: false }) }));
const data = { version: 1, fetchedAt: '2026-11-21T00:00:00Z', attribution: 'Test', report: { skippedEdges: 0, ambiguousIds: 0, invalidGeometry: 0 }, junctions: ['1', '2', '3'].map((id, i) => ({ id, number: id, position: [3 + i * 0.01, 51], network: 'Test', owner: 'Test' })), edges: [{ id: 'a', from: '1', to: '2', coordinates: [[3, 51], [3.01, 51]] }, { id: 'b', from: '2', to: '3', coordinates: [[3.01, 51], [3.02, 51]] }] };
const draft: RouteDraft = { version: 1, name: 'Bewaarde werkroute', stops: ['1', '2'], activeId: null, speed: 15, tileLayer: 'cycle' };
let root: Root, element: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); localStorage.clear(); window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  element = document.createElement('div'); document.body.appendChild(element); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
it('herstelt een werkroute inclusief profiel en kaartlaag en verliest niets bij een klik op het logo', async () => {
  writeDraft(draft); await act(async () => root.render(<App/>));
  expect((element.querySelector('#route-name') as HTMLInputElement).value).toBe(draft.name);
  expect((element.querySelector('#bike') as HTMLSelectElement).value).toBe('15'); expect(captured.map.tileLayer).toBe('cycle');
  expect(captured.map.route.stops).toEqual(['1', '2']);
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  await act(async () => { element.querySelector('.brand')!.dispatchEvent(click); });
  expect(click.defaultPrevented).toBe(true); expect(captured.map.route.stops).toEqual(['1', '2']); expect(readDraft()).toEqual(draft);
});
it('geeft een geldige deellink voorrang en herstelt na herladen de daarna bewerkte werkroute', async () => {
  writeDraft(draft); window.history.replaceState(null, '', '/#route=2,3');
  let complete!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }) as Promise<Response>);
  await act(async () => root.render(<App/>)); expect(readDraft()).toEqual(draft);
  await act(async () => complete({ ok: true, json: async () => data } as Response));
  expect(captured.map.route.stops).toEqual(['2', '3']); expect(window.location.hash).toBe('');
  await act(async () => captured.map.onSelect('1')); expect(readDraft()?.stops).toEqual(['2', '3', '1']);
  await act(async () => root.unmount()); root = createRoot(element);
  await act(async () => root.render(<App/>)); expect(captured.map.route.stops).toEqual(['2', '3', '1']);
});
it('verwijdert de herstelkopie wanneer bewust een nieuwe lege route wordt gestart', async () => {
  writeDraft(draft); await act(async () => root.render(<App/>));
  const button = [...element.querySelectorAll('button')].find(b => b.textContent === 'Nieuwe route')!;
  await act(async () => button.click()); expect(readDraft()).toBeNull(); expect(captured.map.route.stops).toEqual([]);
});


it('toont de actuele versie direct links van de infoknop', async () => {
  await act(async () => root.render(<App/>));
  const info = element.querySelector('[aria-label="Over de app"]')!;
  expect(info.previousElementSibling?.textContent).toBe('v' + __APP_VERSION__);
  expect(info.previousElementSibling?.classList.contains('header-version')).toBe(true);
});
