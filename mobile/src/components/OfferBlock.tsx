import { Clock, Tag } from 'lucide-react-native';
import { View } from 'react-native';

import type { Banner } from '@/api';
import { useI18n } from '@/i18n';
import { daysUntil } from '@/lib/time';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

/**
 * A provider's running offer on their profile: a deep lavender block (the colour
 * of the primary buttons, with white words) carrying the title, one sentence and
 * when it ends. The discount, when there is one, is the big figure on a white
 * block at the end; without it a tag icon takes its place.
 */
export function OfferBlock({ banner }: { banner: Banner }) {
  const { colors } = useTheme();
  const { s, f, row, plural } = useI18n();
  const styles = useStyles();
  const ends = plural(s.offer.ends, daysUntil(banner.expires_at));
  const discount = banner.discount_percent;

  // Read as one sentence: "Offer: Screen week. Every phone screen... 20% off. Ends in 5 days."
  const spoken = [
    f(s.offer.labelNamed, { title: banner.title }),
    banner.text,
    discount !== null ? f(s.offer.discountLabel, { n: discount }) : null,
    ends,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View style={[styles.block, { flexDirection: row }]} accessible accessibilityLabel={spoken}>
      <View style={styles.words}>
        <Txt role="headline" color="onPrimary" content>
          {banner.title}
        </Txt>
        {banner.text ? (
          <Txt color="onPrimary" content>
            {banner.text}
          </Txt>
        ) : null}
        <View style={[styles.ends, { flexDirection: row }]}>
          <Clock color={colors.onPrimary} size={size.iconSmall} strokeWidth={size.lineBold} />
          <Txt role="label" color="onPrimary">
            {ends}
          </Txt>
        </View>
      </View>

      {discount !== null ? (
        <View style={styles.figure}>
          {/* The figure stays left-to-right ("20%") in Arabic too. */}
          <Txt role="poster" center ltr numberOfLines={1} adjustsFontSizeToFit>
            {discount}%
          </Txt>
          <Txt role="label" color="textMuted" center>
            {s.offer.off}
          </Txt>
        </View>
      ) : (
        <View style={styles.mark}>
          <Tag color={colors.text} size={size.iconLarge} strokeWidth={size.lineBold} />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  block: {
    backgroundColor: c.primary,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
    alignItems: 'stretch',
  },
  words: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
  },
  ends: {
    alignItems: 'center',
    gap: space.xs + space.xxs,
    marginTop: space.md,
  },
  figure: {
    minWidth: size.offerFigure,
    minHeight: size.offerFigure,
    paddingHorizontal: space.md,
    borderRadius: radius.lg - space.xs,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
}));
