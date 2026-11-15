import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { variants, type ColorTokens, type Look, type VariantId } from './tokens';

export * from './tokens';

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  /** Shapes and layout choices of the design option in use. */
  look: Look;
}

/**
 * Which design option to show. Set EXPO_PUBLIC_DESIGN_VARIANT=a|b|c before
 * starting Expo (default a). On web, ?variant=b in the address also works,
 * which is how the preview screenshots are taken from one server.
 */
function pickVariant(): VariantId {
  const fromUrl =
    typeof window !== 'undefined' && window.location
      ? new URLSearchParams(window.location.search).get('variant')
      : null;
  const wanted = (fromUrl ?? process.env.EXPO_PUBLIC_DESIGN_VARIANT ?? 'a').toLowerCase();
  return wanted === 'b' || wanted === 'c' ? wanted : 'a';
}

const VARIANT = variants[pickVariant()];

// The options are light only for now. The dark theme (darkColors in tokens.ts)
// comes back once one option is chosen and gets its own dark palette.
const THEME: Theme = { dark: false, colors: VARIANT.colors, look: VARIANT.look };

/** Current theme. */
export function useTheme(): Theme {
  return THEME;
}

type NamedStyles<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Build a stylesheet from colour tokens. Usage:
 *   const useStyles = makeStyles((c) => ({ box: { backgroundColor: c.sheet } }));
 *   const styles = useStyles();
 * The second argument gives the shapes of the design option in use.
 */
export function makeStyles<T extends NamedStyles<T>>(build: (colors: ColorTokens, look: Look) => T) {
  let styles: T | null = null;
  return function useStyles(): T {
    const { colors, look } = useTheme();
    return useMemo(() => {
      if (!styles) styles = StyleSheet.create(build(colors, look));
      return styles;
    }, [colors, look]);
  };
}
