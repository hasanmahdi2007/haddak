import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useI18n } from '@/i18n';
import { RADIUS_OPTIONS, radiusLabel, type RadiusM } from '@/lib/radius';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

interface Props {
  value: RadiusM;
  onChange: (value: RadiusM) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * One choice of four: 500 m, 1 km, 5 km, City.
 * A row of pill chips: outlined (light grey edge, no fill) when not chosen, solid
 * black with white words when chosen.
 * Each segment is 36 dp high to the eye; hitSlop above and below makes the touch
 * target 48 dp without making the control any taller.
 */
export function RadiusChips({ value, onChange, style }: Props) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={s.radius.label}
      style={[styles.track, { flexDirection: row }, style]}
    >
      {RADIUS_OPTIONS.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option)}
            hitSlop={{ top: size.segmentSlop, bottom: size.segmentSlop }}
            android_ripple={{ color: colors.surfaceTint }}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.segmentSelected : null,
              pressed && !selected ? styles.segmentPressed : null,
            ]}
          >
            <Txt role="label" color={selected ? 'onPrimary' : 'text'} center numberOfLines={1}>
              {radiusLabel(s, option)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  track: {
    gap: space.xs + space.xxs,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    height: size.segment,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    overflow: 'hidden',
  },
  segmentSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  segmentPressed: {
    backgroundColor: c.surfaceInset,
  },
}));
