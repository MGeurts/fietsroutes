// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { UpdateNotice } from './components/UpdateNotice';
const sw = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('./activateUpdate', () => ({ activateUpdate: sw.update }));
vi.mock('virtual:pwa-register/react', async () => {
  const { useState } = await import('react');
  return { useRegisterSW: () => ({ needRefresh: useState(true), updateServiceWorker: sw.update }) };
});
let root: Root, element: HTMLDivElement;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); element = document.createElement('div'); root = createRoot(element); sw.update.mockReset(); sw.update.mockResolvedValue(undefined); });
afterEach(async () => { await act(async () => root.unmount()); });
it('bewaart eerst de werkroute en start pas daarna de update', async () => {
  const order: string[] = [], allowReload = { current: false };
  sw.update.mockImplementation(async () => { order.push('update'); });
  await act(async () => root.render(<UpdateNotice riding={false} preserve={() => { order.push('bewaren'); return true; }} allowReload={allowReload}/>));
  await act(async () => element.querySelector('button')!.click());
  expect(order).toEqual(['bewaren', 'update']); expect(allowReload.current).toBe(true);
});
it('weigert bijwerken tijdens navigatie en wanneer bewaren mislukt', async () => {
  const preserve = vi.fn(() => false), allowReload = { current: false };
  await act(async () => root.render(<UpdateNotice riding={true} preserve={preserve} allowReload={allowReload}/>));
  expect(element.querySelector('button')!.disabled).toBe(true);
  await act(async () => element.querySelector('button')!.click()); expect(preserve).not.toHaveBeenCalled();
  await act(async () => root.render(<UpdateNotice riding={false} preserve={preserve} allowReload={allowReload}/>));
  await act(async () => element.querySelector('button')!.click());
  expect(sw.update).not.toHaveBeenCalled(); expect(element.textContent).toContain('niet veilig'); expect(allowReload.current).toBe(false);
});
it('Later sluit de melding zonder route of app te herladen', async () => {
  const preserve = vi.fn(() => true);
  await act(async () => root.render(<UpdateNotice riding={false} preserve={preserve} allowReload={{ current: false }}/>));
  await act(async () => element.querySelectorAll('button')[1].click()); expect(element.textContent).toBe(''); expect(sw.update).not.toHaveBeenCalled(); expect(preserve).not.toHaveBeenCalled();
});
it('herstelt vertrekbeveiliging wanneer de update mislukt', async () => {
  const allowReload = { current: false }; sw.update.mockRejectedValue(Error('offline'));
  await act(async () => root.render(<UpdateNotice riding={false} preserve={() => true} allowReload={allowReload}/>));
  await act(async () => element.querySelector('button')!.click());
  expect(allowReload.current).toBe(false); expect(element.textContent).toContain('Bijwerken is niet afgerond');
});
