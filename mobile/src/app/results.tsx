import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Badge, List, Map as MapIcon, SearchX, WifiOff, X, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type PriceCurrency, type PriceUnit, type ProviderSummary, type SearchSort } from '@/api';
import { Button } from '@/components/Button';
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
import { formatPrice } from '@/lib/price';
import { parseRadius, radiusPhrase, widerRadius, type RadiusM } from '@/lib/radius';
import { useAsync } from '@/lib/useAsync';
import { usePagedSearch, type PagedParams } from '@/lib/usePagedSearch';
import { elevation, makeStyles, radius, size, space, useTheme } from '@/theme';

type ViewMode = 'list' | 'map';

const PRICE_UNITS: PriceUnit[] = ['hour', 'visit', 'job', 'item', 'month'];

/** A number from a link, or undefined when it is missing or not a number. */
function numberParam(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** The most paid cards shown above a list of results. */
const MAX_SPONSORED = 2;

/** The map asks for this many pins at once (the API's maximum) and clusters them. */
const MAP_LIMIT = 100;

/** Fewer results than this, with a wider distance left: offer it under the list (UX rules, 2026-11-24). */
const FEW_RESULTS = 5;

/** A loading card in the shape of ProviderCard: photo, two lines, a badge, the facts strip. */
function CardSkeleton() {
  const styles = useStyles();
  const { row } = useI18n();
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonTop, { flexDirection: row }]}>
        <Skeleton width={size.thumb} height={size.thumb} round={radius.md} />
        <View style={styles.skeletonLines}>
          {/* Shaped like the card: name, "category · area", then the Verified pill. */}
          <Skeleton width="70%" height={space.lg + space.xxs} round={radius.pill} />
          <Skeleton width="45%" height={space.md} round={radius.pill} />
          <Skeleton width={size.thumb} height={size.badge} round={radius.pill} style={styles.skeletonPill} />
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
    verified?: string;
    // From the assistant (src/app/assist.tsx): its filters, and the centre of a named place.
    max_price?: string;
    price_unit?: string;
    price_currency?: string;
    open_now?: string;
    available_now?: string;
    sort?: string;
    lat?: string;
    lng?: string;
    place?: string;
  }>();
  const location = useLocation();
  // A place named to the assistant ("in Hamra") replaces the phone position as the centre.
  const placeLat = numberParam(params.lat);
  const placeLng = numberParam(params.lng);
  const atPlace = placeLat !== undefined && placeLng !== undefined;
  const coords = atPlace ? { lat: placeLat, lng: placeLng } : location.coords;
  const locationStatus = atPlace ? 'located' : location.status;
  const { byId } = useCategories();

  const categoryId = params.category_id ? Number(params.category_id) : undefined;
  const category = categoryId !== undefined ? byId.get(categoryId) : undefined;
  // The name typed on Home. The backend takes 2 to 60 characters; anything else is dropped.
  const typed = (params.q ?? '').trim().slice(0, 60);
  const q = typed.length >= 2 ? typed : undefined;
  const [radiusM, setRadiusM] = useState<RadiusM>(() => parseRadius(params.radius));
  const [mode, setMode] = useState<ViewMode>('list');
  // Everyone by default, verified first (founder decision 2026-11-17); "Verified only" is
  // the user's switch (or a link that arrives with `verified=1`).
  const [verifiedOnly, setVerifiedOnly] = useState(params.verified === '1');
  // The assistant's extra filters. Each shows as a pill under the header; tapping it removes it.
  const [price, setPrice] = useState(() => {
    const amount = numberParam(params.max_price);
    const unit = PRICE_UNITS.find((u) => u === params.price_unit);
    const currency: PriceCurrency = params.price_currency === 'LBP' ? 'LBP' : 'USD';
    return amount !== undefined && amount > 0 && unit ? { amount, unit, currency } : null;
  });
  const [openNow, setOpenNow] = useState(params.open_now === '1' || params.open_now === 'true');
  // "Available now": a pill the user can always switch on (not only from the assistant).
  const [availableNow, setAvailableNow] = useState(params.available_now === '1' || params.available_now === 'true');
  const [sort, setSort] = useState<SearchSort>(
    params.sort === 'distance' || params.sort === 'price' ? params.sort : 'best',
  );

  // Wait for the position before searching, so the first list is the right one.
  // Changing the distance or any filter starts the list again from its first page.
  const locating = locationStatus === 'locating';
  const searchParams: PagedParams | null = locating
    ? null
    : {
        ...coords,
        radius_m: radiusM,
        category_id: categoryId,
        q,
        include_unverified: !verifiedOnly,
        max_price: price?.amount,
        price_unit: price?.unit,
        price_currency: price?.currency,
        open_now: openNow || undefined,
        available_now: availableNow || undefined,
        sort,
      };
  // The list: 20 at a time, the next 20 when the user nears the end.
  const search = usePagedSearch(searchParams);

  // The map is its own request: up to 100 pins, clustered on the map. It is only asked
  // for once the map has been opened, then kept up to date with the filters.
  const [mapOpened, setMapOpened] = useState(false);
  const mapSearch = useAsync(
    () =>
      searchParams === null || !mapOpened
        ? new Promise<never>(() => undefined)
        : api.searchProviders({ ...searchParams, limit: MAP_LIMIT, offset: 0 }),
    [mapOpened, JSON.stringify(searchParams)],
  );
  const chooseMode = (next: ViewMode) => {
    if (next === 'map') setMapOpened(true);
    setMode(next);
  };

  const placeName = atPlace ? (params.place ?? '').trim() : '';
  const where = placeName ? `${radiusPhrase(s, radiusM)} · ${placeName}` : radiusPhrase(s, radiusM);
  const extraFilters = [
    price
      ? { key: 'price', label: f(s.price.upTo, { price: formatPrice(s, price.amount, price.unit, price.currency) }), remove: () => setPrice(null) }
      : null,
    openNow ? { key: 'open', label: s.hours.openNow, remove: () => setOpenNow(false) } : null,
    sort !== 'best'
      ? { key: 'sort', label: sort === 'distance' ? s.price.nearest : s.price.cheapest, remove: () => setSort('best') }
      : null,
  ].filter((filter) => filter !== null);
  const wider = widerRadius(radiusM);
  const title = q ? f(s.results.named, { q }) : category ? categoryName(category) : s.results.everyone;
  const subtitle =
    search.status === 'ready'
      ? plural(s.results.count, search.total, { where })
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
  const items = search.items;
  const sponsoredItems = q ? [] : items.filter((item) => item.sponsored).slice(0, MAX_SPONSORED);
  const sponsoredIds = new Set(sponsoredItems.map((item) => item.id));
  const listItems = items.filter((item) => !sponsoredIds.has(item.id));
  // The backend puts every verified provider first, so one quiet divider above the
  // first unverified card separates the two groups.
  const firstUnverifiedId = listItems.find((item) => !item.verified)?.id;

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
                    onPress={() => chooseMode(key)}
                    // 36 dp to the eye; hitSlop makes the touch target 48.
                    hitSlop={{ top: size.segmentSlop, bottom: size.segmentSlop }}
                    android_ripple={{ color: colors.accentSoft }}
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

          <View style={[styles.extraFilters, { flexDirection: row }]}>
            {/* Always there: outlined when off; on, it turns black like the other filters. */}
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={s.results.availableFilter}
              accessibilityHint={s.results.availableFilterHint}
              accessibilityState={{ checked: availableNow }}
              aria-checked={availableNow}
              onPress={() => setAvailableNow((on) => !on)}
              hitSlop={{ top: size.segmentSlop, bottom: size.segmentSlop }}
              android_ripple={{ color: availableNow ? colors.primaryPressed : colors.surfaceTintStrong }}
              style={[styles.extraFilter, availableNow ? null : styles.extraFilterOff, { flexDirection: row }]}
            >
              <Zap
                color={availableNow ? colors.onPrimary : colors.text}
                fill={availableNow ? colors.onPrimary : 'none'}
                size={size.iconSmall}
                strokeWidth={size.lineBold}
              />
              <Txt role="label" color={availableNow ? 'onPrimary' : 'text'} numberOfLines={1}>
                {s.results.availableFilter}
              </Txt>
              {availableNow ? <X color={colors.onPrimary} size={size.iconSmall} strokeWidth={size.lineBold} /> : null}
            </Pressable>
            {extraFilters.map((filter) => (
              <Pressable
                key={filter.key}
                accessibilityRole="button"
                accessibilityLabel={f(s.price.removeFilter, { name: filter.label })}
                onPress={filter.remove}
                hitSlop={{ top: size.segmentSlop, bottom: size.segmentSlop }}
                android_ripple={{ color: colors.primaryPressed }}
                style={[styles.extraFilter, { flexDirection: row }]}
              >
                <Txt role="label" color="onPrimary" numberOfLines={1}>
                  {filter.label}
                </Txt>
                <X color={colors.onPrimary} size={size.iconSmall} strokeWidth={size.lineBold} />
              </Pressable>
            ))}
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
        ) : search.status === 'ready' && search.items.length === 0 ? (
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
            providers={mapSearch.status === 'ready' ? mapSearch.data.items : []}
            total={mapSearch.status === 'ready' ? mapSearch.data.total : 0}
            loading={mapSearch.status === 'loading'}
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
              <>
                {item.id === firstUnverifiedId ? (
                  <View
                    style={[styles.unverifiedHead, { flexDirection: row }]}
                    accessible
                    accessibilityRole="header"
                    accessibilityLabel={`${s.results.unverifiedDivider}. ${s.results.unverifiedDividerBody}`}
                  >
                    <Badge color={colors.textSubtle} size={size.iconSmall} strokeWidth={size.stroke} />
                    <Txt role="label" color="text">
                      {s.results.unverifiedDivider}
                    </Txt>
                    <Txt role="label" color="textMuted" style={styles.unverifiedBody} numberOfLines={2}>
                      {s.results.unverifiedDividerBody}
                    </Txt>
                  </View>
                ) : null}
                <ProviderCard
                  provider={item}
                  plain
                  onPress={() => openProvider(item)}
                  onOpenStory={() => openStory(item)}
                />
              </>
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
            // The next 20 when the user is half a screen from the end.
            onEndReached={search.loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              <View style={styles.footer}>
                {/* Few results and a wider distance left: offer it, never a dead end. */}
                {wider && search.total < FEW_RESULTS && !search.hasMore ? (
                  <View style={styles.few}>
                    <Txt role="title" color="onAccent">
                      {plural(s.results.few, search.total, { where: radiusPhrase(s, radiusM) })}
                    </Txt>
                    <Txt role="body" color="textMuted">
                      {s.results.fewBody}
                    </Txt>
                    <Button
                      label={f(s.results.fewAction, { where: radiusPhrase(s, wider) })}
                      onPress={() => setRadiusM(wider)}
                      style={styles.fewButton}
                    />
                  </View>
                ) : null}

                {search.moreError ? (
                  <View style={styles.footerLine} accessibilityRole="alert">
                    <Txt role="label" color="textMuted">
                      {s.results.moreError}
                    </Txt>
                    <Button label={s.common.tryAgain} variant="outline" compact onPress={search.loadMore} />
                  </View>
                ) : search.loadingMore ? (
                  <View
                    style={[styles.footerLine, { flexDirection: row }]}
                    accessible
                    accessibilityLabel={s.results.loadingMore}
                  >
                    <ActivityIndicator size="small" color={colors.textMuted} />
                    <Txt role="label" color="textMuted">
                      {f(s.results.showing, { shown: search.items.length, total: search.total })}
                    </Txt>
                  </View>
                ) : (
                  // "Showing 20 of 134" while more are coming; "That is everyone: 12" at the end.
                  <View style={styles.footerLine}>
                    <Txt role="label" color="textMuted" center accessibilityLiveRegion="polite">
                      {search.hasMore
                        ? f(s.results.showing, { shown: search.items.length, total: search.total })
                        : f(s.results.allShown, { total: search.total })}
                    </Txt>
                  </View>
                )}
              </View>
            }
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
  // List / Map: an alice-blue segmented track; the chosen segment is a black pill with white words.
  switch: {
    backgroundColor: c.accent,
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
  // The assistant's filters: black pills (the selected state) with an X that removes them.
  extraFilters: {
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  extraFilter: {
    minHeight: size.segment,
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    overflow: 'hidden',
  },
  // Off: an outlined pill, like every unselected chip.
  extraFilterOff: {
    backgroundColor: 'transparent',
    borderWidth: size.hairline,
    borderColor: c.border,
  },
  list: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  separator: {
    height: space.md,
  },
  footer: {
    gap: space.lg,
    paddingTop: space.lg,
  },
  footerLine: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: size.touch,
  },
  // "Only 3 places within 1 km": the alice-blue info block with a black button to go wider.
  few: {
    backgroundColor: c.accent,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.sm,
  },
  fewButton: {
    marginTop: space.sm,
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
    marginTop: space.lg,
    paddingHorizontal: space.xs,
  },
  // "Not verified yet: Haddak hasn't checked these": a hairline and one quiet line, no box.
  unverifiedHead: {
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    marginBottom: space.md,
    paddingTop: space.md,
    paddingHorizontal: space.xs,
    borderTopWidth: size.hairline,
    borderTopColor: c.divider,
  },
  unverifiedBody: {
    flex: 1,
  },
  skeletonCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
    marginBottom: space.md,
    boxShadow: elevation.card,
  },
  skeletonPill: {
    marginTop: space.xs,
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
    backgroundColor: c.surfaceInset,
  },
}));
