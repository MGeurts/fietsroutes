import { createNetwork, type Dataset } from './domain/network';
import { directions, directionalRoundTrip } from './domain/roundTrips';
self.onmessage = (event: MessageEvent<{ data: Dataset; start: string; targetKm: number }>) => {
  try {
    const { data, start, targetKm } = event.data, network = createNetwork(data);
    for (const direction of directions) {
      const route = directionalRoundTrip(network, start, targetKm, direction.key);
      self.postMessage({ type: 'option', direction: direction.key, route });
    }
    self.postMessage({ type: 'done' });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Rondritten berekenen is niet gelukt.' }); }
};
