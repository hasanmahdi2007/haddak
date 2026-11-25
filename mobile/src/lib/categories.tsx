import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, type ApiError, type Category } from '@/api';

import { normalizeText } from './normalize';
import { useAsync } from './useAsync';

export interface CategoryNode extends Category {
  children: Category[];
}

interface CategoriesState {
  status: 'loading' | 'ready' | 'error';
  error: ApiError | null;
  /** Top-level categories, each with its children, in sort order. */
  tree: CategoryNode[];
  byId: Map<number, Category>;
  reload: () => void;
}

const CategoriesContext = createContext<CategoriesState | null>(null);

/** The API returns a flat list; the app builds the tree from parent_id. */
export function buildTree(categories: Category[]): CategoryNode[] {
  const bySort = (a: Category, b: Category) => a.sort_order - b.sort_order || a.id - b.id;
  return categories
    .filter((category) => category.parent_id === null)
    .sort(bySort)
    .map((parent) => ({
      ...parent,
      children: categories.filter((child) => child.parent_id === parent.id).sort(bySort),
    }));
}

/**
 * The everyday groups Home shows (founder's UX rules, 2026-11-24: Home shows a few
 * groups, "All categories" shows everything). Slugs from docs/SCHEMA.md, in this order.
 */
export const HOME_GROUP_SLUGS = [
  'food-drink',
  'home-repair',
  'groceries',
  'doctors',
  'power',
  'car-services',
  'beauty',
  'fashion',
] as const;

/** How many groups Home shows. */
export const HOME_GROUP_COUNT = HOME_GROUP_SLUGS.length;

/**
 * Home's short list. Groups named above come first, in that order; if some slug is
 * missing (an older backend, mock data), the next groups in sort order fill the gap,
 * so Home always shows a full grid.
 */
export function homeGroups(tree: CategoryNode[]): CategoryNode[] {
  const bySlug = new Map(tree.map((node) => [node.slug, node]));
  const picked = HOME_GROUP_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (node): node is CategoryNode => node !== undefined,
  );
  const rest = tree.filter((node) => !picked.includes(node));
  return [...picked, ...rest].slice(0, HOME_GROUP_COUNT);
}

/**
 * Every word a category can be found by, already normalized: its English and
 * Arabic names and its aliases. Built once per category list, not per keystroke.
 */
export function searchWords(category: Category): string[] {
  return [category.name_en, category.name_ar, ...(category.aliases ?? [])].map(normalizeText);
}

/** Where the last list from the server is kept on the phone. */
const CACHE_KEY = 'haddak.categories.v1';

async function readCache(): Promise<Category[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(list) && list.length > 0 ? (list as Category[]) : null;
  } catch {
    return null;
  }
}

/**
 * Loads the categories once for the whole app. The last list is also kept on the
 * phone: Home shows it at once while the fresh one loads (the server may be
 * waking up), and keeps showing it when the phone is offline.
 */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { status, data, error, reload } = useAsync(() => api.getCategories(), []);
  const [cached, setCached] = useState<Category[] | null>(null);

  useEffect(() => {
    let live = true;
    void readCache().then((list) => {
      if (live && list) setCached(list);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (data) AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => undefined);
  }, [data]);

  const value = useMemo<CategoriesState>(() => {
    // The fresh list when we have it, else the saved one.
    const list = data ?? cached ?? [];
    return {
      status: list.length > 0 ? 'ready' : status,
      error: list.length > 0 ? null : error,
      tree: buildTree(list),
      byId: new Map(list.map((category) => [category.id, category])),
      reload,
    };
  }, [status, data, cached, error, reload]);

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesState {
  const value = useContext(CategoriesContext);
  if (!value) throw new Error('useCategories must be used inside CategoriesProvider');
  return value;
}
