import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

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

/** A category in the grid: line icon on manila, label under it. */
export function CategoryTile({ icon, label, selected, hasChildren, selectedChild, onPress }: Props) {
  const { colors } = useTheme();
  const { s, f, start } = useI18n();
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasChildren ? f(s.home.hasMore, { name: label }) : label}
      accessibilityState={{ selected }}
      onPress={onPress}
      android_ripple={{ color: colors.manilaDeep }}
      style={({ pressed }) => [
        styles.tile,
        selected ? styles.selected : null,
        pressed && !selected ? styles.pressed : null,
      ]}
    >
      <CategoryIcon icon={icon} color={selected ? colors.onInkWash : colors.ink} />
      <Txt role="label" color={selected ? 'onInkWash' : 'text'} center numberOfLines={2}>
        {label}
      </Txt>
      {selectedChild ? (
        <Txt role="caption" color="onInkWash" center numberOfLines={1}>
          {selectedChild}
        </Txt>
      ) : null}
      {selected ? (
        <View style={[styles.corner, start(space.sm)]}>
          <Check color={colors.onInkWash} size={size.iconSmall} strokeWidth={size.strokeBold} />
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: size.tile,
    borderRadius: radius.md,
    borderWidth: size.lineBold,
    borderColor: c.manila,
    backgroundColor: c.manila,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    paddingVertical: space.md,
    gap: space.sm,
    overflow: 'hidden',
  },
  selected: {
    backgroundColor: c.inkWash,
    borderColor: c.ink,
  },
  pressed: {
    backgroundColor: c.manilaDeep,
    borderColor: c.manilaDeep,
  },
  corner: {
    position: 'absolute',
    top: space.sm,
  },
}));
