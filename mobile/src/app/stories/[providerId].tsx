import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Clock, WifiOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api';
import { CategoryIcon } from '@/components/CategoryIcon';
import { IconButton } from '@/components/IconButton';
import { Photo } from '@/components/Photo';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { isAllowedImage } from '@/lib/imageHosts';
import { takeStoryQueue } from '@/lib/storyQueue';
import { timeAgo } from '@/lib/time';
import { useAsync } from '@/lib/useAsync';
import { makeStyles, motion, opacity, radius, size, space, type TypeRole, useTheme } from '@/theme';

/** A press held this long is a pause, not a tap. */
const HOLD_MS = 220;

/** Short updates are set large, like a poster; long ones step down so they still fit. */
function roleFor(text: string): TypeRole {
  if (text.length <= 70) return 'poster';
  if (text.length <= 170) return 'display';
  return 'headline';
}

/**
 * One provider's updates, full screen: the page with one big block on it.
 * A written update is a alice-blue block with the words set large at the bottom;
 * an update with a photo is the photo, with the words on a white block over
 * its lower edge.
 *
 * Each update stays for about six seconds. A tap on the far side (the right, in
 * English) goes to the next one, a tap on the near side goes back, and holding
 * a finger down pauses. When the phone asks for reduced motion, or a screen
 * reader is on, nothing moves by itself: the user steps through.
 *
 * Opened from a stories row (Home's "Updates nearby", the Following feed), the
 * viewer goes on to the next provider in that row after the last update, and a
 * tap back on the first update goes to the previous provider. Opened from a
 * profile or a result card, it plays that one provider and closes.
 */
export default function StoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, f, row, rtl, start, end, alignStart, categoryName } = useI18n();
  const styles = useStyles();
  const { providerId, from } = useLocalSearchParams<{ providerId: string; from?: string }>();

  // The row's order of providers, when opened from a row (src/lib/storyQueue.ts); else null.
  const [queue] = useState(() => takeStoryQueue(providerId));
  // Which provider of the row is playing.
  const [position, setPosition] = useState(() => (queue ? queue.indexOf(providerId) : 0));
  const currentId = queue ? queue[position] : providerId;

  // The provider (name, photo) and their updates, asked for together.
  const load = useAsync(
    () =>
      Promise.all([api.getProvider(currentId), api.getProviderStories(currentId)]).then(
        ([provider, stories]) => ({ provider, stories: stories.items }),
      ),
    [currentId],
  );
  const stories = load.data?.stories ?? [];
  const count = stories.length;

  const [index, setIndex] = useState(0);
  // Goes up when the first update is asked to start again.
  const [run, setRun] = useState(0);
  const [held, setHeld] = useState(false);
  // Null until the phone has answered; true means "do not move by yourself".
  const [still, setStill] = useState<boolean | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  // How much of the current update has played (0 to 1), kept across a pause.
  const played = useRef(0);

  useEffect(() => {
    let current = true;
    Promise.all([AccessibilityInfo.isReduceMotionEnabled(), AccessibilityInfo.isScreenReaderEnabled()])
      .then(([reduced, reader]) => {
        // On web the screen-reader answer is always "yes", so only reduced motion counts there.
        if (current) setStill(reduced || (reader && Platform.OS !== 'web'));
      })
      .catch(() => {
        if (current) setStill(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  // Moves to another provider of the row, starting at their first update.
  const switchTo = useCallback((nextPosition: number) => {
    setPosition(nextPosition);
    setIndex(0);
  }, []);

  // After the last update: the next provider of the row, or close.
  const finish = useCallback(() => {
    if (queue && position < queue.length - 1) switchTo(position + 1);
    else close();
  }, [queue, position, switchTo, close]);

  // A provider of the row whose updates all expired since the row loaded is skipped.
  const emptyInRow = queue !== null && load.status === 'ready' && count === 0;
  useEffect(() => {
    if (!emptyInRow) return undefined;
    // Moved on right after this render, not inside it.
    const timer = setTimeout(finish, 0);
    return () => clearTimeout(timer);
  }, [emptyInRow, finish]);

  // A new update, a new provider or a restart begins from an empty bar.
  useEffect(() => {
    played.current = 0;
    progress.setValue(0);
  }, [index, run, currentId, progress]);

  // The timer: fills the bar, then moves on. Stopping it (a hold, or leaving) remembers where it was.
  useEffect(() => {
    if (count === 0 || still !== false || held) return undefined;
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.story * (1 - played.current),
      easing: Easing.linear,
      // The bar's width is animated, which the native driver cannot do.
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      if (index < count - 1) setIndex(index + 1);
      else finish();
    });
    return () => {
      progress.stopAnimation((value) => {
        played.current = value;
      });
    };
  }, [index, run, count, still, held, progress, finish]);

  const next = () => {
    if (index < count - 1) setIndex(index + 1);
    else finish();
  };
  const previous = () => {
    if (index > 0) setIndex(index - 1);
    // On the first update: back to the previous provider of the row, or start again.
    else if (queue && position > 0) switchTo(position - 1);
    else setRun((n) => n + 1);
  };

  if (load.status !== 'ready' || count === 0 || emptyInRow) {
    // Loading, failed, or every update has expired: a plain page with a way out.
    return (
      <View style={[styles.plain, { paddingTop: insets.top + space.xs }]}>
        <View style={[styles.plainBar, { flexDirection: row }]}>
          <IconButton icon={X} label={s.stories.close} onPress={close} />
        </View>
        {load.status === 'loading' || emptyInRow ? (
          <View style={styles.column} accessible accessibilityLabel={s.stories.loading} />
        ) : load.status === 'error' ? (
          <View style={styles.column}>
            <StateView
              alert
              icon={WifiOff}
              title={s.stories.errorTitle}
              body={s.results.errorBody}
              actionLabel={s.common.tryAgain}
              onAction={load.reload}
            />
          </View>
        ) : (
          <View style={styles.column}>
            <StateView
              icon={Clock}
              title={s.stories.emptyTitle}
              body={s.stories.emptyBody}
              actionLabel={s.stories.viewProfile}
              onAction={() => router.replace({ pathname: '/provider/[id]', params: { id: currentId } })}
            />
          </View>
        )}
      </View>
    );
  }

  const provider = load.data.provider;
  const story = stories[Math.min(index, count - 1)];
  const ForwardIcon = rtl ? ArrowLeft : ArrowRight;

  // Coming from the profile, "View profile" just goes back to it instead of opening a second copy.
  const viewProfile = () => {
    if (from === 'profile' && router.canGoBack()) router.back();
    else router.replace({ pathname: '/provider/[id]', params: { id: provider.id } });
  };

  const hold = {
    onPressIn: () => setHeld(true),
    onPressOut: () => setHeld(false),
    // With a long-press handler set, a held press does not also count as a tap.
    onLongPress: () => undefined,
    delayLongPress: HOLD_MS,
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <StatusBar style="dark" />
      <View style={[styles.column, styles.page]}>
        {/* One segment per update: full when seen, filling while it plays. */}
        <View
          style={[styles.bars, { flexDirection: row }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={f(s.stories.position, { i: index + 1, n: count })}
        >
          {stories.map((item, i) => (
            <View key={item.id} style={[styles.bar, { alignItems: alignStart }]}>
              {i < index || (i === index && still !== false) ? (
                <View style={[styles.barFill, styles.barFull]} />
              ) : i === index ? (
                <Animated.View
                  style={[
                    styles.barFill,
                    { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>

        <View style={[styles.head, { flexDirection: row }]}>
          <Photo
            uri={provider.cover_photo_url}
            fallbackIcon={provider.category.icon}
            fallbackIconSize={size.icon}
            style={styles.avatar}
          />
          <View style={styles.headWords}>
            <Txt role="title" numberOfLines={1} accessibilityRole="header" content>
              {provider.name}
            </Txt>
            <Txt role="label" color="textMuted" numberOfLines={1}>
              {timeAgo(story.created_at, s)} · {categoryName(provider.category)}
            </Txt>
          </View>
          <IconButton
            icon={X}
            label={s.stories.close}
            onPress={close}
            style={styles.closeButton}
          />
        </View>

        {/* The update itself. */}
        <View style={[styles.block, held ? styles.blockHeld : null]}>
          {/* A picture only from our own storage; any other link is shown as a written update. */}
          {isAllowedImage(story.image_url) ? (
            <>
              <Image
                source={{ uri: story.image_url }}
                style={styles.image}
                contentFit="cover"
                transition={motion.base}
              />
              <View style={styles.caption} accessibilityLiveRegion="polite">
                <Txt role={story.text.length <= 70 ? 'headline' : 'title'} content="block">
                  {story.text}
                </Txt>
              </View>
            </>
          ) : (
            <View style={styles.written}>
              <View style={[styles.mark, { alignSelf: alignStart }]}>
                <CategoryIcon icon={provider.category.icon} color={colors.onHero} size={size.iconLarge} />
              </View>
              <View accessibilityLiveRegion="polite">
                <Txt role={roleFor(story.text)} color="onHero" content="block">
                  {story.text}
                </Txt>
              </View>
            </View>
          )}

          {/* Two invisible buttons over the block: the near third goes back, the rest goes on. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={s.stories.previous}
            onPress={previous}
            {...hold}
            style={[styles.zone, styles.zoneBack, start(0)]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={s.stories.next}
            onPress={next}
            {...hold}
            style={[styles.zone, styles.zoneNext, end(0)]}
          />
        </View>

        <View style={[styles.foot, { flexDirection: row }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${s.stories.viewProfile}, ${provider.name}`}
            onPress={viewProfile}
            style={({ pressed }) => [styles.profile, { flexDirection: row }, pressed ? styles.dim : null]}
          >
            <Txt role="action" color="onPrimary">
              {s.stories.viewProfile}
            </Txt>
            <ForwardIcon color={colors.onPrimary} size={size.icon} strokeWidth={size.lineBold} />
          </Pressable>
          {still === false ? (
            <Txt role="label" color="textMuted" style={styles.hint} numberOfLines={1}>
              {held ? s.stories.paused : s.stories.holdHint}
            </Txt>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
    paddingHorizontal: space.md,
  },
  plain: {
    flex: 1,
    backgroundColor: c.background,
  },
  plainBar: {
    paddingHorizontal: space.sm,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  page: {
    flex: 1,
    gap: space.md,
  },
  bars: {
    gap: space.xs,
    paddingHorizontal: space.xs,
  },
  bar: {
    flex: 1,
    height: size.storyBar,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTintStrong,
    overflow: 'hidden',
  },
  barFill: {
    height: size.storyBar,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
  },
  barFull: {
    width: '100%',
  },
  head: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xs,
  },
  avatar: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: radius.md,
  },
  headWords: {
    flex: 1,
    minWidth: 0,
  },
  closeButton: {
    backgroundColor: c.surfaceTint,
  },
  block: {
    flex: 1,
    borderRadius: radius.sheet,
    backgroundColor: c.hero,
    overflow: 'hidden',
  },
  // Held: the block dims a little, so the pause is seen as well as felt.
  blockHeld: {
    opacity: opacity.pressed,
  },
  written: {
    flex: 1,
    justifyContent: 'space-between',
    padding: space.xxl,
    gap: space.xl,
  },
  // The provider's category on a see-through white square inside the alice-blue block.
  mark: {
    width: size.tileIconBox,
    height: size.tileIconBox,
    borderRadius: radius.md,
    backgroundColor: c.heroControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  caption: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: space.sm,
    borderRadius: radius.lg - space.xs,
    backgroundColor: c.surface,
    padding: space.xl,
  },
  zone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  zoneBack: {
    width: '32%',
  },
  zoneNext: {
    width: '68%',
  },
  foot: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  profile: {
    alignItems: 'center',
    gap: space.sm,
    minHeight: size.touch,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
  },
  hint: {
    flexShrink: 1,
    paddingHorizontal: space.sm,
  },
  dim: {
    opacity: opacity.pressed,
  },
}));
