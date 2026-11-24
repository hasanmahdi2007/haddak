import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Search,
  SearchX,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, type TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Category } from '@/api';
import { CategoryIcon } from '@/components/CategoryIcon';
import { IconButton } from '@/components/IconButton';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { Txt, useTypeScale } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { searchWords, useCategories, type CategoryNode } from '@/lib/categories';
import { normalizeText } from '@/lib/normalize';
import { parseRadius } from '@/lib/radius';
import { elevation, makeStyles, press, radius, size, space, type as typeScale, useTheme } from '@/theme';

/** Limits of the search endpoint's `q` parameter (docs/API.md). */
const Q_MIN = 2;
const Q_MAX = 60;

// Web only: the field shows focus itself, so the browser's ring is turned off.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** The icon wells alternate like Home's grid: alice blue, vanilla. */
const WELLS = ['accent', 'signature'] as const;

/** One group as the filter sees it: the group, and which of its children to show. */
interface FilteredGroup {
  group: CategoryNode;
  /** The group's own name or alias matched: every child is shown. */
  groupMatched: boolean;
  children: Category[];
}

/**
 * "All categories": every group and its children (143 categories in about 23
 * groups, docs/SCHEMA.md). Calm by default: groups only, two to a row; tapping one
 * opens its children under it. The filter at the top narrows everything on the
 * phone, instantly, by English and Arabic names and aliases. Whatever is typed can
 * also be searched everywhere (names, shops and areas), so a filter never ends in
 * a dead end.
 */
export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, f, row, rtl, plural, categoryName, textAlign, writingDirection } = useI18n();
  const styles = useStyles();
  const font = useTypeScale().bodyLarge;
  const params = useLocalSearchParams<{ radius?: string }>();
  const radiusM = parseRadius(params.radius);
  const categories = useCategories();

  const [filter, setFilter] = useState('');
  const [focused, setFocused] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const typed = filter.trim();
  const needle = normalizeText(typed);

  // Normalized words for every category, worked out once per list (not per keystroke).
  const words = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const group of categories.tree) {
      map.set(group.id, searchWords(group));
      for (const child of group.children) map.set(child.id, searchWords(child));
    }
    return map;
  }, [categories.tree]);

  const filtered = useMemo<FilteredGroup[]>(() => {
    if (!needle) return [];
    const hit = (category: Category) => (words.get(category.id) ?? []).some((word) => word.includes(needle));
    return categories.tree
      .map((group) => {
        const groupMatched = hit(group);
        return { group, groupMatched, children: groupMatched ? group.children : group.children.filter(hit) };
      })
      .filter((entry) => entry.groupMatched || entry.children.length > 0);
  }, [needle, words, categories.tree]);

  const totalCount = categories.tree.reduce((sum, group) => sum + 1 + group.children.length, 0);

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const GoIcon = rtl ? ArrowUpLeft : ArrowUpRight;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const openCategory = (category: Category) =>
    router.push({ pathname: '/results', params: { radius: String(radiusM), category_id: String(category.id) } });
  const searchEverywhere = () =>
    router.push({ pathname: '/results', params: { radius: String(radiusM), q: typed.slice(0, Q_MAX) } });

  /** A child category as a pill: outlined white, its icon, its name. One tap searches it. */
  const childPill = (category: Category) => (
    <Pressable
      key={category.id}
      accessibilityRole="button"
      accessibilityLabel={categoryName(category)}
      onPress={() => openCategory(category)}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={({ pressed }) => [styles.pill, { flexDirection: row }, pressed ? styles.pillPressed : null]}
    >
      <CategoryIcon icon={category.icon} color={colors.text} size={size.iconSmall} />
      <Txt role="label" numberOfLines={1} style={styles.pillText}>
        {categoryName(category)}
      </Txt>
    </Pressable>
  );

  /** "All Food & drink": the whole group, an alice-blue pill first in the panel. */
  const allPill = (group: CategoryNode) => (
    <Pressable
      key={`all-${group.id}`}
      accessibilityRole="button"
      accessibilityLabel={f(s.home.allIn, { name: categoryName(group) })}
      onPress={() => openCategory(group)}
      android_ripple={{ color: colors.accentSoft }}
      style={({ pressed }) => [styles.pill, styles.pillAll, { flexDirection: row }, pressed ? styles.pillAllPressed : null]}
    >
      <Txt role="label" color="onAccent" numberOfLines={1} style={styles.pillText}>
        {f(s.home.allIn, { name: categoryName(group) })}
      </Txt>
      <GoIcon color={colors.onAccent} size={size.iconSmall} strokeWidth={size.lineBold} />
    </Pressable>
  );

  /** A group in the two-column grid. Open: it turns black (the chosen state) and its panel opens under the row. */
  const groupTile = (group: CategoryNode, index: number) => {
    const open = group.id === openId;
    const Chevron = open ? ChevronUp : ChevronDown;
    return (
      <Pressable
        key={group.id}
        accessibilityRole="button"
        accessibilityLabel={`${categoryName(group)}, ${plural(s.categories.kinds, group.children.length)}`}
        accessibilityHint={open ? s.categories.closeGroup : s.categories.openGroup}
        accessibilityState={{ expanded: open }}
        onPress={() => (group.children.length === 0 ? openCategory(group) : setOpenId(open ? null : group.id))}
        android_ripple={{ color: open ? colors.primaryPressed : colors.surfaceTintStrong }}
        style={({ pressed }) => [
          styles.group,
          open ? styles.groupOpen : null,
          pressed ? (open ? styles.groupOpenPressed : styles.groupPressed) : null,
        ]}
      >
        <View style={[styles.groupTop, { flexDirection: row }]}>
          <View style={[styles.well, { backgroundColor: colors[WELLS[index % WELLS.length]] }]}>
            <CategoryIcon icon={group.icon} color={colors.text} size={size.icon} />
          </View>
          <Chevron color={open ? colors.onPrimary : colors.textMuted} size={size.icon} strokeWidth={size.lineBold} />
        </View>
        <View>
          <Txt role="action" color={open ? 'onPrimary' : 'text'} numberOfLines={2}>
            {categoryName(group)}
          </Txt>
          <Txt role="caption" color={open ? 'onPrimary' : 'textMuted'} numberOfLines={1}>
            {plural(s.categories.kinds, group.children.length)}
          </Txt>
        </View>
      </Pressable>
    );
  };

  // The grid, two groups to a row; the open group's children sit in a panel under its row.
  const gridRows: CategoryNode[][] = [];
  for (let i = 0; i < categories.tree.length; i += 2) gridRows.push(categories.tree.slice(i, i + 2));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.column}>
        <View style={[styles.bar, { flexDirection: row }]}>
          <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
          <View style={styles.titles}>
            <Txt role="headline" accessibilityRole="header" numberOfLines={1}>
              {s.categories.title}
            </Txt>
            {categories.status === 'ready' ? (
              <Txt role="label" color="textMuted" numberOfLines={1}>
                {f(s.categories.count, { groups: categories.tree.length, n: totalCount })}
              </Txt>
            ) : null}
          </View>
        </View>

        {/* The filter: a white pill on the ground, black edge while typing. Instant, on the phone. */}
        <View style={[styles.field, { flexDirection: row }, focused ? styles.fieldFocused : null]}>
          <View style={styles.fieldIcon} pointerEvents="none">
            <Search color={colors.textMuted} size={size.icon} strokeWidth={size.lineBold} />
          </View>
          <TextInput
            value={filter}
            onChangeText={setFilter}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => {
              if (typed.length >= Q_MIN && filtered.length === 0) searchEverywhere();
            }}
            placeholder={s.categories.filterPlaceholder}
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel={s.categories.filterLabel}
            returnKeyType="search"
            enterKeyHint="search"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={Q_MAX}
            selectionColor={colors.accentStrong}
            style={[styles.fieldInput, font, NO_FOCUS_RING, { textAlign, writingDirection }]}
          />
          {filter.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={s.categories.clearFilter}
              onPress={() => setFilter('')}
              hitSlop={{ top: space.xs, bottom: space.xs }}
              style={styles.fieldClear}
            >
              <X color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xxl }]}
      >
        <View style={[styles.column, styles.stack]}>
          {categories.status === 'loading' ? (
            <View style={styles.stack} accessible accessibilityLabel={s.results.loading}>
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

          {/* Something typed: it can always be searched everywhere, first thing in the list. */}
          {categories.status === 'ready' && typed.length >= Q_MIN ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={f(s.categories.searchEverywhere, { q: typed })}
              accessibilityHint={s.categories.searchEverywhereHint}
              onPress={searchEverywhere}
              android_ripple={{ color: colors.accentSoft }}
              style={({ pressed }) => [styles.everywhere, { flexDirection: row }, pressed ? styles.everywherePressed : null]}
            >
              <View style={styles.everywhereText}>
                <Txt role="action" color="onAccent" numberOfLines={2}>
                  {f(s.categories.searchEverywhere, { q: typed })}
                </Txt>
                <Txt role="label" color="textMuted" numberOfLines={1}>
                  {s.categories.searchEverywhereHint}
                </Txt>
              </View>
              <View style={styles.go}>
                <GoIcon color={colors.onPrimary} size={size.iconSmall} strokeWidth={size.lineBold} />
              </View>
            </Pressable>
          ) : null}

          {categories.status === 'ready' && needle && filtered.length === 0 ? (
            <StateView icon={SearchX} title={f(s.categories.noMatch, { q: typed })} body={s.categories.noMatchBody} />
          ) : null}

          {/* Filtered: one white block per group that matched, with only the matching children. */}
          {categories.status === 'ready' && needle
            ? filtered.map(({ group, groupMatched, children }, index) => (
                <View key={group.id} style={styles.section}>
                  <View style={[styles.sectionHead, { flexDirection: row }]}>
                    <View style={[styles.wellSmall, { backgroundColor: colors[WELLS[index % WELLS.length]] }]}>
                      <CategoryIcon icon={group.icon} color={colors.text} size={size.iconSmall} />
                    </View>
                    <Txt role="title" accessibilityRole="header" numberOfLines={1} style={styles.sectionTitle}>
                      {categoryName(group)}
                    </Txt>
                  </View>
                  <View style={[styles.pills, { flexDirection: row }]}>
                    {groupMatched || group.children.length === 0 ? allPill(group) : null}
                    {children.map(childPill)}
                  </View>
                </View>
              ))
            : null}

          {/* Nothing typed: every group, two to a row. */}
          {categories.status === 'ready' && !needle
            ? gridRows.map((cells, r) => {
                const open = cells.find((group) => group.id === openId);
                return (
                  <View key={r} style={styles.stack}>
                    <View style={[styles.gridRow, { flexDirection: row }]}>
                      {cells.map((group, c) => (
                        <View key={group.id} style={styles.cell}>
                          {groupTile(group, r + c)}
                        </View>
                      ))}
                      {/* A last group alone keeps half the width, so every tile is the same size. */}
                      {cells.length === 1 ? <View style={styles.cell} /> : null}
                    </View>
                    {open ? (
                      <View style={[styles.panel, styles.pills, { flexDirection: row }]}>
                        {allPill(open)}
                        {open.children.map(childPill)}
                      </View>
                    ) : null}
                  </View>
                );
              })
            : null}
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
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  bar: {
    alignItems: 'center',
    gap: space.xs,
    // The back button has its own air around the arrow.
    paddingStart: space.xs,
    paddingEnd: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  // The filter: a white pill on the ground with a light edge; black edge while typing.
  field: {
    alignItems: 'center',
    minHeight: size.buttonLarge,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    borderWidth: size.lineBold,
    borderColor: c.surface,
    paddingStart: space.md,
    paddingEnd: space.xs,
    boxShadow: elevation.card,
  },
  fieldFocused: {
    borderColor: c.primary,
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
  scroll: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  stack: {
    gap: space.md,
  },
  gridRow: {
    gap: space.md,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  // A group: a white card, the icon well and the open / close chevron on top, the name and count below.
  group: {
    flex: 1,
    minHeight: size.tile,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.md + space.xs,
    gap: space.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
    boxShadow: elevation.card,
  },
  groupPressed: {
    backgroundColor: c.surfaceInset,
    transform: [{ scale: press.scale }],
  },
  // Open is the chosen state: black with white words.
  groupOpen: {
    backgroundColor: c.primary,
  },
  groupOpenPressed: {
    backgroundColor: c.primaryPressed,
    transform: [{ scale: press.scale }],
  },
  groupTop: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  well: {
    width: size.tileIconBox - space.xs,
    height: size.tileIconBox - space.xs,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellSmall: {
    width: size.arrowDisc + space.xs,
    height: size.arrowDisc + space.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The open group's children: a white block under its row.
  panel: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.md,
    boxShadow: elevation.card,
  },
  pills: {
    flexWrap: 'wrap',
    gap: space.sm,
  },
  // A child: an outlined pill (a white tile inside a white card gets an edge, not a fill).
  pill: {
    alignItems: 'center',
    gap: space.xs + space.xxs,
    minHeight: size.segment + space.xs,
    maxWidth: '100%',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  pillPressed: {
    backgroundColor: c.surfaceTint,
  },
  pillText: {
    flexShrink: 1,
  },
  // "All ..." first in a panel: an alice-blue pill with black words and an arrow.
  pillAll: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  pillAllPressed: {
    backgroundColor: c.accentSoft,
  },
  // Filtered view: one white block per group.
  section: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
    boxShadow: elevation.card,
  },
  sectionHead: {
    alignItems: 'center',
    gap: space.sm,
  },
  sectionTitle: {
    flex: 1,
  },
  // "Search “x” everywhere": the alice-blue info block with the round black arrow.
  everywhere: {
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.accent,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
  everywherePressed: {
    transform: [{ scale: press.scale }],
  },
  everywhereText: {
    flex: 1,
    minWidth: 0,
  },
  go: {
    width: size.arrowDisc + space.sm,
    height: size.arrowDisc + space.sm,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
