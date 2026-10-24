// Finds the customer's city: the browser asks for permission, then the server turns the
// coordinates into a city name (OpenStreetMap). Only the city is kept – never the coordinates.
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export type CityState =
  | { status: 'idle' | 'asking' }
  | { status: 'found'; city: string }
  | { status: 'denied' | 'failed' | 'unsupported'; message: string };

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60e3 }));
}

/** Asks for the location as soon as the page opens; `retry` asks again (e.g. after the customer allows it). */
export function useDetectedCity(): CityState & { retry: () => void } {
  const [state, setState] = useState<CityState>({ status: 'idle' });

  const detect = useCallback(async () => {
    if (!('geolocation' in navigator)) { setState({ status: 'unsupported', message: "This browser can't share your location." }); return; }
    setState({ status: 'asking' });
    try {
      const pos = await position();
      const r = await api.locate(pos.coords.latitude, pos.coords.longitude);
      setState(r.city ? { status: 'found', city: r.city } : { status: 'failed', message: "We couldn't recognise your city." });
    } catch (e) {
      const geo = e as GeolocationPositionError;
      if (geo && geo.code === 1) setState({ status: 'denied', message: 'Location is blocked. Allow it in your browser to detect your city.' });
      else setState({ status: 'failed', message: "We couldn't detect your city right now." });
    }
  }, []);

  useEffect(() => { detect(); }, [detect]);
  return { ...state, retry: detect };
}
