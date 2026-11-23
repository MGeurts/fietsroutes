// @vitest-environment jsdom
import { expect, it } from 'vitest';
import L from './leafletRuntime';
import 'leaflet-rotate';
it('roteert een echte Leaflet-kaart zodat een oostelijke rijrichting bovenaan ligt en markers op hun geografische positie blijven',()=>{
  const el=document.createElement('div');document.body.append(el);
  Object.defineProperties(el,{clientWidth:{value:640},clientHeight:{value:480}});
  const map=L.map(el,{center:[51,3],zoom:16,rotate:true,rotateControl:false,shiftKeyRotate:false});
  try {
    const center=map.latLngToContainerPoint([51,3]);
    const east=map.latLngToContainerPoint([51,3.001]); expect(east.x).toBeGreaterThan(center.x);
    map.setBearing(-90);
    const rotatedCenter=map.latLngToContainerPoint([51,3]),rotatedEast=map.latLngToContainerPoint([51,3.001]);
    expect(rotatedEast.y).toBeLessThan(rotatedCenter.y);
    expect(Math.abs(rotatedEast.x-rotatedCenter.x)).toBeLessThan(2);
    const original=map.containerPointToLatLng(rotatedEast);expect(original.lng).toBeCloseTo(3.001,4);expect(original.lat).toBeCloseTo(51,4);
    const marker=L.marker([51,3.001]).addTo(map);expect(marker.getLatLng().lng).toBe(3.001);
    map.setBearing(0);expect(map.latLngToContainerPoint([51,3.001]).x).toBeGreaterThan(map.latLngToContainerPoint([51,3]).x);
  } finally {map.remove();el.remove();}
});
