import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nManager } from 'react-native';

import type { Category, CategoryRef } from '@/api';

import { ar } from './ar';
import { en, type Strings } from './en';

export type Language = 'en' | 'ar';

const STORAGE_KEY = 'haddak.language';
const STRINGS: Record<Language, Strings> = { en, ar };

/**
 * Layout direction is handled by the app, not by the operating system, so the
 * language switch flips the layout at once (no restart) and works the same on
 * Android, iOS and web. We ask React Native not to mirror on its own; that only
 * takes effect after a restart, so `nativeRTL` covers the session in between.
 */
I18nManager.allowRTL(false);
// On web isRTL is not defined, hence the strict comparison.
const nativeRTL = I18nManager.isRTL === true;

type PluralForms = Record<'zero' | 'one' | 'two' | 'few' | 'many' | 'other', string>;

function pluralForm(language: Language, n: number): keyof PluralForms {
  if (n === 0) return 'zero';
  if (n === 1) return 'one';
  if (language === 'en') return 'other';
  if (n === 2) return 'two';
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return 'few';
  if (mod >= 11) return 'many';
  return 'other';
}

function fill(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  /** All strings for the current language. */
  s: Strings;
  /** Fill `{placeholders}` in a string. */
  f: (template: string, values?: Record<string, string | number>) => string;
  /** Pick the plural form for `n`, then fill placeholders (`{n}` is set for you). */
  plural: (forms: PluralForms, n: number, values?: Record<string, string | number>) => string;
  /** A category's name in the current language. */
  categoryName: (category: Category | CategoryRef) => string;
  /** "184 m" or "2.3 km". */
  distance: (metres: number) => string;
  rtl: boolean;
  /** flexDirection for a row that follows the reading direction. */
  row: 'row' | 'row-reverse';
  /** textAlign for the start edge. */
  textAlign: 'left' | 'right';
  writingDirection: 'ltr' | 'rtl';
  /** alignItems / alignSelf value for the start edge of a column. */
  alignStart: 'flex-start' | 'flex-end';
  /** Absolute-position helper: `{ left: n }` in LTR, `{ right: n }` in RTL. */
  start: (n: number) => { left: number } | { right: number };
  end: (n: number) => { left: number } | { right: number };
}

const I18nContext = createContext<I18n | null>(null);

function deviceLanguage(): Language {
  try {
    return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(deviceLanguage);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'en' || stored === 'ar') setLanguageState(stored);
      })
      .catch(() => undefined);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<I18n>(() => {
    const rtl = language === 'ar';
    // If the system is already mirroring, our own flip must not mirror twice.
    const flip = rtl !== nativeRTL;
    const s = STRINGS[language];
    const f = fill;
    return {
      language,
      setLanguage,
      s,
      f,
      plural: (forms, n, values) => f(forms[pluralForm(language, n)], { n, ...values }),
      categoryName: (category) => (rtl ? category.name_ar : category.name_en),
      distance: (metres) =>
        metres < 1000
          ? f(s.units.m, { n: Math.round(metres) })
          : f(s.units.km, { n: (metres / 1000).toFixed(metres < 10_000 ? 1 : 0) }),
      rtl,
      row: flip ? 'row-reverse' : 'row',
      textAlign: flip ? 'right' : 'left',
      writingDirection: rtl ? 'rtl' : 'ltr',
      alignStart: flip ? 'flex-end' : 'flex-start',
      start: (n) => (flip ? { right: n } : { left: n }),
      end: (n) => (flip ? { left: n } : { right: n }),
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
