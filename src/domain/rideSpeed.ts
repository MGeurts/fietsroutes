import { distance } from './network';
import type { HeadingFix } from './heading';
export interface RideSpeedState { anchor: HeadingFix | null; speedKmh: number | null }
export function updateRideSpeed(state: RideSpeedState, fix: HeadingFix): RideSpeedState {
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > 50) return { anchor: null, speedKmh: null };
  if (state.anchor && fix.timestamp <= state.anchor.timestamp) return state;
  if (fix.speed !== null && Number.isFinite(fix.speed) && fix.speed >= 0 && fix.speed <= 28) return { anchor: fix, speedKmh: fix.speed * 3.6 };
  const anchor = state.anchor, seconds = anchor ? (fix.timestamp - anchor.timestamp) / 1000 : 0;
  if (!anchor || seconds > 15) return { anchor: fix, speedKmh: null };
  if (seconds < 2) return state;
  if (fix.accuracy > 25 || anchor.accuracy > 25) return { anchor: fix, speedKmh: null };
  const meters = distance(anchor.position, fix.position), speed = meters / seconds * 3.6;
  return { anchor: fix, speedKmh: speed > 100 ? null : meters < Math.max(3, fix.accuracy / 2, anchor.accuracy / 2) ? 0 : speed };
}
