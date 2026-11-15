import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ProviderDetail, ProviderSummary } from '@/api';

const STORAGE_KEY = 'haddak.favourites';

/**
 * What is kept on the phone for one saved provider: just enough to draw the
 * Saved list at once and without a connection. The profile itself is always
 * loaded fresh when it is opened.
 */
export interface Favourite {
  id: string;
  name: string;
  category_name_en: string;
  category_name_ar: string;
  /** Category icon key, drawn when there is no photo. */
  category_icon: string;
  area_name: string;
  photo_url: string | null;
  /** ISO time the provider was saved. */
  saved_at: string;
}

interface FavouritesState {
  /** False until the saved list has been read from the phone. */
  ready: boolean;
  /** Newest first. */
  list: Favourite[];
  isFavourite: (id: string) => boolean;
  /** Saves the provider, or removes it if it was saved. Returns true when it is now saved. */
  toggle: (provider: ProviderSummary | ProviderDetail) => boolean;
  remove: (id: string) => void;
}

const FavouritesContext = createContext<FavouritesState | null>(null);

function snapshot(provider: ProviderSummary | ProviderDetail): Favourite {
  // A profile carries its photos; a search result only its cover photo.
  const firstPhoto = 'photos' in provider ? provider.photos[0] : undefined;
  return {
    id: provider.id,
    name: provider.name,
    category_name_en: provider.category.name_en,
    category_name_ar: provider.category.name_ar,
    category_icon: provider.category.icon,
    area_name: provider.area_name,
    photo_url: firstPhoto ?? provider.cover_photo_url ?? null,
    saved_at: new Date().toISOString(),
  };
}

/** Reads whatever is in storage and keeps only entries that look right. */
function parse(raw: string | null): Favourite[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is Favourite =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Favourite).id === 'string' &&
      typeof (item as Favourite).name === 'string',
  );
}

/**
 * Favourites live only on this phone: no account, no backend.
 * If storage cannot be read or written, they simply stay in memory until the app closes.
 */
export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Favourite[]>([]);
  const [ready, setReady] = useState(false);

  // Read once at start. Anything saved before the read finished is kept on top.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const stored = parse(raw);
        setList((current) => [
          ...current,
          ...stored.filter((item) => !current.some((mine) => mine.id === item.id)),
        ]);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  // Write after every change, but never before the first read (that would wipe the saved list).
  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => undefined);
  }, [list, ready]);

  const toggle = useCallback(
    (provider: ProviderSummary | ProviderDetail) => {
      const saved = list.some((item) => item.id === provider.id);
      setList((current) =>
        saved
          ? current.filter((item) => item.id !== provider.id)
          : [snapshot(provider), ...current.filter((item) => item.id !== provider.id)],
      );
      return !saved;
    },
    [list],
  );

  const remove = useCallback((id: string) => {
    setList((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<FavouritesState>(
    () => ({
      ready,
      list,
      isFavourite: (id) => list.some((item) => item.id === id),
      toggle,
      remove,
    }),
    [ready, list, toggle, remove],
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites(): FavouritesState {
  const value = useContext(FavouritesContext);
  if (!value) throw new Error('useFavourites must be used inside FavouritesProvider');
  return value;
}
