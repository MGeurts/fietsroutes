const distance = (a, b) => Math.hypot((a[0] - b[0]) * 70000, (a[1] - b[1]) * 111000);
/** Eenrichting follows source begin_geoid -> end_geoid; never infer reverse access. */
export function normalizeSourceEdge(feature, nodes) {
  const p = feature.properties, from = String(p.begin_geoid), to = String(p.end_geoid);
  const direction = p.direction == null ? '' : String(p.direction).trim();
  if (direction !== '' && direction !== 'Eenrichting') return { reason: 'unknownDirection' };
  if (!nodes.has(from) || !nodes.has(to) || feature.geometry?.type !== 'LineString') return { reason: 'skippedEdges' };
  const raw = feature.geometry.coordinates;
  if (!Array.isArray(raw) || raw.some(p => !Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return { reason: 'invalidGeometry' };
  const coordinates = raw.filter((c, i) => !i || c[0] !== raw[i - 1][0] || c[1] !== raw[i - 1][1]).map(c => [c[0], c[1]]);
  if (coordinates.length < 2) return { reason: 'invalidGeometry' };
  const start = nodes.get(from).position, end = nodes.get(to).position;
  const reversed = distance(start, coordinates[0]) + distance(end, coordinates.at(-1)) > distance(start, coordinates.at(-1)) + distance(end, coordinates[0]);
  // A directed source line contradicting its declared topology is not safe to guess.
  if (reversed && direction === 'Eenrichting') return { reason: 'directionConflict' };
  if (reversed) coordinates.reverse();
  if (distance(start, coordinates[0]) > 40 || distance(end, coordinates.at(-1)) > 40) return { reason: 'invalidGeometry' };
  return { edge: { id: String(p.objectid), from, to, coordinates, ...(direction === 'Eenrichting' ? { oneWay: true } : {}) } };
}
