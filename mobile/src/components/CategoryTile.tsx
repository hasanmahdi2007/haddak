import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, opacity, radius, size, space, useTheme, type TileTone } from '@/theme';

import { CategoryIcon } from './CategoryIcon';
import { Txt } from './Txt';

interface Props {
  icon: string;
  label: string;
  selected: boolean;
  /** Colours of this tile; the grid hands them out in turn. */
  tone: TileTone;
  /** Opens a second level instead of selecting. */
  hasChildren?: boolean;
  /** Shown under the label when a child of this category is selected. */
  selectedChild?: string;
  onPress: () => void;
}

/**
 * A category in the grid. The design option decides the layout:
 * bubble (icon in a circle over the label), row (icon beside the label)
 * or poster (icon at the top, label at the bottom of a coloured tile).
 */
export function CategoryTile({ icon, label, selected, tone, hasChildren, selectedChild, onPress }: Props) {
  const { colors, look } = useTheme();
  const { s, f, row, end, alignStart } = useI18n();
  const styles = useStyles();

  // A chosen tile is either filled with the primary colour or keeps its own colour inside a ring.
  const filled = selected && look.selectedTile === 'fill';
  const ringed = selected && look.selectedTile === 'ring';
  const bg = filled ? colors.ink : tone.bg;
  const labelColor = filled ? colors.onInk : tone.label;
  const bubbleColor = filled ? colors.sheet : tone.bubble;
  // (A chosen, filled tile turns its icon shape white and its icon the primary colour.)
  const iconColor = filled ? colors.ink : tone.icon;
  const isRow = look.tile === 'row';
  const isPoster = look.tile === 'poster';

  const iconNode = (
    <View style={[isPoster ? null : styles.bubble, isRow ? styles.bubbleRow : null, { backgroundColor: bubbleColor }]}>
      <CategoryIcon icon={icon} color={iconColor} size={isPoster ? size.tileIcon : size.iconLarge} />
    </View>
  );

  const texts = (
    <View style={isRow ? styles.textsRow : isPoster ? styles.textsPoster : styles.textsBubble}>
      {/* A long single word (Dermatologist) shrinks a little instead of breaking in the middle. */}
      <Txt
        role="label"
        center={!isRow && !isPoster}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{ color: labelColor }}
      >
        {label}
      </Txt>
      {selectedChild ? (
        <Txt role="caption" center={!isRow && !isPoster} numberOfLines={1} style={{ color: labelColor }}>
          {selectedChild}
        </Txt>
      ) : null}
    </View>
  );

  const check = selected ? (
    <View
      style={[
        styles.check,
        // On the many-coloured tiles the tick is dark, so it shows on every colour.
        ringed ? { backgroundColor: colors.ink } : null,
        isRow ? null : [styles.checkCorner, end(space.sm)],
      ]}
    >
      <Check color={ringed ? colors.onInk : colors.onAccent} size={size.star} strokeWidth={size.strokeBold} />
    </View>
  ) : null;

  return (
    // The outer cell takes an equal share of the row; the tile fills it.
    <View style={styles.cell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasChildren ? f(s.home.hasMore, { name: label }) : label}
        accessibilityState={{ selected }}
        onPress={onPress}
        android_ripple={{ color: colors.manilaDeep }}
        style={({ pressed }) => [
          styles.tile,
          isRow ? [styles.tileRow, { flexDirection: row }] : null,
          isPoster ? [styles.tilePoster, { alignItems: alignStart }] : null,
          { backgroundColor: bg, borderColor: selected ? colors.ink : isRow ? colors.manilaDeep : tone.bg },
          pressed ? styles.pressed : null,
        ]}
      >
        {iconNode}
        {texts}
        {check}
        {/* The ring is drawn inside the tile's edge so it takes no room from the label. */}
        {ringed ? <View pointerEvents="none" style={styles.ring} /> : null}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c, look) => ({
  cell: {
    flex: 1,
    minWidth: 0,
  },
  tile: {
    flexGrow: 1,
    minHeight: size.tile,
    borderRadius: look.tileRadius,
    borderWidth: size.lineMid,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    gap: space.xs,
    overflow: 'hidden',
  },
  tileRow: {
    minHeight: size.tileRow,
    justifyContent: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.md,
  },
  tilePoster: {
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  ring: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: look.tileRadius - size.lineMid,
    borderWidth: size.lineBold,
    borderColor: c.ink,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  bubble: {
    width: size.tileBubble,
    height: size.tileBubble,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleRow: {
    borderRadius: radius.lg,
  },
  textsBubble: {
    alignSelf: 'stretch',
  },
  textsRow: {
    flex: 1,
    minWidth: 0,
  },
  textsPoster: {
    alignSelf: 'stretch',
  },
  // The tick on a chosen tile: a small disc in the accent colour.
  check: {
    width: size.sealSmall,
    height: size.sealSmall,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCorner: {
    position: 'absolute',
    top: space.sm,
  },
}));
