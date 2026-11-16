import { ArrowUpLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, opacity, radius, size, space, useTheme, type ColorTokens } from '@/theme';

import { CategoryIcon } from './CategoryIcon';
import { Txt } from './Txt';

/** The colour of a tile. Text on lavender and mint is always dark, in both themes. */
export type TileTone = 'accent' | 'mint' | 'plain';

const TONES: Record<TileTone, { bg: keyof ColorTokens; fg: 'onAccent' | 'onMint' | 'text' }> = {
  // The founder asked for every category tile in one calm colour (2026-11-16):
  // white tiles, with lavender only on the icon. The tone names are kept so callers need no change.
  accent: { bg: 'surface', fg: 'text' },
  mint: { bg: 'surface', fg: 'text' },
  plain: { bg: 'surface', fg: 'text' },
};

interface Props {
  icon: string;
  label: string;
  tone: TileTone;
  /** Share of the row this tile takes; the grid mixes wide and narrow tiles. */
  grow?: number;
  /** Opens a second level instead of searching. */
  hasChildren?: boolean;
  onPress: () => void;
}

/**
 * A category in the grid: one solid colour block. The icon sits at the top, the
 * name at the bottom, and a small arrow in the corner says what a tap does:
 * a chevron opens more choices, a diagonal arrow goes straight to the results.
 */
export function CategoryTile({ icon, label, tone, grow = 1, hasChildren, onPress }: Props) {
  const { colors } = useTheme();
  const { s, f, row, rtl } = useI18n();
  const styles = useStyles();
  const { bg, fg } = TONES[tone];
  const Arrow = hasChildren ? (rtl ? ChevronLeft : ChevronRight) : rtl ? ArrowUpLeft : ArrowUpRight;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasChildren ? f(s.home.hasMore, { name: label }) : label}
      onPress={onPress}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={({ pressed }) => [
        styles.tile,
        { flex: grow, backgroundColor: colors[bg] },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.top, { flexDirection: row }]}>
        <CategoryIcon icon={icon} color={colors.primary} size={size.tileIcon} />
        <Arrow color={colors.textSubtle} size={size.icon} strokeWidth={size.stroke} />
      </View>
      {/* A long single word (Dermatologist) shrinks a little instead of breaking in the middle. */}
      <Txt role="action" color={fg} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </Txt>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  tile: {
    minWidth: 0,
    minHeight: size.tile,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  pressed: {
    opacity: opacity.pressed,
  },
  top: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
}));
