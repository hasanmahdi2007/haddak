import { Star } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, TextInput, View } from 'react-native';

import { api, ApiError, type Review } from '@/api';
import { useI18n } from '@/i18n';
import type { Strings } from '@/i18n/en';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Field, Notice, useInputStyle } from './Field';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

/** Limits of PUT /providers/{id}/reviews/mine (docs/API.md). */
const NAME_MAX = 80;
const COMMENT_MAX = 2000;
const STARS = [1, 2, 3, 4, 5] as const;

/** The words for a failed review write or delete, by the status the API answered. */
export function reviewErrorText(cause: unknown, s: Strings, f: (t: string, v?: Record<string, string | number>) => string) {
  const error = cause instanceof ApiError ? cause : null;
  switch (error?.status) {
    case 0:
      return s.reviews.errors.offline;
    case 401:
      return s.reviews.errors.signedOut;
    case 403:
      return s.reviews.errors.own;
    case 404:
      return s.reviews.errors.gone;
    case 422:
      return s.reviews.errors.invalid;
    case 429:
      return error.retryAfterS
        ? f(s.reviews.errors.rateLimitedFor, { n: Math.ceil(error.retryAfterS) })
        : s.reviews.errors.rateLimited;
    default:
      return s.reviews.errors.failed;
  }
}

interface Props {
  providerId: string;
  providerName: string;
  /** My review when editing; null to write a new one. */
  existing: Review | null;
  onClose: () => void;
  onSaved: (review: Review) => void;
}

/**
 * Write or edit my review: 1 to 5 stars (each a 48 dp target), the name shown
 * with the review, and an optional comment. Saving is one PUT: it creates the
 * review or replaces the one I had.
 */
export function ReviewSheet({ providerId, providerName, existing, onClose, onSaved }: Props) {
  const { colors } = useTheme();
  const { s, f, row, plural } = useI18n();
  const styles = useStyles();
  const inputStyle = useInputStyle();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [name, setName] = useState(existing?.author_name ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [focused, setFocused] = useState<'name' | 'comment' | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  // Set at once on the first tap, so a second quick tap (before the button turns busy) does nothing.
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const ratingError = tried && rating === 0 ? s.reviews.ratingRequired : null;
  const nameError = tried && name.trim().length === 0 ? s.reviews.nameRequired : null;
  const words = [s.reviews.words.r1, s.reviews.words.r2, s.reviews.words.r3, s.reviews.words.r4, s.reviews.words.r5];

  const save = async () => {
    setTried(true);
    if (rating === 0 || name.trim().length === 0 || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const review = await api.upsertMyReview(providerId, {
        rating,
        comment: comment.trim(),
        author_name: name.trim(),
      });
      AccessibilityInfo.announceForAccessibility(existing ? s.reviews.updated : s.reviews.saved);
      onSaved(review);
    } catch (cause) {
      setError(reviewErrorText(cause, s, f));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Sheet
      title={existing ? s.reviews.sheetTitleEdit : f(s.reviews.sheetTitle, { name: providerName })}
      closeLabel={s.reviews.close}
      onClose={onClose}
    >
      {/* The stars: a white block with five 48 dp targets and the word for the choice. */}
      <Field label={s.reviews.starsLabel} error={ratingError}>
        <View style={styles.starBlock}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={s.reviews.starsLabel}
            style={[styles.stars, { flexDirection: row }]}
          >
            {STARS.map((n) => {
              const on = n <= rating;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: n === rating }}
                  accessibilityLabel={`${plural(s.reviews.star, n)}, ${words[n - 1]}`}
                  onPress={() => setRating(n)}
                  android_ripple={{ color: colors.surfaceTintStrong, borderless: true }}
                  style={styles.star}
                >
                  <Star
                    size={size.starPick}
                    color={on ? colors.rating : colors.outline}
                    fill={on ? colors.rating : 'none'}
                    strokeWidth={size.stroke}
                  />
                </Pressable>
              );
            })}
          </View>
          <Txt role="bodyStrong" color={rating ? 'text' : 'textMuted'} center accessibilityLiveRegion="polite">
            {rating ? words[rating - 1] : s.reviews.pickStars}
          </Txt>
        </View>
      </Field>

      <Field label={s.reviews.name} hint={s.reviews.nameHint} error={nameError}>
        <TextInput
          value={name}
          onChangeText={setName}
          onFocus={() => setFocused('name')}
          onBlur={() => setFocused(null)}
          placeholder={s.reviews.namePlaceholder}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={s.reviews.name}
          accessibilityHint={nameError ?? s.reviews.nameHint}
          aria-invalid={nameError ? true : undefined}
          autoComplete="name"
          maxLength={NAME_MAX}
          selectionColor={colors.primary}
          style={inputStyle(focused === 'name', nameError)}
        />
      </Field>

      <Field label={s.reviews.comment} optional>
        <TextInput
          value={comment}
          onChangeText={setComment}
          onFocus={() => setFocused('comment')}
          onBlur={() => setFocused(null)}
          placeholder={s.reviews.commentPlaceholder}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={s.reviews.comment}
          multiline
          maxLength={COMMENT_MAX}
          selectionColor={colors.primary}
          style={inputStyle(focused === 'comment', null, true)}
        />
      </Field>

      {error ? <Notice>{error}</Notice> : null}
      <Button
        label={existing ? s.reviews.saveEdit : s.reviews.save}
        onPress={() => void save()}
        loading={saving}
      />
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  starBlock: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    gap: space.xs,
  },
  stars: {
    justifyContent: 'center',
    gap: space.xs,
  },
  star: {
    width: size.touch,
    height: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
