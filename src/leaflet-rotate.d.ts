import 'leaflet';
declare module 'leaflet' {
  interface MapOptions { rotate?: boolean; bearing?: number; rotateControl?: boolean; touchRotate?: boolean; shiftKeyRotate?: boolean; }
  interface Map { setBearing(degrees: number): this; getBearing(): number; }
  interface MarkerOptions { rotateWithView?: boolean; }
}
declare module 'leaflet-rotate';
