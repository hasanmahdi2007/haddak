import AsyncStorage from '@react-native-async-storage/async-storage';
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

import type { Coordinates } from '@/api';

import { withTimeout } from './timeout';

/** Haret Hreik: the seed area and the fallback when location is unavailable. */
export const HARET_HREIK = { lat: 33.8547, lng: 35.5097 } as const;

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
  /**
   * True while the short "why we ask" card should show, before the phone's own
   * permission dialog (only the first time, and only when the phone can still ask).
   */
  intro: boolean;
  /** From the card: "Allow". Shows the phone's dialog. */
  allow: () => void;
  /** From the card: "Not now". Searches around Haret Hreik; "Use my location" asks later. */
  skip: () => void;
}

const LocationContext = createContext<LocationState | null>(null);

const POSITION_TIMEOUT_MS = 8000;
/** Set once the user answered the card, so it is not shown again on every launch. */
const INTRO_KEY = 'haddak.location-intro-done';

async function introDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(INTRO_KEY)) === '1';
  } catch {
    return false;
  }
}

function rememberIntro() {
  AsyncStorage.setItem(INTRO_KEY, '1').catch(() => undefined);
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>('locating');
  const [coords, setCoords] = useState<Coordinates>(HARET_HREIK);
  const [intro, setIntro] = useState(false);

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
        (await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          POSITION_TIMEOUT_MS,
        ));
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setStatus('located');
    } catch {
      // Location services off, timeout, or no provider: fall back quietly.
      setCoords(HARET_HREIK);
      setStatus('fallback');
    }
  }, []);

  // At launch: already allowed, find the position. Never asked yet: show the card
  // first (the phone's dialog alone, before anything is on screen, is easy to refuse).
  // The card was answered "Not now" before: search around Haret Hreik without asking.
  const start = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.granted) return locate(false);
      if (permission.canAskAgain && !(await introDone())) {
        setIntro(true);
        return;
      }
      setStatus('fallback');
    } catch {
      setStatus('fallback');
    }
  }, [locate]);

  useEffect(() => {
    // State is only set after the awaited checks settle, not during the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
  }, [start]);

  const value = useMemo<LocationState>(
    () => ({
      status,
      coords,
      retry: () => {
        setStatus('locating');
        void locate(true);
      },
      intro,
      allow: () => {
        setIntro(false);
        rememberIntro();
        void locate(false);
      },
      skip: () => {
        setIntro(false);
        rememberIntro();
        setStatus('fallback');
      },
    }),
    [status, coords, locate, intro],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationState {
  const value = useContext(LocationContext);
  if (!value) throw new Error('useLocation must be used inside LocationProvider');
  return value;
}
