import { expect, it } from 'vitest';
import { updateRideSpeed } from './rideSpeed';
import type { HeadingFix } from './heading';
const fix=(extra:Partial<HeadingFix>={}):HeadingFix=>({position:[3,51],accuracy:5,timestamp:1000,heading:null,speed:null,...extra});
it('gebruikt gemeten GPS-snelheid in km/u, inclusief stilstand',()=>{
  expect(updateRideSpeed({anchor:null,speedKmh:null},fix({speed:5})).speedKmh).toBe(18);
  expect(updateRideSpeed({anchor:null,speedKmh:18},fix({speed:0})).speedKmh).toBe(0);
  expect(updateRideSpeed({anchor:null,speedKmh:18},fix({speed:5,accuracy:100})).speedKmh).toBeNull();
});
it('berekent een terugval uit verplaatsing maar weigert lange gaten, GPS-ruis en onmogelijke sprongen',()=>{
  const state=updateRideSpeed({anchor:null,speedKmh:null},fix());
  expect(updateRideSpeed(state,fix({timestamp:3000,position:[3.0001,51]})).speedKmh!).toBeGreaterThan(10);
  expect(updateRideSpeed(state,fix({timestamp:3000,position:[3.000001,51]})).speedKmh).toBe(0);
  expect(updateRideSpeed(state,fix({timestamp:3000,position:[4,51]})).speedKmh).toBeNull();
  expect(updateRideSpeed(state,fix({timestamp:30000,position:[3.001,51]})).speedKmh).toBeNull();
});
