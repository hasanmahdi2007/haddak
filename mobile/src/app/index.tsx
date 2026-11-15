import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, LocateFixed, MapPin, Search, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Category } from '@/api';
import { Button } from '@/components/Button';
import { CategoryTile } from '@/components/CategoryTile';
import { IconButton } from '@/components/IconButton';
import { RadiusChips } from '@/components/RadiusChips';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { useCategories, type CategoryNode } from '@/lib/categories';
import { useLocation } from '@/lib/location';
import { DEFAULT_RADIUS, type RadiusM } from '@/lib/radius';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

const COLUMNS = 3;

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
  const { colors } = useTheme();
  const { s, f, row, rtl, language, setLanguage, categoryName } = useI18n();
  const styles = useStyles();
  const location = useLocation();
  const categories = useCategories();

  const [radiusM, setRadiusM] = useState<RadiusM>(DEFAULT_RADIUS);
  const [selected, setSelected] = useState<Category | null>(null);
  const [openParent, setOpenParent] = useState<CategoryNode | null>(null);

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

  const search = () => {
    router.push({
      pathname: '/results',
      params: { radius: String(radiusM), ...(selected ? { category_id: String(selected.id) } : {}) },
    });
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
      <StatusBar style="light" />

      <View style={[styles.shell, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.column}>
          <View style={[styles.brandRow, { flexDirection: row }]}>
            <Txt role="headline" color="onShell" accessibilityRole="header">
              {s.appName}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={s.language.switchToLabel}
              onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              android_ripple={{ color: colors.shellLine }}
              style={styles.languageTarget}
            >
              <View style={styles.language}>
                <Txt role="label" color="onShell">
                  {s.language.switchTo}
                </Txt>
              </View>
            </Pressable>
          </View>

          <Txt role="display" color="onShell" accessibilityRole="header">
            {s.home.question}
          </Txt>

          <View style={[styles.locationRow, { flexDirection: row }]} accessibilityLiveRegion="polite">
            {location.status === 'locating' ? (
              <ActivityIndicator size="small" color={colors.onShellMuted} />
            ) : (
              <LocationIcon color={colors.onShellMuted} size={size.iconSmall} strokeWidth={size.stroke} />
            )}
            <Txt role="label" color="onShellMuted" style={styles.locationText}>
              {locationText}
            </Txt>
            {location.status === 'fallback' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityHint={s.home.fallbackHint}
                onPress={location.retry}
                android_ripple={{ color: colors.shellLine }}
                style={styles.locationAction}
              >
                <Txt role="label" color="onShell" style={styles.underline}>
                  {s.home.useMyLocation}
                </Txt>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
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
            <View style={styles.grid} accessibilityLabel={s.results.loading}>
              {[0, 1, 2, 3].map((r) => (
                <View key={r} style={[styles.gridRow, { flexDirection: row }]}>
                  {[0, 1, 2].map((c) => (
                    <Skeleton key={c} height={size.tile} round={radius.md} style={styles.cell} />
                  ))}
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
    backgroundColor: c.paper,
  },
  // Keeps content at a readable width on tablets and web.
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  shell: {
    backgroundColor: c.shell,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  brandRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  languageTarget: {
    minHeight: size.touch,
    justifyContent: 'center',
  },
  language: {
    borderWidth: size.hairline,
    borderColor: c.shellLine,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  locationRow: {
    alignItems: 'center',
    gap: space.sm,
    minHeight: size.touch,
  },
  locationText: {
    flex: 1,
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
    paddingTop: space.lg,
    paddingBottom: space.xxl,
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
  dock: {
    backgroundColor: c.sheet,
    borderTopWidth: size.hairline,
    borderTopColor: c.hairline,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  dockInner: {
    gap: space.sm,
  },
}));
