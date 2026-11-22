import { useEffect, useRef, useState } from 'react';
import type { Position } from './domain/network';

export function useDeviceLocation(onCenter: (position: Position) => void) {
  const [location, setLocation] = useState<Position | null>(null), [accuracy, setAccuracy] = useState(0), [lastFix, setLastFix] = useState(0);
  const [status, setStatus] = useState('Je locatie bepalen…'), [retry, setRetry] = useState(0);
  const center = useRef(onCenter); center.current = onCenter;
  useEffect(() => {
    if (!navigator.geolocation) { setStatus('Locatie wordt niet ondersteund door deze browser.'); return; }
    let active = true, centered = false;
    setStatus('Je locatie bepalen…');
    const watch = navigator.geolocation.watchPosition(p => {
      if (!active) return;
      const position: Position = [p.coords.longitude, p.coords.latitude];
      setLocation(position); setAccuracy(p.coords.accuracy); setLastFix(p.timestamp); setStatus('');
      if (!centered) { centered = true; center.current(position); }
    }, error => {
      if (!active) return;
      setStatus(error.code === 1 ? 'Locatietoegang geweigerd. Geef toestemming via je browser.' : error.code === 3 ? 'Je locatie bepalen duurt te lang. Probeer opnieuw.' : 'Je locatie is momenteel niet beschikbaar.');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    return () => { active = false; navigator.geolocation.clearWatch(watch); };
  }, [retry]);
  function locate() {
    if (location) center.current(location);
    setRetry(value => value + 1);
  }
  return { location, accuracy, lastFix, status, locate };
}
