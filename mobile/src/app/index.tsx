import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Heart, LocateFixed, MapPin, Search, UserRound, WifiOff, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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
import { CategoryTile, type TileTone } from '@/components/CategoryTile';
import { IconButton } from '@/components/IconButton';
import { RadiusChips } from '@/components/RadiusChips';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { StoriesRow } from '@/components/StoriesRow';
import { TextLink } from '@/components/TextLink';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { requireSignIn } from '@/lib/auth';
import { useCategories, type CategoryNode } from '@/lib/categories';
import { useFavourites } from '@/lib/favourites';
import { useLocation } from '@/lib/location';
import { DEFAULT_RADIUS, type RadiusM } from '@/lib/radius';
import { makeStyles, opacity, radius, size, space, type as typeScale, useTheme } from '@/theme';

/** Limits of the search endpoint's `q` parameter (docs/API.md). */
const NAME_MIN = 2;
const NAME_MAX = 60;

// Web only: the field shows focus itself, so the browser's ring is turned off.
// ('none' is valid CSS but missing from React Native's types, hence the cast.)
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

// The grid is laid out two tiles to a row. Rows alternate wide + narrow and
// narrow + wide, and the colours repeat every four tiles, so lavender and mint
// step diagonally down the page instead of forming columns.
const ROW_SHARES: [number, number][] = [
  [3, 2],
  [2, 3],
];
const TONES: TileTone[] = ['accent', 'plain', 'plain', 'mint'];

/** Split a list into rows of two. A last tile on its own takes the full width. */
function toRows<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
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
  const [openParent, setOpenParent] = useState<CategoryNode | null>(null);
  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);

  // Android Back closes the second level before it leaves the app.
  useEffect(() => {
    if (!openParent) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpenParent(null);
      return true;
    });
    return () => subscription.remove();
  }, [openParent]);

  const query = name.trim();

  // One tap on a category searches. A name of 2+ letters travels with it; a shorter one is ignored.
  const search = (category?: Category) => {
    router.push({
      pathname: '/results',
      params: {
        radius: String(radiusM),
        ...(category ? { category_id: String(category.id) } : {}),
        ...(query.length >= NAME_MIN ? { q: query } : {}),
      },
    });
  };

  // The keyboard's search key and the round button: nothing happens until the name is long enough.
  const submitName = () => {
    if (query.length >= NAME_MIN) search();
  };

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const ForwardIcon = rtl ? ArrowLeft : ArrowRight;
  const LocationIcon = location.status === 'located' ? LocateFixed : MapPin;
  const locationText =
    location.status === 'locating'
      ? s.home.locating
      : location.status === 'located'
        ? s.home.located
        : s.home.fallback;

  // What the grid shows: the top level, or one parent ("All ..." first) and its children.
  const tiles: { category: Category; label: string; hasChildren: boolean; onPress: () => void }[] =
    categories.status !== 'ready'
      ? []
      : openParent
        ? [openParent, ...openParent.children].map((category) => ({
            category,
            label:
              category.id === openParent.id
                ? f(s.home.allIn, { name: categoryName(category) })
                : categoryName(category),
            hasChildren: false,
            onPress: () => search(category),
          }))
        : categories.tree.map((node) => ({
            category: node,
            label: categoryName(node),
            hasChildren: node.children.length > 0,
            onPress: () => (node.children.length > 0 ? setOpenParent(node) : search(node)),
          }));

  return (
    <View style={styles.screen}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
        <View style={[styles.column, styles.brandRow, { flexDirection: row }]}>
          <Txt role="headline" accessibilityRole="header">
            {s.appName}
          </Txt>
          <View style={[styles.brandActions, { flexDirection: row }]}>
            {/* Who you follow, their updates, and your account. */}
            <IconButton icon={UserRound} label={s.account.open} onPress={() => router.push('/following')} />
            {/* Saved providers; the lavender badge counts them. */}
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
                  <Txt role="caption" color="onAccent" ltr>
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
                <Txt role="label">{s.language.switchTo}</Txt>
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xxl }]}
      >
        <View style={[styles.column, styles.stack]}>
          {/* The lavender block, kept calm: the question, where the search is centred, the assistant, search by name. */}
          <View style={styles.hero}>
            <Txt role="display" color="onHero" accessibilityRole="header">
              {s.home.question}
            </Txt>

            <View style={[styles.locationRow, { flexDirection: row }]} accessibilityLiveRegion="polite">
              {location.status === 'locating' ? (
                <ActivityIndicator size="small" color={colors.mint} />
              ) : (
                <View style={styles.pin}>
                  <LocationIcon color={colors.onMint} size={size.iconSmall} strokeWidth={size.lineBold} />
                </View>
              )}
              <Txt role="label" color="onHeroMuted" style={styles.locationText}>
                {locationText}
              </Txt>
              {location.status === 'fallback' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={s.home.fallbackHint}
                  onPress={location.retry}
                  hitSlop={space.md}
                >
                  <Txt role="label" color="onHero" style={styles.underline}>
                    {s.home.useMyLocation}
                  </Txt>
                </Pressable>
              ) : null}
            </View>

            {/* The assistant: one big white entry that looks like a field. Nothing else competes with it. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={s.assist.name}
              accessibilityHint={s.assist.openHint}
              onPress={() => router.push('/assist')}
              android_ripple={{ color: colors.surfaceTintStrong }}
              style={({ pressed }) => [styles.ask, { flexDirection: row }, pressed ? styles.askPressed : null]}
            >
              <View style={styles.askText}>
                <Txt role="headline">{s.assist.name}</Txt>
                <Txt role="bodyLarge" color="textMuted">
                  {s.assist.hint}
                </Txt>
              </View>
              <View style={styles.askGo}>
                <ForwardIcon color={colors.onPrimary} size={size.iconLarge} strokeWidth={size.lineBold} />
              </View>
            </Pressable>

            {/* Search by name stays, one tap away: the assistant took the field's place. */}
            {nameOpen ? (
              <View style={[styles.field, { flexDirection: row }, nameFocused ? styles.fieldFocused : null]}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={submitName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  // It only appears after "Search by name" was tapped, so the keyboard comes up at once.
                  autoFocus
                  placeholder={s.home.searchPlaceholder}
                  placeholderTextColor={colors.textSubtle}
                  accessibilityLabel={s.home.searchPlaceholder}
                  accessibilityHint={s.home.searchHint}
                  returnKeyType="search"
                  enterKeyHint="search"
                  autoCorrect={false}
                  autoCapitalize="words"
                  maxLength={NAME_MAX}
                  selectionColor={colors.accentStrong}
                  style={[styles.fieldInput, NO_FOCUS_RING, { textAlign, writingDirection }]}
                />
                {name.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={s.home.clearSearch}
                    onPress={() => setName('')}
                    hitSlop={{ top: space.xs, bottom: space.xs }}
                    style={styles.fieldClear}
                  >
                    <X color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={s.home.search}
                  accessibilityHint={s.home.searchHint}
                  accessibilityState={{ disabled: query.length < NAME_MIN }}
                  onPress={submitName}
                  hitSlop={space.xs}
                  style={({ pressed }) => [styles.fieldGo, pressed ? styles.dim : null]}
                >
                  <Search color={colors.onMint} size={size.icon} strokeWidth={size.lineBold} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setNameOpen(true)}
                hitSlop={space.md}
                style={[styles.nameToggle, { flexDirection: row, alignSelf: alignStart }]}
              >
                <Search color={colors.onHero} size={size.iconSmall} strokeWidth={size.lineBold} />
                <Txt role="label" color="onHero" style={styles.underline}>
                  {s.home.searchPlaceholder}
                </Txt>
              </Pressable>
            )}
          </View>

          {/* Distance: one compact row. It applies to whatever is tapped below. */}
          <View style={[styles.radiusRow, { flexDirection: row }]}>
            <Txt role="label" color="textMuted">
              {s.radius.label}
            </Txt>
            <RadiusChips value={radiusM} onChange={setRadiusM} style={styles.radiusChips} />
          </View>

          {/* Updates from providers inside the chosen distance. Not there when nobody posted. */}
          {openParent ? null : (
            <StoriesRow
              coords={location.coords}
              radiusM={radiusM}
              ready={location.status !== 'locating'}
              onOpen={(provider) =>
                router.push({ pathname: '/stories/[providerId]', params: { providerId: provider.id } })
              }
            />
          )}

          {openParent ? (
            <View style={[styles.levelHeader, { flexDirection: row }]}>
              <IconButton icon={BackIcon} label={s.home.allCategories} onPress={() => setOpenParent(null)} />
              <Txt role="headline" accessibilityRole="header" style={styles.levelTitle}>
                {categoryName(openParent)}
              </Txt>
            </View>
          ) : (
            <Txt role="headline" accessibilityRole="header" style={styles.sectionTitle}>
              {s.home.categories}
            </Txt>
          )}

          {categories.status === 'loading' ? (
            <View style={styles.grid} accessible accessibilityLabel={s.results.loading}>
              {[0, 1, 2].map((r) => (
                <View key={r} style={[styles.gridRow, { flexDirection: row }]}>
                  <Skeleton height={size.tile} round={radius.lg} style={{ flex: ROW_SHARES[r % 2][0] }} />
                  <Skeleton height={size.tile} round={radius.lg} style={{ flex: ROW_SHARES[r % 2][1] }} />
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

          {categories.status === 'ready' ? (
            <View style={styles.grid}>
              {toRows(tiles).map((cells, r) => (
                <View key={r} style={[styles.gridRow, { flexDirection: row }]}>
                  {cells.map((tile, c) => (
                    <CategoryTile
                      key={tile.category.id}
                      icon={tile.category.icon}
                      label={tile.label}
                      tone={TONES[(r * 2 + c) % TONES.length]}
                      grow={cells.length === 1 ? 1 : ROW_SHARES[r % 2][c]}
                      hasChildren={tile.hasChildren}
                      onPress={tile.onPress}
                    />
                  ))}
                </View>
              ))}

              {/* No category in mind: everyone around, best rated first. */}
              {!openParent ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={s.home.searchAll}
                  onPress={() => search()}
                  android_ripple={{ color: colors.surfaceTintStrong }}
                  style={({ pressed }) => [styles.everyone, { flexDirection: row }, pressed ? styles.dim : null]}
                >
                  <View style={styles.everyoneText}>
                    <Txt role="action">{s.home.everyone}</Txt>
                    <Txt role="label" color="textMuted">
                      {s.home.everyoneHint}
                    </Txt>
                  </View>
                  <View style={styles.everyoneGo}>
                    <ForwardIcon color={colors.onPrimary} size={size.icon} strokeWidth={size.lineBold} />
                  </View>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* A quiet way to tell Haddak about someone who is not listed yet. */}
          {categories.status === 'ready' ? (
            <TextLink label={s.home.suggest} onPress={() => router.push('/suggest')} />
          ) : null}
          {/* For owners: list their own business. It needs an account, so signing in comes first. */}
          <TextLink
            label={s.join.homeLink}
            onPress={() => {
              if (requireSignIn(() => router.push('/join'))) router.push('/join');
            }}
          />
        </View>
      </ScrollView>
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
  },
  brandRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandActions: {
    alignItems: 'center',
    gap: space.xs,
  },
  // Count on the heart: a small lavender pill at its top end corner, ringed in the ground colour.
  savedBadge: {
    position: 'absolute',
    top: space.none,
    minWidth: space.xl + space.xxs,
    height: space.xl + space.xxs,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
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
    backgroundColor: c.surfaceTint,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  stack: {
    gap: space.lg,
  },
  hero: {
    backgroundColor: c.hero,
    borderRadius: radius.sheet,
    padding: space.xl,
    gap: space.md,
  },
  locationRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: space.sm,
    rowGap: space.xs,
  },
  pin: {
    width: size.pin,
    height: size.pin,
    borderRadius: radius.pill,
    backgroundColor: c.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    flexShrink: 1,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  // "Ask Jarak AI": a white block as tall as two lines of big text, with the ink arrow at its end.
  ask: {
    alignItems: 'center',
    gap: space.md,
    minHeight: size.askEntry,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingStart: space.xl,
    paddingEnd: space.md,
    marginTop: space.xs,
    overflow: 'hidden',
  },
  askPressed: {
    backgroundColor: c.surfaceTint,
  },
  askText: {
    flex: 1,
    minWidth: 0,
  },
  askGo: {
    width: size.buttonLarge,
    height: size.buttonLarge,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameToggle: {
    alignItems: 'center',
    gap: space.sm,
    minHeight: size.touch,
  },
  field: {
    alignItems: 'center',
    minHeight: size.button,
    backgroundColor: c.background,
    borderRadius: radius.pill,
    borderWidth: size.lineBold,
    borderColor: c.background,
    paddingHorizontal: space.xs,
    marginTop: space.sm,
  },
  fieldFocused: {
    borderColor: c.mint,
  },
  fieldInput: {
    ...typeScale.body,
    flex: 1,
    minWidth: 0,
    minHeight: size.segment + space.xs,
    color: c.text,
    paddingHorizontal: space.md,
    paddingVertical: space.none,
  },
  fieldClear: {
    width: size.segment + space.xs,
    height: size.segment + space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The round mint button inside the field: 40 dp to the eye, 48 with its hitSlop.
  fieldGo: {
    width: size.segment + space.xs,
    height: size.segment + space.xs,
    borderRadius: radius.pill,
    backgroundColor: c.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: opacity.pressed,
  },
  radiusRow: {
    alignItems: 'center',
    gap: space.md,
  },
  radiusChips: {
    flex: 1,
  },
  sectionTitle: {
    marginTop: space.sm,
  },
  levelHeader: {
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.sm,
    // The back button has its own air around the arrow; this lines the arrow up with the page edge.
    marginHorizontal: -space.md,
  },
  levelTitle: {
    flex: 1,
  },
  grid: {
    gap: space.sm + space.xxs,
  },
  gridRow: {
    gap: space.sm + space.xxs,
  },
  // "Everyone nearby": a wide grey block with an ink arrow button.
  everyone: {
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
  everyoneText: {
    flex: 1,
    minWidth: 0,
  },
  everyoneGo: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
