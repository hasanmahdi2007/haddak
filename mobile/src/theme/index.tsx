import { useMemo } from 'react';
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { darkColors, lightColors, type ColorTokens } from './tokens';

export * from './tokens';

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
}

// Two fixed objects, so anything that depends on the theme only changes when the theme does.
const LIGHT: Theme = { dark: false, colors: lightColors };
const DARK: Theme = { dark: true, colors: darkColors };

/** Current theme. It follows the phone's light / dark setting. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
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
