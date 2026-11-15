import { Banknote, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { ProviderSummary } from '@/api';
import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { FeaturedTag, FoundingStamp, Seal } from './Badges';
import { Photo } from './Photo';
import { Rating } from './Rating';
import { Txt } from './Txt';

interface Props {
  provider: ProviderSummary;
  onPress: () => void;
}

/**
 * One search result. The bottom row keeps rating, distance and price in the
 * same three columns on every card, so a list can be compared at a glance.
 */
export function ProviderCard({ provider, onPress }: Props) {
  const { colors } = useTheme();
  const { s, row, categoryName, distance } = useI18n();
  const styles = useStyles();
  const hasTags = provider.featured || provider.founding_member;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={s.results.openProfile}
      onPress={onPress}
      android_ripple={{ color: colors.manila }}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={[styles.top, { flexDirection: row }]}>
        <Photo
          uri={provider.cover_photo_url}
          fallbackIcon={provider.category.icon}
          style={styles.thumb}
        />
        <View style={styles.main}>
          <View style={[styles.nameRow, { flexDirection: row }]}>
            <Txt role="title" numberOfLines={2} style={styles.name} content>
              {provider.name}
            </Txt>
            {provider.verified ? (
              <View style={styles.seal} accessible accessibilityLabel={s.badges.verified}>
                <Seal />
              </View>
            ) : null}
          </View>
          <Txt role="label" color="textMuted" numberOfLines={1}>
            {categoryName(provider.category)} · {provider.area_name}
          </Txt>
          {hasTags ? (
            <View style={[styles.tags, { flexDirection: row }]}>
              {provider.featured ? <FeaturedTag /> : null}
              {provider.founding_member ? <FoundingStamp /> : null}
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
              <Txt role="data" numberOfLines={1} style={styles.priceText} content>
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
    backgroundColor: c.sheet,
    borderRadius: radius.md,
    borderWidth: size.hairline,
    borderColor: c.hairline,
    overflow: 'hidden',
  },
  pressed: {
    backgroundColor: c.manila,
  },
  top: {
    padding: space.md,
    gap: space.md,
  },
  thumb: {
    width: size.thumb,
    height: size.thumb,
    borderRadius: radius.sm,
  },
  main: {
    flex: 1,
    gap: space.xxs,
  },
  nameRow: {
    alignItems: 'flex-start',
    gap: space.sm,
  },
  name: {
    flexShrink: 1,
  },
  seal: {
    paddingTop: space.xs,
  },
  tags: {
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.xs,
  },
  facts: {
    borderTopWidth: size.hairline,
    borderTopColor: c.hairline,
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
    flexShrink: 1,
  },
}));
