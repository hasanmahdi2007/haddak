import { Banknote, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { ProviderSummary } from '@/api';
import { useI18n } from '@/i18n';
import { fonts, makeStyles, opacity, radius, size, space, useTheme } from '@/theme';

import { CommunityLabel, FeaturedTag, FoundingBadge, NotVerifiedBadge, VerifiedBadge } from './Badges';
import { OpenStatus } from './OpenStatus';
import { Photo } from './Photo';
import { Rating } from './Rating';
import { Txt } from './Txt';

interface Props {
  provider: ProviderSummary;
  onPress: () => void;
}

/**
 * One search result: a soft grey block with no outline.
 * Top: photo, name, "category · area", then the trust line. A verified provider
 * gets the mint Verified pill; one that is not gets the grey "Not verified" pill,
 * and "Listed by the community" when nobody has claimed the listing.
 * Bottom: a white strip that keeps rating, distance and price in the same three
 * columns on every card, so a list can be compared at a glance.
 *
 * Sponsored (paid, shown above the results): the same card as a solid lavender
 * block, with a small "Sponsored" label and one line written by the sponsor.
 * Text on lavender is dark in both themes.
 */
export function ProviderCard({ provider, onPress }: Props) {
  const { colors } = useTheme();
  const { s, f, row, plural, categoryName, distance } = useI18n();
  const styles = useStyles();
  const place = `${categoryName(provider.category)} · ${provider.area_name}`;
  const sponsored = provider.sponsored === true;

  // The whole card is one button, so it gets one spoken description.
  const spoken = [
    provider.name,
    place,
    sponsored ? s.results.sponsoredLabel : null,
    sponsored ? provider.sponsor_hook : null,
    provider.verified ? s.badges.verified : s.badges.notVerified,
    provider.claimed ? null : s.badges.community,
    provider.featured ? s.badges.featuredLabel : null,
    provider.founding_member ? s.badges.founding : null,
    provider.open_now === null ? null : provider.open_now ? s.hours.openNow : s.hours.closedNow,
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
        pressed ? styles.pressed : null,
        sponsored ? styles.sponsored : null,
        sponsored && pressed ? styles.sponsoredPressed : null,
      ]}
    >
      <View style={[styles.top, { flexDirection: row }]}>
        <Photo uri={provider.cover_photo_url} fallbackIcon={provider.category.icon} style={styles.thumb} />
        <View style={styles.main}>
          <Txt role="title" color={sponsored ? 'onAccent' : 'text'} numberOfLines={2} content>
            {provider.name}
          </Txt>
          <Txt role="label" color={sponsored ? 'onAccent' : 'textMuted'} numberOfLines={1}>
            {place}
          </Txt>
          {sponsored && provider.sponsor_hook ? (
            <Txt role="bodyStrong" color="onAccent" numberOfLines={2} content>
              {provider.sponsor_hook}
            </Txt>
          ) : null}
          <View style={[styles.badges, { flexDirection: row }]}>
            {provider.verified ? <VerifiedBadge decorative /> : <NotVerifiedBadge decorative />}
            {sponsored ? (
              <View style={styles.sponsoredTag}>
                <Txt role="caption" color="accent" style={styles.sponsoredTagText}>
                  {s.results.sponsored}
                </Txt>
              </View>
            ) : null}
            {provider.featured && !sponsored ? <FeaturedTag /> : null}
            {provider.founding_member && !sponsored ? <FoundingBadge /> : null}
            {provider.claimed || sponsored ? null : <CommunityLabel />}
            <OpenStatus open={provider.open_now} onPastel={sponsored} />
          </View>
        </View>
      </View>

      <View style={[styles.facts, { flexDirection: row }]}>
        <View style={[styles.fact, styles.factRating, { flexDirection: row }]}>
          <Rating rating={provider.avg_rating} count={provider.review_count} />
        </View>
        <View style={[styles.fact, styles.factDistance, { flexDirection: row }]}>
          {provider.distance_m !== null ? (
            <>
              <MapPin color={colors.textSubtle} size={size.iconSmall} strokeWidth={size.stroke} />
              <Txt role="data" numberOfLines={1}>
                {distance(provider.distance_m)}
              </Txt>
            </>
          ) : null}
        </View>
        <View style={[styles.fact, styles.factPrice, { flexDirection: row }]}>
          {provider.price_text ? (
            <>
              <Banknote color={colors.textSubtle} size={size.iconSmall} strokeWidth={size.stroke} />
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
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    padding: space.sm + space.xxs,
    gap: space.sm + space.xxs,
    overflow: 'hidden',
  },
  pressed: {
    backgroundColor: c.surfaceTintStrong,
  },
  sponsored: {
    backgroundColor: c.accent,
  },
  sponsoredPressed: {
    opacity: opacity.pressed,
  },
  // The "Sponsored" label: a small ink pill with lavender text.
  sponsoredTag: {
    minHeight: size.badge,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.onAccent,
  },
  sponsoredTagText: {
    fontFamily: fonts.bodyMedium,
  },
  top: {
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
    columnGap: space.sm,
    rowGap: space.xs,
    marginTop: space.xs,
  },
  // The white strip inside the grey block.
  facts: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
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
