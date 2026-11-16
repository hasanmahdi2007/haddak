import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { DayKey, OpeningHours, TimeRange } from '@/api';
import { useI18n } from '@/i18n';
import { DAY_KEYS } from '@/lib/hours';
import { makeStyles, opacity, radius, size, space, useTheme } from '@/theme';

import { useInputStyle } from './Field';
import { TextLink } from './TextLink';
import { Txt } from './Txt';

/**
 * One day in the editor: open or closed, and one opening period.
 * A day saved with two or three periods (possible through the API) keeps the
 * later ones in `extra`; they are shown under the day and sent back unchanged.
 */
export interface DayDraft {
  open: boolean;
  from: string;
  to: string;
  extra: TimeRange[];
}

export type HoursDraft = Record<DayKey, DayDraft>;

const DEFAULT_FROM = '09:00';
const DEFAULT_TO = '18:00';
/** 24-hour "HH:MM", 00:00 to 23:59: the backend's rule. */
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The editor's starting point: the saved hours, or Monday to Saturday 9 to 6. */
export function hoursDraft(hours: OpeningHours | null): HoursDraft {
  const draft = {} as HoursDraft;
  for (const day of DAY_KEYS) {
    const ranges = hours ? (hours[day] ?? []) : null;
    if (ranges === null) {
      draft[day] = { open: day !== 'sun', from: DEFAULT_FROM, to: DEFAULT_TO, extra: [] };
    } else if (ranges.length === 0) {
      draft[day] = { open: false, from: DEFAULT_FROM, to: DEFAULT_TO, extra: [] };
    } else {
      draft[day] = { open: true, from: ranges[0][0], to: ranges[0][1], extra: ranges.slice(1) };
    }
  }
  return draft;
}

/** The first day whose times are not valid, or null when all are fine. */
export function invalidDay(draft: HoursDraft): DayKey | null {
  for (const day of DAY_KEYS) {
    const { open, from, to } = draft[day];
    // "HH:MM" texts of the same length compare correctly as plain strings.
    if (open && (!CLOCK.test(from) || !CLOCK.test(to) || from >= to)) return day;
  }
  return null;
}

/** The draft in the API's shape. Closed days are left out, which means closed. */
export function draftToHours(draft: HoursDraft): OpeningHours {
  const hours: OpeningHours = {};
  for (const day of DAY_KEYS) {
    const { open, from, to, extra } = draft[day];
    if (open) hours[day] = [[from, to], ...extra];
  }
  return hours;
}

/** "930" -> "09:30", "1730" -> "17:30": the colon is added while typing. */
function formatTime(typed: string): string {
  const digits = typed.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, digits.length - 2).padStart(2, '0')}:${digits.slice(-2)}`;
}

interface Props {
  value: HoursDraft;
  onChange: (next: HoursDraft) => void;
  /** The day to mark in red, once the owner has tried to send the form. */
  errorDay: DayKey | null;
  /** Called when a time field gets focus, so the page can bring it above the keyboard. */
  onFieldFocus?: (input: ComponentRef<typeof TextInput> | null) => void;
}

/**
 * Opening hours, one row per day: the day's name and an Open / Closed switch,
 * then, when open, two time pills (opens, closes). Times are 24-hour, as the
 * API stores them. A link copies Monday's times to every open day.
 */
export function HoursEditor({ value, onChange, errorDay, onFieldFocus }: Props) {
  const { colors } = useTheme();
  const { s, f, row } = useI18n();
  const styles = useStyles();
  const inputStyle = useInputStyle();
  const [focused, setFocused] = useState<string | null>(null);
  const inputs = useRef<Record<string, ComponentRef<typeof TextInput> | null>>({});

  const setDay = (day: DayKey, change: Partial<DayDraft>) => onChange({ ...value, [day]: { ...value[day], ...change } });

  const copyMonday = () => {
    const { from, to } = value.mon;
    const next = { ...value };
    for (const day of DAY_KEYS) if (next[day].open) next[day] = { ...next[day], from, to };
    onChange(next);
  };

  return (
    <View style={styles.list}>
      {DAY_KEYS.map((day) => {
        const draft = value[day];
        const dayName = s.hours.days[day];
        const wrong = errorDay === day;
        const timeField = (which: 'from' | 'to') => {
          const id = `${day}-${which}`;
          const label = `${dayName}, ${which === 'from' ? s.join.opens : s.join.closes}`;
          return (
            <View style={styles.timeGroup}>
              <Txt role="caption" color="textMuted" style={styles.timeLabel}>
                {which === 'from' ? s.join.opens : s.join.closes}
              </Txt>
              <TextInput
                ref={(input) => {
                  inputs.current[id] = input;
                }}
                value={draft[which]}
                onChangeText={(typed) => setDay(day, { [which]: formatTime(typed) })}
                onFocus={() => {
                  setFocused(id);
                  onFieldFocus?.(inputs.current[id] ?? null);
                }}
                onBlur={() => setFocused(null)}
                placeholder={which === 'from' ? DEFAULT_FROM : DEFAULT_TO}
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={label}
                accessibilityHint={s.join.timeHint}
                aria-invalid={wrong ? true : undefined}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={5}
                selectionColor={colors.primary}
                // Times read left to right in Arabic too.
                style={[inputStyle(focused === id, wrong ? 'error' : null), styles.time]}
              />
            </View>
          );
        };

        return (
          <View key={day} style={styles.day}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={dayName}
              accessibilityState={{ checked: draft.open }}
              aria-checked={draft.open}
              accessibilityHint={draft.open ? s.join.open : s.join.closed}
              onPress={() => setDay(day, { open: !draft.open })}
              style={({ pressed }) => [styles.dayHead, { flexDirection: row }, pressed ? styles.dim : null]}
            >
              <Txt role="bodyStrong" style={styles.flex}>
                {dayName}
              </Txt>
              <Txt role="label" color={draft.open ? 'text' : 'textMuted'}>
                {draft.open ? s.join.open : s.join.closed}
              </Txt>
              <View
                style={[
                  styles.track,
                  { flexDirection: row, justifyContent: draft.open ? 'flex-end' : 'flex-start' },
                  draft.open ? styles.trackOn : null,
                ]}
              >
                <View style={styles.thumb} />
              </View>
            </Pressable>
            {draft.open ? (
              <View style={[styles.times, { flexDirection: row }]}>
                {timeField('from')}
                {timeField('to')}
              </View>
            ) : null}
            {draft.open && draft.extra.length > 0 ? (
              <Txt role="caption" color="textMuted" ltr style={styles.timeLabel}>
                {draft.extra.map(([from, to]) => `+ ${from} – ${to}`).join('   ')}
              </Txt>
            ) : null}
            {wrong ? (
              <Txt role="label" color="danger" accessibilityRole="alert" style={styles.timeLabel}>
                {f(s.join.hoursInvalid, { day: dayName })}
              </Txt>
            ) : null}
          </View>
        );
      })}
      <TextLink label={s.join.copyMonday} onPress={copyMonday} style={styles.copy} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  list: {
    gap: space.xs,
  },
  day: {
    gap: space.sm,
    paddingBottom: space.sm,
  },
  dayHead: {
    minHeight: size.touch,
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xs,
  },
  dim: {
    opacity: opacity.pressed,
  },
  times: {
    gap: space.md,
  },
  timeGroup: {
    gap: space.xxs,
  },
  timeLabel: {
    paddingHorizontal: space.md,
  },
  time: {
    width: size.timeField,
    textAlign: 'center',
    writingDirection: 'ltr',
    paddingHorizontal: space.sm,
  },
  // The same small switch as the "Verified only" filter, with an ink track when open.
  track: {
    width: size.switchTrackW,
    height: size.switchTrackH,
    borderRadius: radius.pill,
    alignItems: 'center',
    paddingHorizontal: (size.switchTrackH - size.switchThumb) / 2,
    backgroundColor: c.outline,
  },
  trackOn: {
    backgroundColor: c.primary,
  },
  thumb: {
    width: size.switchThumb,
    height: size.switchThumb,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
  },
  copy: {
    alignSelf: 'center',
  },
}));
