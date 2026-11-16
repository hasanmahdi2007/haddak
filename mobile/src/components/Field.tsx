import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, type StyleProp, type TextStyle, View, type ViewStyle } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, type as typeScale, useTheme } from '@/theme';

import { Txt } from './Txt';

/**
 * The form parts shared by sign-in and My business. They follow the Suggest form
 * (src/app/suggest.tsx): a label set in to line up with the typed text, a grey
 * pill field whose edge turns ink on focus and red on an error, then a hint or
 * the error under it.
 */

/** Space between the edge of a pill field and the text inside it. */
export const FIELD_INSET = space.xl;

// Web only: the field's own ink edge shows focus, so the browser's ring is turned off.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

interface FieldProps {
  label: string;
  /** Adds "(optional)" after the label. */
  optional?: boolean;
  hint?: string;
  error?: string | null;
  /** Small text at the end of the label line, such as a character count. */
  aside?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Field({ label, optional, hint, error, aside, children, style }: FieldProps) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.field, style]}>
      <View style={[styles.labelRow, { flexDirection: row }]}>
        <Txt role="bodyStrong" style={styles.flex}>
          {label}
          {optional ? (
            <Txt role="label" color="textSubtle">
              {' '}
              ({s.business.optional})
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
          style={[styles.under, styles.message, { flexDirection: row }]}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityLabel={error}
        >
          <View style={styles.messageIcon}>
            <CircleAlert color={colors.danger} size={size.iconSmall} strokeWidth={size.stroke} />
          </View>
          <Txt role="label" color="danger" style={styles.flex}>
            {error}
          </Txt>
        </View>
      ) : hint ? (
        <Txt role="caption" color="textSubtle" style={styles.under}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/** The style of a pill field in its current state. */
export function useInputStyle() {
  const styles = useStyles();
  const { textAlign, writingDirection } = useI18n();
  return (focused: boolean, error?: string | null, multiline = false) => [
    styles.input,
    NO_FOCUS_RING,
    { textAlign, writingDirection },
    multiline ? styles.multiline : null,
    focused ? styles.focused : null,
    error ? styles.errorEdge : null,
  ];
}

type NoticeTone = 'error' | 'info' | 'success';

const NOTICE_ICON: Record<NoticeTone, LucideIcon> = { error: CircleAlert, info: Info, success: CircleCheck };

/** A short message in its own block: red-soft for a failure, white for information, mint for done. */
export function Notice({ tone = 'error', children }: { tone?: NoticeTone; children: string }) {
  const { colors } = useTheme();
  const { row } = useI18n();
  const styles = useStyles();
  const Icon = NOTICE_ICON[tone];
  const fg = tone === 'error' ? 'onDangerSoft' : tone === 'success' ? 'onMint' : 'text';
  return (
    <View
      style={[styles.notice, styles[tone], { flexDirection: row }]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.messageIcon}>
        <Icon color={colors[fg]} size={size.iconSmall} strokeWidth={size.stroke} />
      </View>
      <Txt role="label" color={fg} style={styles.flex}>
        {children}
      </Txt>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: {
    flex: 1,
  },
  field: {
    gap: space.sm,
  },
  labelRow: {
    alignItems: 'baseline',
    gap: space.sm,
    paddingHorizontal: FIELD_INSET,
  },
  under: {
    paddingHorizontal: FIELD_INSET,
  },
  message: {
    alignItems: 'flex-start',
    gap: space.xs,
  },
  // Lines the small icon up with the first line of the message.
  messageIcon: {
    paddingTop: space.xxs,
  },
  input: {
    ...typeScale.body,
    minHeight: size.button,
    backgroundColor: c.surfaceTint,
    borderRadius: radius.pill,
    borderWidth: size.lineBold,
    borderColor: c.surfaceTint,
    color: c.text,
    paddingHorizontal: FIELD_INSET - size.lineBold,
    paddingVertical: space.md,
  },
  // Several lines do not fit a pill, so a long text is a block with the card radius.
  multiline: {
    minHeight: size.tile,
    borderRadius: radius.lg,
    paddingTop: space.lg,
    textAlignVertical: 'top',
  },
  focused: {
    borderColor: c.primary,
  },
  errorEdge: {
    borderColor: c.danger,
  },
  notice: {
    alignItems: 'flex-start',
    gap: space.sm,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  error: {
    backgroundColor: c.dangerSoft,
  },
  info: {
    backgroundColor: c.surface,
  },
  success: {
    backgroundColor: c.mint,
  },
}));
