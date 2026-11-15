import type { LucideIcon } from 'lucide-react-native';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, radius, size, useTheme } from '@/theme';

interface IconButtonProps {
  icon: LucideIcon;
  /** Read by screen readers; icon-only buttons always need one. */
  label: string;
  onPress: () => void;
  /** `scrim` is for buttons that sit on a photo. */
  tone?: 'plain' | 'scrim';
  style?: StyleProp<ViewStyle>;
  /** For an on/off button (the heart): told to screen readers as selected or not. */
  selected?: boolean;
  /** Icon colour, when it is not the tone's own. */
  color?: string;
  /** Fills the icon's shape (a saved heart). */
  fill?: string;
}

/** A 48 dp round icon button. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  tone = 'plain',
  style,
  selected,
  color: iconColor,
  fill,
}: IconButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const color = iconColor ?? (tone === 'scrim' ? colors.onScrim : colors.text);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      android_ripple={{ color: colors.surfaceTintStrong, borderless: true }}
      style={({ pressed }) => [
        styles.base,
        tone === 'scrim' ? styles.scrim : null,
        pressed && tone === 'plain' ? styles.pressed : null,
        style,
      ]}
    >
      <Icon color={color} fill={fill ?? 'none'} size={size.iconLarge} strokeWidth={size.stroke} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  base: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    backgroundColor: c.scrim,
  },
  pressed: {
    backgroundColor: c.surfaceTint,
  },
}));
