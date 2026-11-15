import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, List, Map as MapIcon, MapPinned, SearchX, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ProviderSummary } from '@/api';
import { IconButton } from '@/components/IconButton';
import { ProviderCard } from '@/components/ProviderCard';
import { RadiusChips } from '@/components/RadiusChips';
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

function CardSkeleton() {
  const styles = useStyles();
  const { row } = useI18n();
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonTop, { flexDirection: row }]}>
        <Skeleton width={size.thumb} height={size.thumb} />
        <View style={styles.skeletonLines}>
          <Skeleton width="70%" height={space.xl} />
          <Skeleton width="50%" height={space.lg} />
        </View>
      </View>
      <Skeleton height={space.lg} />
    </View>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, f, row, rtl, plural, categoryName } = useI18n();
  const styles = useStyles();
  const params = useLocalSearchParams<{ category_id?: string; radius?: string }>();
  const { coords, status: locationStatus } = useLocation();
  const { byId } = useCategories();

  const categoryId = params.category_id ? Number(params.category_id) : undefined;
  const category = categoryId !== undefined ? byId.get(categoryId) : undefined;
  const [radiusM, setRadiusM] = useState<RadiusM>(() => parseRadius(params.radius));
  const [mode, setMode] = useState<ViewMode>('list');

  // Wait for the position before searching, so the first list is the right one.
  const locating = locationStatus === 'locating';
  const search = useAsync(
    () =>
      locating
        ? new Promise<never>(() => undefined)
        : api.searchProviders({ ...coords, radius_m: radiusM, category_id: categoryId }),
    [locating, coords.lat, coords.lng, radiusM, categoryId],
  );

  const where = radiusPhrase(s, radiusM);
  const wider = widerRadius(radiusM);
  const title = category ? categoryName(category) : s.results.everyone;
  const subtitle =
    search.status === 'ready'
      ? plural(s.results.count, search.data.total, { where })
      : search.status === 'loading'
        ? f(s.results.searching, { where })
        : '';

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
                    android_ripple={{ color: colors.manilaDeep }}
                    style={[styles.segment, { flexDirection: row }, active ? styles.segmentActive : null]}
                  >
                    <Icon
                      color={active ? colors.onInkWash : colors.textMuted}
                      size={size.iconSmall}
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

      {mode === 'map' ? (
        <View style={styles.column}>
          <StateView
            icon={MapPinned}
            title={s.results.mapTitle}
            body={s.results.mapBody}
            actionLabel={s.results.mapAction}
            onAction={() => setMode('list')}
            actionVariant="outline"
          />
        </View>
      ) : search.status === 'loading' ? (
        <View style={[styles.column, styles.list]} accessible accessibilityLabel={s.results.loading}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : search.status === 'error' ? (
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
      ) : search.data.items.length === 0 ? (
        <View style={styles.column}>
          <StateView
            icon={SearchX}
            title={f(s.results.emptyTitle, { where })}
            body={wider ? s.results.emptyBody : s.results.emptyCityBody}
            actionLabel={
              wider ? f(s.results.emptyAction, { where: radiusPhrase(s, wider) }) : s.results.emptyCityAction
            }
            onAction={() => (wider ? setRadiusM(wider) : goBack())}
          />
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
    backgroundColor: c.paper,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  header: {
    borderBottomWidth: size.hairline,
    borderBottomColor: c.hairline,
    paddingBottom: space.md,
  },
  bar: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  titles: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  segmented: {
    borderWidth: size.hairline,
    borderColor: c.outline,
    borderRadius: radius.lg,
    backgroundColor: c.sheet,
    overflow: 'hidden',
  },
  segment: {
    width: size.touch,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  segmentActive: {
    backgroundColor: c.inkWash,
  },
  list: {
    padding: space.lg,
    gap: space.none,
  },
  separator: {
    height: space.md,
  },
  skeletonCard: {
    backgroundColor: c.sheet,
    borderRadius: radius.md,
    borderWidth: size.hairline,
    borderColor: c.hairline,
    padding: space.md,
    gap: space.md,
    marginBottom: space.md,
  },
  skeletonTop: {
    gap: space.md,
  },
  skeletonLines: {
    flex: 1,
    gap: space.sm,
  },
}));
