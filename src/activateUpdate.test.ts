// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { activateUpdate } from './activateUpdate';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function setup() {
  const worker = Object.assign(new EventTarget(), { state: 'installed', postMessage: vi.fn() });
  const container = Object.assign(new EventTarget(), { controller: null as unknown, getRegistration: vi.fn().mockResolvedValue({ waiting: worker }) });
  vi.stubGlobal('navigator', { serviceWorker: container });
  return { worker, container };
}
it('activeert de werkelijk wachtende worker en herstart pas zodra die controle heeft', async () => {
  const { worker, container } = setup(), reload = vi.fn();
  const result = activateUpdate(reload); await Promise.resolve();
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  worker.state = 'activated'; worker.dispatchEvent(new Event('statechange')); expect(reload).not.toHaveBeenCalled();
  container.controller = worker; container.dispatchEvent(new Event('controllerchange'));
  await result; expect(reload).toHaveBeenCalledTimes(1);
  container.dispatchEvent(new Event('controllerchange')); expect(reload).toHaveBeenCalledTimes(1);
});
it('stopt wachten na 15 seconden zonder onverwacht later te herstarten', async () => {
  vi.useFakeTimers(); const { container, worker } = setup(), reload = vi.fn();
  const result = expect(activateUpdate(reload)).rejects.toThrow('Activeren duurt te lang');
  await vi.advanceTimersByTimeAsync(15000); await result;
  container.controller = worker; container.dispatchEvent(new Event('controllerchange')); expect(reload).not.toHaveBeenCalled();
});
it('meldt wanneer de update al door een andere tab is afgehandeld', async () => {
  setup(); vi.mocked(navigator.serviceWorker.getRegistration).mockResolvedValue(undefined);
  await expect(activateUpdate(vi.fn())).rejects.toThrow('Geen wachtende update');
});
