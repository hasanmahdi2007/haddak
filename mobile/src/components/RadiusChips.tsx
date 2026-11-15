import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { RADIUS_OPTIONS, radiusLabel, type RadiusM } from '@/lib/radius';
import { makeStyles, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

interface Props {
  value: RadiusM;
  onChange: (value: RadiusM) => void;
}

/**
 * One choice of four: 500 m, 1 km, 5 km, City.
 * Drawn as separate pills, or as one segmented track, depending on the design option.
 */
export function RadiusChips({ value, onChange }: Props) {
  const { colors, look } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  const track = look.chips === 'track';

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={s.radius.label}
      style={[track ? styles.track : styles.group, { flexDirection: row }]}
    >
      {RADIUS_OPTIONS.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option)}
            android_ripple={{ color: colors.manilaDeep }}
            style={styles.target}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.chip,
                  track ? styles.chipInTrack : null,
                  selected ? styles.chipSelected : null,
                  pressed && !selected ? styles.chipPressed : null,
                ]}
              >
                <Txt role="action" color={selected ? 'onInk' : 'text'} center numberOfLines={1}>
                  {radiusLabel(s, option)}
                </Txt>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c, look) => ({
  group: {
    gap: space.sm,
  },
  // The segmented track: one tinted bar, the chosen segment filled.
  track: {
    backgroundColor: c.manila,
    borderRadius: look.chipRadius + space.xs,
    padding: space.xs,
    gap: space.xxs,
  },
  // The touch target is at least 48 dp tall; the visible chip sits inside it.
  target: {
    flex: 1,
    minHeight: size.touch,
    justifyContent: 'center',
  },
  chip: {
    minHeight: size.chip,
    borderRadius: look.chipRadius,
    borderWidth: size.lineMid,
    borderColor: c.outline,
    backgroundColor: c.sheet,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  chipInTrack: {
    minHeight: size.touch,
    borderColor: c.manila,
    backgroundColor: c.manila,
  },
  chipSelected: {
    backgroundColor: c.ink,
    borderColor: c.ink,
  },
  chipPressed: {
    backgroundColor: c.manilaDeep,
  },
}));
