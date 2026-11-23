import { distance, type Position } from './network';
export interface HeadingFix { position: Position; accuracy: number; timestamp: number; heading: number | null; speed: number | null }
export interface HeadingState { anchor: HeadingFix | null; heading: number | null }
export function bearingBetween(a: Position, b: Position): number {
  const rad = Math.PI / 180, lat1 = a[1] * rad, lat2 = b[1] * rad, d = (b[0] - a[0]) * rad;
  return (Math.atan2(Math.sin(d) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(d)) / rad + 360) % 360;
}
export function updateHeading(state: HeadingState, fix: HeadingFix): HeadingState {
  if (fix.accuracy > 50 || !Number.isFinite(fix.accuracy)) return { ...state, anchor: null };
  if (state.anchor && fix.timestamp <= state.anchor.timestamp) return state;
  let candidate: number | null = null, anchor = state.anchor;
  if (Number.isFinite(fix.heading) && fix.heading !== null && fix.heading >= 0 && fix.heading < 360 && fix.speed !== null && fix.speed >= 1) {
    candidate = fix.heading; anchor = fix;
  } else if (fix.speed !== null && Number.isFinite(fix.speed) && fix.speed < 0.6) {
    // A stationary GPS can drift: never use that movement to spin the map.
    anchor = fix;
  } else if (anchor && fix.timestamp - anchor.timestamp <= 60000 && distance(anchor.position, fix.position) >= Math.max(8, anchor.accuracy, fix.accuracy)) {
    candidate = bearingBetween(anchor.position, fix.position); anchor = fix;
  } else if (!anchor || fix.timestamp - anchor.timestamp > 60000) anchor = fix;
  if (candidate === null) return { ...state, anchor };
  const delta = state.heading === null ? 0 : (candidate - state.heading + 540) % 360 - 180;
  const heading = state.heading === null ? candidate : Math.abs(delta) < 3 ? state.heading : (state.heading + delta * 0.45 + 360) % 360;
  return { anchor, heading };
}
