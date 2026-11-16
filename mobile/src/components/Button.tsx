import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, opacity, radius, size, space, useTheme, type ColorTokens } from '@/theme';

import { Txt } from './Txt';

export type ButtonVariant = 'primary' | 'whatsapp' | 'tonal' | 'outline' | 'danger' | 'white';

type ColorName = keyof ColorTokens;

const VARIANTS: Record<
  ButtonVariant,
  { bg: ColorName | null; pressed: ColorName; fg: ColorName; border: ColorName | null }
> = {
  primary: { bg: 'primary', pressed: 'primaryPressed', fg: 'onPrimary', border: null },
  whatsapp: { bg: 'whatsapp', pressed: 'whatsappPressed', fg: 'onWhatsapp', border: null },
  tonal: { bg: 'surfaceTint', pressed: 'surfaceTintStrong', fg: 'onPrimarySoft', border: null },
  outline: { bg: null, pressed: 'surfaceTint', fg: 'primary', border: 'outline' },
  // Emergency numbers only.
  danger: { bg: 'danger', pressed: 'dangerPressed', fg: 'onDanger', border: null },
  // A quiet action on a grey or lavender block.
  white: { bg: 'surface', pressed: 'surfaceTintStrong', fg: 'onPrimarySoft', border: null },
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  /** A custom glyph (the WhatsApp mark) in place of a line icon. */
  glyph?: (color: string) => ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Tighter padding, for a row of three buttons. */
  compact?: boolean;
  /** 56 dp and bigger words: the assistant's main actions. Long labels wrap instead of being cut. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The one button shape in the app: a pill. Variants change colour only. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  glyph,
  accessibilityLabel,
  accessibilityHint,
  loading = false,
  disabled = false,
  compact = false,
  large = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const { row } = useI18n();
  const styles = useStyles();
  const v = VARIANTS[variant];
  const fg = colors[v.fg];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={{ color: colors[v.pressed] }}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : null,
        large ? styles.large : null,
        { flexDirection: row },
        v.bg ? { backgroundColor: colors[pressed ? v.pressed : v.bg] } : null,
        !v.bg && pressed ? { backgroundColor: colors[v.pressed] } : null,
        v.border ? { borderWidth: size.lineMid, borderColor: colors[v.border] } : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {glyph ? <View>{glyph(fg)}</View> : null}
          {Icon ? (
            <Icon color={fg} size={large ? size.iconLarge : size.icon} strokeWidth={large ? size.lineBold : size.stroke} />
          ) : null}
          <Txt
            role={large ? 'actionLarge' : 'action'}
            color={v.fg}
            numberOfLines={large ? 2 : 1}
            center={large}
            style={styles.label}
          >
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  base: {
    minHeight: size.button,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    overflow: 'hidden',
  },
  large: {
    minHeight: size.buttonLarge,
    paddingVertical: space.md,
  },
  compact: {
    paddingHorizontal: space.sm + space.xxs,
    gap: space.xs + space.xxs,
  },
  label: {
    flexShrink: 1,
  },
  disabled: {
    opacity: opacity.disabled,
  },
}));
