import { Banknote, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { ProviderSummary } from '@/api';
import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { FeaturedTag, FoundingBadge, VerifiedBadge } from './Badges';
import { Photo } from './Photo';
import { Rating } from './Rating';
import { Txt } from './Txt';

interface Props {
  provider: ProviderSummary;
  onPress: () => void;
}

/**
 * One search result. Top: photo, name, "category · area" and the badges.
 * Bottom: an aqua strip that keeps rating, distance and price in the same
 * three columns on every card, so a list can be compared at a glance.
 * A featured (paid) card has a teal edge and the Featured tag.
 */
export function ProviderCard({ provider, onPress }: Props) {
  const { colors } = useTheme();
  const { s, f, row, plural, categoryName, distance } = useI18n();
  const styles = useStyles();
  const hasBadges = provider.verified || provider.featured || provider.founding_member;
  const place = `${categoryName(provider.category)} · ${provider.area_name}`;

  // The whole card is one button, so it gets one spoken description.
  const spoken = [
    provider.name,
    place,
    provider.verified ? s.badges.verified : null,
    provider.featured ? s.badges.featuredLabel : null,
    provider.founding_member ? s.badges.founding : null,
    plural(s.rating.label, provider.review_count, { rating: provider.avg_rating.toFixed(1) }),
    provider.distance_m !== null ? f(s.provider.away, { distance: distance(provider.distance_m) }) : null,
    provider.price_text,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={s.results.openProfile}
      onPress={onPress}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={({ pressed }) => [
        styles.card,
        provider.featured ? styles.cardFeatured : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.top, { flexDirection: row }]}>
        <Photo uri={provider.cover_photo_url} fallbackIcon={provider.category.icon} style={styles.thumb} />
        <View style={styles.main}>
          <Txt role="title" numberOfLines={2} content>
            {provider.name}
          </Txt>
          <Txt role="label" color="textMuted" numberOfLines={1}>
            {place}
          </Txt>
          {hasBadges ? (
            <View style={[styles.badges, { flexDirection: row }]}>
              {provider.verified ? <VerifiedBadge decorative /> : null}
              {provider.featured ? <FeaturedTag /> : null}
              {provider.founding_member ? <FoundingBadge /> : null}
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.facts, { flexDirection: row }]}>
        <View style={[styles.fact, styles.factRating, { flexDirection: row }]}>
          <Rating rating={provider.avg_rating} count={provider.review_count} />
        </View>
        <View style={[styles.fact, styles.factDistance, { flexDirection: row }]}>
          {provider.distance_m !== null ? (
            <>
              <MapPin color={colors.primary} size={size.iconSmall} strokeWidth={size.stroke} />
              <Txt role="data" numberOfLines={1}>
                {distance(provider.distance_m)}
              </Txt>
            </>
          ) : null}
        </View>
        <View style={[styles.fact, styles.factPrice, { flexDirection: row }]}>
          {provider.price_text ? (
            <>
              <Banknote color={colors.primary} size={size.iconSmall} strokeWidth={size.stroke} />
              {/* Prices are typed by providers and can be long: two lines rather than cut off. */}
              <Txt role="data" numberOfLines={2} style={styles.priceText} content>
                {provider.price_text}
              </Txt>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: size.lineMid,
    borderColor: c.surfaceTintStrong,
    overflow: 'hidden',
  },
  cardFeatured: {
    borderColor: c.primary,
  },
  pressed: {
    backgroundColor: c.surfaceTint,
  },
  top: {
    padding: space.md,
    gap: space.md,
  },
  thumb: {
    width: size.thumb,
    height: size.thumb,
    borderRadius: radius.md,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
  badges: {
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.md,
    rowGap: space.xs,
    marginTop: space.xs,
  },
  facts: {
    backgroundColor: c.surfaceTint,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  fact: {
    alignItems: 'center',
    gap: space.xs,
    minHeight: space.xxl,
  },
  // Fixed proportions: the columns line up from card to card.
  factRating: {
    flex: 5,
  },
  factDistance: {
    flex: 4,
  },
  factPrice: {
    flex: 8,
  },
  priceText: {
    flex: 1,
    minWidth: 0,
  },
}));
