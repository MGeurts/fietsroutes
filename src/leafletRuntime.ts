import L from 'leaflet';
// leaflet-rotate extends the shared Leaflet instance through its global entry point.
(globalThis as typeof globalThis & { L: typeof L }).L = L;
export default L;
