import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Store, UserRound, WifiOff } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ProviderSummary, type StoryGroup } from '@/api';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Field';
import { IconButton } from '@/components/IconButton';
import { ProviderCard } from '@/components/ProviderCard';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { StoriesStrip } from '@/components/StoriesRow';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { requireSignIn, signOut, useAuth } from '@/lib/auth';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

interface Loaded {
  feed: StoryGroup[];
  following: ProviderSummary[];
  total: number;
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Loaded };

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
        <Txt role="display" accessibilityRole="header" numberOfLines={1} style={styles.title}>
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
  // Each load has a number; only the newest one may change the screen.
  const run = useRef(0);

  const fetchAll = useCallback(async (mode: 'first' | 'refresh' | 'quiet') => {
    const mine = ++run.current;
    if (mode === 'refresh') setRefreshing(true);
    try {
      const [feed, following] = await Promise.all([api.getMyFeed(), api.getMyFollowing({ limit: 100 })]);
      if (mine !== run.current) return;
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

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void fetchAll('refresh')}
          colors={[colors.primary]}
          tintColor={colors.primary}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <View style={[styles.column, styles.page]}>
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

            <View style={styles.section}>
              <View style={[styles.sectionHead, { flexDirection: row }]}>
                <Txt role="headline" accessibilityRole="header" style={styles.flex}>
                  {s.account.providers}
                </Txt>
                <Txt role="data" color="textMuted" ltr>
                  {total}
                </Txt>
              </View>
              {following.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  plain
                  onPress={() => openProfile(provider)}
                  onOpenStory={() => openStories(provider)}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
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
  // A white tile: the email and Sign out on one line, My business under it as a lavender block.
  account: {
    backgroundColor: c.surface,
    borderRadius: radius.sheet,
    padding: space.sm,
    gap: space.sm,
  },
  accountTop: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
  },
  business: {
    alignItems: 'center',
    gap: space.md,
    minHeight: size.touch + space.xxl,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.lg,
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
  sectionHead: {
    alignItems: 'baseline',
    gap: space.sm,
  },
  skeletonRow: {
    gap: space.md,
  },
}));
