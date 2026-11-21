import { Text, type TextProps, type TextStyle } from 'react-native';

import { useI18n } from '@/i18n';
import { type ColorTokens, type TypeRole, type as typeLatin, typeArabic, useTheme } from '@/theme';

type ColorName = {
  [K in keyof ColorTokens]: ColorTokens[K] extends string ? K : never;
}[keyof ColorTokens];

export interface TxtProps extends Omit<TextProps, 'role'> {
  /** Type role from the design system. */
  role?: TypeRole;
  /** Colour token name. */
  color?: ColorName;
  /** Centre the text instead of aligning it to the reading edge. */
  center?: boolean;
  /**
   * Text that is always left-to-right whatever the language (phone numbers).
   * It still aligns to the reading edge.
   */
  ltr?: boolean;
  /**
   * Text written by a provider or reviewer (names, prices, descriptions, comments).
   * It may be in either language whatever the app language, so its direction
   * comes from the text itself. With 'block' a paragraph also aligns to its own side.
   */
  content?: boolean | 'block';
}

/** Any letter in the Arabic Unicode block. */
const ARABIC = /[؀-ۿ]/;

function textOf(children: unknown): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(textOf).join('');
  return '';
}

/**
 * The type scale for the app language: Urbanist roles in English, Beiruti and
 * Readex Pro in Arabic (Urbanist has no Arabic letters). Text fields use it too.
 */
export function useTypeScale() {
  return useI18n().rtl ? typeArabic : typeLatin;
}

/** The only text component: applies a type role, a colour token and the reading direction. */
export function Txt({
  role = 'body',
  color = 'text',
  center,
  ltr,
  content,
  style,
  ...rest
}: TxtProps) {
  const { colors } = useTheme();
  const i18n = useI18n();
  const contentRtl = content ? ARABIC.test(textOf(rest.children)) : i18n.rtl;
  const direction = ltr ? 'ltr' : content ? (contentRtl ? 'rtl' : 'ltr') : i18n.writingDirection;
  // A paragraph of content sits on its own reading side; everything else follows the app.
  const textAlign =
    content === 'block' && contentRtl !== i18n.rtl
      ? i18n.textAlign === 'left'
        ? 'right'
        : 'left'
      : i18n.textAlign;
  // Arabic words get the Arabic fonts, even in the English app (a provider's Arabic
  // name, the "عربي" language pill): Urbanist has no Arabic letters.
  const arabicText = content ? contentRtl : ARABIC.test(textOf(rest.children));
  const scale = i18n.rtl || arabicText ? typeArabic : typeLatin;
  const base: TextStyle = {
    ...scale[role],
    color: colors[color],
    textAlign: center ? 'center' : textAlign,
    writingDirection: direction,
  };
  return <Text {...rest} style={[base, style]} />;
}
