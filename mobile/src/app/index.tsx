import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Heart, LocateFixed, MapPin, Mic, Search, UserRound, WifiOff, X } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
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
import { DemoDataPill } from '@/components/AppNotices';
import { CategoryTile, type TileTone } from '@/components/CategoryTile';
import { IconButton } from '@/components/IconButton';
import { JarakMark } from '@/components/JarakMark';
import { RadiusChips } from '@/components/RadiusChips';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { StoriesRow } from '@/components/StoriesRow';
import { TextLink } from '@/components/TextLink';
import { Txt, useTypeScale } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { requireSignIn } from '@/lib/auth';
import { homeGroups, useCategories, type CategoryNode } from '@/lib/categories';
import { useFavourites } from '@/lib/favourites';
import { useLocation } from '@/lib/location';
import { DEFAULT_RADIUS, type RadiusM } from '@/lib/radius';
import { VOICE_AVAILABLE } from '@/lib/useVoice';
import { elevation, makeStyles, press, radius, size, space, type as typeScale, useTheme } from '@/theme';

/** Limits of the search endpoint's `q` parameter (docs/API.md). */
const NAME_MIN = 2;
const NAME_MAX = 60;

// Web only: the field shows focus itself, so the browser's ring is turned off.
// ('none' is valid CSS but missing from React Native's types, hence the cast.)
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

// The grid is laid out two tiles to a row. Rows alternate wide + narrow and
// narrow + wide. The icon wells alternate alice blue and vanilla like a chessboard,
// so each colour steps diagonally down the page instead of forming a column.
const ROW_SHARES: [number, number][] = [
  [3, 2],
  [2, 3],
];
const TONES: TileTone[] = ['alice', 'vanilla'];

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
  const { s, f, row, rtl, end, textAlign, writingDirection, language, setLanguage, categoryName } = useI18n();
  const styles = useStyles();
  const font = useTypeScale().bodyLarge;
  const savedCount = useFavourites().list.length;
  const location = useLocation();
  const categories = useCategories();

  const [radiusM, setRadiusM] = useState<RadiusM>(DEFAULT_RADIUS);
  const [openParent, setOpenParent] = useState<CategoryNode | null>(null);
  // The Ask entry is two buttons when the phone can listen; the whole block greys while its text part is pressed.
  const [askPressed, setAskPressed] = useState(false);
  // The search bar: always on screen, the first thing under the question (UX rules, 2026-11-24).
  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

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

  // One tap on a category searches that category. The search bar's words are not carried
  // along: they search names, trades and areas on their own (see submitName).
  const search = (category?: Category) => {
    router.push({
      pathname: '/results',
      params: {
        radius: String(radiusM),
        ...(category ? { category_id: String(category.id) } : {}),
      },
    });
  };

  // The keyboard's search key and the round button. Too short: the field takes focus
  // instead of doing nothing, so the button never feels dead.
  const submitName = () => {
    if (query.length >= NAME_MIN) {
      router.push({ pathname: '/results', params: { radius: String(radiusM), q: query } });
    } else {
      inputRef.current?.focus();
    }
  };

  const openAllCategories = () =>
    router.push({ pathname: '/categories', params: { radius: String(radiusM) } });

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const ForwardIcon = rtl ? ArrowLeft : ArrowRight;
  const LocationIcon = location.status === 'located' ? LocateFixed : MapPin;
  const locationText =
    location.status === 'locating'
      ? s.home.locating
      : location.status === 'located'
        ? s.home.located
        : s.home.fallback;

  // What the grid shows: a few everyday groups and "All categories" (the rest lives on its
  // own screen, so Home stays calm with 143 categories), or one parent ("All ..." first) and its children.
  type Tile = { key: string; icon: string; label: string; hasChildren: boolean; onPress: () => void };
  const tiles: Tile[] =
    categories.status !== 'ready'
      ? []
      : openParent
        ? [openParent, ...openParent.children].map((category) => ({
            key: String(category.id),
            icon: category.icon,
            label:
              category.id === openParent.id
                ? f(s.home.allIn, { name: categoryName(category) })
                : categoryName(category),
            hasChildren: false,
            onPress: () => search(category),
          }))
        : [
            ...homeGroups(categories.tree).map((node) => ({
              key: String(node.id),
              icon: node.icon,
              label: categoryName(node),
              hasChildren: node.children.length > 0,
              onPress: () => (node.children.length > 0 ? setOpenParent(node) : search(node)),
            })),
            // Last, on its own row at full width: the way to everything else.
            {
              key: 'all',
              icon: 'all-categories',
              label: s.home.allCategories,
              hasChildren: true,
              onPress: openAllCategories,
            },
          ];

  return (
    <View style={styles.screen}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
        <View style={[styles.column, styles.brandRow, { flexDirection: row }]}>
          <View style={[styles.brandName, { flexDirection: row }]}>
            <Txt role="headline" accessibilityRole="header">
              {s.appName}
            </Txt>
            {/* Only when the app runs on built-in fake data. */}
            <DemoDataPill />
          </View>
          <View style={[styles.brandActions, { flexDirection: row }]}>
            {/* Who you follow, their updates, and your account. */}
            <IconButton icon={UserRound} label={s.account.open} onPress={() => router.push('/following')} />
            {/* Saved providers; the small black badge counts them. */}
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
                  <Txt role="badge" color="onPrimary" ltr>
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
          {/* The alice-blue hero block with black words: the question, the search bar, the assistant, where the search is centred. */}
          <View style={styles.hero}>
            <Txt role="display" color="onHero" accessibilityRole="header">
              {s.home.question}
            </Txt>

            {/* Search first: one white pill that finds names, trades, shops and areas. */}
            <View style={[styles.field, { flexDirection: row }, nameFocused ? styles.fieldFocused : null]}>
              <View style={styles.fieldIcon} pointerEvents="none">
                <Search color={colors.textMuted} size={size.icon} strokeWidth={size.lineBold} />
              </View>
              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                onSubmitEditing={submitName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                placeholder={s.home.searchPlaceholder}
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={s.home.searchLabel}
                accessibilityHint={s.home.searchHint}
                returnKeyType="search"
                enterKeyHint="search"
                autoCorrect={false}
                autoCapitalize="none"
                maxLength={NAME_MAX}
                selectionColor={colors.accentStrong}
                numberOfLines={1}
                style={[styles.fieldInput, font, NO_FOCUS_RING, { textAlign, writingDirection }]}
              />
              {name.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={s.home.clearSearch}
                  onPress={() => {
                    setName('');
                    inputRef.current?.focus();
                  }}
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
                onPress={submitName}
                hitSlop={space.xxs}
                android_ripple={{ color: colors.primaryPressed, borderless: true }}
                style={({ pressed }) => [styles.fieldGo, pressed ? styles.askGoPressed : null]}
              >
                <ForwardIcon color={colors.onPrimary} size={size.icon} strokeWidth={size.lineBold} />
              </Pressable>
            </View>

            {/* The assistant, right under the search bar: voice users are still one tap from the microphone. */}
            {VOICE_AVAILABLE ? (
              // With a speech module (the development build): the block opens the assistant to type,
              // the round black disc at its end opens it already listening.
              <View style={[styles.ask, styles.askSplit, { flexDirection: row }, askPressed ? styles.askPressed : null]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={s.assist.name}
                  accessibilityHint={s.assist.openHint}
                  onPress={() => router.push('/assist')}
                  onPressIn={() => setAskPressed(true)}
                  onPressOut={() => setAskPressed(false)}
                  style={styles.askOpen}
                >
                  <View style={[styles.askTitle, { flexDirection: row }]}>
                    <JarakMark />
                    <Txt role="headline" style={styles.askName}>
                      {s.assist.name}
                    </Txt>
                  </View>
                  <Txt role="bodyLarge" color="textMuted">
                    {s.assist.hintVoice}
                  </Txt>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={s.assist.speak}
                  accessibilityHint={s.assist.speakOpenHint}
                  onPress={() => router.push({ pathname: '/assist', params: { listen: '1' } })}
                  android_ripple={{ color: colors.primaryPressed, borderless: true }}
                  style={({ pressed }) => [styles.askGo, pressed ? styles.askGoPressed : null]}
                >
                  <Mic color={colors.onPrimary} size={size.iconLarge} strokeWidth={size.lineBold} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.assist.name}
                accessibilityHint={s.assist.openHint}
                onPress={() => router.push('/assist')}
                android_ripple={{ color: colors.surfaceTintStrong }}
                style={({ pressed }) => [styles.ask, { flexDirection: row }, pressed ? styles.askPressed : null]}
              >
                <View style={styles.askText}>
                  <View style={[styles.askTitle, { flexDirection: row }]}>
                    <JarakMark />
                    <Txt role="headline" style={styles.askName}>
                      {s.assist.name}
                    </Txt>
                  </View>
                  <Txt role="bodyLarge" color="textMuted">
                    {s.assist.hint}
                  </Txt>
                </View>
                <View style={styles.askGo}>
                  <ForwardIcon color={colors.onPrimary} size={size.iconLarge} strokeWidth={size.lineBold} />
                </View>
              </Pressable>
            )}

            {/* Where the search is centred: a quiet line that closes the block. */}
            <View style={[styles.locationRow, { flexDirection: row }]} accessibilityLiveRegion="polite">
              {location.status === 'locating' ? (
                <ActivityIndicator size="small" color={colors.onHero} />
              ) : (
                <View style={styles.pin}>
                  <LocationIcon color={colors.onHero} size={size.iconSmall} strokeWidth={size.lineBold} />
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
                  hitSlop={{ top: space.sm, bottom: space.sm, left: space.xs, right: space.xs }}
                  style={({ pressed }) => [styles.heroChip, pressed ? styles.heroChipPressed : null]}
                >
                  <Txt role="label" color="onHero">
                    {s.home.useMyLocation}
                  </Txt>
                </Pressable>
              ) : null}
            </View>
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
                      key={tile.key}
                      icon={tile.icon}
                      label={tile.label}
                      tone={TONES[(r + c) % TONES.length]}
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
                  style={({ pressed }) => [styles.everyone, { flexDirection: row }, pressed ? styles.everyonePressed : null]}
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
  brandName: {
    alignItems: 'center',
    gap: space.sm,
    flexShrink: 1,
  },
  brandActions: {
    alignItems: 'center',
    gap: space.xs,
  },
  // Count on the heart: a small black pill at its top end corner, ringed in the ground colour.
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
  // An outlined pill, like every unselected chip.
  language: {
    borderWidth: size.hairline,
    borderColor: c.border,
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
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.lg,
    gap: space.md,
  },
  locationRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: space.sm,
    rowGap: space.xs,
  },
  // "You are here": a white disc with a black pin on the alice-blue block.
  pin: {
    width: size.pin,
    height: size.pin,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    flexShrink: 1,
  },
  // Quiet controls inside the alice-blue block: soft white pills with black words, never underlined links.
  heroChip: {
    minHeight: size.badge + space.sm,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.heroControl,
  },
  heroChipPressed: {
    backgroundColor: c.heroControlPressed,
  },
  // "Ask Jarak AI": a white block as tall as two lines of big text, with the round black arrow at its end.
  // Flat: on the alice-blue block, white is separation enough.
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
    backgroundColor: c.surfaceInset,
    transform: [{ scale: press.scale }],
  },
  // Split entry: the text part carries its own padding so the whole of it is the tap area.
  askSplit: {
    paddingVertical: 0,
    paddingStart: 0,
  },
  askOpen: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: space.md,
    paddingStart: space.xl,
  },
  askGoPressed: {
    backgroundColor: c.primaryPressed,
  },
  askText: {
    flex: 1,
    minWidth: 0,
  },
  // The vanilla Jarak AI mark, then the name.
  askTitle: {
    alignItems: 'center',
    gap: space.sm,
  },
  askName: {
    flexShrink: 1,
  },
  // A round black button with a white arrow, as in the founder's reference (16:1).
  askGo: {
    width: size.buttonLarge,
    height: size.buttonLarge,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The search bar: a tall white pill inside the alice-blue block, a magnifier at the
  // start and the round black go button at the end, like the Ask entry under it.
  field: {
    alignItems: 'center',
    minHeight: size.buttonLarge + space.xs,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    borderWidth: size.lineBold,
    borderColor: c.surface,
    paddingStart: space.md,
    paddingEnd: space.xs,
    marginTop: space.xs,
  },
  // The edge turns black on focus.
  fieldFocused: {
    borderColor: c.onHero,
  },
  fieldIcon: {
    width: size.icon + space.xs,
    alignItems: 'center',
  },
  fieldInput: {
    ...typeScale.bodyLarge,
    flex: 1,
    minWidth: 0,
    minHeight: size.touch,
    color: c.text,
    paddingHorizontal: space.sm,
    paddingVertical: space.none,
  },
  fieldClear: {
    width: size.touch - space.xs,
    height: size.touch - space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The round black go button: 44 dp to the eye, 48 with its hitSlop.
  fieldGo: {
    width: size.touch - space.xs,
    height: size.touch - space.xs,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  radiusRow: {
    alignItems: 'center',
    gap: space.md,
  },
  radiusChips: {
    flex: 1,
  },
  // More air above a section title than below it.
  sectionTitle: {
    marginTop: space.md,
    marginBottom: -space.xs,
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
    gap: space.md,
  },
  gridRow: {
    gap: space.md,
  },
  // "Everyone nearby": a wide white block with a round black arrow button.
  everyone: {
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    overflow: 'hidden',
    boxShadow: elevation.card,
  },
  everyonePressed: {
    backgroundColor: c.surfaceInset,
    transform: [{ scale: press.scale }],
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
