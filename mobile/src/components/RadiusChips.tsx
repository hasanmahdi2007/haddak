import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { RADIUS_OPTIONS, radiusLabel, type RadiusM } from '@/lib/radius';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

interface Props {
  value: RadiusM;
  onChange: (value: RadiusM) => void;
}

/**
 * One choice of four: 500 m, 1 km, 5 km, City.
 * Drawn as one aqua track with the chosen segment filled teal.
 */
export function RadiusChips({ value, onChange }: Props) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={s.radius.label}
      style={[styles.track, { flexDirection: row }]}
    >
      {RADIUS_OPTIONS.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option)}
            android_ripple={{ color: colors.surfaceTintStrong }}
            style={styles.target}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.chip,
                  selected ? styles.chipSelected : null,
                  pressed && !selected ? styles.chipPressed : null,
                ]}
              >
                <Txt role="action" color={selected ? 'onPrimary' : 'text'} center numberOfLines={1}>
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

const useStyles = makeStyles((c) => ({
  track: {
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    padding: space.xs,
    gap: space.xxs,
  },
  target: {
    flex: 1,
    minHeight: size.touch,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  chip: {
    flex: 1,
    minHeight: size.touch,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  chipSelected: {
    backgroundColor: c.primary,
  },
  chipPressed: {
    backgroundColor: c.surfaceTintStrong,
  },
}));
