/** Activate the actual waiting worker, including updates discovered by another tab. */
export async function activateUpdate(reload: () => void = () => window.location.reload()): Promise<void> {
  const serviceWorker = navigator.serviceWorker;
  const registration = await serviceWorker?.getRegistration();
  const worker = registration?.waiting;
  if (!worker) throw new Error('Geen wachtende update.');
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      serviceWorker.removeEventListener('controllerchange', changed);
      worker.removeEventListener('statechange', changed);
    };
    const changed = () => {
      if (serviceWorker.controller === worker) {
        cleanup(); reload(); resolve();
      } else if (worker.state === 'redundant') {
        cleanup(); reject(new Error('Update vervallen.'));
      }
    };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Activeren duurt te lang.')); }, 15000);
    serviceWorker.addEventListener('controllerchange', changed);
    worker.addEventListener('statechange', changed);
    try { worker.postMessage({ type: 'SKIP_WAITING' }); changed(); }
    catch (error) { cleanup(); reject(error); }
  });
}
