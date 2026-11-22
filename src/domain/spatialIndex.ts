export interface Box { west: number; south: number; east: number; north: number }
export interface SpatialItem<T> { box: Box; value: T }
export function intersects(a: Box, b: Box) { return a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south; }
export function pointBox(lon: number, lat: number): Box { return { west: lon, east: lon, south: lat, north: lat }; }
export function lineBox(points: [number, number][]): Box {
  const box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const [lon, lat] of points) { box.west = Math.min(box.west, lon); box.east = Math.max(box.east, lon); box.south = Math.min(box.south, lat); box.north = Math.max(box.north, lat); }
  return box;
}
// Grid cells bound the work per viewport. Long segments are indexed by their
// bounding box, so a segment crossing the screen is found even without a vertex inside it.
export class SpatialGrid<T> {
  private cells = new Map<string, SpatialItem<T>[]>();
  private extent = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  constructor(items: SpatialItem<T>[], private size = 0.05) {
    for (const item of items) {
      const x0 = Math.floor(item.box.west / size), x1 = Math.floor(item.box.east / size), y0 = Math.floor(item.box.south / size), y1 = Math.floor(item.box.north / size);
      this.extent.x0 = Math.min(this.extent.x0, x0); this.extent.x1 = Math.max(this.extent.x1, x1);
      this.extent.y0 = Math.min(this.extent.y0, y0); this.extent.y1 = Math.max(this.extent.y1, y1);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const key = `${x}:${y}`; const cell = this.cells.get(key) ?? []; cell.push(item); this.cells.set(key, cell); }
    }
  }
  query(box: Box): T[] {
    const found = new Set<SpatialItem<T>>(), values: T[] = [];
    const x0 = Math.max(this.extent.x0, Math.floor(box.west / this.size)), x1 = Math.min(this.extent.x1, Math.floor(box.east / this.size));
    const y0 = Math.max(this.extent.y0, Math.floor(box.south / this.size)), y1 = Math.min(this.extent.y1, Math.floor(box.north / this.size));
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const item of this.cells.get(`${x}:${y}`) ?? []) {
      if (!found.has(item)) { found.add(item); if (intersects(item.box, box)) values.push(item.value); }
    }
    return values;
  }
}
