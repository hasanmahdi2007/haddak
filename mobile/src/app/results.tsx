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
import { VerifiedFilter } from '@/components/VerifiedFilter';
import { useI18n } from '@/i18n';
import { useCategories } from '@/lib/categories';
import { useLocation } from '@/lib/location';
import { parseRadius, radiusPhrase, widerRadius, type RadiusM } from '@/lib/radius';
import { useAsync } from '@/lib/useAsync';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

type ViewMode = 'list' | 'map';

/** The most paid cards shown above a list of results. */
const MAX_SPONSORED = 2;

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
  const params = useLocalSearchParams<{
    category_id?: string;
    radius?: string;
    q?: string;
    unverified?: string;
  }>();
  const { coords, status: locationStatus } = useLocation();
  const { byId } = useCategories();

  const categoryId = params.category_id ? Number(params.category_id) : undefined;
  const category = categoryId !== undefined ? byId.get(categoryId) : undefined;
  // The name typed on Home. The backend takes 2 to 60 characters; anything else is dropped.
  const typed = (params.q ?? '').trim().slice(0, 60);
  const q = typed.length >= 2 ? typed : undefined;
  const [radiusM, setRadiusM] = useState<RadiusM>(() => parseRadius(params.radius));
  const [mode, setMode] = useState<ViewMode>('list');
  // Verified only unless the user says otherwise (or a link arrives with `unverified=1`).
  const [verifiedOnly, setVerifiedOnly] = useState(params.unverified !== '1');

  // Wait for the position before searching, so the first list is the right one.
  // Changing the distance or the verification filter runs the search again.
  const locating = locationStatus === 'locating';
  const search = useAsync(
    () =>
      locating
        ? new Promise<never>(() => undefined)
        : api.searchProviders({
            ...coords,
            radius_m: radiusM,
            category_id: categoryId,
            q,
            include_unverified: !verifiedOnly,
          }),
    [locating, coords.lat, coords.lng, radiusM, categoryId, q, verifiedOnly],
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
          ' ';

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openProvider = (provider: ProviderSummary) =>
    router.push({ pathname: '/provider/[id]', params: { id: provider.id } });
  const openStory = (provider: ProviderSummary) =>
    router.push({ pathname: '/stories/[providerId]', params: { providerId: provider.id } });

  // Paid cards get their own labelled section at the top of the list: at most two,
  // and only when browsing a category or everyone (a search by name stays a plain list).
  // Each one is taken out of the list below, so nobody is shown twice.
  const items = search.status === 'ready' ? search.data.items : [];
  const sponsoredItems = q ? [] : items.filter((item) => item.sponsored).slice(0, MAX_SPONSORED);
  const sponsoredIds = new Set(sponsoredItems.map((item) => item.id));
  const listItems = items.filter((item) => !sponsoredIds.has(item.id));

  const modes: { key: ViewMode; label: string; icon: typeof List }[] = [
    { key: 'list', label: s.results.viewList, icon: List },
    { key: 'map', label: s.results.viewMap, icon: MapIcon },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* One header: who and how many, the List / Map switch, then distance and the verified filter. */}
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

            {/* List / Map: both words always on screen, the chosen one filled ink. */}
            <View
              accessibilityRole="tablist"
              accessibilityLabel={s.results.viewToggle}
              style={[styles.switch, { flexDirection: row }]}
            >
              {modes.map(({ key, label, icon: Icon }) => {
                const active = mode === key;
                return (
                  <Pressable
                    key={key}
                    testID={`view-${key}`}
                    accessibilityRole="tab"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                    onPress={() => setMode(key)}
                    // 36 dp to the eye; hitSlop makes the touch target 48.
                    hitSlop={{ top: size.segmentSlop, bottom: size.segmentSlop }}
                    android_ripple={{ color: colors.surfaceTintStrong }}
                    style={[styles.switchItem, { flexDirection: row }, active ? styles.switchActive : null]}
                  >
                    <Icon
                      color={active ? colors.onPrimary : colors.text}
                      size={size.iconSmall}
                      strokeWidth={size.lineBold}
                    />
                    <Txt role="label" color={active ? 'onPrimary' : 'text'} numberOfLines={1}>
                      {label}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.filters, { flexDirection: row }]}>
            <RadiusChips value={radiusM} onChange={setRadiusM} style={styles.radius} />
            <VerifiedFilter verifiedOnly={verifiedOnly} onChange={setVerifiedOnly} />
          </View>
        </View>
      </View>

      {/* Everything under the header. `flex: 1` here is what gives the map its height. */}
      <View style={styles.content}>
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
              // Nobody here yet: the user may know who is missing.
              secondaryLabel={s.home.suggest}
              onSecondary={() =>
                router.push({
                  pathname: '/suggest',
                  params: categoryId !== undefined ? { category_id: String(categoryId) } : {},
                })
              }
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
          </View>
        ) : (
          <FlatList
            data={listItems}
            keyExtractor={(item) => item.id}
            // `plain`: a sponsored provider outside the section is drawn as an ordinary card.
            renderItem={({ item }) => (
              <ProviderCard
                provider={item}
                plain
                onPress={() => openProvider(item)}
                onOpenStory={() => openStory(item)}
              />
            )}
            ListHeaderComponent={
              sponsoredItems.length > 0 ? (
                <View style={styles.sponsored}>
                  <View
                    style={[styles.sectionHead, { flexDirection: row }]}
                    accessible
                    accessibilityRole="header"
                    accessibilityLabel={s.sponsored.sectionLabel}
                  >
                    <Txt role="title">{s.sponsored.section}</Txt>
                    <Txt role="label" color="textMuted">
                      {s.sponsored.sectionNote}
                    </Txt>
                  </View>
                  {sponsoredItems.map((item) => (
                    <ProviderCard
                      key={item.id}
                      provider={item}
                      onPress={() => openProvider(item)}
                      onOpenStory={() => openStory(item)}
                    />
                  ))}
                  {listItems.length > 0 ? (
                    <Txt role="title" accessibilityRole="header" style={styles.restHead}>
                      {s.sponsored.rest}
                    </Txt>
                  ) : null}
                </View>
              ) : undefined
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={[styles.list, styles.column, { paddingBottom: insets.bottom + space.xxl }]}
          />
        )}
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
  header: {
    paddingBottom: space.md,
  },
  content: {
    flex: 1,
    alignSelf: 'stretch',
  },
  bar: {
    alignItems: 'center',
    gap: space.xs,
    // The back button has its own 12 dp of air around the arrow, so the bar starts closer to the edge.
    paddingStart: space.xs,
    paddingEnd: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  // List / Map: a grey pill track, like the distance control.
  switch: {
    backgroundColor: c.surfaceTint,
    borderRadius: radius.pill,
    padding: space.xxs,
    gap: space.xxs,
  },
  switchItem: {
    height: size.segment,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + space.xxs,
    overflow: 'hidden',
  },
  switchActive: {
    backgroundColor: c.primary,
  },
  filters: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  radius: {
    flex: 1,
  },
  list: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  separator: {
    height: space.md,
  },
  // The paid section: its heading, the cards, then the heading of the ordinary results.
  sponsored: {
    gap: space.md,
    paddingBottom: space.md,
  },
  sectionHead: {
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.xs,
  },
  restHead: {
    marginTop: space.md,
    paddingHorizontal: space.xs,
  },
  skeletonCard: {
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    padding: space.sm + space.xxs,
    gap: space.sm + space.xxs,
    marginBottom: space.md,
  },
  skeletonTop: {
    gap: space.md,
  },
  skeletonLines: {
    flex: 1,
    gap: space.sm,
    paddingTop: space.xs,
  },
  skeletonFacts: {
    height: space.xxl + space.lg,
    borderRadius: radius.md,
    backgroundColor: c.surface,
  },
}));
