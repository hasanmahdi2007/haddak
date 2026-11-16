import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Heart } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Photo } from '@/components/Photo';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { type Favourite, useFavourites } from '@/lib/favourites';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

/** One saved provider: the open-profile button, and beside it the heart that removes it. */
function SavedCard({ item, onOpen, onRemove }: { item: Favourite; onOpen: () => void; onRemove: () => void }) {
  const { colors } = useTheme();
  const { s, f, row, rtl } = useI18n();
  const styles = useStyles();
  const place = `${rtl ? item.category_name_ar : item.category_name_en} · ${item.area_name}`;

  return (
    <View style={[styles.card, { flexDirection: row }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${place}`}
        accessibilityHint={s.results.openProfile}
        onPress={onOpen}
        android_ripple={{ color: colors.surfaceTintStrong }}
        style={({ pressed }) => [styles.open, { flexDirection: row }, pressed ? styles.pressed : null]}
      >
        <Photo uri={item.photo_url} fallbackIcon={item.category_icon} style={styles.thumb} />
        <View style={styles.main}>
          <Txt role="title" numberOfLines={1} content>
            {item.name}
          </Txt>
          <Txt role="label" color="textMuted" numberOfLines={1}>
            {place}
          </Txt>
        </View>
      </Pressable>
      <IconButton
        icon={Heart}
        label={f(s.saved.removeNamed, { name: item.name })}
        onPress={onRemove}
        color={colors.primary}
        fill={colors.primary}
        style={styles.remove}
      />
    </View>
  );
}

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dark } = useTheme();
  const { s, row, rtl } = useI18n();
  const styles = useStyles();
  const { ready, list, remove } = useFavourites();

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[styles.column, styles.bar, { flexDirection: row }]}>
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
        <Txt role="display" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {s.saved.title}
        </Txt>
      </View>

      {/* Nothing is drawn until the list is read, so the empty state never flashes. */}
      {ready && list.length === 0 ? (
        <View style={styles.column}>
          <StateView
            icon={Heart}
            title={s.saved.emptyTitle}
            body={s.saved.emptyBody}
            actionLabel={s.saved.emptyAction}
            onAction={goBack}
          />
        </View>
      ) : null}

      {ready && list.length > 0 ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xxl }]}>
          <View style={[styles.column, styles.list]}>
            {list.map((item) => (
              <SavedCard
                key={item.id}
                item={item}
                onOpen={() => router.push({ pathname: '/provider/[id]', params: { id: item.id } })}
                onRemove={() => remove(item.id)}
              />
            ))}
            <Txt role="caption" color="textSubtle" center style={styles.note}>
              {s.saved.note}
            </Txt>
          </View>
        </ScrollView>
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
  scroll: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  list: {
    gap: space.md,
  },
  // The same grey block as a result card, in one short row.
  card: {
    alignItems: 'center',
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  open: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
  },
  pressed: {
    backgroundColor: c.surfaceTintStrong,
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
  remove: {
    marginHorizontal: space.xs,
  },
  note: {
    marginTop: space.sm,
  },
}));
