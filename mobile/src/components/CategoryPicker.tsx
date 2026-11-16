import { Check, ChevronDown, ChevronUp, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, type TextStyle, View } from 'react-native';

import type { Category } from '@/api';
import { useI18n } from '@/i18n';
import { useCategories } from '@/lib/categories';
import { makeStyles, radius, size, space, type as typeScale, useTheme } from '@/theme';

import { FIELD_INSET, useInputStyle } from './Field';
import { Txt } from './Txt';

/** How many category rows show before the list scrolls. */
const VISIBLE_CATEGORIES = 5;

// Web only: the field's own ink edge shows focus, so the browser's ring is turned off.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

interface Props {
  /** Read to screen readers with the chosen value. */
  label: string;
  value: number | null;
  onChange: (categoryId: number) => void;
  error?: string | null;
  /** Called when the search box gets focus, so the page can bring it above the keyboard. */
  onSearchFocus?: () => void;
}

/**
 * Choose a category: a pill like the other fields; opening it adds a grey block
 * with a search box and the categories (each top-level one followed by its
 * sub-categories). The same pattern as the Suggest form. Goes inside a `Field`.
 */
export function CategoryPicker({ label, value, onChange, error, onSearchFocus }: Props) {
  const { colors } = useTheme();
  const { s, row, textAlign, writingDirection, categoryName } = useI18n();
  const styles = useStyles();
  const inputStyle = useInputStyle();
  const categories = useCategories();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const all: { category: Category; parent: Category | null }[] = [];
    for (const parent of categories.tree) {
      all.push({ category: parent, parent: null });
      for (const child of parent.children) all.push({ category: child, parent });
    }
    const wanted = query.trim().toLowerCase();
    if (!wanted) return all;
    return all.filter(({ category, parent }) =>
      [category.name_en, category.name_ar, parent?.name_en, parent?.name_ar].some((text) =>
        text?.toLowerCase().includes(wanted),
      ),
    );
  }, [categories.tree, query]);

  const chosen = value !== null ? categories.byId.get(value) : undefined;
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${chosen ? categoryName(chosen) : s.join.categoryChoose}`}
        accessibilityHint={error ?? undefined}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((now) => !now)}
        style={[inputStyle(open, error), styles.closed, { flexDirection: row }]}
      >
        <Txt color={chosen ? 'text' : 'textSubtle'} numberOfLines={1} style={styles.flex}>
          {categories.status === 'loading' ? s.join.categoryLoading : chosen ? categoryName(chosen) : s.join.categoryChoose}
        </Txt>
        <Chevron color={colors.text} size={size.icon} strokeWidth={size.stroke} />
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {/* A white pill inside the grey block, the same way the facts strip sits in a card. */}
          <View style={[styles.search, { flexDirection: row }]}>
            <Search color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={onSearchFocus}
              placeholder={s.join.categorySearch}
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={s.join.categorySearch}
              autoCorrect={false}
              returnKeyType="search"
              selectionColor={colors.primary}
              style={[styles.searchInput, NO_FOCUS_RING, { textAlign, writingDirection }]}
            />
          </View>
          {categories.status === 'error' ? (
            <Pressable accessibilityRole="button" onPress={categories.reload} style={styles.option}>
              <Txt color="primary">{s.join.categoryRetry}</Txt>
            </Pressable>
          ) : null}
          {/* A short list that scrolls inside the page. */}
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: size.touch * VISIBLE_CATEGORIES + size.touch / 2 }}
          >
            {options.length === 0 && categories.status === 'ready' ? (
              <Txt color="textMuted" style={styles.empty}>
                {s.join.categoryNone}
              </Txt>
            ) : null}
            {options.map(({ category, parent }) => {
              const active = category.id === value;
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityLabel={parent ? `${categoryName(category)}, ${categoryName(parent)}` : categoryName(category)}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onChange(category.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  android_ripple={{ color: colors.surfaceTintStrong }}
                  style={({ pressed }) => [styles.option, { flexDirection: row }, pressed ? styles.pressed : null]}
                >
                  <View style={styles.flex}>
                    <Txt role={parent ? 'body' : 'bodyStrong'} numberOfLines={1}>
                      {categoryName(category)}
                    </Txt>
                    {parent ? (
                      <Txt role="caption" color="textSubtle" numberOfLines={1}>
                        {categoryName(parent)}
                      </Txt>
                    ) : null}
                  </View>
                  {active ? <Check color={colors.primary} size={size.icon} strokeWidth={size.strokeBold} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  closed: {
    alignItems: 'center',
    gap: space.sm,
  },
  // The choices: a grey block with a white search pill inset at its top.
  panel: {
    borderRadius: radius.lg,
    backgroundColor: c.surfaceTint,
    overflow: 'hidden',
    paddingBottom: space.sm,
  },
  search: {
    alignItems: 'center',
    gap: space.sm,
    minHeight: size.touch,
    margin: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
  },
  searchInput: {
    ...typeScale.body,
    flex: 1,
    minWidth: 0,
    minHeight: size.touch,
    color: c.text,
    paddingVertical: space.none,
  },
  empty: {
    paddingHorizontal: FIELD_INSET,
    paddingVertical: space.md,
  },
  option: {
    minHeight: size.touch,
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: FIELD_INSET,
    paddingVertical: space.xs,
  },
  pressed: {
    backgroundColor: c.surfaceTintStrong,
  },
}));
