import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

interface Props {
  label: string;
  /** One line under the label saying what the switch changes. */
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/**
 * An on/off setting in a form: a grey block with the words at the start and a
 * small switch at the end. The switch is the one from the "Verified only"
 * filter (VerifiedFilter.tsx): off is a mid-grey track with an empty thumb at
 * the start; on is an ink track with a white thumb and a check at the end.
 * Mint is kept for trust, so the block itself stays grey.
 *
 * The whole block is the touch target. To a screen reader it is a switch.
 */
export function SwitchRow({ label, hint, value, onChange }: Props) {
  const { colors } = useTheme();
  const { row } = useI18n();
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      // The web build reads this one (role="switch" needs aria-checked).
      aria-checked={value}
      onPress={() => onChange(!value)}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={[styles.block, { flexDirection: row }]}
    >
      <View style={styles.words}>
        <Txt role="bodyStrong">{label}</Txt>
        {hint ? (
          <Txt role="caption" color="textMuted">
            {hint}
          </Txt>
        ) : null}
      </View>
      {/* `row` is already mirrored for Arabic, so "end" is the right side in English and the left in Arabic. */}
      <View
        style={[
          styles.track,
          { flexDirection: row, justifyContent: value ? 'flex-end' : 'flex-start' },
          value ? styles.trackOn : null,
        ]}
      >
        <View style={styles.thumb}>
          {value ? <Check color={colors.primary} size={size.switchThumb - space.xs} strokeWidth={size.strokeHeavy} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  block: {
    minHeight: size.touch + space.md,
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceTint,
    overflow: 'hidden',
  },
  words: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
  // Off: a mid-grey track, clearly a control on the grey block (3:1) and clearly not "on".
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
}));
