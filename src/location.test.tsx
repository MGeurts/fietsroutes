// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceLocation } from './useDeviceLocation';
import { useApproach } from './useApproach';
import { fetchApproach, type Approach } from './domain/approach';
import type { Position } from './domain/network';

vi.mock('./domain/approach', () => ({ fetchApproach: vi.fn() }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('Locatie bij opstarten', () => {
  it('vraagt automatisch een verse GPS-fix, centreert eenmaal en blijft de stip actualiseren', async () => {
    let callback: PositionCallback = () => {};
    const watch = vi.fn((success: PositionCallback) => { callback = success; return 17; }), clear = vi.fn(), center = vi.fn();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition: watch, clearWatch: clear } });
    let state!: ReturnType<typeof useDeviceLocation>;
    function Probe() { state = useDeviceLocation(center); return null; }
    await act(async () => root.render(<Probe/>));
    expect(watch).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), expect.objectContaining({ maximumAge: 0, enableHighAccuracy: true }));
    const fix = (longitude: number) => ({ coords: { longitude, latitude: 51.05, accuracy: 12 }, timestamp: Date.now() }) as GeolocationPosition;
    await act(async () => callback(fix(3.72)));
    expect(center).toHaveBeenCalledExactlyOnceWith([3.72, 51.05]);
    await act(async () => callback(fix(3.73)));
    expect(state.location).toEqual([3.73, 51.05]); expect(center).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount()); expect(clear).toHaveBeenCalledWith(17);
    root = createRoot(container);
  });
  it('meldt geweigerde toegang en negeert callbacks na het verlaten van de pagina', async () => {
    let success: PositionCallback = () => {}, failure: PositionErrorCallback = () => {};
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition: (s: PositionCallback, e: PositionErrorCallback) => { success = s; failure = e; return 1; }, clearWatch: vi.fn() } });
    let state!: ReturnType<typeof useDeviceLocation>; const center = vi.fn();
    function Probe() { state = useDeviceLocation(center); return null; }
    await act(async () => root.render(<Probe/>));
    await act(async () => failure({ code: 1 } as GeolocationPositionError));
    expect(state.status).toContain('geweigerd'); expect(state.location).toBeNull();
    await act(async () => root.unmount());
    success({ coords: { longitude: 3, latitude: 51, accuracy: 10 }, timestamp: 1 } as GeolocationPosition);
    expect(center).not.toHaveBeenCalled(); root = createRoot(container);
  });
});

describe('Aanrijroute bij routebewerkingen', () => {
  it('annuleert de oude aanvraag en negeert een laat antwoord na een ander startpunt', async () => {
    vi.useFakeTimers();
    const from: Position = [3.72, 51.05], a: Position = [3.73, 51.05], b: Position = [3.74, 51.05];
    let first!: (route: Approach) => void;
    vi.mocked(fetchApproach).mockImplementationOnce(() => new Promise(resolve => { first = resolve; })).mockResolvedValueOnce({ coordinates: [from, b], meters: 1400 });
    let state!: ReturnType<typeof useApproach>;
    function Probe({ start }: { start: Position }) { state = useApproach(from, start, true); return null; }
    await act(async () => root.render(<Probe start={a}/>));
    await act(async () => vi.advanceTimersByTime(500));
    const signal = vi.mocked(fetchApproach).mock.calls[0][2];
    await act(async () => root.render(<Probe start={b}/>));
    expect(signal.aborted).toBe(true); expect(state.route).toBeNull();
    await act(async () => vi.advanceTimersByTime(500));
    expect(state.route?.coordinates.at(-1)).toEqual(b);
    await act(async () => first({ coordinates: [from, a], meters: 700 }));
    expect(state.route?.coordinates.at(-1)).toEqual(b);
  });
  it('vraagt geen aanrijroute op zonder internet of wanneer je al aan de start bent', async () => {
    vi.useFakeTimers(); const from: Position = [3.72, 51.05];
    let state!: ReturnType<typeof useApproach>;
    function Probe({ start, online }: { start: Position; online: boolean }) { state = useApproach(from, start, online); return null; }
    await act(async () => root.render(<Probe start={[3.74, 51.05]} online={false}/>));
    expect(state.status).toContain('internetverbinding');
    await act(async () => root.render(<Probe start={from} online={true}/>));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(state.atStart).toBe(true); expect(state.route).toBeNull(); expect(fetchApproach).not.toHaveBeenCalled();
  });
});

it('stopt de aanrijroute blijvend na het bereiken van de start tijdens navigatie', async () => {
  vi.useFakeTimers(); const from: Position = [3.70, 51.05], start: Position = [3.72, 51.05], later: Position = [3.74, 51.05];
  vi.mocked(fetchApproach).mockResolvedValue({ coordinates: [from, start], meters: 1400 });
  let state!: ReturnType<typeof useApproach>;
  function Probe({ position, riding }: { position: Position; riding: boolean }) { state = useApproach(position, start, true, riding, 0, 10); return null; }
  await act(async () => root.render(<Probe position={from} riding={true}/>));
  await act(async () => vi.advanceTimersByTime(500)); expect(fetchApproach).toHaveBeenCalledTimes(1);
  await act(async () => root.render(<Probe position={start} riding={true}/>)); expect(state.route).toBeNull();
  await act(async () => root.render(<Probe position={later} riding={true}/>));
  await act(async () => vi.advanceTimersByTime(2000)); expect(fetchApproach).toHaveBeenCalledTimes(1); expect(state.route).toBeNull();
  await act(async () => root.render(<Probe position={later} riding={false}/>));
  await act(async () => vi.advanceTimersByTime(500)); expect(fetchApproach).toHaveBeenCalledTimes(2);
});
it('annuleert een lopende aanrijroute zodra GPS-voortgang toont dat de route wordt gevolgd', async () => {
  vi.useFakeTimers(); const from: Position = [3.70, 51.05], start: Position = [3.72, 51.05];
  vi.mocked(fetchApproach).mockImplementation(() => new Promise(() => {}));
  function Probe({ progress }: { progress: number }) { useApproach(from, start, true, true, progress, 10); return null; }
  await act(async () => root.render(<Probe progress={0}/>)); await act(async () => vi.advanceTimersByTime(500));
  const signal = vi.mocked(fetchApproach).mock.calls[0][2];
  await act(async () => root.render(<Probe progress={100}/>)); expect(signal.aborted).toBe(true);
  await act(async () => vi.advanceTimersByTime(40000)); expect(fetchApproach).toHaveBeenCalledTimes(1);
});
