import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Linking, Platform } from 'react-native';

import { HARET_HREIK, type Coordinates } from '@/api';

/**
 * - locating: waiting for permission or a position
 * - located: using the device position
 * - fallback: permission denied or no position; searching around Haret Hreik
 */
export type LocationStatus = 'locating' | 'located' | 'fallback';

interface LocationState {
  status: LocationStatus;
  /** Always usable: the device position, or Haret Hreik. */
  coords: Coordinates;
  /** Ask again; opens system settings when the permission dialog can no longer be shown. */
  retry: () => void;
}

const LocationContext = createContext<LocationState | null>(null);

const POSITION_TIMEOUT_MS = 8000;

function timeout<T>(ms: number): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>('locating');
  const [coords, setCoords] = useState<Coordinates>(HARET_HREIK);

  const locate = useCallback(async (openSettingsIfBlocked: boolean) => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) {
        if (openSettingsIfBlocked && !permission.canAskAgain && Platform.OS !== 'web') {
          Linking.openSettings().catch(() => undefined);
        }
        setStatus('fallback');
        return;
      }

      // A recent known position answers at once; otherwise wait for a fresh one.
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
        (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          timeout<Location.LocationObject>(POSITION_TIMEOUT_MS),
        ]));
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setStatus('located');
    } catch {
      // Location services off, timeout, or no provider: fall back quietly.
      setCoords(HARET_HREIK);
      setStatus('fallback');
    }
  }, []);

  useEffect(() => {
    // State is only set after the awaited request settles, not during the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void locate(false);
  }, [locate]);

  const value = useMemo<LocationState>(
    () => ({
      status,
      coords,
      retry: () => {
        setStatus('locating');
        void locate(true);
      },
    }),
    [status, coords, locate],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationState {
  const value = useContext(LocationContext);
  if (!value) throw new Error('useLocation must be used inside LocationProvider');
  return value;
}
