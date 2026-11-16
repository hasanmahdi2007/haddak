import { Check, Clock, PhoneMissed, Star } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, View } from 'react-native';

import { api, ApiError, type HireAnswer, type HireCheck, type Review } from '@/api';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { makeStyles, space } from '@/theme';

import { Button } from './Button';
import { Notice } from './Field';
import { ReviewSheet } from './ReviewSheet';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

/**
 * "Did you hire them?" (docs/API.md). Sits once in the root layout and draws
 * nothing until it has a question to ask.
 *
 * Each time the app opens or comes back to the foreground while signed in, it
 * asks the backend for pending checks (12 hours to 14 days after a WhatsApp or
 * Call tap) and shows the newest one. At most one sheet per app open, so a
 * user with three pending checks is never asked three times in a row.
 */
export function HireCheckPrompt() {
  const { status } = useAuth();
  const [check, setCheck] = useState<HireCheck | null>(null);
  // True once a sheet was shown in this app open. Reset when the app goes to the background.
  const shownThisOpen = useRef(false);

  /** Fetch the pending checks and show the newest, unless a sheet was shown in this app open. */
  const lookForCheck = useCallback(() => {
    if (shownThisOpen.current) return;
    api
      .getPendingHireChecks()
      .then(({ items }) => {
        if (items.length > 0 && !shownThisOpen.current) {
          shownThisOpen.current = true;
          setCheck(items[0]);
        }
      })
      // Offline or signed out meanwhile: nothing to ask this time.
      .catch(() => undefined);
  }, []);

  // On open, and again after signing in.
  useEffect(() => {
    if (status === 'signedIn') lookForCheck();
  }, [status, lookForCheck]);

  // Coming back to the foreground counts as a new app open.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') shownThisOpen.current = false;
      if (next === 'active' && status === 'signedIn') lookForCheck();
    });
    return () => subscription.remove();
  }, [status, lookForCheck]);

  if (!check || status !== 'signedIn') return null;
  return <HireCheckSheet check={check} onDone={() => setCheck(null)} />;
}

type Stage = 'ask' | 'thanks' | 'review';

/** The sheet itself: three big answers, then (after "Yes") an offer to rate. */
export function HireCheckSheet({ check, onDone }: { check: HireCheck; onDone: () => void }) {
  const { s, f } = useI18n();
  const styles = useStyles();
  const [stage, setStage] = useState<Stage>('ask');
  const [sending, setSending] = useState<HireAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const name = check.provider.name;

  const send = async (answer: HireAnswer) => {
    if (sending) return;
    setSending(answer);
    setError(null);
    try {
      await api.answerHireCheck(check.id, answer);
    } catch (cause) {
      // 404 / 409: already answered (on another phone) or gone. Nothing left to ask.
      const status = cause instanceof ApiError ? cause.status : 0;
      if (status !== 404 && status !== 409) {
        setSending(null);
        setError(s.hire.error);
        AccessibilityInfo.announceForAccessibility(s.hire.error);
        return;
      }
    }
    setSending(null);
    if (answer === 'hired') {
      setStage('thanks');
    } else {
      AccessibilityInfo.announceForAccessibility(s.hire.thanks);
      onDone();
    }
  };

  const openReview = async () => {
    // Edit my review if I already wrote one, so it is not written twice.
    try {
      setMyReview(await api.getMyReview(check.provider.id));
    } catch {
      setMyReview(null);
    }
    setStage('review');
  };

  if (stage === 'review') {
    return (
      <ReviewSheet
        providerId={check.provider.id}
        providerName={name}
        existing={myReview}
        onClose={onDone}
        onSaved={onDone}
      />
    );
  }

  if (stage === 'thanks') {
    return (
      <Sheet title={f(s.hire.thanksTitle, { name })} closeLabel={s.hire.close} onClose={onDone}>
        <Txt role="bodyLarge" color="textMuted">
          {s.hire.thanksBody}
        </Txt>
        <View style={styles.actions}>
          <Button label={s.hire.rate} icon={Star} large onPress={() => void openReview()} />
          <Button label={s.hire.later} variant="white" large onPress={onDone} />
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet title={f(s.hire.title, { name })} closeLabel={s.hire.close} onClose={onDone}>
      <Txt role="bodyLarge" color="textMuted">
        {s.hire.body}
      </Txt>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <View style={styles.actions}>
        <Button
          label={s.hire.yes}
          icon={Check}
          large
          loading={sending === 'hired'}
          disabled={sending !== null && sending !== 'hired'}
          onPress={() => void send('hired')}
        />
        <Button
          label={s.hire.notYet}
          icon={Clock}
          variant="white"
          large
          loading={sending === 'not_yet'}
          disabled={sending !== null && sending !== 'not_yet'}
          onPress={() => void send('not_yet')}
        />
        <Button
          label={s.hire.noAnswer}
          icon={PhoneMissed}
          variant="white"
          large
          loading={sending === 'no_answer'}
          disabled={sending !== null && sending !== 'no_answer'}
          onPress={() => void send('no_answer')}
        />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(() => ({
  actions: {
    gap: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
}));
