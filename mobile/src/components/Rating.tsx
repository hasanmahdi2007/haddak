import { Star } from 'lucide-react-native';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

/** "★ 4.7 (23)", or "New" when there are no reviews yet. */
export function Rating({ rating, count }: { rating: number; count: number }) {
  const { colors } = useTheme();
  const { s, row, plural } = useI18n();
  const styles = useStyles();

  if (count === 0) {
    return (
      <Txt role="data" color="textSubtle" accessibilityLabel={s.rating.noneLabel}>
        {s.rating.none}
      </Txt>
    );
  }

  return (
    <View
      style={[styles.row, { flexDirection: row }]}
      accessible
      accessibilityLabel={plural(s.rating.label, count, { rating: rating.toFixed(1) })}
    >
      <Star color={colors.saffron} fill={colors.saffron} size={size.iconSmall} />
      <Txt role="data">{rating.toFixed(1)}</Txt>
      <Txt role="data" color="textSubtle">
        ({count})
      </Txt>
    </View>
  );
}

/** Five stars for one review. */
export function Stars({ value }: { value: number }) {
  const { colors } = useTheme();
  const { s, f, row } = useI18n();
  const styles = useStyles();
  return (
    <View
      style={[styles.stars, { flexDirection: row }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={f(s.rating.stars, { n: value })}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size.star}
          color={n <= value ? colors.saffron : colors.outline}
          fill={n <= value ? colors.saffron : 'none'}
          strokeWidth={size.stroke}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: {
    alignItems: 'center',
    gap: space.xs,
  },
  stars: {
    gap: space.xxs,
  },
}));
