import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, LockKeyhole, Store, Trash2, WifiOff } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, type Banner, type OwnProvider, type Story } from '@/api';
import { NotVerifiedBadge, SponsoredTag, VerifiedBadge } from '@/components/Badges';
import { Button } from '@/components/Button';
import { Field, Notice, useInputStyle } from '@/components/Field';
import { IconButton } from '@/components/IconButton';
import { OfferBlock } from '@/components/OfferBlock';
import { Photo } from '@/components/Photo';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import type { Strings } from '@/i18n/en';
import { requireSignIn, useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/time';
import { makeStyles, opacity, radius, size, space, useTheme } from '@/theme';

/** Limits from docs/API.md ("Stories and banners", "sponsor_hook"). */
const STORY_TEXT_MAX = 280;
const STORY_MAX = 5;
const IMAGE_URL_MAX = 1000;
const OFFER_TITLE_MAX = 60;
const OFFER_TEXT_MAX = 200;
const HOOK_MAX = 80;
const DAY_CHOICES = [1, 2, 3, 4, 5, 6, 7] as const;
const HOUR_MS = 3_600_000;

type Load =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error' }
  | { status: 'ready'; own: OwnProvider };

/** Whole hours an update has left (at least 1, so "Ends in 0 h" never shows). */
function hoursLeft(expiresAt: string): number {
  return Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / HOUR_MS));
}

/** A short, plain message for a failed change. The backend's own wording is English only. */
function errorText(error: unknown, s: Strings, f: (t: string, v?: Record<string, string | number>) => string) {
  const e = s.business.errors;
  if (!(error instanceof ApiError)) return e.failed;
  switch (error.status) {
    case 0:
      return e.offline;
    case 401:
      return e.signedOut;
    case 403:
      return e.forbidden;
    case 404:
      return e.gone;
    case 409:
      return e.full;
    case 422:
      return e.invalid;
    case 429:
      return error.retryAfterS ? f(e.rateLimitedFor, { n: error.retryAfterS }) : e.rateLimited;
    default:
      return e.failed;
  }
}

/**
 * "My business": what the owner of a listing can do from the app.
 * A verified owner posts updates (stories), runs one offer (banner) and writes
 * the one sentence shown on their card while sponsored. Before verification the
 * screen says posting opens later; without a listing it points to Suggest.
 */
export default function MyBusinessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dark, colors } = useTheme();
  const { s, row, rtl } = useI18n();
  const styles = useStyles();
  const auth = useAuth();
  // Each answer is stored with the request it belongs to (user and attempt), so
  // a new request shows "loading" until its own answer arrives.
  const [settled, setSettled] = useState<{ key: string; load: Load } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${auth.userId ?? ''}:${attempt}`;
  const load: Load = settled && settled.key === key ? settled.load : { status: 'loading' };

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const signedIn = auth.status === 'signedIn';

  useEffect(() => {
    if (!signedIn) return undefined;
    let current = true;
    api
      .getMyProvider()
      .then((own) => {
        if (current) setSettled({ key, load: { status: 'ready', own } });
      })
      .catch((error: unknown) => {
        if (!current) return;
        // 404: this account has no listing yet.
        const status = error instanceof ApiError && error.status === 404 ? 'none' : 'error';
        setSettled({ key, load: { status } });
      });
    return () => {
      current = false;
    };
  }, [signedIn, key]);

  // A section saved a change: show the profile as the server now has it.
  const setOwn = useCallback(
    (own: OwnProvider) => setSettled({ key, load: { status: 'ready', own } }),
    [key],
  );

  let body: ReactNode = null;
  if (auth.status === 'signedOut') {
    body = (
      <StateView
        icon={Store}
        title={s.business.title}
        body={s.business.signInBody}
        actionLabel={s.account.signIn}
        onAction={() => requireSignIn()}
      />
    );
  } else if (!signedIn || load.status === 'loading') {
    body = (
      <View style={styles.page} accessible accessibilityLabel={s.business.title}>
        <Skeleton height={space.huge * 2} round={radius.sheet} />
        <Skeleton height={space.huge * 4} round={radius.sheet} />
        <Skeleton height={space.huge * 3} round={radius.sheet} />
      </View>
    );
  } else if (load.status === 'none') {
    body = (
      <StateView
        icon={Store}
        title={s.business.noneTitle}
        body={s.business.noneBody}
        actionLabel={s.business.noneAction}
        onAction={() => router.push('/suggest')}
      />
    );
  } else if (load.status === 'error') {
    body = (
      <StateView
        icon={WifiOff}
        title={s.business.errorTitle}
        body={s.account.errorBody}
        actionLabel={s.common.tryAgain}
        onAction={() => setAttempt((n) => n + 1)}
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[styles.column, styles.bar, { flexDirection: row }]}>
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
        <Txt role="display" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
          {s.business.title}
        </Txt>
      </View>
      {body ? (
        <View style={styles.column}>{body}</View>
      ) : load.status === 'ready' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
          >
            <View style={[styles.column, styles.page]}>
              <Header own={load.own} />
              {load.own.status === 'verified' ? (
                <>
                  <StoriesSection own={load.own} />
                  <OfferSection own={load.own} onSaved={setOwn} />
                  <HookSection own={load.own} onSaved={setOwn} />
                </>
              ) : (
                <View style={[styles.locked, { flexDirection: row }]}>
                  <View style={styles.lockedIcon}>
                    <LockKeyhole color={colors.onAccent} size={size.icon} strokeWidth={size.stroke} />
                  </View>
                  <View style={styles.flexGap}>
                    <Txt role="title" color="onAccent" accessibilityRole="header">
                      {s.business.lockedTitle}
                    </Txt>
                    <Txt color="onAccent">{s.business.lockedBody}</Txt>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

/** The listing itself: mint when verified (the trust colour), white otherwise. */
function Header({ own }: { own: OwnProvider }) {
  const { s, row, categoryName } = useI18n();
  const styles = useStyles();
  const verified = own.status === 'verified';
  return (
    <View style={[styles.header, verified ? styles.headerVerified : null, { flexDirection: row }]}>
      <Photo uri={own.cover_photo_url} fallbackIcon={own.category.icon} style={styles.headerPhoto} />
      <View style={styles.flexGap}>
        <Txt role="headline" color={verified ? 'onMint' : 'text'} numberOfLines={2} content>
          {own.name}
        </Txt>
        <Txt role="label" color={verified ? 'onMint' : 'textMuted'} numberOfLines={1}>
          {`${categoryName(own.category)} · ${own.area_name}`}
        </Txt>
        <View style={[styles.badges, { flexDirection: row }]}>
          {verified ? <VerifiedBadge /> : <NotVerifiedBadge />}
          {verified ? null : (
            <Txt role="caption" color="textMuted">
              {s.business.status[own.status]}
            </Txt>
          )}
          {own.sponsored ? <SponsoredTag /> : null}
        </View>
      </View>
    </View>
  );
}

/** A white block with a title, an optional figure at its end, and a one-line note. */
function Section({ title, aside, note, children }: { title: string; aside?: string; note?: string; children: ReactNode }) {
  const { row } = useI18n();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionTitle, { flexDirection: row }]}>
          <Txt role="headline" accessibilityRole="header" style={styles.flex}>
            {title}
          </Txt>
          {aside ? (
            <Txt role="label" color="textMuted">
              {aside}
            </Txt>
          ) : null}
        </View>
        {note ? (
          <Txt role="label" color="textMuted">
            {note}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

type Feedback = { tone: 'error' | 'success'; text: string } | null;

// ---------------------------------------------------------------------------
// Updates

function StoriesSection({ own }: { own: OwnProvider }) {
  const { colors } = useTheme();
  const { s, f, row } = useI18n();
  const styles = useStyles();
  const inputStyle = useInputStyle();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [focused, setFocused] = useState<'text' | 'image' | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [posting, setPosting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    api
      .getProviderStories(own.id)
      .then((result) => {
        if (current) setStories(result.items);
      })
      .catch(() => {
        if (current) setStories([]);
      });
    return () => {
      current = false;
    };
  }, [own.id]);

  const count = stories?.length ?? 0;
  const full = count >= STORY_MAX;
  const imageTrimmed = image.trim();
  const textProblem = text.trim().length === 0 ? s.business.storyTextRequired : null;
  const imageProblem =
    imageTrimmed.length > 0 && !/^https:\/\/\S+$/i.test(imageTrimmed) ? s.business.storyImageInvalid : null;

  const post = async () => {
    if (textProblem || imageProblem) {
      setShowErrors(true);
      AccessibilityInfo.announceForAccessibility(textProblem ?? imageProblem ?? '');
      return;
    }
    setPosting(true);
    setFeedback(null);
    try {
      const story = await api.postMyStory({ text: text.trim(), image_url: imageTrimmed || null });
      setStories((list) => [story, ...(list ?? [])]);
      setText('');
      setImage('');
      setShowErrors(false);
      setFeedback({ tone: 'success', text: s.business.posted });
      AccessibilityInfo.announceForAccessibility(s.business.posted);
    } catch (error) {
      setFeedback({ tone: 'error', text: errorText(error, s, f) });
    } finally {
      setPosting(false);
    }
  };

  const remove = async (story: Story) => {
    setDeleting(story.id);
    setFeedback(null);
    try {
      await api.deleteMyStory(story.id);
      setStories((list) => (list ?? []).filter((item) => item.id !== story.id));
      setFeedback({ tone: 'success', text: s.business.deleted });
      AccessibilityInfo.announceForAccessibility(s.business.deleted);
    } catch (error) {
      // Already gone (404) is what the user wanted anyway.
      if (error instanceof ApiError && error.status === 404) {
        setStories((list) => (list ?? []).filter((item) => item.id !== story.id));
      } else {
        setFeedback({ tone: 'error', text: errorText(error, s, f) });
      }
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  };

  const textError = showErrors ? textProblem : null;
  const imageError = showErrors ? imageProblem : null;

  return (
    <Section
      title={s.business.storiesTitle}
      aside={stories ? f(s.business.storiesCount, { n: count }) : undefined}
      note={s.business.storiesNote}
    >
      {full ? (
        <Notice tone="info">{s.business.storiesFull}</Notice>
      ) : (
        <View style={styles.form}>
          <Field
            label={s.business.storyText}
            aside={`${text.length} / ${STORY_TEXT_MAX}`}
            error={textError}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused('text')}
              onBlur={() => setFocused(null)}
              placeholder={s.business.storyPlaceholder}
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={`${s.business.storyText}, ${text.length} / ${STORY_TEXT_MAX}`}
              aria-invalid={textError ? true : undefined}
              multiline
              maxLength={STORY_TEXT_MAX}
              selectionColor={colors.primary}
              style={inputStyle(focused === 'text', textError, true)}
            />
          </Field>
          <Field label={s.business.storyImage} optional hint={s.business.storyImageHint} error={imageError}>
            <TextInput
              value={image}
              onChangeText={setImage}
              onFocus={() => setFocused('image')}
              onBlur={() => setFocused(null)}
              placeholder="https://"
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={s.business.storyImage}
              accessibilityHint={imageError ?? s.business.storyImageHint}
              aria-invalid={imageError ? true : undefined}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
              maxLength={IMAGE_URL_MAX}
              selectionColor={colors.primary}
              // A link reads left to right in Arabic too.
              style={[inputStyle(focused === 'image', imageError), styles.ltr]}
            />
          </Field>
          <Button label={s.business.post} onPress={() => void post()} loading={posting} />
        </View>
      )}

      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}

      {stories === null ? (
        <Skeleton height={space.huge + space.xl} round={radius.lg} />
      ) : stories.length === 0 ? (
        <Txt role="label" color="textMuted" style={styles.inset}>
          {s.business.noStories}
        </Txt>
      ) : (
        <View style={styles.list}>
          {stories.map((story) => {
            const asking = confirming === story.id;
            return (
              <View key={story.id} style={styles.story}>
                <View style={[styles.storyTop, { flexDirection: row }]}>
                  {story.image_url ? (
                    <Photo uri={story.image_url} fallbackIcon={own.category.icon} style={styles.storyPhoto} />
                  ) : null}
                  <View style={styles.flexGap}>
                    <Txt numberOfLines={3} content>
                      {story.text}
                    </Txt>
                    <Txt role="caption" color="textSubtle">
                      {`${timeAgo(story.created_at, s)} · ${f(s.business.storyEndsIn, { n: hoursLeft(story.expires_at) })}`}
                    </Txt>
                  </View>
                  {asking ? null : (
                    <IconButton icon={Trash2} label={s.business.deleteStory} onPress={() => setConfirming(story.id)} />
                  )}
                </View>
                {asking ? (
                  // Asked in place, so a stray tap never deletes an update.
                  <View style={[styles.confirm, { flexDirection: row }]} accessibilityLiveRegion="polite">
                    <Txt role="bodyStrong" style={styles.flex}>
                      {s.business.deleteConfirm}
                    </Txt>
                    <Button label={s.business.keep} onPress={() => setConfirming(null)} variant="tonal" compact />
                    <Button
                      label={s.business.delete}
                      onPress={() => void remove(story)}
                      loading={deleting === story.id}
                      compact
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Offer

function OfferSection({ own, onSaved }: { own: OwnProvider; onSaved: (own: OwnProvider) => void }) {
  const { colors } = useTheme();
  const { s, f, row, plural } = useI18n();
  const styles = useStyles();
  const inputStyle = useInputStyle();
  const banner = own.active_banner;
  const [editing, setEditing] = useState(banner === null);
  const [title, setTitle] = useState(banner?.title ?? '');
  const [text, setText] = useState(banner?.text ?? '');
  const [discount, setDiscount] = useState(banner?.discount_percent ? String(banner.discount_percent) : '');
  const [days, setDays] = useState<number>(7);
  const [focused, setFocused] = useState<'title' | 'text' | 'discount' | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const discountNumber = discount.trim() ? Number(discount.trim()) : null;
  const titleProblem = title.trim().length === 0 ? s.business.offerNameRequired : null;
  const discountProblem =
    discountNumber !== null && (!Number.isInteger(discountNumber) || discountNumber < 1 || discountNumber > 90)
      ? s.business.discountInvalid
      : null;

  const show = (next: Banner | null) =>
    onSaved({ ...own, active_banner: next, banner_title: next?.title ?? null });

  const save = async () => {
    if (titleProblem || discountProblem) {
      setShowErrors(true);
      AccessibilityInfo.announceForAccessibility(titleProblem ?? discountProblem ?? '');
      return;
    }
    setBusy('save');
    setFeedback(null);
    try {
      const saved = await api.setMyBanner({
        title: title.trim(),
        text: text.trim() || null,
        discount_percent: discountNumber,
        days,
      });
      show(saved);
      setEditing(false);
      setShowErrors(false);
      setFeedback({ tone: 'success', text: s.business.offerSaved });
      AccessibilityInfo.announceForAccessibility(s.business.offerSaved);
    } catch (error) {
      setFeedback({ tone: 'error', text: errorText(error, s, f) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    setFeedback(null);
    try {
      await api.deleteMyBanner();
      show(null);
      setTitle('');
      setText('');
      setDiscount('');
      setDays(7);
      setEditing(true);
      setFeedback({ tone: 'success', text: s.business.offerRemoved });
      AccessibilityInfo.announceForAccessibility(s.business.offerRemoved);
    } catch (error) {
      setFeedback({ tone: 'error', text: errorText(error, s, f) });
    } finally {
      setBusy(null);
    }
  };

  const titleError = showErrors ? titleProblem : null;
  const discountError = showErrors ? discountProblem : null;

  return (
    <Section title={s.business.offerTitle} note={s.business.offerNote}>
      {banner && !editing ? (
        <>
          {/* Exactly what customers see on the profile. */}
          <OfferBlock banner={banner} />
          <View style={[styles.buttons, { flexDirection: row }]}>
            <Button
              label={s.business.editOffer}
              onPress={() => {
                setFeedback(null);
                setEditing(true);
              }}
              variant="tonal"
              style={styles.flex}
            />
            <Button
              label={s.business.removeOffer}
              onPress={() => void remove()}
              variant="outline"
              loading={busy === 'remove'}
              style={styles.flex}
            />
          </View>
        </>
      ) : (
        <View style={styles.form}>
          <Field label={s.business.offerName} aside={`${title.length} / ${OFFER_TITLE_MAX}`} error={titleError}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              onFocus={() => setFocused('title')}
              onBlur={() => setFocused(null)}
              placeholder={s.business.offerNamePlaceholder}
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={s.business.offerName}
              aria-invalid={titleError ? true : undefined}
              maxLength={OFFER_TITLE_MAX}
              selectionColor={colors.primary}
              style={inputStyle(focused === 'title', titleError)}
            />
          </Field>
          <Field label={s.business.offerText} optional aside={`${text.length} / ${OFFER_TEXT_MAX}`}>
            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused('text')}
              onBlur={() => setFocused(null)}
              placeholder={s.business.offerTextPlaceholder}
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={s.business.offerText}
              multiline
              maxLength={OFFER_TEXT_MAX}
              selectionColor={colors.primary}
              style={inputStyle(focused === 'text', null, true)}
            />
          </Field>
          <Field label={s.business.discount} optional hint={s.business.discountHint} error={discountError}>
            <TextInput
              value={discount}
              onChangeText={(value) => setDiscount(value.replace(/[^\d]/g, '').slice(0, 2))}
              onFocus={() => setFocused('discount')}
              onBlur={() => setFocused(null)}
              placeholder="20"
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={s.business.discount}
              accessibilityHint={discountError ?? s.business.discountHint}
              aria-invalid={discountError ? true : undefined}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={2}
              selectionColor={colors.primary}
              style={[inputStyle(focused === 'discount', discountError), styles.short, styles.ltr]}
            />
          </Field>
          <View style={styles.fieldGroup}>
            <Txt role="bodyStrong" style={styles.inset} nativeID="offer-days">
              {s.business.duration}
            </Txt>
            {/* One pill per day count; the chosen one is filled, like the distance chips. */}
            <View style={[styles.days, { flexDirection: row }]} accessibilityRole="radiogroup" accessibilityLabelledBy="offer-days">
              {DAY_CHOICES.map((n) => {
                const chosen = n === days;
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="radio"
                    accessibilityLabel={plural(s.business.days, n)}
                    accessibilityState={{ checked: chosen }}
                    onPress={() => setDays(n)}
                    hitSlop={space.xs}
                    style={({ pressed }) => [styles.day, chosen ? styles.dayChosen : null, pressed ? styles.dim : null]}
                  >
                    <Txt role="action" color={chosen ? 'onPrimary' : 'text'} ltr>
                      {n}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
            <Txt role="caption" color="textSubtle" style={styles.inset}>
              {plural(s.business.days, days)}
            </Txt>
          </View>
          <View style={[styles.buttons, { flexDirection: row }]}>
            {banner ? (
              <Button
                label={s.business.keep}
                onPress={() => {
                  setEditing(false);
                  setShowErrors(false);
                }}
                variant="tonal"
                style={styles.flex}
              />
            ) : null}
            <Button
              label={s.business.saveOffer}
              onPress={() => void save()}
              loading={busy === 'save'}
              style={styles.flex}
            />
          </View>
        </View>
      )}
      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Sponsor sentence

function HookSection({ own, onSaved }: { own: OwnProvider; onSaved: (own: OwnProvider) => void }) {
  const { colors } = useTheme();
  const { s, f, language } = useI18n();
  const inputStyle = useInputStyle();
  const [hook, setHook] = useState(own.sponsor_hook ?? '');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const unchanged = hook.trim() === (own.sponsor_hook ?? '');

  const save = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      // An empty sentence clears it.
      const saved = await api.updateMyProvider({ sponsor_hook: hook.trim() || null });
      onSaved(saved);
      setHook(saved.sponsor_hook ?? '');
      setFeedback({ tone: 'success', text: s.business.hookSaved });
      AccessibilityInfo.announceForAccessibility(s.business.hookSaved);
    } catch (error) {
      setFeedback({ tone: 'error', text: errorText(error, s, f) });
    } finally {
      setBusy(false);
    }
  };

  const until =
    own.sponsored && own.featured_until
      ? new Date(own.featured_until).toLocaleDateString(language === 'ar' ? 'ar-LB' : 'en-GB', {
          day: 'numeric',
          month: 'long',
        })
      : null;

  return (
    <Section
      title={s.business.hookTitle}
      aside={until ? f(s.business.sponsoredUntil, { date: until }) : s.business.notSponsored}
    >
      <Field label={s.business.hookLabel} optional aside={`${hook.length} / ${HOOK_MAX}`}>
        <TextInput
          value={hook}
          onChangeText={setHook}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={s.business.hookPlaceholder}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={s.business.hookLabel}
          maxLength={HOOK_MAX}
          selectionColor={colors.primary}
          style={inputStyle(focused)}
        />
      </Field>
      <Notice tone="info">{s.business.hookNote}</Notice>
      <Button label={s.business.saveHook} onPress={() => void save()} loading={busy} disabled={unchanged} />
      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
    </Section>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  flexGap: {
    flex: 1,
    minWidth: 0,
    gap: space.xs,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  bar: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  page: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    gap: space.md,
  },
  ltr: {
    writingDirection: 'ltr',
  },
  inset: {
    paddingHorizontal: space.xl,
  },
  header: {
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.sheet,
    backgroundColor: c.surface,
  },
  headerVerified: {
    backgroundColor: c.mint,
  },
  headerPhoto: {
    width: size.thumb,
    height: size.thumb,
    borderRadius: radius.md,
  },
  badges: {
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  locked: {
    alignItems: 'flex-start',
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.sheet,
    backgroundColor: c.accent,
  },
  lockedIcon: {
    width: size.tileIconBox,
    height: size.tileIconBox,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Each part of the business is one white block on the lavender ground.
  section: {
    backgroundColor: c.surface,
    borderRadius: radius.sheet,
    padding: space.lg,
    gap: space.lg,
  },
  sectionHead: {
    gap: space.xxs,
    paddingHorizontal: space.xs,
  },
  sectionTitle: {
    alignItems: 'baseline',
    gap: space.sm,
  },
  form: {
    gap: space.lg,
  },
  fieldGroup: {
    gap: space.sm,
  },
  short: {
    width: size.button * 2,
  },
  days: {
    flexWrap: 'wrap',
    gap: space.sm,
  },
  day: {
    width: size.segment + space.xs,
    height: size.segment + space.xs,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChosen: {
    backgroundColor: c.primary,
  },
  dim: {
    opacity: opacity.pressed,
  },
  buttons: {
    gap: space.sm,
  },
  list: {
    gap: space.sm,
  },
  // A posted update: a soft lavender-grey block inside the white one.
  story: {
    backgroundColor: c.surfaceTint,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
  },
  storyTop: {
    alignItems: 'flex-start',
    gap: space.md,
  },
  storyPhoto: {
    width: size.avatarLarge,
    height: size.avatarLarge,
    borderRadius: radius.md,
  },
  confirm: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
}));
