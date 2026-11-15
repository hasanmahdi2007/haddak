import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, opacity, radius, size, space, useTheme } from '@/theme';

import { CategoryIcon } from './CategoryIcon';
import { Txt } from './Txt';

interface Props {
  icon: string;
  label: string;
  selected: boolean;
  /** Opens a second level instead of selecting. */
  hasChildren?: boolean;
  /** Shown under the label when a child of this category is selected. */
  selectedChild?: string;
  onPress: () => void;
}

/**
 * A category in the grid: a white tile with the icon in a solid teal square
 * and the label beside it. Chosen: the tile fills teal, the square turns
 * white and a coral tick appears at the end.
 */
export function CategoryTile({ icon, label, selected, hasChildren, selectedChild, onPress }: Props) {
  const { colors } = useTheme();
  const { s, f, row } = useI18n();
  const styles = useStyles();
  const labelColor = selected ? 'onPrimary' : 'text';

  return (
    // The outer cell takes an equal share of the row; the tile fills it.
    <View style={styles.cell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasChildren ? f(s.home.hasMore, { name: label }) : label}
        accessibilityState={{ selected }}
        onPress={onPress}
        android_ripple={{ color: colors.surfaceTintStrong }}
        style={({ pressed }) => [
          styles.tile,
          { flexDirection: row },
          selected ? styles.tileSelected : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={[styles.iconBox, selected ? styles.iconBoxSelected : null]}>
          <CategoryIcon
            icon={icon}
            color={selected ? colors.primary : colors.onPrimary}
            size={size.iconLarge}
          />
        </View>
        <View style={styles.texts}>
          {/* A long single word (Dermatologist) shrinks a little instead of breaking in the middle. */}
          <Txt role="label" color={labelColor} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
            {label}
          </Txt>
          {selectedChild ? (
            <Txt role="caption" color={labelColor} numberOfLines={1}>
              {selectedChild}
            </Txt>
          ) : null}
        </View>
        {selected ? (
          <View style={styles.check}>
            <Check color={colors.onAccent} size={size.star} strokeWidth={size.strokeBold} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  cell: {
    flex: 1,
    minWidth: 0,
  },
  tile: {
    flexGrow: 1,
    minHeight: size.tile,
    borderRadius: radius.lg,
    borderWidth: size.lineMid,
    borderColor: c.surfaceTintStrong,
    backgroundColor: c.surface,
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.md,
    overflow: 'hidden',
  },
  tileSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  iconBox: {
    width: size.tileIconBox,
    height: size.tileIconBox,
    borderRadius: radius.md,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: {
    backgroundColor: c.surface,
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  // The tick on a chosen tile: a small coral disc.
  check: {
    width: size.sealSmall,
    height: size.sealSmall,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
