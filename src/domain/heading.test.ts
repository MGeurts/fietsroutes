import { expect, it } from 'vitest';
import { bearingBetween, updateHeading, type HeadingFix, type HeadingState } from './heading';
const fix=(extra: Partial<HeadingFix>={}): HeadingFix=>({ position:[3,51],accuracy:5,timestamp:1000,heading:null,speed:null,...extra });
const empty: HeadingState={anchor:null,heading:null};
it('berekent de juiste windrichting uit verplaatsing',()=>{
  expect(bearingBetween([3,51],[3,51.01])).toBeCloseTo(0);
  expect(bearingBetween([3,51],[3.01,51])).toBeCloseTo(90,1);
  expect(bearingBetween([3,51],[3,50.99])).toBeCloseTo(180);
  expect(bearingBetween([3,51],[2.99,51])).toBeCloseTo(270,1);
  const state=updateHeading(empty,fix());
  expect(updateHeading(state,fix({ position:[3.001,51], timestamp:5000 })).heading).toBeCloseTo(90,1);
});
it('gebruikt GPS-koers tijdens rijden, maar niet bij stilstand of onnauwkeurige fixes',()=>{
  const riding=updateHeading(empty,fix({heading:90,speed:5})); expect(riding.heading).toBe(90);
  expect(updateHeading(riding,fix({timestamp:2000,heading:180,speed:0,position:[3.001,51]})).heading).toBe(90);
  expect(updateHeading(riding,fix({timestamp:2000,heading:180,speed:5,accuracy:100})).heading).toBe(90);
  expect(updateHeading(riding,fix({timestamp:2000,heading:NaN,speed:5})).heading).toBe(90);
});
it('dempt koerswisselingen over noord heen en negeert GPS-ruis en oude metingen',()=>{
  const state=updateHeading(empty,fix({heading:359,speed:5}));
  const next=updateHeading(state,fix({timestamp:2000,heading:5,speed:5}));
  expect(next.heading!).toBeGreaterThanOrEqual(0);expect(next.heading!).toBeLessThan(5);
  expect(updateHeading(state,fix({timestamp:500,heading:180,speed:5}))).toBe(state);
  expect(updateHeading(updateHeading(empty,fix()),fix({position:[3.000001,51],timestamp:2000})).heading).toBeNull();
});
