import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { api, type ApiError, type Category } from '@/api';

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

/** Loads the categories once for the whole app. */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { status, data, error, reload } = useAsync(() => api.getCategories(), []);

  const value = useMemo<CategoriesState>(() => {
    const list = data ?? [];
    return {
      status,
      error,
      tree: buildTree(list),
      byId: new Map(list.map((category) => [category.id, category])),
      reload,
    };
  }, [status, data, error, reload]);

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesState {
  const value = useContext(CategoriesContext);
  if (!value) throw new Error('useCategories must be used inside CategoriesProvider');
  return value;
}
