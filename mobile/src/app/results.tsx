import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, List, Map as MapIcon, SearchX, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ProviderSummary } from '@/api';
import { IconButton } from '@/components/IconButton';
import { ProviderCard } from '@/components/ProviderCard';
import { RadiusChips } from '@/components/RadiusChips';
import { ResultsMap } from '@/components/ResultsMap';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { useCategories } from '@/lib/categories';
import { useLocation } from '@/lib/location';
import { parseRadius, radiusPhrase, widerRadius, type RadiusM } from '@/lib/radius';
import { useAsync } from '@/lib/useAsync';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

type ViewMode = 'list' | 'map';

/** A loading card in the shape of ProviderCard: photo, two lines, a badge, the facts strip. */
function CardSkeleton() {
  const styles = useStyles();
  const { row } = useI18n();
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonTop, { flexDirection: row }]}>
        <Skeleton width={size.thumb} height={size.thumb} round={radius.md} />
        <View style={styles.skeletonLines}>
          <Skeleton width="70%" height={space.xl} />
          <Skeleton width="50%" height={space.lg} />
          <Skeleton width="30%" height={space.lg} />
        </View>
      </View>
      <View style={styles.skeletonFacts} />
    </View>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, f, row, rtl, plural, categoryName } = useI18n();
  const styles = useStyles();
  const params = useLocalSearchParams<{ category_id?: string; radius?: string; q?: string }>();
  const { coords, status: locationStatus } = useLocation();
  const { byId } = useCategories();

  const categoryId = params.category_id ? Number(params.category_id) : undefined;
  const category = categoryId !== undefined ? byId.get(categoryId) : undefined;
  // The name typed on Home. The backend takes 2 to 60 characters; anything else is dropped.
  const typed = (params.q ?? '').trim().slice(0, 60);
  const q = typed.length >= 2 ? typed : undefined;
  const [radiusM, setRadiusM] = useState<RadiusM>(() => parseRadius(params.radius));
  const [mode, setMode] = useState<ViewMode>('list');

  // Wait for the position before searching, so the first list is the right one.
  const locating = locationStatus === 'locating';
  const search = useAsync(
    () =>
      locating
        ? new Promise<never>(() => undefined)
        : api.searchProviders({ ...coords, radius_m: radiusM, category_id: categoryId, q }),
    [locating, coords.lat, coords.lng, radiusM, categoryId, q],
  );

  const where = radiusPhrase(s, radiusM);
  const wider = widerRadius(radiusM);
  const title = q ? f(s.results.named, { q }) : category ? categoryName(category) : s.results.everyone;
  const subtitle =
    search.status === 'ready'
      ? plural(s.results.count, search.data.total, { where })
      : search.status === 'loading'
        ? f(s.results.searching, { where })
        : // A non-breaking space keeps the line's height, so the title does not jump.
          '\u00A0';

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openProvider = (provider: ProviderSummary) =>
    router.push({ pathname: '/provider/[id]', params: { id: provider.id } });

  const modes: { key: ViewMode; label: string; icon: typeof List }[] = [
    { key: 'list', label: s.results.viewList, icon: List },
    { key: 'map', label: s.results.viewMap, icon: MapIcon },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.column}>
          <View style={[styles.bar, { flexDirection: row }]}>
            <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
            <View style={styles.titles}>
              <Txt role="headline" numberOfLines={1} accessibilityRole="header">
                {title}
              </Txt>
              <Txt role="label" color="textMuted" numberOfLines={1} accessibilityLiveRegion="polite">
                {subtitle}
              </Txt>
            </View>
            <View
              accessibilityRole="tablist"
              accessibilityLabel={s.results.viewToggle}
              style={[styles.segmented, { flexDirection: row }]}
            >
              {modes.map(({ key, label, icon: Icon }) => {
                const active = mode === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="tab"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                    onPress={() => setMode(key)}
                    // The visible segment is 40 dp high; hitSlop makes the touch target 48.
                    hitSlop={{ top: space.xs, bottom: space.xs }}
                    android_ripple={{ color: colors.surfaceTintStrong }}
                    style={[styles.segment, active ? styles.segmentActive : null]}
                  >
                    <Icon
                      color={active ? colors.onPrimary : colors.text}
                      size={size.icon}
                      strokeWidth={size.stroke}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.controls}>
            <RadiusChips value={radiusM} onChange={setRadiusM} />
          </View>
        </View>
      </View>

      {/* Error and empty look the same in both views; the list and the map share one search. */}
      {search.status === 'error' ? (
        <View style={styles.column}>
          <StateView
            alert
            icon={WifiOff}
            title={s.results.errorTitle}
            body={s.results.errorBody}
            actionLabel={s.common.tryAgain}
            onAction={search.reload}
          />
        </View>
      ) : search.status === 'ready' && search.data.items.length === 0 ? (
        <View style={styles.column}>
          <StateView
            icon={SearchX}
            title={q ? f(s.results.emptyNameTitle, { q, where }) : f(s.results.emptyTitle, { where })}
            body={
              q
                ? wider
                  ? s.results.emptyNameBody
                  : s.results.emptyNameCityBody
                : wider
                  ? s.results.emptyBody
                  : s.results.emptyCityBody
            }
            actionLabel={
              wider
                ? f(s.results.emptyAction, { where: radiusPhrase(s, wider) })
                : q
                  ? s.results.emptyNameCityAction
                  : s.results.emptyCityAction
            }
            onAction={() => (wider ? setRadiusM(wider) : goBack())}
          />
        </View>
      ) : mode === 'map' ? (
        // The map stays up while a new search runs (pins come back when it lands),
        // so changing the distance re-fits it instead of rebuilding it.
        <ResultsMap
          center={coords}
          radiusM={radiusM}
          providers={search.status === 'ready' ? search.data.items : []}
          loading={search.status === 'loading'}
          onOpenProvider={openProvider}
        />
      ) : search.status === 'loading' ? (
        <View style={[styles.column, styles.list]} accessible accessibilityLabel={s.results.loading}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={search.data.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProviderCard provider={item} onPress={() => openProvider(item)} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={[styles.list, styles.column, { paddingBottom: insets.bottom + space.xxl }]}
        />
      )}
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
  header: {
    borderBottomWidth: size.hairline,
    borderBottomColor: c.border,
    paddingBottom: space.md,
  },
  bar: {
    alignItems: 'center',
    gap: space.xs,
    // The back button has its own 12 dp of air around the arrow, so the bar starts closer to the edge.
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  controls: {
    paddingHorizontal: space.lg,
  },
  // List / map: a small version of the distance track.
  segmented: {
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    padding: space.xs,
    gap: space.xxs,
    marginHorizontal: space.sm,
  },
  segment: {
    width: size.touch,
    height: size.segment,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentActive: {
    backgroundColor: c.primary,
  },
  list: {
    padding: space.lg,
  },
  separator: {
    height: space.md,
  },
  skeletonCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: size.lineMid,
    borderColor: c.surfaceTintStrong,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  skeletonTop: {
    padding: space.md,
    gap: space.md,
  },
  skeletonLines: {
    flex: 1,
    gap: space.sm,
    paddingTop: space.xs,
  },
  skeletonFacts: {
    height: space.xxl + space.lg,
    backgroundColor: c.surfaceTint,
  },
}));
