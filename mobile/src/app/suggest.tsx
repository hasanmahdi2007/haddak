import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  HeartHandshake,
  Search,
  X,
} from 'lucide-react-native';
import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  type TextStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, type Category } from '@/api';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { useCategories } from '@/lib/categories';
import { makeStyles, radius, size, space, type as typeScale, useTheme } from '@/theme';

/** Limits of POST /suggestions (docs/API.md). */
const NAME_MAX = 100;
const AREA_MAX = 100;
const NOTE_MAX = 500;
/** International format: "+" and 8 to 15 digits. */
const PHONE = /^\+\d{8,15}$/;
/**
 * The example number, wrapped in "left-to-right isolate" marks so that inside an
 * Arabic sentence the plus sign and the digit groups keep their order.
 */
const PHONE_EXAMPLE = '⁦+961 70 123 456⁩';

/** How many category rows show before the list scrolls. */
const VISIBLE_CATEGORIES = 5;

// Web only: the field's own border shows focus, so the browser's ring is turned off.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/**
 * "+961 70-123 456" and "00961 70 123 456" both become "+96170123456".
 * People in Lebanon usually type the local form, so "70 123 456" and
 * "03 123 456" (7 or 8 digits, with or without the leading 0) get +961 added.
 */
function cleanPhone(typed: string): string {
  const compact = typed.replace(/[\s\-().]/g, '');
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (compact.startsWith('+')) return compact;
  const local = compact.startsWith('0') ? compact.slice(1) : compact;
  return /^\d{7,8}$/.test(local) ? `+961${local}` : compact;
}

type FieldKey = 'name' | 'phone' | 'category' | 'area' | 'note';
type Failure = 'rateLimited' | 'other';

interface FieldProps {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  /** Small text at the end of the label line (the note's character count). */
  aside?: string;
  onLayoutY: (y: number) => void;
  children: ReactNode;
}

/** A form field: the label above, the control, then a hint or the error under it. */
function Field({ label, optional, hint, error, aside, onLayoutY, children }: FieldProps) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View style={styles.fieldGroup} onLayout={(event) => onLayoutY(event.nativeEvent.layout.y)}>
      <View style={[styles.labelRow, { flexDirection: row }]}>
        <Txt role="label" style={styles.labelText}>
          {label}
          {optional ? (
            <Txt role="label" color="textSubtle">
              {' '}
              ({s.suggest.optional})
            </Txt>
          ) : null}
        </Txt>
        {aside ? (
          <Txt role="caption" color="textSubtle" ltr>
            {aside}
          </Txt>
        ) : null}
      </View>
      {children}
      {error ? (
        // An alert, so a screen reader says the message as soon as it appears.
        <View
          style={[styles.message, { flexDirection: row }]}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityLabel={error}
        >
          <View style={styles.messageIcon}>
            <CircleAlert color={colors.danger} size={size.iconSmall} strokeWidth={size.stroke} />
          </View>
          <Txt role="label" color="danger" style={styles.messageText}>
            {error}
          </Txt>
        </View>
      ) : hint ? (
        <Txt role="caption" color="textSubtle">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export default function SuggestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, f, row, rtl, textAlign, writingDirection, categoryName } = useI18n();
  const styles = useStyles();
  const params = useLocalSearchParams<{ category_id?: string }>();
  const categories = useCategories();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Coming from an empty Results list, the category searched for is filled in already.
  const [categoryId, setCategoryId] = useState<number | null>(() =>
    params.category_id ? Number(params.category_id) : null,
  );
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [focused, setFocused] = useState<FieldKey | 'categorySearch' | null>(null);
  // Errors stay hidden until the first try to send; after that they update while typing.
  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [done, setDone] = useState(false);

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const phoneRef = useRef<ComponentRef<typeof TextInput>>(null);
  // Where each field starts inside the scrolling form, measured as it is laid out.
  const fieldY = useRef<Partial<Record<FieldKey, number>>>({});

  const phoneExample = PHONE_EXAMPLE;
  const nameProblem = name.trim().length === 0 ? s.suggest.nameRequired : null;
  const phoneProblem =
    phone.trim().length > 0 && !PHONE.test(cleanPhone(phone))
      ? f(s.suggest.phoneInvalid, { example: phoneExample })
      : null;
  const nameError = showErrors ? nameProblem : null;
  const phoneError = showErrors ? phoneProblem : null;

  // Top-level categories, each followed by its sub-categories, filtered by the search box.
  const options = useMemo(() => {
    const all: { category: Category; parent: Category | null }[] = [];
    for (const parent of categories.tree) {
      all.push({ category: parent, parent: null });
      for (const child of parent.children) all.push({ category: child, parent });
    }
    const wanted = categoryQuery.trim().toLowerCase();
    if (!wanted) return all;
    return all.filter(({ category, parent }) =>
      [category.name_en, category.name_ar, parent?.name_en, parent?.name_ar].some((text) =>
        text?.toLowerCase().includes(wanted),
      ),
    );
  }, [categories.tree, categoryQuery]);

  const chosen = categoryId !== null ? categories.byId.get(categoryId) : undefined;
  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const goHome = () => (router.canGoBack() ? router.dismissTo('/') : router.replace('/'));

  // Bring the field being typed in to the top of the form, clear of the keyboard.
  // The short wait lets the keyboard finish opening first.
  const onFieldFocus = (key: FieldKey | 'categorySearch') => {
    setFocused(key);
    const y = fieldY.current[key === 'categorySearch' ? 'category' : key];
    if (y === undefined) return;
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - space.sm), animated: true }), 250);
  };

  const submit = async () => {
    if (nameProblem || phoneProblem) {
      setShowErrors(true);
      // Say the first problem and put the cursor in that field.
      AccessibilityInfo.announceForAccessibility(nameProblem ?? phoneProblem ?? '');
      (nameProblem ? nameRef : phoneRef).current?.focus();
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      await api.submitSuggestion({
        name: name.trim(),
        // Empty optional fields are left out of the request.
        phone: phone.trim() ? cleanPhone(phone) : undefined,
        category_id: chosen?.id,
        area_name: area.trim() || undefined,
        note: note.trim() || undefined,
      });
      setDone(true);
      AccessibilityInfo.announceForAccessibility(s.suggest.successTitle);
    } catch (cause) {
      // 429 means too many suggestions from this connection in the last hour.
      setFailure(cause instanceof ApiError && cause.status === 429 ? 'rateLimited' : 'other');
    } finally {
      setSending(false);
    }
  };

  const inputStyle = (key: FieldKey, error?: string | null) => [
    styles.input,
    NO_FOCUS_RING,
    { textAlign, writingDirection },
    focused === key ? styles.inputFocused : null,
    error ? styles.inputError : null,
  ];

  const header = (
    <View style={styles.header}>
      <View style={[styles.column, styles.bar, { flexDirection: row }]}>
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
        <Txt role="display" numberOfLines={1} accessibilityRole="header" style={styles.title}>
          {s.suggest.title}
        </Txt>
      </View>
    </View>
  );

  if (done) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.column}>
          <StateView
            icon={HeartHandshake}
            title={s.suggest.successTitle}
            body={s.suggest.successBody}
            actionLabel={s.suggest.successAction}
            onAction={goHome}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      {/* Shrinks the form by the keyboard's height, so the send button rides above the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={[styles.column, styles.form]}>
            <Txt color="textMuted">{s.suggest.intro}</Txt>

            <Field label={s.suggest.name} error={nameError} onLayoutY={(y) => (fieldY.current.name = y)}>
              <TextInput
                ref={nameRef}
                value={name}
                onChangeText={setName}
                onFocus={() => onFieldFocus('name')}
                onBlur={() => setFocused(null)}
                placeholder={s.suggest.namePlaceholder}
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={s.suggest.name}
                accessibilityHint={nameError ?? undefined}
                aria-invalid={nameError ? true : undefined}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                maxLength={NAME_MAX}
                selectionColor={colors.primary}
                style={inputStyle('name', nameError)}
              />
            </Field>

            <Field
              label={s.suggest.phone}
              optional
              hint={f(s.suggest.phoneHint, { example: phoneExample })}
              error={phoneError}
              onLayoutY={(y) => (fieldY.current.phone = y)}
            >
              <TextInput
                ref={phoneRef}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => onFieldFocus('phone')}
                onBlur={() => setFocused(null)}
                placeholder="+961 70 123 456"
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={s.suggest.phone}
                accessibilityHint={phoneError ?? f(s.suggest.phoneHint, { example: phoneExample })}
                aria-invalid={phoneError ? true : undefined}
                keyboardType="phone-pad"
                inputMode="tel"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={24}
                selectionColor={colors.primary}
                // A phone number reads left to right in Arabic too.
                style={[inputStyle('phone', phoneError), styles.ltr]}
              />
            </Field>

            {categories.status === 'ready' ? (
              <Field label={s.suggest.category} optional onLayoutY={(y) => (fieldY.current.category = y)}>
                <View style={[styles.input, styles.picker, { flexDirection: row }, pickerOpen ? styles.inputFocused : null]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${s.suggest.category}, ${chosen ? categoryName(chosen) : s.suggest.categoryChoose}`}
                    accessibilityState={{ expanded: pickerOpen }}
                    onPress={() => setPickerOpen((open) => !open)}
                    style={[styles.pickerMain, { flexDirection: row }]}
                  >
                    <Txt color={chosen ? 'text' : 'textSubtle'} numberOfLines={1} style={styles.pickerText}>
                      {chosen ? categoryName(chosen) : s.suggest.categoryChoose}
                    </Txt>
                    {chosen ? null : pickerOpen ? (
                      <ChevronUp color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
                    ) : (
                      <ChevronDown color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
                    )}
                  </Pressable>
                  {chosen ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={s.suggest.categoryClear}
                      onPress={() => setCategoryId(null)}
                      style={styles.pickerClear}
                    >
                      <X color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
                    </Pressable>
                  ) : null}
                </View>

                {pickerOpen ? (
                  <View style={styles.panel}>
                    <View style={[styles.panelSearch, { flexDirection: row }]}>
                      <Search color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
                      <TextInput
                        value={categoryQuery}
                        onChangeText={setCategoryQuery}
                        onFocus={() => onFieldFocus('categorySearch')}
                        onBlur={() => setFocused(null)}
                        placeholder={s.suggest.categorySearch}
                        placeholderTextColor={colors.textSubtle}
                        accessibilityLabel={s.suggest.categorySearch}
                        autoCorrect={false}
                        returnKeyType="search"
                        selectionColor={colors.primary}
                        style={[styles.panelInput, NO_FOCUS_RING, { textAlign, writingDirection }]}
                      />
                    </View>
                    {/* A short list that scrolls inside the form. */}
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: size.touch * VISIBLE_CATEGORIES + size.touch / 2 }}
                    >
                      {options.length === 0 ? (
                        <Txt color="textMuted" style={styles.panelEmpty}>
                          {s.suggest.categoryNone}
                        </Txt>
                      ) : null}
                      {options.map(({ category, parent }) => {
                        const active = category.id === categoryId;
                        return (
                          <Pressable
                            key={category.id}
                            accessibilityRole="button"
                            accessibilityLabel={
                              parent ? `${categoryName(category)}, ${categoryName(parent)}` : categoryName(category)
                            }
                            accessibilityState={{ selected: active }}
                            onPress={() => {
                              setCategoryId(category.id);
                              setPickerOpen(false);
                              setCategoryQuery('');
                            }}
                            android_ripple={{ color: colors.surfaceTintStrong }}
                            style={({ pressed }) => [
                              styles.option,
                              { flexDirection: row },
                              pressed ? styles.optionPressed : null,
                            ]}
                          >
                            <View style={styles.optionText}>
                              <Txt role={parent ? 'body' : 'bodyStrong'} numberOfLines={1}>
                                {categoryName(category)}
                              </Txt>
                              {parent ? (
                                <Txt role="caption" color="textSubtle" numberOfLines={1}>
                                  {categoryName(parent)}
                                </Txt>
                              ) : null}
                            </View>
                            {active ? (
                              <Check color={colors.primary} size={size.icon} strokeWidth={size.strokeBold} />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </Field>
            ) : null}

            <Field label={s.suggest.area} optional onLayoutY={(y) => (fieldY.current.area = y)}>
              <TextInput
                value={area}
                onChangeText={setArea}
                onFocus={() => onFieldFocus('area')}
                onBlur={() => setFocused(null)}
                placeholder={s.suggest.areaPlaceholder}
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={s.suggest.area}
                autoCapitalize="words"
                maxLength={AREA_MAX}
                selectionColor={colors.primary}
                style={inputStyle('area')}
              />
            </Field>

            <Field
              label={s.suggest.note}
              optional
              aside={note.length > 0 ? `${note.length} / ${NOTE_MAX}` : undefined}
              onLayoutY={(y) => (fieldY.current.note = y)}
            >
              <TextInput
                value={note}
                onChangeText={setNote}
                onFocus={() => onFieldFocus('note')}
                onBlur={() => setFocused(null)}
                placeholder={s.suggest.notePlaceholder}
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={s.suggest.note}
                multiline
                maxLength={NOTE_MAX}
                selectionColor={colors.primary}
                style={[inputStyle('note'), styles.inputMultiline]}
              />
            </Field>

            <Txt role="caption" color="textSubtle">
              {s.suggest.privacy}
            </Txt>
          </View>
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
          <View style={[styles.column, styles.dockInner]}>
            {failure ? (
              <View style={[styles.notice, { flexDirection: row }]} accessibilityRole="alert">
                <View style={styles.messageIcon}>
                  <CircleAlert color={colors.onDangerSoft} size={size.iconSmall} strokeWidth={size.stroke} />
                </View>
                <Txt role="label" color="onDangerSoft" style={styles.messageText}>
                  {failure === 'rateLimited' ? s.suggest.rateLimited : s.suggest.failed}
                </Txt>
              </View>
            ) : null}
            <Button label={s.suggest.submit} onPress={() => void submit()} loading={sending} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  flex: {
    flex: 1,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  header: {
  },
  bar: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  title: {
    flex: 1,
  },
  scroll: {
    padding: space.lg,
    paddingBottom: space.xxl,
  },
  form: {
    gap: space.xl,
  },
  fieldGroup: {
    gap: space.xs,
  },
  labelRow: {
    alignItems: 'baseline',
    gap: space.sm,
  },
  labelText: {
    flex: 1,
  },
  // A soft grey field with round corners: 48 dp, ink edge on focus.
  input: {
    ...typeScale.body,
    minHeight: size.touch,
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    borderWidth: size.lineMid,
    borderColor: c.surfaceTint,
    color: c.text,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  inputFocused: {
    borderColor: c.primary,
  },
  inputError: {
    borderColor: c.danger,
  },
  inputMultiline: {
    minHeight: size.touch * 2,
    textAlignVertical: 'top',
  },
  ltr: {
    writingDirection: 'ltr',
  },
  message: {
    alignItems: 'flex-start',
    gap: space.xs,
  },
  // Lines the small icon up with the first line of the message.
  messageIcon: {
    paddingTop: space.xxs,
  },
  messageText: {
    flex: 1,
  },
  picker: {
    alignItems: 'center',
    paddingVertical: space.none,
    // The clear button brings its own 48 dp box, so the end side needs no padding.
    paddingHorizontal: space.none,
  },
  pickerMain: {
    flex: 1,
    minWidth: 0,
    minHeight: size.touch - size.lineMid * 2,
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  pickerText: {
    flex: 1,
  },
  pickerClear: {
    width: size.touch,
    height: size.touch - size.lineMid * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    borderRadius: radius.lg,
    backgroundColor: c.surfaceTint,
    overflow: 'hidden',
  },
  panelSearch: {
    alignItems: 'center',
    gap: space.sm,
    minHeight: size.touch,
    paddingHorizontal: space.md,
    borderBottomWidth: size.hairline,
    borderBottomColor: c.border,
  },
  panelInput: {
    ...typeScale.body,
    flex: 1,
    minWidth: 0,
    minHeight: size.touch,
    color: c.text,
    paddingVertical: space.none,
  },
  panelEmpty: {
    padding: space.md,
  },
  option: {
    minHeight: size.touch,
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  optionPressed: {
    backgroundColor: c.surfaceTintStrong,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  dock: {
    backgroundColor: c.background,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  dockInner: {
    gap: space.sm,
  },
  notice: {
    alignItems: 'flex-start',
    gap: space.xs,
    backgroundColor: c.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
}));
