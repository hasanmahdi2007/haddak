import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { api, type Coordinates, type ProviderSummary, type StoryGroup } from '@/api';
import { useI18n } from '@/i18n';
import { timeAgo } from '@/lib/time';
import { makeStyles, opacity, radius, size, space } from '@/theme';

import { Photo } from './Photo';
import { StoryRing } from './StoryRing';
import { Txt } from './Txt';

interface Props {
  /** Where the search is centred. */
  coords: Coordinates;
  radiusM: number;
  /** False while the position is still being found: nothing is asked yet. */
  ready: boolean;
  onOpen: (provider: ProviderSummary) => void;
}

/**
 * "Updates nearby" on Home: one ringed photo per provider who posted an update
 * inside the chosen distance, newest first, in a row that scrolls sideways.
 * Under each photo: the name and how fresh the newest update is.
 *
 * The row is an extra, so it never shows a loading or an error state: it is
 * simply not there until there is something to show. While a new distance loads,
 * the previous row stays up, so the page does not jump twice.
 */
export function StoriesRow({ coords, radiusM, ready, onOpen }: Props) {
  const { s, f, row, rtl } = useI18n();
  const styles = useStyles();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const { lat, lng } = coords;

  useEffect(() => {
    if (!ready) return undefined;
    let current = true;
    api
      .getNearbyStories({ lat, lng, radius_m: radiusM })
      .then((result) => {
        // A provider with no stories left has nothing to open.
        if (current) setGroups(result.items.filter((group) => group.stories.length > 0));
      })
      .catch(() => {
        // Offline or failed: keep what is on screen. Search still works without this row.
      });
    return () => {
      current = false;
    };
  }, [ready, lat, lng, radiusM]);

  if (groups.length === 0) return null;

  return (
    <View style={styles.section}>
      <Txt role="headline" accessibilityRole="header">
        {s.stories.nearby}
      </Txt>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        // The row runs to the screen edges; the page's own padding is given back inside.
        style={styles.scroller}
        contentContainerStyle={[styles.row, { flexDirection: row }]}
        // In Arabic the row starts from the right, so it opens scrolled to that end.
        onContentSizeChange={() => {
          if (rtl) scroller.current?.scrollToEnd({ animated: false });
        }}
      >
        {groups.map(({ provider, stories }) => (
          <Pressable
            key={provider.id}
            accessibilityRole="button"
            accessibilityLabel={`${f(s.stories.open, { name: provider.name })}, ${timeAgo(stories[0].created_at, s)}`}
            accessibilityHint={s.stories.openHint}
            onPress={() => onOpen(provider)}
            style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
          >
            <StoryRing active box={size.storyBubble} round={radius.md + space.xs}>
              {provider.cover_photo_url ? (
                <Photo
                  uri={provider.cover_photo_url}
                  fallbackIcon={provider.category.icon}
                  style={styles.fill}
                />
              ) : (
                // No photo: the first letter of the name on the lavender block.
                <View style={[styles.fill, styles.initial]}>
                  <Txt role="headline" color="onAccent" center content>
                    {provider.name.trim().charAt(0).toUpperCase()}
                  </Txt>
                </View>
              )}
            </StoryRing>
            <View style={styles.words}>
              <Txt role="label" center numberOfLines={1} content>
                {provider.name}
              </Txt>
              <Txt role="caption" color="textSubtle" center numberOfLines={1}>
                {timeAgo(stories[0].created_at, s)}
              </Txt>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  section: {
    gap: space.md,
    marginTop: space.sm,
  },
  scroller: {
    marginHorizontal: -space.lg,
  },
  row: {
    flexGrow: 1,
    gap: space.sm,
    paddingHorizontal: space.lg - space.xs,
  },
  item: {
    width: size.storyBubbleSlot + space.sm,
    alignItems: 'center',
    gap: space.sm,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  fill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  initial: {
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: {
    alignSelf: 'stretch',
  },
}));
