import { expect, it } from 'vitest';
import { SpatialGrid, lineBox, pointBox } from './spatialIndex';
it('vindt lijnen die het venster kruisen zonder vertex in beeld', () => {
  const grid = new SpatialGrid([{ value: 'lijn', box: lineBox([[2, 51], [5, 51]]) }]);
  expect(grid.query({ west: 3, east: 3.01, south: 50.99, north: 51.01 })).toEqual(['lijn']);
});
it('geeft geen dubbels voor trajecten die meerdere cellen beslaan', () => {
  const grid = new SpatialGrid([{ value: 1, box: lineBox([[3, 51], [3.2, 51.2]]) }, { value: 2, box: pointBox(5, 50) }]);
  expect(grid.query({ west: 2.9, east: 3.3, south: 50.9, north: 51.3 })).toEqual([1]);
  expect(grid.query({ west: -180, east: 180, south: -90, north: 90 }).sort()).toEqual([1, 2]);
});
it('vindt randen en behandelt lege indexen correct', () => {
  expect(new SpatialGrid([{ value: 'rand', box: pointBox(3, 51) }]).query({ west: 3, east: 3.1, south: 51, north: 51.1 })).toEqual(['rand']);
  expect(new SpatialGrid([]).query({ west: 0, east: 10, south: 0, north: 60 })).toEqual([]);
});
