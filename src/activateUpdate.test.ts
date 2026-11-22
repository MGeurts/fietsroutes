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
  worker.dispatchEvent(new Event('statechange')); expect(reload).not.toHaveBeenCalled();
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
  await expect(activateUpdate(vi.fn())).rejects.toThrow('geen volledig geïnstalleerde');
});

it('herlaadt de reeds geactiveerde versie wanneer de wachtende update verdwenen is', async () => {
  setup(); const reload = vi.fn();
  vi.mocked(navigator.serviceWorker.getRegistration).mockResolvedValue({ waiting: null, active: { state: 'activated' } } as unknown as ServiceWorkerRegistration);
  await activateUpdate(reload); expect(reload).toHaveBeenCalledTimes(1);
});
it('herlaadt na activatie ook wanneer geen controllerchange op de huidige pagina volgt', async () => {
  const { worker } = setup(), reload = vi.fn();
  const result = activateUpdate(reload); await Promise.resolve();
  worker.state = 'activated'; worker.dispatchEvent(new Event('statechange'));
  await result; expect(reload).toHaveBeenCalledTimes(1);
});
