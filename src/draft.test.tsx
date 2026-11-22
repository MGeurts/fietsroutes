// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRouteDraft } from './useRouteDraft';
import { readDraft, type RouteDraft } from './domain/draft';
let root: Root, container: HTMLDivElement, state: ReturnType<typeof useRouteDraft>;
const draft: RouteDraft = { version: 1, name: 'Herstelrit', stops: ['1', '2'], speed: 20, tileLayer: 'network', activeId: null };
function Probe({ value = draft, dirty = true, enabled = true }: { value?: RouteDraft; dirty?: boolean; enabled?: boolean }) { state = useRouteDraft(value, enabled, dirty); return null; }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); localStorage.clear(); container = document.createElement('div'); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); });
it('schrijft de werkroute automatisch en de laatste wijziging vóór afsluiten', async () => {
  await act(async () => root.render(<Probe/>)); expect(readDraft()).toEqual(draft);
  await act(async () => root.render(<Probe value={{ ...draft, name: 'Aangepast', stops: ['1', '3'] }}/>));
  const event = new Event('beforeunload', { cancelable: true });
  await act(async () => { window.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(true); expect(readDraft()?.name).toBe('Aangepast'); expect(readDraft()?.stops).toEqual(['1', '3']);
});
it('laat gecontroleerd bijwerken toe nadat de werkroute veilig is bewaard', async () => {
  await act(async () => root.render(<Probe/>)); expect(state.flush()).toBe(true); state.allowReload.current = true;
  const event = new Event('beforeunload', { cancelable: true }); await act(async () => { window.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(false); expect(readDraft()).toEqual(draft);
});
it('houdt een bestaande draft intact zolang een gedeelde route nog niet geladen is', async () => {
  localStorage.setItem('fietsroutes:draft:v1', JSON.stringify(draft));
  await act(async () => root.render(<Probe value={{ ...draft, stops: [] }} enabled={false} dirty={false}/>));
  expect(readDraft()).toEqual(draft);
});
it('meldt opslagproblemen en geeft geen succesvolle veilige update terug', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('vol'); });
  await act(async () => root.render(<Probe/>));
  let saved = true; await act(async () => { saved = state.flush(); });
  expect(saved).toBe(false); expect(state.error).toContain('niet automatisch');
});
