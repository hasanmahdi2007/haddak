import { Banknote, MapPin, MessageCircle, Phone, Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { ProviderSummary } from '@/api';
import { useI18n } from '@/i18n';
import { providerPrice } from '@/lib/price';
import { elevation, makeStyles, radius, size, space, useTheme } from '@/theme';

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
 * phone. Compact, so two whole cards fit on the first screen under the question:
 * photo, name and trust marks, the facts in a slim grey strip, then WhatsApp and Call
 * side by side as 56 dp buttons (WhatsApp first). The photo and name open the profile.
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
          <Txt role="title" numberOfLines={2} content>
            {provider.name}
          </Txt>
          <Txt role="body" color="textMuted" numberOfLines={1}>
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

      {/* Side by side to save height; each is still a 56 dp target. While the number
          is fetched the tapped one shows a spinner (its screen-reader label says why). */}
      <View style={[styles.actions, { flexDirection: row }]}>
        <Button
          label={s.assist.whatsapp}
          accessibilityLabel={
            busy === 'whatsapp' ? s.assist.contactLoading : f(s.provider.whatsappLabel, { name: provider.name })
          }
          icon={MessageCircle}
          variant="whatsapp"
          large
          loading={busy === 'whatsapp'}
          disabled={busy !== null}
          onPress={onWhatsApp}
          style={styles.action}
        />
        <Button
          label={s.assist.call}
          accessibilityLabel={busy === 'call' ? s.assist.contactLoading : f(s.provider.callLabel, { name: provider.name })}
          icon={Phone}
          variant="tonal"
          large
          loading={busy === 'call'}
          disabled={busy !== null}
          onPress={onCall}
          style={styles.action}
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
    boxShadow: elevation.card,
  },
  top: {
    gap: space.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  topPressed: {
    backgroundColor: c.surfaceInset,
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
    marginTop: space.xxs,
  },
  // A faint lavender strip inside the white block, the same as on a result card.
  facts: {
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.lg,
    rowGap: space.xs,
    backgroundColor: c.surfaceInset,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
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
  action: {
    flex: 1,
  },
}));
