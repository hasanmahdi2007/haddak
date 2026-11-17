import { Banknote, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { ProviderSummary } from '@/api';
import { useI18n } from '@/i18n';
import { makeStyles, opacity, radius, size, space, useTheme } from '@/theme';

import {
  AvailableTag,
  CommunityLabel,
  FeaturedTag,
  FoundingBadge,
  NotVerifiedBadge,
  OfferTag,
  SponsoredTag,
  VerifiedBadge,
} from './Badges';
import { OpenStatus } from './OpenStatus';
import { Photo } from './Photo';
import { Rating } from './Rating';
import { StoryRing } from './StoryRing';
import { Txt } from './Txt';

interface Props {
  provider: ProviderSummary;
  onPress: () => void;
  /** Opens the provider's updates. Given: a tap on the ringed photo opens them instead of the profile. */
  onOpenStory?: () => void;
  /**
   * Draw a sponsored provider as an ordinary card. The results list does this
   * outside its "Sponsored" section, so a paid card is never shown twice.
   */
  plain?: boolean;
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
 *
 * A provider with an update gets a ring around the photo (StoryRing), and one
 * with a running offer gets an ink tag with the offer's title.
 */
export function ProviderCard({ provider, onPress, onOpenStory, plain = false }: Props) {
  const { colors } = useTheme();
  const { s, f, row, plural, categoryName, distance } = useI18n();
  const styles = useStyles();
  const place = `${categoryName(provider.category)} · ${provider.area_name}`;
  const sponsored = provider.sponsored === true && !plain;
  const hasStory = provider.has_active_story === true;
  const canOpenStory = hasStory && onOpenStory !== undefined;

  // The whole card is one button, so it gets one spoken description.
  const spoken = [
    provider.name,
    place,
    sponsored ? s.results.sponsoredLabel : null,
    sponsored ? provider.sponsor_hook : null,
    provider.verified ? s.badges.verified : s.badges.notVerified,
    provider.claimed ? null : s.badges.community,
    provider.banner_title ? f(s.offer.labelNamed, { title: provider.banner_title }) : null,
    provider.featured ? s.badges.featuredLabel : null,
    provider.founding_member ? s.badges.founding : null,
    provider.available_now ? s.badges.availableNow : null,
    // "Available now" wins over the hours: "Closed" beside it would only confuse.
    provider.available_now || provider.open_now === null ? null : provider.open_now ? s.hours.openNow : s.hours.closedNow,
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
      // The photo is a button inside a button, which a screen reader cannot reach:
      // it gets the updates as a second action on the card instead.
      accessibilityActions={
        canOpenStory
          ? [
              { name: 'activate', label: s.results.openProfile },
              { name: 'story', label: f(s.stories.open, { name: provider.name }) },
            ]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'story') onOpenStory?.();
        else onPress();
      }}
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
        {/* The ring is ink on the lavender card, where a lavender ring would not show. */}
        <Pressable
          disabled={!canOpenStory}
          onPress={onOpenStory}
          accessible={false}
          style={({ pressed }) => (pressed ? styles.thumbPressed : null)}
        >
          <StoryRing
            active={hasStory}
            box={size.thumb}
            round={radius.md}
            tone={sponsored ? 'ink' : 'accent'}
          >
            <Photo uri={provider.cover_photo_url} fallbackIcon={provider.category.icon} style={styles.thumb} />
          </StoryRing>
        </Pressable>
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
          {provider.banner_title ? (
            <View style={[styles.offer, { flexDirection: row }]}>
              <OfferTag title={provider.banner_title} />
            </View>
          ) : null}
          <View style={[styles.badges, { flexDirection: row }]}>
            {provider.verified ? <VerifiedBadge decorative /> : <NotVerifiedBadge decorative />}
            {sponsored ? <SponsoredTag decorative /> : null}
            {provider.featured && !sponsored ? <FeaturedTag /> : null}
            {provider.founding_member && !sponsored ? <FoundingBadge /> : null}
            {provider.claimed || sponsored ? null : <CommunityLabel />}
            {provider.available_now ? (
              <AvailableTag decorative />
            ) : (
              <OpenStatus open={provider.open_now} onPastel={sponsored} />
            )}
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
  top: {
    gap: space.md,
  },
  // The photo fills the ring's inside (or the whole 84 dp when there is no ring).
  thumb: {
    flex: 1,
    alignSelf: 'stretch',
  },
  thumbPressed: {
    opacity: opacity.pressed,
  },
  offer: {
    marginTop: space.xs,
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
