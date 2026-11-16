import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, opacity, radius, size, space, useTheme, type ColorTokens } from '@/theme';

import { Txt } from './Txt';

export type ButtonVariant = 'primary' | 'whatsapp' | 'tonal' | 'outline';

type ColorName = keyof ColorTokens;

const VARIANTS: Record<
  ButtonVariant,
  { bg: ColorName | null; pressed: ColorName; fg: ColorName; border: ColorName | null }
> = {
  primary: { bg: 'primary', pressed: 'primaryPressed', fg: 'onPrimary', border: null },
  whatsapp: { bg: 'whatsapp', pressed: 'whatsappPressed', fg: 'onWhatsapp', border: null },
  tonal: { bg: 'surfaceTint', pressed: 'surfaceTintStrong', fg: 'onPrimarySoft', border: null },
  outline: { bg: null, pressed: 'surfaceTint', fg: 'primary', border: 'outline' },
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  /** A custom glyph (the WhatsApp mark) in place of a line icon. */
  glyph?: (color: string) => ReactNode;
  accessibilityLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Tighter padding, for a row of three buttons. */
  compact?: boolean;
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
  loading = false,
  disabled = false,
  compact = false,
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
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={{ color: colors[v.pressed] }}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : null,
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
          {Icon ? <Icon color={fg} size={size.icon} strokeWidth={size.stroke} /> : null}
          <Txt role="action" color={v.fg} numberOfLines={1} style={styles.label}>
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
