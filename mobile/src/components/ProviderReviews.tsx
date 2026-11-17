import { PenLine, Star } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';

import { api, type ProviderDetail, type Review } from '@/api';
import { useI18n } from '@/i18n';
import { requireSignIn, useAuth } from '@/lib/auth';
import { elevation, makeStyles, opacity, radius, size, space, useTheme } from '@/theme';

import { HiredBadge } from './Badges';
import { Button } from './Button';
import { Notice } from './Field';
import { Stars } from './Rating';
import { ReviewSheet, reviewErrorText } from './ReviewSheet';
import { Skeleton } from './Skeleton';
import { Txt } from './Txt';

/** Reviews asked for at a time. */
const PAGE = 10;
/** Reviews shown before "See all". */
const LATEST = 3;

function ReviewItem({ review }: { review: Review }) {
  const { row, language } = useI18n();
  const styles = useStyles();
  const date = new Date(review.created_at).toLocaleDateString(
    language === 'ar' ? 'ar-LB-u-nu-latn' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );
  return (
    <View style={styles.review}>
      <View style={[styles.reviewHead, { flexDirection: row }]}>
        <Txt role="bodyStrong" numberOfLines={1} style={styles.flex} content>
          {review.author_name}
        </Txt>
        <Txt role="caption" color="textSubtle">
          {date}
        </Txt>
      </View>
      <View style={[styles.reviewMeta, { flexDirection: row }]}>
        <Stars value={review.rating} />
        {review.hired_through_haddak ? <HiredBadge /> : null}
      </View>
      {review.comment ? (
        <Txt color="textMuted" content="block">
          {review.comment}
        </Txt>
      ) : null}
    </View>
  );
}

interface Props {
  /** The profile, with its rating as fresh as the screen has it. */
  provider: ProviderDetail;
  /** After my review is posted, changed or deleted: the screen fetches the new average. */
  onChanged: () => void;
}

/**
 * The reviews card on a profile: the average and count, my own review (or
 * "Write a review"), then the latest three with "See all" opening the rest a
 * page at a time.
 *
 * Writing needs an account: signed out, "Write a review" opens sign-in first
 * and the sheet once it closes.
 */
export function ProviderReviews({ provider, onChanged }: Props) {
  const { s, f, row, plural } = useI18n();
  const styles = useStyles();
  const auth = useAuth();
  const signedIn = auth.status === 'signedIn';

  const [items, setItems] = useState<Review[]>([]);
  const [total, setTotal] = useState(provider.review_count);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState(false);
  const [myReview, setMine] = useState<Review | null>(null);
  // Signed out, nothing is mine (whatever was fetched before signing out).
  const mine = signedIn ? myReview : null;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(
    async (offset: number) => {
      try {
        const page = await api.getReviews(provider.id, { limit: PAGE, offset });
        setItems((current) => (offset === 0 ? page.items : [...current, ...page.items]));
        setTotal(page.total);
        setState('ready');
      } catch {
        setState('error');
      }
    },
    [provider.id],
  );

  // The first page, again whenever someone signs in or out (it marks which review is mine).
  useEffect(() => {
    // State is only set after the awaited request settles, not during the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0);
  }, [load, signedIn]);

  // My review, asked for on its own: it may sit on a later page of the list.
  useEffect(() => {
    if (!signedIn) return undefined;
    let current = true;
    api
      .getMyReview(provider.id)
      .then((review) => {
        if (current) setMine(review);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [provider.id, signedIn]);

  const more = () => {
    setState('loading');
    void load(items.length);
  };

  const openSheet = () => {
    setNotice(null);
    setConfirmDelete(false);
    // Signed out: sign in first. Then fetch my review, so a returning reviewer edits theirs.
    if (
      !requireSignIn(() => {
        api
          .getMyReview(provider.id)
          .then(setMine)
          .catch(() => undefined)
          .finally(() => setSheetOpen(true));
      })
    ) {
      return;
    }
    setSheetOpen(true);
  };

  const saved = (review: Review) => {
    const wasEdit = mine !== null;
    setMine(review);
    setSheetOpen(false);
    setNotice({ tone: 'success', text: wasEdit ? s.reviews.updated : s.reviews.saved });
    void load(0);
    onChanged();
  };

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setNotice(null);
    try {
      await api.deleteMyReview(provider.id);
      setMine(null);
      setConfirmDelete(false);
      setNotice({ tone: 'success', text: s.reviews.deleted });
      AccessibilityInfo.announceForAccessibility(s.reviews.deleted);
      void load(0);
      onChanged();
    } catch (cause) {
      setNotice({ tone: 'error', text: reviewErrorText(cause, s, f) });
    } finally {
      setDeleting(false);
    }
  };

  // My review has its own block, so it is left out of the list under it.
  const others = items.filter((review) => !review.is_mine && review.id !== mine?.id);
  const shown = expanded ? others : others.slice(0, LATEST);
  const othersTotal = Math.max(0, total - (mine ? 1 : 0));
  const count = provider.review_count;

  return (
    <View style={styles.section}>
      <Txt role="title" accessibilityRole="header">
        {s.provider.reviews}
      </Txt>

      {/* The summary: the average large, its stars, and how many reviews make it. */}
      {count > 0 ? (
        <View
          style={[styles.summary, { flexDirection: row }]}
          accessible
          accessibilityLabel={plural(s.rating.label, count, { rating: provider.avg_rating.toFixed(1) })}
        >
          <Txt role="display">{provider.avg_rating.toFixed(1)}</Txt>
          <View style={styles.summaryText}>
            <View style={{ flexDirection: row }}>
              <Stars value={Math.round(provider.avg_rating)} />
            </View>
            <Txt role="label" color="textMuted">
              {plural(s.provider.reviewCount, count)}
            </Txt>
          </View>
        </View>
      ) : state === 'ready' ? (
        <View style={styles.empty}>
          <Txt role="bodyStrong">{s.provider.noReviews}</Txt>
          <Txt color="textMuted">{f(s.reviews.firstBody, { name: provider.name })}</Txt>
        </View>
      ) : null}

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      {/* Mine: a white block with Edit and Delete; Delete asks once, in place. */}
      {mine ? (
        <View style={styles.mine}>
          <Txt role="label" color="textMuted">
            {s.reviews.yours}
          </Txt>
          <ReviewItem review={mine} />
          {confirmDelete ? (
            <View style={styles.confirm} accessibilityLiveRegion="polite">
              <Txt role="bodyStrong">{s.reviews.deleteConfirm}</Txt>
              <View style={[styles.mineActions, { flexDirection: row }]}>
                <Button
                  label={s.reviews.keep}
                  variant="tonal"
                  compact
                  onPress={() => setConfirmDelete(false)}
                  style={styles.flex}
                />
                <Button
                  label={s.reviews.delete}
                  accessibilityLabel={s.reviews.deleteLabel}
                  compact
                  loading={deleting}
                  onPress={() => void remove()}
                  style={styles.flex}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.mineActions, { flexDirection: row }]}>
              <Button
                label={s.reviews.edit}
                accessibilityLabel={s.reviews.editLabel}
                icon={PenLine}
                variant="tonal"
                compact
                onPress={openSheet}
                style={styles.flex}
              />
              <Button
                label={s.reviews.delete}
                accessibilityLabel={s.reviews.deleteLabel}
                variant="tonal"
                compact
                onPress={() => {
                  setNotice(null);
                  setConfirmDelete(true);
                }}
                style={styles.flex}
              />
            </View>
          )}
        </View>
      ) : (
        <Button label={s.reviews.write} icon={Star} onPress={openSheet} />
      )}

      {shown.map((review, i) => (
        <View key={review.id} style={i > 0 || mine ? styles.divider : null}>
          <ReviewItem review={review} />
        </View>
      ))}

      {state === 'loading' ? (
        <View style={styles.skeleton} accessible accessibilityLabel={s.provider.loading}>
          <Skeleton width="40%" height={space.lg} />
          <Skeleton height={space.lg} />
          <Skeleton width="80%" height={space.lg} />
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={styles.errorBlock} accessibilityRole="alert">
          <Txt color="textMuted">{s.provider.reviewsError}</Txt>
          <Button label={s.common.tryAgain} variant="outline" onPress={more} />
        </View>
      ) : null}

      {/* "See all" opens the rest; after that, more pages come on demand. */}
      {state === 'ready' && !expanded && others.length > LATEST ? (
        <QuietAction label={plural(s.reviews.seeAll, othersTotal)} onPress={() => setExpanded(true)} />
      ) : null}
      {state === 'ready' && expanded && items.length < total ? (
        <QuietAction label={s.provider.moreReviews} onPress={more} />
      ) : null}
      {state === 'ready' && expanded && others.length > LATEST && items.length >= total ? (
        <QuietAction label={s.reviews.showFewer} onPress={() => setExpanded(false)} />
      ) : null}

      {sheetOpen ? (
        <ReviewSheet
          providerId={provider.id}
          providerName={provider.name}
          existing={mine}
          onClose={() => setSheetOpen(false)}
          onSaved={saved}
        />
      ) : null}
    </View>
  );
}

/** A full-width white pill for paging through reviews: quieter than the main button. */
function QuietAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={({ pressed }) => [styles.quiet, pressed ? styles.pressed : null]}
    >
      <Txt role="action" center>
        {label}
      </Txt>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  flex: {
    flex: 1,
  },
  section: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    boxShadow: elevation.card,
  },
  summary: {
    alignItems: 'center',
    gap: space.md,
  },
  summaryText: {
    gap: space.xxs,
  },
  empty: {
    gap: space.xxs,
  },
  mine: {
    backgroundColor: c.surfaceInset,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  mineActions: {
    gap: space.sm,
  },
  confirm: {
    gap: space.sm,
  },
  review: {
    gap: space.xs,
  },
  reviewHead: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  reviewMeta: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  divider: {
    borderTopWidth: size.hairline,
    borderTopColor: c.divider,
    paddingTop: space.md,
  },
  skeleton: {
    gap: space.sm,
    paddingVertical: space.sm,
  },
  errorBlock: {
    gap: space.sm,
  },
  quiet: {
    minHeight: size.touch,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceInset,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    overflow: 'hidden',
  },
  pressed: {
    opacity: opacity.pressed,
  },
}));
