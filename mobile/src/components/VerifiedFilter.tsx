import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

interface Props {
  /** True: only providers Haddak has checked. Off by default since 2026-11-17 (everyone, verified first). */
  verifiedOnly: boolean;
  onChange: (verifiedOnly: boolean) => void;
}

/**
 * The verification filter: a pill with a fixed name, "Verified only", and a
 * small switch at its end. The name never changes; only the switch does.
 *
 * - On: the pill is solid black (the selected state), the thumb sits at the end and carries a check.
 * - Off (the default): an outlined pill, the thumb sits at the start and is empty.
 *
 * The whole pill is the touch target. To a screen reader it is a switch named
 * "Verified only" that is on or off.
 */
export function VerifiedFilter({ verifiedOnly, onChange }: Props) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();

  return (
    <Pressable
      testID="verified-filter"
      accessibilityRole="switch"
      accessibilityLabel={s.filter.label}
      accessibilityHint={s.filter.hint}
      accessibilityState={{ checked: verifiedOnly }}
      // The web build reads this one (role="switch" needs aria-checked).
      aria-checked={verifiedOnly}
      onPress={() => onChange(!verifiedOnly)}
      // 40 dp to the eye, 48 dp to the finger.
      hitSlop={{ top: space.xs, bottom: space.xs }}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={[styles.pill, { flexDirection: row }, verifiedOnly ? styles.pillOn : null]}
    >
      <Txt role="label" color={verifiedOnly ? 'onPrimary' : 'text'} numberOfLines={1}>
        {s.filter.label}
      </Txt>
      {/* `row` is already mirrored for Arabic, so "end" is the right side in English and the left in Arabic. */}
      <View
        style={[
          styles.track,
          { flexDirection: row, justifyContent: verifiedOnly ? 'flex-end' : 'flex-start' },
          verifiedOnly ? styles.trackOn : null,
        ]}
      >
        <View style={[styles.thumb, verifiedOnly ? styles.thumbOn : null]}>
          {verifiedOnly ? (
            <Check color={colors.onPrimary} size={size.switchThumb - space.xs} strokeWidth={size.strokeHeavy} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  pill: {
    // The same height as the distance track beside it.
    height: size.segment + space.xxs * 2,
    alignItems: 'center',
    gap: space.sm,
    paddingStart: space.md,
    paddingEnd: space.xs + space.xxs,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: c.border,
    overflow: 'hidden',
  },
  pillOn: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  // Off: a mid-grey track, clearly a control (3:1 on white and the ground) and clearly not "on".
  track: {
    width: size.switchTrackW,
    height: size.switchTrackH,
    borderRadius: radius.pill,
    alignItems: 'center',
    paddingHorizontal: (size.switchTrackH - size.switchThumb) / 2,
    backgroundColor: c.outline,
  },
  // On: a white track on the black pill, with a black thumb and a white check.
  trackOn: {
    backgroundColor: c.onPrimary,
  },
  thumb: {
    width: size.switchThumb,
    height: size.switchThumb,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // White on the mid-grey track when off.
    backgroundColor: c.surface,
  },
  // Black on the white track when on.
  thumbOn: {
    backgroundColor: c.primary,
  },
}));
