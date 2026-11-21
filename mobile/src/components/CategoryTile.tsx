import { ArrowUpLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { elevation, makeStyles, press, radius, size, space, useTheme, type ColorTokens } from '@/theme';

import { CategoryIcon } from './CategoryIcon';
import { Txt } from './Txt';

/** The colour of a tile's icon well: alice blue or vanilla. The tile itself is always white. */
export type TileTone = 'alice' | 'vanilla';

// Every tile is white (the founder asked for one calm colour, 2026-11-16); only the icon
// well is coloured, and the icon on it is always black (12:1 or more on both pastels).
const TONES: Record<TileTone, keyof ColorTokens> = {
  alice: 'accent',
  vanilla: 'signature',
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
 * A category in the grid: a white card. The icon sits at the top, the
 * name at the bottom, and a small arrow in the corner says what a tap does:
 * a chevron opens more choices, a diagonal arrow goes straight to the results.
 */
export function CategoryTile({ icon, label, tone, grow = 1, hasChildren, onPress }: Props) {
  const { colors } = useTheme();
  const { s, f, row, rtl } = useI18n();
  const styles = useStyles();
  const well = TONES[tone];
  const Arrow = hasChildren ? (rtl ? ChevronLeft : ChevronRight) : rtl ? ArrowUpLeft : ArrowUpRight;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasChildren ? f(s.home.hasMore, { name: label }) : label}
      onPress={onPress}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={({ pressed }) => [
        styles.tile,
        { flex: grow },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.top, { flexDirection: row }]}>
        {/* The icon sits in an alice-blue or vanilla well, the one touch of colour on a white tile. */}
        <View style={[styles.iconWell, { backgroundColor: colors[well] }]}>
          <CategoryIcon icon={icon} color={colors.text} size={size.iconLarge} />
        </View>
        {/* The round black "open" button of the founder's reference, small. */}
        <View style={styles.go}>
          <Arrow color={colors.onPrimary} size={size.iconSmall} strokeWidth={size.lineBold} />
        </View>
      </View>
      {/* A long single word (Dermatologist) shrinks a little instead of breaking in the middle. */}
      <Txt role="action" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </Txt>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  tile: {
    minWidth: 0,
    backgroundColor: c.surface,
    minHeight: size.tile,
    borderRadius: radius.lg,
    padding: space.md + space.xs,
    gap: space.md,
    justifyContent: 'space-between',
    // Clips the ripple to the rounded corners; the shadow is drawn outside and is not cut.
    overflow: 'hidden',
    boxShadow: elevation.card,
  },
  go: {
    width: size.arrowDisc,
    height: size.arrowDisc,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: c.surfaceInset,
    transform: [{ scale: press.scale }],
  },
  iconWell: {
    width: size.tileIconBox,
    height: size.tileIconBox,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
}));
