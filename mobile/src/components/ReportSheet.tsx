import { Check } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, TextInput, View } from 'react-native';

import { api, ApiError, type ReportReason } from '@/api';
import { useI18n } from '@/i18n';
import { makeStyles, opacity, radius, size, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Field, Notice, useInputStyle } from './Field';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

/** In the order people are most likely to need them. */
const REASONS: ReportReason[] = ['wrong_info', 'closed', 'not_real', 'offensive', 'other'];
/**
 * A listing nobody owns (from a suggestion or OpenStreetMap) also offers
 * "This is my business and I want it removed", the way out for owners listed without asking.
 */
const UNCLAIMED_REASONS: ReportReason[] = ['wrong_info', 'closed', 'not_real', 'remove_my_business', 'offensive', 'other'];
/** Limit of `note` in POST /providers/{id}/reports. */
const NOTE_MAX = 500;

interface Props {
  providerId: string;
  name: string;
  /** True for a listing with no owner: adds the "remove my business" reason. */
  unclaimed?: boolean;
  /** A reason chosen in advance, e.g. from "Not listed by you? Ask us to remove it". */
  initialReason?: ReportReason;
  onClose: () => void;
}

/**
 * "Report this listing": choose a reason, add details if you like, send.
 * Then the same sheet says thank you. No login, and nothing about the sender
 * is stored (docs/API.md).
 */
export function ReportSheet({ providerId, name, unclaimed = false, initialReason, onClose }: Props) {
  const { colors } = useTheme();
  const { s, f, row } = useI18n();
  const styles = useStyles();
  const inputStyle = useInputStyle();
  const [reason, setReason] = useState<ReportReason | null>(initialReason ?? null);
  const [note, setNote] = useState('');
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  // Set at once on the first tap, so a second quick tap (before the button turns busy) does nothing.
  const inFlight = useRef(false);
  const [sent, setSent] = useState(false);
  // Shown only after a press of Send without a reason.
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setTried(true);
    if (!reason || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      await api.reportProvider(providerId, { reason, note: note.trim() || null });
      setSent(true);
      AccessibilityInfo.announceForAccessibility(s.report.thanksTitle);
    } catch (cause) {
      const status = cause instanceof ApiError ? cause.status : 0;
      setError(status === 429 ? s.report.rateLimited : status === 404 ? s.report.gone : s.report.failed);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Sheet title={s.report.title} closeLabel={s.report.close} onClose={onClose}>
        <View style={styles.thanks} accessibilityLiveRegion="polite">
          <View style={styles.thanksDisc}>
            <Check color={colors.onAccent} size={size.iconLarge} strokeWidth={size.strokeBold} />
          </View>
          <Txt role="title" center>
            {s.report.thanksTitle}
          </Txt>
          <Txt color="textMuted" center>
            {s.report.thanksBody}
          </Txt>
        </View>
        <Button label={s.report.done} onPress={onClose} />
      </Sheet>
    );
  }

  const reasonError = tried && !reason ? s.report.reasonRequired : null;

  return (
    <Sheet title={s.report.title} closeLabel={s.report.close} onClose={onClose}>
      <Txt color="textMuted">{f(s.report.intro, { name })}</Txt>

      <Field label={s.report.reasonLabel} error={reasonError}>
        <View accessibilityRole="radiogroup" accessibilityLabel={s.report.reasonLabel} style={styles.reasons}>
          {(unclaimed ? UNCLAIMED_REASONS : REASONS).map((key) => {
            const chosen = reason === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen }}
                accessibilityLabel={s.report.reasons[key]}
                onPress={() => setReason(key)}
                android_ripple={{ color: colors.surfaceTintStrong }}
                style={({ pressed }) => [
                  styles.reason,
                  { flexDirection: row },
                  chosen ? styles.reasonChosen : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                {/* The round mark of a single choice: empty ring, or a white disc with a check. */}
                <View style={[styles.mark, chosen ? styles.markChosen : null]}>
                  {chosen ? (
                    <Check color={colors.primary} size={size.iconSmall} strokeWidth={size.strokeBold} />
                  ) : null}
                </View>
                <Txt role="bodyStrong" color={chosen ? 'onPrimary' : 'text'} style={styles.flex}>
                  {s.report.reasons[key]}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label={s.report.details} optional aside={`${note.length} / ${NOTE_MAX}`}>
        <TextInput
          value={note}
          onChangeText={setNote}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={s.report.detailsPlaceholder}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={s.report.details}
          multiline
          maxLength={NOTE_MAX}
          selectionColor={colors.primary}
          style={inputStyle(focused, null, true)}
        />
      </Field>

      <Txt role="label" color="textMuted" center>
        {s.report.privacy}
      </Txt>
      {error ? <Notice>{error}</Notice> : null}
      <Button label={s.report.send} onPress={() => void send()} loading={sending} />
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  flex: {
    flex: 1,
  },
  reasons: {
    gap: space.sm,
  },
  // Each reason is a white pill; the chosen one turns to the primary colour.
  reason: {
    alignItems: 'center',
    gap: space.md,
    minHeight: size.touch + space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  reasonChosen: {
    backgroundColor: c.primary,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  mark: {
    width: size.badgeDisc,
    height: size.badgeDisc,
    borderRadius: radius.pill,
    borderWidth: size.lineBold,
    borderColor: c.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markChosen: {
    borderColor: c.onPrimary,
    backgroundColor: c.onPrimary,
  },
  thanks: {
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.xl,
  },
  thanksDisc: {
    width: size.trustDisc + space.md,
    height: size.trustDisc + space.md,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
}));
