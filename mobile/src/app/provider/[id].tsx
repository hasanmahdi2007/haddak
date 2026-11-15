import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Star,
  UserX,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ContactEventType, type ProviderDetail, type Review } from '@/api';
import { FeaturedTag, FoundingBadge, Seal } from '@/components/Badges';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Photo } from '@/components/Photo';
import { Stars } from '@/components/Rating';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { directionsUrl, shareUrl, telUrl, whatsappUrl } from '@/lib/links';
import { useFavourites } from '@/lib/favourites';
import { useLocation } from '@/lib/location';
import { useAsync } from '@/lib/useAsync';
import { makeStyles, motion, radius, size, space, useTheme } from '@/theme';

const REVIEW_PAGE = 10;

function galleryHeightFor(width: number, hasPhotos: boolean): number {
  return Math.round(width * (hasPhotos ? size.galleryRatio : size.galleryRatioEmpty));
}

function Gallery({ provider, width }: { provider: ProviderDetail; width: number }) {
  const { s, f, start } = useI18n();
  const styles = useStyles();
  const [index, setIndex] = useState(0);
  const photos = provider.photos;
  // Without photos the header is shorter, so the page does not open on an empty block.
  const height = galleryHeightFor(width, photos.length > 0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  if (photos.length === 0) {
    return (
      <Photo
        uri={null}
        fallbackIcon={provider.category.icon}
        fallbackIconSize={space.huge}
        label={s.provider.noPhoto}
        style={{ width, height }}
      />
    );
  }

  return (
    <View style={{ width, height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {photos.map((uri, i) => (
          <Photo
            key={uri}
            uri={uri}
            fallbackIcon={provider.category.icon}
            fallbackIconSize={space.huge}
            label={f(s.provider.photo, { i: i + 1, n: photos.length })}
            style={{ width, height }}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={[styles.counter, start(space.lg)]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Txt role="caption" color="onScrim" ltr>
            {index + 1} / {photos.length}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const { row, language } = useI18n();
  const styles = useStyles();
  const date = new Date(review.created_at).toLocaleDateString(
    language === 'ar' ? 'ar-LB-u-nu-latn' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );
  return (
    <View style={styles.review}>
      <View style={[styles.reviewHead, { flexDirection: row }]}>
        <Txt role="bodyStrong" numberOfLines={1} style={styles.reviewAuthor} content>
          {review.author_name}
        </Txt>
        <Txt role="caption" color="textSubtle">
          {date}
        </Txt>
      </View>
      <View style={{ flexDirection: row }}>
        <Stars value={review.rating} />
      </View>
      {review.comment ? (
        <Txt color="textMuted" content="block">
          {review.comment}
        </Txt>
      ) : null}
    </View>
  );
}

function Reviews({ provider }: { provider: ProviderDetail }) {
  const { s, f, row, plural } = useI18n();
  const styles = useStyles();
  const [items, setItems] = useState<Review[]>([]);
  const [total, setTotal] = useState(provider.review_count);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(
    async (offset: number) => {
      try {
        const page = await api.getReviews(provider.id, { limit: REVIEW_PAGE, offset });
        setItems((current) => (offset === 0 ? page.items : [...current, ...page.items]));
        setTotal(page.total);
        setState('ready');
      } catch {
        setState('error');
      }
    },
    [provider.id],
  );

  useEffect(() => {
    // State is only set after the awaited request settles, not during the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0);
  }, [load]);

  const more = () => {
    setState('loading');
    void load(items.length);
  };

  return (
    <View style={styles.section}>
      <View style={[styles.sectionHead, { flexDirection: row }]}>
        <Txt role="title" accessibilityRole="header" style={styles.sectionTitle}>
          {s.provider.reviews}
        </Txt>
        {total > 0 ? (
          <Txt role="label" color="textMuted">
            {plural(s.provider.reviewCount, total)}
          </Txt>
        ) : null}
      </View>

      {state === 'ready' && total === 0 ? (
        <View style={styles.noReviews}>
          <Txt role="bodyStrong">{s.provider.noReviews}</Txt>
          <Txt color="textMuted">{f(s.provider.noReviewsBody, { name: provider.name })}</Txt>
        </View>
      ) : null}

      {items.map((review, i) => (
        <View key={review.id} style={i > 0 ? styles.reviewDivider : null}>
          <ReviewItem review={review} />
        </View>
      ))}

      {state === 'loading' ? (
        <View style={styles.reviewSkeleton} accessible accessibilityLabel={s.provider.loading}>
          <Skeleton width="40%" height={space.lg} />
          <Skeleton height={space.lg} />
          <Skeleton width="80%" height={space.lg} />
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={styles.reviewError} accessibilityRole="alert">
          <Txt color="textMuted">{s.provider.reviewsError}</Txt>
          <Button label={s.common.tryAgain} variant="outline" onPress={() => more()} />
        </View>
      ) : null}

      {state === 'ready' && items.length < total ? (
        <Button label={s.provider.moreReviews} variant="outline" onPress={() => more()} />
      ) : null}
    </View>
  );
}

export default function ProviderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { colors, dark } = useTheme();
  const { s, f, row, rtl, end, plural, categoryName, distance } = useI18n();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coords, status: locationStatus } = useLocation();
  const [notice, setNotice] = useState<string | null>(null);
  const favourites = useFavourites();
  const saved = favourites.isFavourite(id);
  // Scale of the heart; kept in state so the same value lives for the whole screen.
  const [pulse] = useState(() => new Animated.Value(1));

  // Same origin as the search (the device position, or Haret Hreik), so distances agree.
  const from = locationStatus === 'locating' ? undefined : coords;
  const load = useAsync(() => api.getProvider(id, from), [id, from?.lat, from?.lng]);
  const provider = load.data;
  const providerId = provider?.id;

  // Count one profile view per visit. Counting must never get in the user's way.
  useEffect(() => {
    if (providerId) api.logContactEvent(providerId, 'view').catch(() => undefined);
  }, [providerId]);

  const width = Math.min(window.width, size.maxContent);
  const galleryHeight = galleryHeightFor(width, (provider?.photos.length ?? 1) > 0);
  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const contact = async (type: Exclude<ContactEventType, 'view'>, target: ProviderDetail) => {
    api.logContactEvent(target.id, type).catch(() => undefined);
    const url =
      type === 'whatsapp'
        ? whatsappUrl(target.whatsapp ?? target.phone, s.provider.greeting)
        : telUrl(target.phone);
    try {
      await Linking.openURL(url);
      setNotice(null);
    } catch {
      setNotice(
        type === 'whatsapp'
          ? s.provider.whatsappFailed
          : f(s.provider.callFailed, { phone: target.phone }),
      );
    }
  };

  // Opens the phone's maps app with the route to the provider.
  const directions = async (target: ProviderDetail) => {
    try {
      await Linking.openURL(directionsUrl(target.lat, target.lng));
      setNotice(null);
    } catch {
      setNotice(s.provider.directionsFailed);
    }
  };

  const share = (target: ProviderDetail) => {
    const url = shareUrl(target.slug);
    Share.share({ message: f(s.provider.shareMessage, { name: target.name, url }) }).catch(
      () => undefined,
    );
  };

  // Saves or removes the provider on this phone, with a short pulse and a spoken confirmation.
  const toggleSaved = (target: ProviderDetail) => {
    const nowSaved = favourites.toggle(target);
    AccessibilityInfo.announceForAccessibility(nowSaved ? s.saved.added : s.saved.removed);
    const native = Platform.OS !== 'web';
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.2, duration: motion.fast, useNativeDriver: native }),
      Animated.timing(pulse, { toValue: 1, duration: motion.fast, useNativeDriver: native }),
    ]).start();
  };

  if (load.status !== 'ready' || !provider) {
    const notFound = load.status === 'error' && load.error.status === 404;
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={[styles.plainBar, { flexDirection: row }]}>
          <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
        </View>
        {load.status === 'loading' ? (
          <View style={[styles.column, styles.loading]} accessible accessibilityLabel={s.provider.loading}>
            <Skeleton height={galleryHeight} round={radius.lg} />
            <Skeleton width="40%" height={space.lg} />
            <Skeleton width="70%" height={space.xxxl} />
            <Skeleton height={space.huge + space.xxl} round={radius.lg} />
            <Skeleton height={space.lg} />
            <Skeleton width="85%" height={space.lg} />
          </View>
        ) : notFound ? (
          <View style={styles.column}>
            <StateView
              icon={UserX}
              title={s.provider.notFoundTitle}
              body={s.provider.notFoundBody}
              actionLabel={s.provider.notFoundAction}
              onAction={() => router.replace('/')}
            />
          </View>
        ) : (
          <View style={styles.column}>
            <StateView
              alert
              icon={WifiOff}
              title={s.provider.errorTitle}
              body={s.provider.errorBody}
              actionLabel={s.common.tryAgain}
              onAction={load.reload}
            />
          </View>
        )}
      </View>
    );
  }

  const hasPhotos = provider.photos.length > 0;

  return (
    <View style={styles.screen}>
      <StatusBar style={hasPhotos || dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <View style={styles.column}>
          <Gallery provider={provider} width={width} />

          {/* The white sheet rises over the photo with round top corners. */}
          <View style={styles.body}>
            <View style={styles.identity}>
              {/* The first line shares its height with the seal, so it stops short of it. */}
              <View style={{ flexDirection: row }}>
                <Txt role="label" color="textMuted" style={styles.place}>
                  {categoryName(provider.category)} · {provider.area_name}
                </Txt>
                {provider.verified ? <View style={styles.sealRoom} /> : null}
              </View>
              <Txt role="headline" accessibilityRole="header" content>
                {provider.name}
              </Txt>

              {provider.verified ? (
                <View
                  style={[styles.verified, { flexDirection: row }]}
                  accessible
                  accessibilityLabel={`${s.badges.verified}. ${s.badges.verifiedBody}`}
                >
                  <View style={styles.verifiedSeal}>
                    <Seal />
                  </View>
                  <View style={styles.verifiedText}>
                    <Txt role="bodyStrong" color="primary">
                      {s.badges.verified}
                    </Txt>
                    <Txt role="label" color="textMuted">
                      {s.badges.verifiedBody}
                    </Txt>
                  </View>
                </View>
              ) : null}

              {provider.featured || provider.founding_member ? (
                <View style={[styles.badges, { flexDirection: row }]}>
                  {provider.featured ? <FeaturedTag /> : null}
                  {provider.founding_member ? <FoundingBadge /> : null}
                </View>
              ) : null}
            </View>

            {/* The facts and the way there read as one group. */}
            <View style={styles.factsGroup}>
            {/* Rating, distance, price: the same three facts, icons and order as on a result card. */}
            <View style={[styles.facts, { flexDirection: row }]}>
              <View
                style={styles.fact}
                accessible
                accessibilityLabel={plural(s.rating.label, provider.review_count, {
                  rating: provider.avg_rating.toFixed(1),
                })}
              >
                <View style={[styles.factValue, { flexDirection: row }]}>
                  {provider.review_count > 0 ? (
                    <Star color={colors.rating} fill={colors.rating} size={size.iconSmall} />
                  ) : null}
                  <Txt role="title">
                    {provider.review_count > 0 ? provider.avg_rating.toFixed(1) : s.rating.none}
                  </Txt>
                </View>
                <Txt role="caption" color="textMuted" center>
                  {s.provider.rating}
                </Txt>
              </View>
              {provider.distance_m !== null ? (
                <>
                  <View style={styles.factDivider} />
                  <View style={styles.fact} accessible>
                    <View style={[styles.factValue, { flexDirection: row }]}>
                      <MapPin color={colors.primary} size={size.iconSmall} strokeWidth={size.stroke} />
                      <Txt role="title">{distance(provider.distance_m)}</Txt>
                    </View>
                    <Txt role="caption" color="textMuted" center>
                      {s.provider.distance}
                    </Txt>
                  </View>
                </>
              ) : null}
              <View style={styles.factDivider} />
              <View style={[styles.fact, styles.factWide]} accessible>
                <View style={[styles.factValue, { flexDirection: row }]}>
                  <Banknote color={colors.primary} size={size.iconSmall} strokeWidth={size.stroke} />
                  <Txt role="title" numberOfLines={2} style={styles.factText} content>
                    {provider.price_text ?? s.provider.askPrice}
                  </Txt>
                </View>
                <Txt role="caption" color="textMuted" center>
                  {s.provider.price}
                </Txt>
              </View>
            </View>
            <Button
              label={s.provider.directions}
              accessibilityLabel={f(s.provider.directionsLabel, { name: provider.name })}
              icon={Navigation}
              variant="outline"
              onPress={() => void directions(provider)}
            />
            </View>

            {provider.description ? (
              <View style={styles.section}>
                <Txt role="title" accessibilityRole="header">
                  {s.provider.about}
                </Txt>
                <Txt content="block">{provider.description}</Txt>
              </View>
            ) : null}

            <Reviews provider={provider} />
          </View>

          {/* The large seal sits across the top edge of the sheet, on the end side. Decorative: the verified line says it in words. */}
          {provider.verified ? (
            <View
              style={[styles.sealSpot, { top: galleryHeight - size.sheetOverlap - size.sealLarge / 2 }, end(space.lg)]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Seal large />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Controls over the photo. */}
      <View
        style={[styles.overlayBar, { top: insets.top + space.sm, flexDirection: row }]}
        pointerEvents="box-none"
      >
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} tone="scrim" />
        <View style={[styles.overlayGroup, { flexDirection: row }]}>
          {/* The heart: outline when not saved, filled coral when saved. It swells for a moment on a tap. */}
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <IconButton
              icon={Heart}
              label={saved ? s.saved.remove : s.saved.save}
              selected={saved}
              color={saved ? colors.accent : undefined}
              fill={saved ? colors.accent : undefined}
              onPress={() => toggleSaved(provider)}
              tone="scrim"
            />
          </Animated.View>
          <IconButton icon={Share2} label={s.provider.share} onPress={() => share(provider)} tone="scrim" />
        </View>
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.column, styles.dockInner]}>
          {notice ? (
            <View style={[styles.notice, { flexDirection: row }]} accessibilityRole="alert">
              <Txt role="label" color="onDangerSoft" style={styles.noticeText}>
                {notice}
              </Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.provider.dismiss}
                onPress={() => setNotice(null)}
                hitSlop={space.sm}
                style={styles.noticeClose}
              >
                <X color={colors.onDangerSoft} size={size.icon} strokeWidth={size.stroke} />
              </Pressable>
            </View>
          ) : null}
          <View style={[styles.actions, { flexDirection: row }]}>
            <Button
              label={s.provider.whatsapp}
              accessibilityLabel={f(s.provider.whatsappLabel, { name: provider.name })}
              icon={MessageCircle}
              variant="whatsapp"
              onPress={() => void contact('whatsapp', provider)}
              style={styles.actionPrimary}
            />
            <Button
              label={s.provider.call}
              accessibilityLabel={f(s.provider.callLabel, { name: provider.name })}
              icon={Phone}
              variant="primary"
              onPress={() => void contact('call', provider)}
              style={styles.actionSecondary}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  plainBar: {
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
  },
  loading: {
    padding: space.lg,
    gap: space.md,
  },
  overlayBar: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    justifyContent: 'space-between',
  },
  overlayGroup: {
    gap: space.sm,
  },
  // Photo counter; it sits above the part of the photo the sheet covers.
  counter: {
    position: 'absolute',
    bottom: size.sheetOverlap + space.md,
    backgroundColor: c.scrim,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xxs,
  },
  sealSpot: {
    position: 'absolute',
  },
  body: {
    marginTop: -size.sheetOverlap,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: c.background,
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    gap: space.xxl,
  },
  identity: {
    gap: space.xs,
  },
  place: {
    flex: 1,
  },
  // Empty room the width of the large seal, so the line beside it never runs under it.
  sealRoom: {
    width: size.sealLarge + space.sm,
  },
  verified: {
    alignItems: 'flex-start',
    gap: space.sm,
    marginTop: space.sm,
  },
  // Lines the small seal up with the first line of text.
  verifiedSeal: {
    paddingTop: space.xxs,
  },
  verifiedText: {
    flex: 1,
  },
  badges: {
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  factsGroup: {
    gap: space.sm,
  },
  facts: {
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    paddingVertical: space.md,
  },
  fact: {
    flex: 1,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
  },
  factWide: {
    flex: 1.5,
  },
  factValue: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    maxWidth: '100%',
  },
  factText: {
    flexShrink: 1,
  },
  factDivider: {
    width: size.hairline,
    backgroundColor: c.surfaceTintStrong,
  },
  section: {
    gap: space.sm,
  },
  sectionHead: {
    alignItems: 'baseline',
    gap: space.md,
  },
  sectionTitle: {
    flex: 1,
  },
  noReviews: {
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xxs,
  },
  review: {
    gap: space.xs,
  },
  reviewHead: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  reviewAuthor: {
    flex: 1,
  },
  reviewDivider: {
    borderTopWidth: size.hairline,
    borderTopColor: c.border,
    paddingTop: space.md,
    marginTop: space.xs,
  },
  reviewSkeleton: {
    gap: space.sm,
    paddingVertical: space.sm,
  },
  reviewError: {
    gap: space.sm,
  },
  dock: {
    backgroundColor: c.surface,
    borderTopWidth: size.hairline,
    borderTopColor: c.border,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  dockInner: {
    gap: space.sm,
  },
  actions: {
    gap: space.md,
  },
  actionPrimary: {
    flex: 1.6,
  },
  actionSecondary: {
    flex: 1,
  },
  notice: {
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  noticeText: {
    flex: 1,
  },
  // 32 dp visible, 48 dp with its hitSlop.
  noticeClose: {
    width: space.xxxl,
    height: space.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
