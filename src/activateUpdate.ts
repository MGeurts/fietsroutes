/** Activate the actual waiting worker, including updates discovered by another tab. */
export async function activateUpdate(reload: () => void = () => window.location.reload()): Promise<void> {
  const serviceWorker = navigator.serviceWorker;
  const registration = await serviceWorker?.getRegistration();
  const worker = registration?.waiting;
  if (!worker) {
    // A different tab may have activated it after the banner appeared.
    // Reload onto the active installation instead of leaving a stale prompt.
    if (registration?.active?.state === 'activated') { reload(); return; }
    throw new Error('Er is nog geen volledig geïnstalleerde appversie beschikbaar.');
  }
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      serviceWorker.removeEventListener('controllerchange', changed);
      worker.removeEventListener('statechange', changed);
    };
    const changed = () => {
      if (serviceWorker.controller === worker || worker.state === 'activated') {
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
