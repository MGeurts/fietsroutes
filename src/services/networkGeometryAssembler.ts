export type NetworkCoordinate = [number, number];

function distanceDegrees(a: NetworkCoordinate, b: NetworkCoordinate): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function sameCoordinate(a: NetworkCoordinate, b: NetworkCoordinate): boolean {
  return distanceDegrees(a, b) < 1e-10;
}

/**
 * Assemble the ways of one route relation into a single ordered line.
 *
 * OSM relation members are not guaranteed to be in travel order, nor to have a
 * consistent direction. We therefore grow the line at both ends. A very small
 * gap is retained as a visible short connector; a larger gap rejects the whole
 * geometry rather than inventing a route across the map.
 */
export function assembleRelationGeometry(
  inputSegments: NetworkCoordinate[][],
  maxJoinDistanceDegrees: number,
): NetworkCoordinate[] | null {
  if (inputSegments.length === 0 || inputSegments.some((segment) => segment.length < 2)) return null;

  const remaining = inputSegments.map((segment) => [...segment]);
  let coordinates = remaining.shift()!;

  while (remaining.length > 0) {
    const head = coordinates[0];
    const tail = coordinates[coordinates.length - 1];
    let best: { index: number; side: 'prepend' | 'append'; reverse: boolean; distance: number } | null = null;

    const consider = (index: number, side: 'prepend' | 'append', reverse: boolean, distance: number) => {
      if (!best || distance < best.distance) best = { index, side, reverse, distance };
    };

    remaining.forEach((segment, index) => {
      const start = segment[0];
      const end = segment[segment.length - 1];
      consider(index, 'append', false, distanceDegrees(tail, start));
      consider(index, 'append', true, distanceDegrees(tail, end));
      consider(index, 'prepend', false, distanceDegrees(head, end));
      consider(index, 'prepend', true, distanceDegrees(head, start));
    });

    if (!best || best.distance > maxJoinDistanceDegrees) return null;
    const segment = remaining.splice(best.index, 1)[0];
    const oriented = best.reverse ? [...segment].reverse() : segment;

    if (best.side === 'append') {
      coordinates = coordinates.concat(sameCoordinate(coordinates[coordinates.length - 1], oriented[0]) ? oriented.slice(1) : oriented);
    } else {
      coordinates = (sameCoordinate(oriented[oriented.length - 1], coordinates[0]) ? oriented.slice(0, -1) : oriented).concat(coordinates);
    }
  }

  return coordinates;
}
