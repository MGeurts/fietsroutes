import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute, PrecacheFallbackPlugin } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

setCacheNameDetails({ prefix: 'fietsroutes-production-v1' });
// Register before precaching: root and index.html must both use fresh HTML online.
// Only failed network requests fall back to the installed offline app.
registerRoute(new NavigationRoute(new NetworkOnly({
  fetchOptions: { cache: 'no-store' },
  plugins: [new PrecacheFallbackPlugin({ fallbackURL: '/index.html' })],
})));
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();
// Activation stays user-controlled so an active ride is never interrupted.
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
