import { useMemo } from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { darkColors, lightColors, type ColorTokens } from './tokens';

export * from './tokens';

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
}

const LIGHT: Theme = { dark: false, colors: lightColors };
const DARK: Theme = { dark: true, colors: darkColors };

/** Current theme; follows the system light or dark setting. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

type NamedStyles<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Build a stylesheet from colour tokens. Usage:
 *   const useStyles = makeStyles((c) => ({ box: { backgroundColor: c.sheet } }));
 *   const styles = useStyles();
 */
export function makeStyles<T extends NamedStyles<T>>(build: (colors: ColorTokens) => T) {
  const cache = new Map<boolean, T>();
  return function useStyles(): T {
    const { dark, colors } = useTheme();
    return useMemo(() => {
      let styles = cache.get(dark);
      if (!styles) {
        styles = StyleSheet.create(build(colors));
        cache.set(dark, styles);
      }
      return styles;
    }, [dark, colors]);
  };
}
