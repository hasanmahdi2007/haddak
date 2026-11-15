import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Heart, LocateFixed, MapPin, Search, WifiOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Platform,
  ScrollView,
  TextInput,
  type TextStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Category } from '@/api';
import { Button } from '@/components/Button';
import { CategoryTile } from '@/components/CategoryTile';
import { IconButton } from '@/components/IconButton';
import { RadiusChips } from '@/components/RadiusChips';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { TextLink } from '@/components/TextLink';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { useCategories, type CategoryNode } from '@/lib/categories';
import { useFavourites } from '@/lib/favourites';
import { useLocation } from '@/lib/location';
import { DEFAULT_RADIUS, type RadiusM } from '@/lib/radius';
import { makeStyles, radius, size, space, type as typeScale, useTheme } from '@/theme';

/** Category tiles per row. */
const COLUMNS = 2;

/** Limits of the search endpoint's `q` parameter (docs/API.md). */
const NAME_MIN = 2;
const NAME_MAX = 60;

// Web only: the field's own border shows focus, so the browser's ring is turned off.
// ('none' is valid CSS but missing from React Native's types, hence the cast.)
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** Split a list into grid rows, padding the last row so tiles keep their width. */
function toRows<T>(items: T[]): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += COLUMNS) {
    const row: (T | null)[] = items.slice(i, i + COLUMNS);
    while (row.length < COLUMNS) row.push(null);
    rows.push(row);
  }
  return rows;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, dark } = useTheme();
  const { s, f, row, rtl, end, alignStart, textAlign, writingDirection, language, setLanguage, categoryName } =
    useI18n();
  const styles = useStyles();
  const savedCount = useFavourites().list.length;
  const location = useLocation();
  const categories = useCategories();

  const [radiusM, setRadiusM] = useState<RadiusM>(DEFAULT_RADIUS);
  const [selected, setSelected] = useState<Category | null>(null);
  const [openParent, setOpenParent] = useState<CategoryNode | null>(null);
  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);

  // Android Back closes the second level before it leaves the app.
  useEffect(() => {
    if (!openParent) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpenParent(null);
      return true;
    });
    return () => subscription.remove();
  }, [openParent]);

  const toggle = useCallback((category: Category) => {
    setSelected((current) => (current?.id === category.id ? null : category));
  }, []);

  const query = name.trim();

  // A name of 2+ letters travels with the search; a shorter one is ignored.
  const search = () => {
    router.push({
      pathname: '/results',
      params: {
        radius: String(radiusM),
        ...(selected ? { category_id: String(selected.id) } : {}),
        ...(query.length >= NAME_MIN ? { q: query } : {}),
      },
    });
  };

  // The keyboard's search key: nothing happens until the name is long enough.
  const submitName = () => {
    if (query.length >= NAME_MIN) search();
  };

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const LocationIcon = location.status === 'located' ? LocateFixed : MapPin;
  const locationText =
    location.status === 'locating'
      ? s.home.locating
      : location.status === 'located'
        ? s.home.located
        : s.home.fallback;

  return (
    <View style={styles.screen}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.column}>
          <View style={[styles.brandRow, { flexDirection: row }]}>
            <Txt role="headline" color="primary" accessibilityRole="header">
              {s.appName}
            </Txt>
            <View style={[styles.brandActions, { flexDirection: row }]}>
              {/* Saved providers; the teal badge counts them. */}
              <View>
                <IconButton
                  icon={Heart}
                  label={savedCount > 0 ? f(s.saved.openCount, { n: savedCount }) : s.saved.open}
                  onPress={() => router.push('/saved')}
                />
                {savedCount > 0 ? (
                  <View
                    style={[styles.savedBadge, end(space.none)]}
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <Txt role="caption" color="onPrimary" ltr>
                      {savedCount > 99 ? '99+' : savedCount}
                    </Txt>
                  </View>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.language.switchToLabel}
                onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                android_ripple={{ color: colors.surfaceTintStrong }}
                style={styles.languageTarget}
              >
                <View style={styles.language}>
                  <Txt role="label" color="text">
                    {s.language.switchTo}
                  </Txt>
                </View>
              </Pressable>
            </View>
          </View>

          <Txt role="display" accessibilityRole="header">
            {s.home.question}
          </Txt>

          <View
            style={[styles.locationPill, { alignSelf: alignStart, flexDirection: row }]}
            accessibilityLiveRegion="polite"
          >
            {location.status === 'locating' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              // The one coral point of the design: a "you are here" disc.
              <View style={styles.pin}>
                <LocationIcon color={colors.onAccent} size={size.iconSmall} strokeWidth={size.lineBold} />
              </View>
            )}
            <Txt role="label" color="textMuted" style={styles.locationText}>
              {locationText}
            </Txt>
            {location.status === 'fallback' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityHint={s.home.fallbackHint}
                onPress={location.retry}
                android_ripple={{ color: colors.surfaceTintStrong }}
                style={styles.locationAction}
              >
                <Txt role="label" color="onPrimarySoft" style={styles.underline}>
                  {s.home.useMyLocation}
                </Txt>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          {/* Search by name: an aqua field; the border turns teal while typing. */}
          <View
            style={[styles.field, { flexDirection: row }, nameFocused ? styles.fieldFocused : null]}
          >
            <View style={styles.fieldIcon}>
              <Search color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={submitName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              placeholder={s.home.searchPlaceholder}
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={s.home.searchPlaceholder}
              accessibilityHint={s.home.searchHint}
              returnKeyType="search"
              enterKeyHint="search"
              autoCorrect={false}
              autoCapitalize="words"
              maxLength={NAME_MAX}
              selectionColor={colors.primary}
              hitSlop={{ top: space.xs, bottom: space.xs }}
              style={[styles.fieldInput, NO_FOCUS_RING, { textAlign, writingDirection }]}
            />
            {name.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.home.clearSearch}
                onPress={() => setName('')}
                android_ripple={{ color: colors.surfaceTintStrong, borderless: true }}
                style={styles.fieldClear}
              >
                <X color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
              </Pressable>
            ) : null}
          </View>

          {openParent ? (
            <View style={[styles.levelHeader, { flexDirection: row }]}>
              <IconButton icon={BackIcon} label={s.home.allCategories} onPress={() => setOpenParent(null)} />
              <Txt role="title" accessibilityRole="header" style={styles.levelTitle}>
                {categoryName(openParent)}
              </Txt>
            </View>
          ) : (
            <Txt role="title" accessibilityRole="header" style={styles.sectionTitle}>
              {s.home.categories}
            </Txt>
          )}

          {categories.status === 'loading' ? (
            <View style={styles.grid} accessible accessibilityLabel={s.results.loading}>
              {[0, 1, 2, 3].map((r) => (
                <View key={r} style={[styles.gridRow, { flexDirection: row }]}>
                  <Skeleton height={size.tile} round={radius.lg} style={styles.cell} />
                  <Skeleton height={size.tile} round={radius.lg} style={styles.cell} />
                </View>
              ))}
            </View>
          ) : null}

          {categories.status === 'error' ? (
            <StateView
              alert
              icon={WifiOff}
              title={s.home.categoriesError}
              body={s.home.categoriesErrorBody}
              actionLabel={s.common.tryAgain}
              onAction={categories.reload}
              actionVariant="outline"
            />
          ) : null}

          {categories.status === 'ready' && !openParent ? (
            <View style={styles.grid}>
              {toRows(categories.tree).map((cells, r) => (
                <View key={r} style={[styles.gridRow, { flexDirection: row }]}>
                  {cells.map((node, c) =>
                    node ? (
                      <CategoryTile
                        key={node.id}
                        icon={node.icon}
                        label={categoryName(node)}
                        hasChildren={node.children.length > 0}
                        selected={selected?.id === node.id || selected?.parent_id === node.id}
                        selectedChild={
                          selected?.parent_id === node.id ? categoryName(selected) : undefined
                        }
                        onPress={() => (node.children.length > 0 ? setOpenParent(node) : toggle(node))}
                      />
                    ) : (
                      <View key={`pad-${c}`} style={styles.cell} />
                    ),
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {categories.status === 'ready' && openParent ? (
            <View style={styles.grid}>
              {toRows<Category>([openParent, ...openParent.children]).map((cells, r) => (
                <View key={r} style={[styles.gridRow, { flexDirection: row }]}>
                  {cells.map((category, c) =>
                    category ? (
                      <CategoryTile
                        key={category.id}
                        icon={category.icon}
                        label={
                          category.id === openParent.id
                            ? f(s.home.allIn, { name: categoryName(category) })
                            : categoryName(category)
                        }
                        selected={selected?.id === category.id}
                        onPress={() => toggle(category)}
                      />
                    ) : (
                      <View key={`pad-${c}`} style={styles.cell} />
                    ),
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {/* A quiet way to tell Haddak about someone who is not listed yet. */}
          {categories.status === 'ready' ? (
            <TextLink label={s.home.suggest} onPress={() => router.push('/suggest')} style={styles.suggest} />
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.column, styles.dockInner]}>
          <Txt role="label" color="textMuted">
            {s.radius.label}
          </Txt>
          <RadiusChips value={radiusM} onChange={setRadiusM} />
          <Button
            label={selected ? f(s.home.searchIn, { name: categoryName(selected) }) : s.home.searchAll}
            icon={Search}
            onPress={search}
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  // Keeps content at a readable width on tablets and web.
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  brandRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  brandActions: {
    alignItems: 'center',
    gap: space.xs,
  },
  // Count on the heart: a small teal pill at its top end corner, ringed in the ground colour.
  savedBadge: {
    position: 'absolute',
    top: space.none,
    minWidth: space.xl + space.xxs,
    height: space.xl + space.xxs,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    borderWidth: size.lineBold,
    borderColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageTarget: {
    minHeight: size.touch,
    justifyContent: 'center',
  },
  language: {
    backgroundColor: c.surface,
    borderWidth: size.lineMid,
    borderColor: c.outline,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  // The location line is an aqua pill.
  locationPill: {
    alignItems: 'center',
    gap: space.sm,
    minHeight: size.touch,
    backgroundColor: c.surfaceTint,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    marginTop: space.sm,
    maxWidth: '100%',
  },
  pin: {
    width: size.pin,
    height: size.pin,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    flexShrink: 1,
  },
  locationAction: {
    justifyContent: 'center',
    minHeight: size.touch,
    minWidth: size.touch,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  // Same aqua and radius as the facts strips; 48 dp high.
  field: {
    alignItems: 'center',
    minHeight: size.touch,
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    borderWidth: size.lineMid,
    borderColor: c.surfaceTint,
    marginBottom: space.lg,
  },
  fieldFocused: {
    borderColor: c.primary,
  },
  fieldInput: {
    ...typeScale.body,
    flex: 1,
    minWidth: 0,
    // 40 dp inside the 48 dp field (hitSlop covers the rest), so it never draws over the border.
    minHeight: size.segment,
    color: c.text,
    paddingHorizontal: space.sm,
    paddingVertical: space.none,
  },
  // Lines the search icon up with the clear button's 48 dp box on the other side.
  fieldIcon: {
    width: size.touch - space.sm,
    alignItems: 'flex-end',
  },
  fieldClear: {
    width: size.touch,
    height: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    marginBottom: space.md,
  },
  levelHeader: {
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.md,
  },
  levelTitle: {
    flex: 1,
  },
  grid: {
    gap: space.sm,
  },
  gridRow: {
    gap: space.sm,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  suggest: {
    marginTop: space.md,
  },
  dock: {
    backgroundColor: c.surface,
    borderTopWidth: size.hairline,
    borderTopColor: c.border,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  dockInner: {
    gap: space.sm,
  },
}));
