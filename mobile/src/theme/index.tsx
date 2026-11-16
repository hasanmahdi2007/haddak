import { useMemo } from 'react';
import {
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { lightColors, type ColorTokens } from './tokens';

export * from './tokens';

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
}

// Two fixed objects, so anything that depends on the theme only changes when the theme does.
const LIGHT: Theme = { dark: false, colors: lightColors };

/**
 * Current theme. The founder asked for a light-only app (2026-11-16), so the dark
 * palette is kept in tokens.ts but not used. To follow the phone again, use
 * useColorScheme() and return a dark Theme built from darkColors.
 */
export function useTheme(): Theme {
  return LIGHT;
}

type NamedStyles<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Build a stylesheet from colour tokens. Usage:
 *   const useStyles = makeStyles((c) => ({ box: { backgroundColor: c.surface } }));
 *   const styles = useStyles();
 * The stylesheet is built once per theme (light, dark) and reused.
 */
export function makeStyles<T extends NamedStyles<T>>(build: (colors: ColorTokens) => T) {
  const cache = new Map<ColorTokens, T>();
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => {
      let styles = cache.get(colors);
      if (!styles) {
        styles = StyleSheet.create(build(colors));
        cache.set(colors, styles);
      }
      return styles;
    }, [colors]);
  };
}
