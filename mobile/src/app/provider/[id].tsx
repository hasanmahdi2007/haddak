import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Phone,
  Share2,
  UserX,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ContactEventType, type ProviderDetail, type Review } from '@/api';
import { FeaturedTag, FoundingStamp, Seal, VerifiedBadge } from '@/components/Badges';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Photo } from '@/components/Photo';
import { Stars } from '@/components/Rating';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { shareUrl, telUrl, whatsappUrl } from '@/lib/links';
import { useLocation } from '@/lib/location';
import { useAsync } from '@/lib/useAsync';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

const REVIEW_PAGE = 10;

function Gallery({ provider, width }: { provider: ProviderDetail; width: number }) {
  const { s, f, start } = useI18n();
  const styles = useStyles();
  const [index, setIndex] = useState(0);
  const height = Math.round(width * size.galleryRatio);
  const photos = provider.photos;

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
        <View style={[styles.counter, start(space.lg)]}>
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
  const { s, f, plural } = useI18n();
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
      <View style={styles.sectionHead}>
        <Txt role="title" accessibilityRole="header">
          {s.provider.reviews}
        </Txt>
        {total > 0 ? (
          <Txt role="label" color="textMuted">
            {plural(s.provider.reviewCount, total)}
          </Txt>
        ) : null}
      </View>

      {state === 'ready' && total === 0 ? (
        <View>
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
  const { s, f, row, rtl, end, categoryName, distance } = useI18n();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coords, status: locationStatus } = useLocation();
  const [notice, setNotice] = useState<string | null>(null);

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
  const galleryHeight = Math.round(width * size.galleryRatio);
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

  const share = (target: ProviderDetail) => {
    const url = shareUrl(target.slug);
    Share.share({ message: f(s.provider.shareMessage, { name: target.name, url }) }).catch(
      () => undefined,
    );
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
            <Skeleton height={galleryHeight} round={radius.md} />
            <Skeleton width="40%" height={space.lg} />
            <Skeleton width="70%" height={space.xxxl} />
            <Skeleton height={space.huge + space.lg} round={radius.md} />
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

          {provider.verified ? (
            <View
              style={[styles.sealSpot, { top: galleryHeight - size.sealLarge / 2 }, end(space.lg)]}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`${s.badges.verified}. ${s.badges.verifiedBody}`}
            >
              <Seal large />
            </View>
          ) : null}

          <View style={styles.body}>
            <View style={styles.identity}>
              <Txt role="label" color="textMuted" style={styles.beside}>
                {categoryName(provider.category)} · {provider.area_name}
              </Txt>
              <Txt role="headline" accessibilityRole="header" content>
                {provider.name}
              </Txt>
              <View style={[styles.badges, { flexDirection: row }]}>
                {provider.verified ? <VerifiedBadge /> : null}
                {provider.founding_member ? <FoundingStamp /> : null}
                {provider.featured ? <FeaturedTag /> : null}
              </View>
              {provider.verified ? (
                <Txt role="caption" color="textSubtle">
                  {s.badges.verifiedBody}
                </Txt>
              ) : null}
            </View>

            <View style={[styles.facts, { flexDirection: row }]}>
              <View style={styles.fact}>
                <Txt role="caption" color="textSubtle" center>
                  {s.provider.rating}
                </Txt>
                <Txt role="title" center>
                  {provider.review_count > 0 ? provider.avg_rating.toFixed(1) : s.rating.none}
                </Txt>
              </View>
              {provider.distance_m !== null ? (
                <>
                  <View style={styles.factDivider} />
                  <View style={styles.fact}>
                  <Txt role="caption" color="textSubtle" center>
                    {s.provider.distance}
                  </Txt>
                  <Txt role="title" center>
                    {distance(provider.distance_m)}
                  </Txt>
                </View>
                </>
              ) : null}
              <View style={styles.factDivider} />
              <View style={[styles.fact, styles.factWide]}>
                <Txt role="caption" color="textSubtle" center>
                  {s.provider.price}
                </Txt>
                <Txt role="title" center numberOfLines={2} content>
                  {provider.price_text ?? s.provider.askPrice}
                </Txt>
              </View>
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
        </View>
      </ScrollView>

      {/* Controls over the photo. */}
      <View
        style={[styles.overlayBar, { top: insets.top + space.xs, flexDirection: row }]}
        pointerEvents="box-none"
      >
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} tone="scrim" />
        <IconButton icon={Share2} label={s.provider.share} onPress={() => share(provider)} tone="scrim" />
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.column, styles.dockInner]}>
          {notice ? (
            <View style={[styles.notice, { flexDirection: row }]} accessibilityRole="alert">
              <Txt role="label" color="onCarmineWash" style={styles.noticeText}>
                {notice}
              </Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.provider.dismiss}
                onPress={() => setNotice(null)}
                hitSlop={space.md}
                style={styles.noticeClose}
              >
                <X color={colors.onCarmineWash} size={size.icon} strokeWidth={size.stroke} />
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
              variant="tonal"
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
    backgroundColor: c.paper,
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
  counter: {
    position: 'absolute',
    bottom: space.md,
    backgroundColor: c.scrim,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xxs,
  },
  sealSpot: {
    position: 'absolute',
    zIndex: 1,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    gap: space.xxl,
  },
  identity: {
    gap: space.xs,
  },
  // The first line shares its row with the seal; keep text clear of it.
  beside: {
    marginBottom: space.xs,
  },
  badges: {
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xs,
  },
  facts: {
    backgroundColor: c.sheet,
    borderRadius: radius.md,
    borderWidth: size.hairline,
    borderColor: c.hairline,
    paddingVertical: space.md,
  },
  fact: {
    flex: 1,
    paddingHorizontal: space.sm,
    justifyContent: 'center',
    gap: space.xxs,
  },
  factWide: {
    flex: 1.5,
  },
  factDivider: {
    width: size.hairline,
    backgroundColor: c.hairline,
  },
  section: {
    gap: space.sm,
  },
  sectionHead: {
    gap: space.none,
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
    borderTopColor: c.hairline,
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
    backgroundColor: c.sheet,
    borderTopWidth: size.hairline,
    borderTopColor: c.hairline,
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
    backgroundColor: c.carmineWash,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  noticeText: {
    flex: 1,
  },
  noticeClose: {
    padding: space.xs,
  },
}));
