import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Store, UserRound, WifiOff } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ProviderSummary, type StoryGroup } from '@/api';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Field';
import { IconButton } from '@/components/IconButton';
import { ProviderCard } from '@/components/ProviderCard';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { StoriesStrip } from '@/components/StoriesRow';
import { TextLink } from '@/components/TextLink';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { requireSignIn, signOut, useAuth } from '@/lib/auth';
import { elevation, makeStyles, radius, size, space, useTheme } from '@/theme';

interface Loaded {
  feed: StoryGroup[];
  following: ProviderSummary[];
  total: number;
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Loaded };

/** Followed providers come 20 at a time (the founder's paging rule). */
const PAGE = 20;
/** The API's largest page (docs/API.md, GET /me/following). */
const PAGE_MAX = 100;

/**
 * "Following": the updates of the providers you follow, the providers
 * themselves, and your account (email, My business, Sign out).
 * Signed out, it explains what following is for and offers sign-in.
 */
export default function FollowingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dark } = useTheme();
  const { s, row, rtl } = useI18n();
  const styles = useStyles();
  const auth = useAuth();

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[styles.column, styles.bar, { flexDirection: row }]}>
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
        <Txt role="headline" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {s.account.title}
        </Txt>
      </View>

      {auth.status === 'signedOut' ? (
        <View style={styles.column}>
          <StateView
            icon={UserRound}
            title={s.account.signedOutTitle}
            body={s.account.signedOutBody}
            actionLabel={s.account.signIn}
            onAction={() => requireSignIn()}
          />
        </View>
      ) : null}

      {/* A new user gets a fresh screen, so nothing of the last account stays on it. */}
      {auth.status === 'signedIn' ? <SignedIn key={auth.userId ?? 'dev'} /> : null}
    </View>
  );
}

function SignedIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, row, rtl } = useI18n();
  const styles = useStyles();
  const auth = useAuth();

  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  // Loading the next 20 at the end of the list: idle, busy, or failed (with Try again).
  const [more, setMore] = useState<'idle' | 'loading' | 'error'>('idle');
  // Each load has a number; only the newest one may change the screen.
  const run = useRef(0);
  // How many providers are on screen, so a reload brings back as many (not just the first 20).
  const shown = useRef(0);

  const fetchAll = useCallback(async (mode: 'first' | 'refresh' | 'quiet') => {
    const mine = ++run.current;
    if (mode === 'refresh') setRefreshing(true);
    setMore('idle');
    const limit = mode === 'first' ? PAGE : Math.min(Math.max(shown.current, PAGE), PAGE_MAX);
    try {
      const [feed, following] = await Promise.all([api.getMyFeed(), api.getMyFollowing({ limit })]);
      if (mine !== run.current) return;
      shown.current = following.items.length;
      setLoad({
        status: 'ready',
        data: {
          feed: feed.items.filter((group) => group.stories.length > 0),
          following: following.items,
          total: following.total,
        },
      });
    } catch {
      // A quiet reload (coming back to the screen) keeps what is shown if it fails.
      if (mine === run.current && mode !== 'quiet') setLoad({ status: 'error' });
    } finally {
      if (mine === run.current) setRefreshing(false);
    }
  }, []);

  /** The next 20. Safe to call often (FlatList's onEndReached): it ignores calls while busy or done. */
  const loadMore = async () => {
    if (load.status !== 'ready' || more === 'loading') return;
    const { following, total } = load.data;
    if (following.length >= total) return;
    const mine = run.current;
    setMore('loading');
    try {
      const page = await api.getMyFollowing({ limit: PAGE, offset: following.length });
      if (mine !== run.current) return;
      setLoad((current) => {
        if (current.status !== 'ready') return current;
        // Someone followed in between can shift the pages; never show a card twice.
        const seen = new Set(current.data.following.map((provider) => provider.id));
        const added = page.items.filter((provider) => !seen.has(provider.id));
        const list = [...current.data.following, ...added];
        shown.current = list.length;
        // Nothing new although the total says more: stop here instead of asking forever.
        const newTotal = added.length === 0 ? list.length : page.total;
        return { status: 'ready', data: { ...current.data, following: list, total: newTotal } };
      });
      setMore('idle');
    } catch {
      if (mine === run.current) setMore('error');
    }
  };

  // Loads when the screen opens, and again quietly each time the user comes back
  // to it (they may have followed someone on a profile in between).
  const firstDone = useRef(false);
  useFocusEffect(
    useCallback(() => {
      void fetchAll(firstDone.current ? 'quiet' : 'first');
      firstDone.current = true;
    }, [fetchAll]),
  );

  const openProfile = (provider: ProviderSummary) =>
    router.push({ pathname: '/provider/[id]', params: { id: provider.id } });
  const openStories = (provider: ProviderSummary) =>
    router.push({ pathname: '/stories/[providerId]', params: { providerId: provider.id } });
  const Chevron = rtl ? ChevronLeft : ChevronRight;

  const leave = async () => {
    await signOut();
    AccessibilityInfo.announceForAccessibility(s.account.signedOut);
  };

  // The account: who is signed in, the way to My business, and Sign out.
  const account = (
    <View style={styles.account}>
      <View style={[styles.accountTop, { flexDirection: row }]}>
        <View style={styles.flex}>
          <Txt role="caption" color="textSubtle">
            {s.account.signedInAs}
          </Txt>
          <Txt role="bodyStrong" numberOfLines={1} ltr={auth.email !== null}>
            {auth.email ?? s.account.devAccount}
          </Txt>
        </View>
        <Button label={s.account.signOut} onPress={() => void leave()} variant="tonal" compact />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${s.account.myBusiness}, ${s.account.myBusinessHint}`}
        onPress={() => router.push('/my-business')}
        android_ripple={{ color: colors.surfaceTintStrong }}
        style={({ pressed }) => [styles.business, { flexDirection: row }, pressed ? styles.businessPressed : null]}
      >
        <View style={styles.businessIcon}>
          <Store color={colors.onAccent} size={size.icon} strokeWidth={size.stroke} />
        </View>
        <View style={styles.flex}>
          <Txt role="action" color="onAccent">
            {s.account.myBusiness}
          </Txt>
          <Txt role="label" color="onAccent">
            {s.account.myBusinessHint}
          </Txt>
        </View>
        <Chevron color={colors.onAccent} size={size.icon} strokeWidth={size.stroke} />
      </Pressable>
      <TextLink label={s.account.settings} onPress={() => router.push('/account')} style={styles.settings} />
    </View>
  );

  if (load.status === 'loading') {
    return (
      <View style={[styles.column, styles.page]} accessible accessibilityLabel={s.stories.loading}>
        {account}
        <Skeleton width="40%" height={space.xxl} />
        <View style={[styles.skeletonRow, { flexDirection: row }]}>
          <Skeleton width={size.storyBubble} height={size.storyBubble} round={radius.md + space.xs} />
          <Skeleton width={size.storyBubble} height={size.storyBubble} round={radius.md + space.xs} />
          <Skeleton width={size.storyBubble} height={size.storyBubble} round={radius.md + space.xs} />
        </View>
        <Skeleton height={size.thumb + space.huge} round={radius.lg} />
        <Skeleton height={size.thumb + space.huge} round={radius.lg} />
      </View>
    );
  }

  if (load.status === 'error') {
    return (
      <ScrollView contentContainerStyle={[styles.column, styles.page]}>
        {account}
        <StateView
          icon={WifiOff}
          title={s.account.errorTitle}
          body={s.account.errorBody}
          actionLabel={s.common.tryAgain}
          onAction={() => {
            setLoad({ status: 'loading' });
            void fetchAll('first');
          }}
        />
      </ScrollView>
    );
  }

  const { feed, following, total } = load.data;
  const hasMore = following.length < total;

  // The account, the updates and the section title scroll above the cards.
  const header = (
    <View style={[styles.page, styles.headerEnd]}>
      {account}
      {following.length === 0 ? (
        <StateView
          icon={UserRound}
          title={s.account.emptyTitle}
          body={s.account.emptyBody}
          actionLabel={s.account.emptyAction}
          onAction={() => (router.canGoBack() ? router.dismissTo('/') : router.replace('/'))}
        />
      ) : (
        <>
          {feed.length > 0 ? (
            <StoriesStrip title={s.account.updates} groups={feed} onOpen={openStories} />
          ) : (
            <View style={styles.section}>
              <Txt role="headline" accessibilityRole="header">
                {s.account.updates}
              </Txt>
              <Notice tone="info">{s.account.noUpdates}</Notice>
            </View>
          )}
          <View style={[styles.sectionHead, { flexDirection: row }]}>
            <Txt role="headline" accessibilityRole="header" style={styles.flex}>
              {s.account.providers}
            </Txt>
            <Txt role="data" color="textMuted" ltr>
              {total}
            </Txt>
          </View>
        </>
      )}
    </View>
  );

  return (
    <FlatList
      data={following}
      keyExtractor={(provider) => provider.id}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <ProviderCard
            provider={item}
            plain
            onPress={() => openProfile(item)}
            onOpenStory={() => openStories(item)}
          />
        </View>
      )}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      // The next 20 when the user is half a screen from the end.
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        more === 'error' ? (
          <View style={styles.footer} accessibilityRole="alert">
            <Txt role="label" color="textMuted" center>
              {s.results.moreError}
            </Txt>
            <Button label={s.common.tryAgain} variant="outline" compact onPress={() => void loadMore()} />
          </View>
        ) : more === 'loading' || hasMore ? (
          <View style={styles.footer} accessible accessibilityLabel={s.results.loadingMore}>
            <ActivityIndicator size="small" color={colors.textMuted} />
          </View>
        ) : undefined
      }
      contentContainerStyle={[styles.column, { paddingBottom: insets.bottom + space.xxl }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void fetchAll('refresh')}
          colors={[colors.primary]}
          tintColor={colors.primary}
          progressBackgroundColor={colors.surface}
        />
      }
    />
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  bar: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  title: {
    flex: 1,
  },
  page: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    gap: space.xxl,
  },
  // A white tile: the email and Sign out on one line, My business under it as a alice-blue block.
  account: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.sm,
    gap: space.sm,
    boxShadow: elevation.card,
  },
  accountTop: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
  },
  // Quiet, under the big My business button.
  settings: {
    alignSelf: 'center',
  },
  business: {
    alignItems: 'center',
    gap: space.md,
    minHeight: size.touch + space.xxl,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: c.accent,
    overflow: 'hidden',
  },
  businessPressed: {
    backgroundColor: c.accentSoft,
  },
  businessIcon: {
    width: size.tileIconBox,
    height: size.tileIconBox,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: space.md,
  },
  // Space between the section title and the first card.
  headerEnd: {
    paddingBottom: space.md,
  },
  // Each card lines up with the page edge, like the blocks above it.
  item: {
    paddingHorizontal: space.lg,
  },
  separator: {
    height: space.md,
  },
  footer: {
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.lg,
  },
  sectionHead: {
    alignItems: 'baseline',
    gap: space.sm,
  },
  skeletonRow: {
    gap: space.md,
  },
}));
