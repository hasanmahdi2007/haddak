import { Banknote, MapPin, MessageCircle, Phone, Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { ProviderSummary } from '@/api';
import { useI18n } from '@/i18n';
import { providerPrice } from '@/lib/price';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { AvailableTag, NotVerifiedBadge, VerifiedBadge } from './Badges';
import { Button } from './Button';
import { OpenStatus } from './OpenStatus';
import { Photo } from './Photo';
import { Txt } from './Txt';

interface Props {
  provider: ProviderSummary;
  onOpen: () => void;
  onWhatsApp: () => void;
  onCall: () => void;
  /** The number is being fetched after a tap: the buttons say so and wait. */
  busy?: 'whatsapp' | 'call' | null;
}

/**
 * One of the assistant's top three: a white block made for people who rarely use a
 * phone. Bigger words than a result card, the facts spelled out in a grey strip, and
 * the two ways to reach the person as full-width 56 dp buttons: WhatsApp first, then Call.
 * The photo and name open the profile.
 */
export function AssistCard({ provider, onOpen, onWhatsApp, onCall, busy = null }: Props) {
  const { colors } = useTheme();
  const { s, f, row, plural, categoryName, distance } = useI18n();
  const styles = useStyles();
  const place = `${categoryName(provider.category)} · ${provider.area_name}`;
  const price = providerPrice(s, provider);
  const away = provider.distance_m !== null ? f(s.provider.away, { distance: distance(provider.distance_m) }) : null;

  const spoken = [
    provider.name,
    place,
    provider.verified ? s.badges.verified : s.badges.notVerified,
    provider.available_now ? s.badges.availableNow : null,
    provider.available_now || provider.open_now === null ? null : provider.open_now ? s.hours.openNow : s.hours.closedNow,
    away,
    price,
    provider.review_count > 0
      ? plural(s.rating.label, provider.review_count, { rating: provider.avg_rating.toFixed(1) })
      : s.rating.noneLabel,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={f(s.assist.openProfile, { name: spoken })}
        onPress={onOpen}
        android_ripple={{ color: colors.surfaceTint }}
        style={({ pressed }) => [styles.top, { flexDirection: row }, pressed ? styles.topPressed : null]}
      >
        <Photo uri={provider.cover_photo_url} fallbackIcon={provider.category.icon} style={styles.thumb} />
        <View style={styles.main}>
          <Txt role="headline" numberOfLines={2} content>
            {provider.name}
          </Txt>
          <Txt role="bodyLarge" color="textMuted" numberOfLines={2}>
            {place}
          </Txt>
          <View style={[styles.badges, { flexDirection: row }]}>
            {provider.verified ? <VerifiedBadge decorative /> : <NotVerifiedBadge decorative />}
            {provider.available_now ? (
              <AvailableTag decorative />
            ) : (
              <OpenStatus open={provider.open_now} role="bodyStrong" />
            )}
          </View>
        </View>
      </Pressable>

      {/* The facts, spelled out: how far, how much, how others rated them. */}
      <View
        style={[styles.facts, { flexDirection: row }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {provider.distance_m !== null ? (
          <View style={[styles.fact, { flexDirection: row }]}>
            <MapPin color={colors.textSubtle} size={size.icon} strokeWidth={size.stroke} />
            <Txt role="bodyLargeStrong">{distance(provider.distance_m)}</Txt>
          </View>
        ) : null}
        {price ? (
          <View style={[styles.fact, styles.factShrink, { flexDirection: row }]}>
            <Banknote color={colors.textSubtle} size={size.icon} strokeWidth={size.stroke} />
            <Txt role="bodyLargeStrong" style={styles.factShrink} content>
              {price}
            </Txt>
          </View>
        ) : null}
        <View style={[styles.fact, { flexDirection: row }]}>
          {provider.review_count > 0 ? (
            <>
              <Star color={colors.rating} fill={colors.rating} size={size.icon} />
              <Txt role="bodyLargeStrong">{provider.avg_rating.toFixed(1)}</Txt>
              <Txt role="bodyLarge" color="textSubtle">
                ({provider.review_count})
              </Txt>
            </>
          ) : (
            <Txt role="bodyLarge" color="textSubtle">
              {s.rating.none}
            </Txt>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={busy === 'whatsapp' ? s.assist.contactLoading : s.assist.whatsapp}
          accessibilityLabel={f(s.provider.whatsappLabel, { name: provider.name })}
          icon={MessageCircle}
          variant="whatsapp"
          large
          loading={busy === 'whatsapp'}
          disabled={busy !== null}
          onPress={onWhatsApp}
        />
        <Button
          label={busy === 'call' ? s.assist.contactLoading : s.assist.call}
          accessibilityLabel={f(s.provider.callLabel, { name: provider.name })}
          icon={Phone}
          variant="tonal"
          large
          loading={busy === 'call'}
          disabled={busy !== null}
          onPress={onCall}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
  },
  top: {
    gap: space.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  topPressed: {
    backgroundColor: c.surfaceTint,
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
  // A grey strip inside the white block (the result card's white strip, turned around).
  facts: {
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.xl,
    rowGap: space.sm,
    backgroundColor: c.surfaceTint,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  fact: {
    alignItems: 'center',
    gap: space.xs + space.xxs,
  },
  factShrink: {
    flexShrink: 1,
  },
  actions: {
    gap: space.sm,
  },
}));
