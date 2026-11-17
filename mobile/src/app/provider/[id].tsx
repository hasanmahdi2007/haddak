import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  ArrowRight,
  Badge,
  BadgeCheck,
  Banknote,
  Check,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  Share2,
  Star,
  Users,
  UserX,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ContactEventType, type OpeningHours, type ProviderDetail } from '@/api';
import { AvailableTag, FeaturedTag, FoundingBadge, SponsoredTag } from '@/components/Badges';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { OfferBlock } from '@/components/OfferBlock';
import { OpenStatus } from '@/components/OpenStatus';
import { Photo } from '@/components/Photo';
import { ProviderReviews } from '@/components/ProviderReviews';
import { ReportSheet } from '@/components/ReportSheet';
import { ShareProfile } from '@/components/ShareProfile';
import { Sheet } from '@/components/Sheet';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { StoryRing } from '@/components/StoryRing';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { directionsUrl, telUrl, whatsappUrl } from '@/lib/links';
import { useFavourites } from '@/lib/favourites';
import { DAY_KEYS, dayKeyOf, to12Hour } from '@/lib/hours';
import { useLocation } from '@/lib/location';
import { requireSignIn, useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { elevation, makeStyles, motion, opacity, radius, size, space, useTheme } from '@/theme';

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

/**
 * The week from Monday to Sunday, with today marked and the open / closed status
 * beside the title. A day with a break shows its periods one under the other.
 */
function OpeningHoursSection({ hours, open }: { hours: OpeningHours; open: boolean | null }) {
  const { s, f, row, alignStart } = useI18n();
  const styles = useStyles();
  // Read the clock once, when the section first shows.
  const [today] = useState(() => dayKeyOf(new Date()));
  const alignEnd = alignStart === 'flex-start' ? 'flex-end' : 'flex-start';

  // "15:00" -> "3:00 PM", or "3:00 م" in Arabic.
  const clock = (time: string) => {
    const { h, mm, pm } = to12Hour(time);
    return f(s.hours.time, { h, mm, period: pm ? s.hours.pm : s.hours.am });
  };

  return (
    <View style={styles.section}>
      <View style={[styles.hoursHead, { flexDirection: row }]}>
        <Txt role="title" accessibilityRole="header" style={styles.sectionTitle}>
          {s.hours.title}
        </Txt>
        <OpenStatus open={open} role="data" />
      </View>

      <View>
        {DAY_KEYS.map((day) => {
          const ranges = hours[day] ?? [];
          const isToday = day === today;
          const spoken = [
            s.hours.days[day],
            isToday ? s.hours.today : null,
            ranges.length === 0
              ? s.hours.closedDay
              : ranges
                  .map(([from, to]) => f(s.hours.range, { open: clock(from), close: clock(to) }))
                  .join(', '),
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <View
              key={day}
              accessible
              accessibilityLabel={spoken}
              style={[styles.hoursRow, { flexDirection: row }, isToday ? styles.hoursToday : null]}
            >
              <View style={[styles.hoursDay, { flexDirection: row }]}>
                <Txt role={isToday ? 'bodyStrong' : 'body'}>{s.hours.days[day]}</Txt>
                {isToday ? (
                  <Txt role="caption" color="onPrimarySoft">
                    {s.hours.today}
                  </Txt>
                ) : null}
              </View>
              <View style={{ alignItems: alignEnd }}>
                {ranges.length === 0 ? (
                  <Txt role="data" color="textMuted">
                    {s.hours.closedDay}
                  </Txt>
                ) : (
                  // Each time is its own piece of text in a row that follows the reading
                  // direction, so in Arabic the opening time is on the right, as it is read.
                  ranges.map(([from, to]) => (
                    <View key={from} style={[styles.hoursRange, { flexDirection: row }]}>
                      <Txt role={isToday ? 'bodyStrong' : 'data'}>{clock(from)}</Txt>
                      <Txt role="data" color="textMuted">
                        –
                      </Txt>
                      <Txt role={isToday ? 'bodyStrong' : 'data'}>{clock(to)}</Txt>
                    </View>
                  ))
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function ProviderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { colors, dark } = useTheme();
  const { s, f, row, rtl, plural, categoryName, distance } = useI18n();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coords, status: locationStatus } = useLocation();
  const [notice, setNotice] = useState<string | null>(null);
  const auth = useAuth();
  // What the Follow pill shows right after a tap, before the server has answered.
  // Tied to the loaded profile object, so a reload brings back the server's numbers.
  const [followView, setFollowView] = useState<{
    base: ProviderDetail;
    following: boolean;
    count: number;
  } | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  // The rating after the user wrote or deleted a review, fetched quietly (no skeleton).
  // Tied to the loaded profile object like the Follow pill, so a reload starts clean.
  const [rated, setRated] = useState<{
    base: ProviderDetail;
    avg_rating: number;
    review_count: number;
  } | null>(null);
  const [sheet, setSheet] = useState<'share' | 'report' | null>(null);
  const favourites = useFavourites();
  const saved = favourites.isFavourite(id);
  // Scale of the heart; kept in state so the same value lives for the whole screen.
  const [pulse] = useState(() => new Animated.Value(1));
  // How far the page is scrolled; drives the solid bar behind the top controls.
  const [scrollY] = useState(() => new Animated.Value(0));

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

  // After a review was written, changed or deleted: the new average and count.
  const refreshRating = (base: ProviderDetail) => {
    api
      .getProvider(base.id, from)
      .then((fresh) =>
        setRated({ base, avg_rating: fresh.avg_rating, review_count: fresh.review_count }),
      )
      .catch(() => undefined);
  };

  const openStories = (target: ProviderDetail) =>
    router.push({ pathname: '/stories/[providerId]', params: { providerId: target.id, from: 'profile' } });

  // Following needs an account. Signed out, sign-in opens first and the follow
  // happens when it closes; then the profile reloads with the real count.
  // Signed in, the pill and the count change at once and go back if the request fails.
  const follow = async (target: ProviderDetail, following: boolean, count: number) => {
    if (
      !requireSignIn(() => {
        api
          .followProvider(target.id)
          .then(() => {
            AccessibilityInfo.announceForAccessibility(s.follow.following);
            load.reload();
          })
          .catch(() => setNotice(s.follow.failed));
      })
    ) {
      return;
    }
    if (followBusy) return;
    const next = !following;
    setFollowView({ base: target, following: next, count: Math.max(0, count + (next ? 1 : -1)) });
    setFollowBusy(true);
    setNotice(null);
    try {
      if (next) await api.followProvider(target.id);
      else await api.unfollowProvider(target.id);
      AccessibilityInfo.announceForAccessibility(next ? s.follow.following : s.follow.follow);
    } catch {
      setFollowView({ base: target, following, count });
      setNotice(s.follow.failed);
    } finally {
      setFollowBusy(false);
    }
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

  // The profile as shown: the loaded one, with a fresher rating after a review.
  const shown: ProviderDetail =
    rated && rated.base === provider
      ? { ...provider, avg_rating: rated.avg_rating, review_count: rated.review_count }
      : provider;
  const hasPhotos = provider.photos.length > 0;
  // On the mint block every word is dark, whatever the theme.
  const heroText = provider.verified ? 'onMint' : 'text';
  const heroMuted = provider.verified ? 'onMint' : 'textMuted';
  const TrustIcon = provider.verified ? BadgeCheck : Badge;
  // Shown only when the provider chose to, and only when there is something to say.
  const shownContacts = provider.contacts_this_month ?? 0;
  const pending = followView && followView.base === provider ? followView : null;
  // Signed out (for example after signing out elsewhere), nobody is "following".
  const isFollowing = auth.status === 'signedIn' && (pending?.following ?? provider.is_following);
  const followerCount = pending?.count ?? provider.follower_count;
  // The bar covers the status bar area and the row of round buttons.
  const barHeight = insets.top + space.sm * 2 + size.touch;
  // Fully solid when the white sheet's top edge reaches the bottom of the bar.
  const barFadeEnd = Math.max(space.xxl, galleryHeight - size.sheetOverlap - barHeight);

  return (
    <View style={styles.screen}>
      <StatusBar style={hasPhotos || dark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
      >
        <View style={styles.column}>
          <Gallery provider={provider} width={width} />

          {/* The page rises over the photo with round top corners. */}
          <View style={styles.body}>
            {/* The hero block: mint when Haddak has verified this provider, grey when it has not.
                Text on mint is dark in both themes. */}
            <View style={[styles.hero, provider.verified ? styles.heroVerified : null]}>
              <View style={[styles.heroHead, { flexDirection: row }]}>
                <View style={styles.trustText}>
                  <Txt role="label" color={heroMuted}>
                    {categoryName(provider.category)} · {provider.area_name}
                  </Txt>
                  <Txt role="display" color={heroText} accessibilityRole="header" content>
                    {provider.name}
                  </Txt>
                </View>
                {/* The provider posted an update: their photo, ringed, opens it. */}
                {provider.has_active_story ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={f(s.stories.open, { name: provider.name })}
                    accessibilityHint={s.stories.openHint}
                    onPress={() => openStories(provider)}
                    style={({ pressed }) => (pressed ? styles.dim : null)}
                  >
                    <StoryRing
                      active
                      box={size.avatarLarge}
                      round={radius.md}
                      tone={provider.verified ? 'ink' : 'accent'}
                    >
                      <Photo
                        uri={provider.cover_photo_url}
                        fallbackIcon={provider.category.icon}
                        fallbackIconSize={size.icon}
                        style={styles.fill}
                      />
                    </StoryRing>
                  </Pressable>
                ) : null}
              </View>

              {/* A sponsored profile carries the sponsor's own line. */}
              {provider.sponsored && provider.sponsor_hook ? (
                <Txt role="bodyStrong" color={heroText} content="block">
                  {provider.sponsor_hook}
                </Txt>
              ) : null}

              <View
                style={[styles.trust, { flexDirection: row }]}
                accessible
                accessibilityLabel={
                  provider.verified
                    ? `${s.badges.verified}. ${s.badges.verifiedBody}`
                    : `${s.badges.notVerified}. ${s.badges.notVerifiedBody}`
                }
              >
                <View style={[styles.trustDisc, provider.verified ? styles.trustDiscOn : null]}>
                  <TrustIcon
                    color={provider.verified ? colors.mint : colors.text}
                    size={size.iconLarge}
                    strokeWidth={size.lineBold}
                  />
                </View>
                <View style={styles.trustText}>
                  <Txt role="bodyStrong" color={heroText}>
                    {provider.verified ? s.badges.verified : s.badges.notVerified}
                  </Txt>
                  <Txt role="label" color={heroMuted}>
                    {provider.verified ? s.badges.verifiedBody : s.badges.notVerifiedBody}
                  </Txt>
                </View>
              </View>

              {/* Nobody owns this listing yet: it came from a suggestion. */}
              {provider.claimed ? null : (
                <View style={[styles.trust, { flexDirection: row }]}>
                  <View style={styles.trustDisc}>
                    <Users color={colors.text} size={size.icon} strokeWidth={size.stroke} />
                  </View>
                  <View style={styles.trustText}>
                    <Txt role="bodyStrong" color={heroText}>
                      {s.badges.community}
                    </Txt>
                    <Txt role="label" color={heroMuted}>
                      {s.badges.communityBody}
                    </Txt>
                  </View>
                </View>
              )}
            </View>

            {/* Followers, and the Follow pill (signed out, it opens sign-in first). */}
            <View style={[styles.followRow, { flexDirection: row }]}>
              <View style={[styles.contactCount, styles.trustText, { flexDirection: row }]}>
                <Users color={colors.textSubtle} size={size.iconSmall} strokeWidth={size.stroke} />
                <Txt role="label" color="textMuted" style={styles.trustText}>
                  {plural(s.follow.count, followerCount)}
                </Txt>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isFollowing
                    ? f(s.follow.unfollowLabel, { name: provider.name })
                    : f(s.follow.followLabel, { name: provider.name })
                }
                accessibilityState={{ selected: isFollowing, busy: followBusy }}
                onPress={() => void follow(provider, isFollowing, followerCount)}
                // 40 dp to the eye; hitSlop makes the touch target 48.
                hitSlop={space.xs}
                android_ripple={{ color: colors.surfaceTintStrong }}
                style={({ pressed }) => [
                  styles.follow,
                  { flexDirection: row },
                  isFollowing ? styles.following : null,
                  pressed ? styles.dim : null,
                ]}
              >
                {isFollowing ? (
                  <Check color={colors.text} size={size.iconSmall} strokeWidth={size.strokeBold} />
                ) : (
                  <Plus color={colors.onPrimary} size={size.iconSmall} strokeWidth={size.strokeBold} />
                )}
                <Txt role="action" color={isFollowing ? 'text' : 'onPrimary'}>
                  {isFollowing ? s.follow.following : s.follow.follow}
                </Txt>
              </Pressable>
            </View>

            {provider.active_banner ? <OfferBlock banner={provider.active_banner} /> : null}

            {provider.available_now || provider.sponsored || provider.featured || provider.founding_member || shownContacts > 0 ? (
            <View style={styles.extras}>
              {provider.available_now || provider.sponsored || provider.featured || provider.founding_member ? (
                <View style={[styles.badges, { flexDirection: row }]}>
                  {provider.available_now ? <AvailableTag /> : null}
                  {provider.sponsored ? <SponsoredTag /> : null}
                  {provider.featured ? <FeaturedTag /> : null}
                  {provider.founding_member ? <FoundingBadge /> : null}
                </View>
              ) : null}

              {shownContacts > 0 ? (
                <View style={[styles.contactCount, { flexDirection: row }]}>
                  <Users color={colors.textSubtle} size={size.iconSmall} strokeWidth={size.stroke} />
                  <Txt role="label" color="textMuted" style={styles.trustText}>
                    {plural(s.provider.contactCount, shownContacts)}
                  </Txt>
                </View>
              ) : null}
            </View>
            ) : null}

            {/* Rating, distance, price: three blocks, in the same order as on a result card. */}
            <View style={[styles.facts, { flexDirection: row }]}>
              <View
                style={styles.fact}
                accessible
                accessibilityLabel={[
                  plural(s.rating.label, shown.review_count, { rating: shown.avg_rating.toFixed(1) }),
                  provider.confirmed_hires > 0 ? plural(s.hire.confirmed, provider.confirmed_hires) : null,
                ]
                  .filter(Boolean)
                  .join('. ')}
              >
                <View style={[styles.factValue, { flexDirection: row }]}>
                  {shown.review_count > 0 ? (
                    <Star color={colors.rating} fill={colors.rating} size={size.iconSmall} />
                  ) : null}
                  <Txt role="title">
                    {shown.review_count > 0 ? shown.avg_rating.toFixed(1) : s.rating.none}
                  </Txt>
                </View>
                <Txt role="caption" color="textMuted" center>
                  {s.provider.rating}
                </Txt>
                {/* "Did you hire them?" answers from the last 90 days, shown only when there are some. */}
                {provider.confirmed_hires > 0 ? (
                  <Txt role="caption" color="onPrimarySoft" center style={styles.hires}>
                    {plural(s.hire.confirmed, provider.confirmed_hires)}
                  </Txt>
                ) : null}
              </View>
              {provider.distance_m !== null ? (
                <>
                  <View style={[styles.fact, styles.factDivided]} accessible>
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
              <View style={[styles.fact, styles.factWide, styles.factDivided]} accessible>
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

            {provider.opening_hours ? (
              <OpeningHoursSection hours={provider.opening_hours} open={provider.open_now} />
            ) : null}

            {provider.description ? (
              <View style={styles.section}>
                <Txt role="title" accessibilityRole="header">
                  {s.provider.about}
                </Txt>
                <Txt content="block">{provider.description}</Txt>
              </View>
            ) : null}

            <ProviderReviews provider={shown} onChanged={() => refreshRating(provider)} />

            {/* Reporting is rare, so it is a quiet line at the very end, not a button. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={s.report.open}
              onPress={() => setSheet('report')}
              style={({ pressed }) => [styles.reportLink, { flexDirection: row }, pressed ? styles.dim : null]}
            >
              <Flag color={colors.textMuted} size={size.iconSmall} strokeWidth={size.stroke} />
              <Txt role="label" color="textMuted" style={styles.reportText}>
                {s.report.open}
              </Txt>
            </Pressable>
          </View>

        </View>
      </ScrollView>

      {/* Once the photo has scrolled away, a solid bar fades in behind the controls
          so they never sit on top of the text. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.overlayBacking,
          {
            height: barHeight,
            opacity: scrollY.interpolate({
              inputRange: [Math.max(0, barFadeEnd - space.xxl), barFadeEnd],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />

      {/* Controls over the photo. */}
      <View
        style={[styles.overlayBar, { top: insets.top + space.sm, flexDirection: row }]}
        pointerEvents="box-none"
      >
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} tone="scrim" />
        <View style={[styles.overlayGroup, { flexDirection: row }]}>
          {/* The heart: outline when not saved, filled lavender when saved. It swells for a moment on a tap. */}
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
          <IconButton icon={Share2} label={s.provider.share} onPress={() => setSheet('share')} tone="scrim" />
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
              compact
              onPress={() => void contact('whatsapp', provider)}
              style={styles.actionPrimary}
            />
            <Button
              label={s.provider.call}
              accessibilityLabel={f(s.provider.callLabel, { name: provider.name })}
              icon={Phone}
              variant="primary"
              compact
              onPress={() => void contact('call', provider)}
              style={styles.actionSecondary}
            />
            <Button
              label={s.provider.directions}
              accessibilityLabel={f(s.provider.directionsLabel, { name: provider.name })}
              icon={Navigation}
              variant="white"
              compact
              onPress={() => void directions(provider)}
              style={styles.actionPrimary}
            />
          </View>
        </View>
      </View>

      {sheet === 'share' ? (
        <Sheet title={s.share.title} closeLabel={s.share.close} onClose={() => setSheet(null)}>
          <Txt color="textMuted">{s.share.intro}</Txt>
          <ShareProfile
            slug={provider.slug}
            name={provider.name}
            onPoster={() => {
              setSheet(null);
              router.push({ pathname: '/poster/[slug]', params: { slug: provider.slug } });
            }}
          />
        </Sheet>
      ) : null}
      {sheet === 'report' ? (
        <ReportSheet providerId={provider.id} name={provider.name} onClose={() => setSheet(null)} />
      ) : null}
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
  overlayBacking: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: c.background,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
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
  body: {
    marginTop: -size.sheetOverlap,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: c.background,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
  },
  hero: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.xs,
    boxShadow: elevation.card,
  },
  heroVerified: {
    backgroundColor: c.mint,
  },
  heroHead: {
    alignItems: 'flex-start',
    gap: space.md,
  },
  fill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  dim: {
    opacity: opacity.pressed,
  },
  followRow: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xs,
  },
  // The Follow pill: ink; grey once following.
  follow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + space.xxs,
    minHeight: size.segment + space.xs,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    overflow: 'hidden',
  },
  following: {
    backgroundColor: c.surface,
  },
  trust: {
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
  },
  // The round mark beside a trust line: ink with a mint badge when verified, grey otherwise.
  trustDisc: {
    width: size.trustDisc,
    height: size.trustDisc,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTintStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustDiscOn: {
    backgroundColor: c.onMint,
  },
  trustText: {
    flex: 1,
    minWidth: 0,
  },
  extras: {
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  badges: {
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  contactCount: {
    alignItems: 'center',
    gap: space.sm,
  },
  hoursHead: {
    alignItems: 'center',
    gap: space.md,
  },
  hoursRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  // Today: a faint lavender band inside the white card, heavier text and the word "Today".
  hoursToday: {
    backgroundColor: c.surfaceInset,
  },
  hoursDay: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
  },
  hoursRange: {
    alignItems: 'center',
    gap: space.xs,
  },
  // The three facts share one white card, split by hairlines: one box instead of three.
  facts: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    boxShadow: elevation.card,
  },
  fact: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
  },
  // borderStart follows the reading direction, so the hairline mirrors in Arabic.
  factDivided: {
    borderStartWidth: size.hairline,
    borderColor: c.divider,
  },
  factWide: {
    flex: 1.5,
  },
  hires: {
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: c.primarySoft,
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
  // Each section is a white card with the one soft shadow.
  section: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    boxShadow: elevation.card,
  },
  sectionTitle: {
    flex: 1,
  },
  reportLink: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: space.sm,
    minHeight: size.touch,
    paddingHorizontal: space.lg,
  },
  reportText: {
    textDecorationLine: 'underline',
  },
  dock: {
    backgroundColor: c.background,
    borderTopWidth: size.hairline,
    borderTopColor: c.divider,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  dockInner: {
    gap: space.sm,
  },
  actions: {
    gap: space.sm,
  },
  // Each button is as wide as its words need, and they share what is left over.
  actionPrimary: {
    flexGrow: 1,
  },
  actionSecondary: {
    flexGrow: 1,
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
