import { useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';

import { api, ApiError, type AvailableHours, type OwnProvider } from '@/api';
import { useI18n } from '@/i18n';
import type { Strings } from '@/i18n/en';
import { to12Hour } from '@/lib/hours';
import { elevation, makeStyles, opacity, radius, size, space } from '@/theme';

import { AvailableTag } from './Badges';
import { Notice } from './Field';
import { SwitchRow } from './SwitchRow';
import { Txt } from './Txt';

/** The only choices the backend accepts (docs/API.md, "Available now"). */
const HOUR_CHOICES: readonly AvailableHours[] = [2, 4, 8];

type Feedback = { tone: 'error' | 'success'; text: string } | null;

/** A short, plain message for a failed change (the backend's own wording is English only). */
function errorText(error: unknown, s: Strings): string {
  const e = s.business.errors;
  if (!(error instanceof ApiError)) return e.failed;
  if (error.status === 0) return e.offline;
  if (error.status === 401) return e.signedOut;
  if (error.status === 429) return e.rateLimited;
  return e.failed;
}

/** True while the switch has not run out. The server compares the same time on every read. */
function isOn(own: OwnProvider): boolean {
  return own.available_until !== null && Date.parse(own.available_until) > Date.now();
}

/**
 * "Available now" in My business: a switch and how long it stays on (2, 4 or 8
 * hours). For people without fixed hours, a plumber who can come today. It turns
 * itself off on the server when the time is up, so a forgotten switch never
 * leaves customers calling someone who is not free.
 *
 * Picking another duration while it is on starts the count again from now.
 */
export function AvailableNowSection({ own, onSaved }: { own: OwnProvider; onSaved: (own: OwnProvider) => void }) {
  const { s, f, plural, row } = useI18n();
  const styles = useStyles();
  const [hours, setHours] = useState<AvailableHours>(2);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const on = isOn(own);

  // An ISO time as "3:30 PM" (or "3:30 م"), in the phone's own clock.
  const clock = (iso: string) => {
    const date = new Date(iso);
    const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const { h, mm, pm } = to12Hour(hhmm);
    return f(s.hours.time, { h, mm, period: pm ? s.hours.pm : s.hours.am });
  };

  const say = (next: Feedback) => {
    setFeedback(next);
    if (next) AccessibilityInfo.announceForAccessibility(next.text);
  };

  const switchOn = async (forHours: AvailableHours) => {
    setBusy(true);
    setFeedback(null);
    try {
      const next = await api.setMyAvailable(forHours);
      onSaved(next);
      if (next.available_until) {
        say({ tone: 'success', text: f(s.business.availableSaved, { time: clock(next.available_until) }) });
      }
    } catch (error) {
      say({ tone: 'error', text: errorText(error, s) });
    } finally {
      setBusy(false);
    }
  };

  const switchOff = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await api.clearMyAvailable();
      onSaved({ ...own, available_until: null, available_now: false });
      say({ tone: 'success', text: s.business.availableCleared });
    } catch (error) {
      say({ tone: 'error', text: errorText(error, s) });
    } finally {
      setBusy(false);
    }
  };

  const chooseHours = (n: AvailableHours) => {
    setHours(n);
    // Already on: the new length counts from now.
    if (on && !busy) void switchOn(n);
  };

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={[styles.title, { flexDirection: row }]}>
          <Txt role="headline" accessibilityRole="header" style={styles.flex}>
            {s.business.availableTitle}
          </Txt>
          {/* The same tag customers see on the card, while it is on. */}
          {on ? <AvailableTag decorative /> : null}
        </View>
        <Txt role="label" color="textMuted">
          {s.business.availableNote}
        </Txt>
      </View>

      <SwitchRow
        label={s.business.availableSwitch}
        hint={on && own.available_until ? f(s.business.availableOn, { time: clock(own.available_until) }) : s.business.availableOff}
        value={on}
        onChange={(value) => {
          if (busy) return;
          void (value ? switchOn(hours) : switchOff());
        }}
      />

      <View style={styles.choice}>
        <Txt role="label" color="textMuted" style={styles.inset}>
          {s.business.availableFor}
        </Txt>
        <View style={[styles.pills, { flexDirection: row }]} accessibilityRole="radiogroup">
          {HOUR_CHOICES.map((n) => {
            const chosen = n === hours;
            return (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityLabel={plural(s.business.availableHours, n)}
                accessibilityState={{ checked: chosen, disabled: busy }}
                onPress={() => chooseHours(n)}
                hitSlop={{ top: size.segmentSlop, bottom: size.segmentSlop }}
                style={({ pressed }) => [styles.pill, chosen ? styles.pillChosen : null, pressed ? styles.dim : null]}
              >
                <Txt role="action" color={chosen ? 'onPrimary' : 'text'} numberOfLines={1}>
                  {plural(s.business.availableHours, n)}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  // The same white block as the other sections of My business.
  section: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
    boxShadow: elevation.card,
  },
  head: {
    gap: space.xxs,
    paddingHorizontal: space.xs,
  },
  title: {
    alignItems: 'center',
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
  choice: {
    gap: space.sm,
  },
  inset: {
    paddingHorizontal: space.xs,
  },
  pills: {
    gap: space.sm,
  },
  // Three equal pills, the chosen one ink, like the offer's day pills.
  pill: {
    flex: 1,
    minHeight: size.segment + space.xs,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceInset,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  pillChosen: {
    backgroundColor: c.primary,
  },
  dim: {
    opacity: opacity.pressed,
  },
}));
