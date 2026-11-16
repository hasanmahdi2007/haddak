import { Badge, BadgeCheck } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

interface Props {
  /** True (the default everywhere): only providers Haddak has checked. */
  verifiedOnly: boolean;
  onChange: (verifiedOnly: boolean) => void;
}

/**
 * The verification filter: one chip that is either on or off.
 * On: solid mint, a check badge, "Verified only".
 * Off: an outlined chip, the empty badge, "Unverified too".
 * To a screen reader it is a switch named "Verified only".
 */
export function VerifiedFilter({ verifiedOnly, onChange }: Props) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  const Icon = verifiedOnly ? BadgeCheck : Badge;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={s.filter.label}
      accessibilityState={{ checked: verifiedOnly }}
      onPress={() => onChange(!verifiedOnly)}
      // 40 dp to the eye, 48 dp to the finger.
      hitSlop={{ top: space.xs, bottom: space.xs }}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={[styles.chip, { flexDirection: row }, verifiedOnly ? styles.on : styles.off]}
    >
      <Icon color={verifiedOnly ? colors.onMint : colors.text} size={size.iconSmall} strokeWidth={size.lineBold} />
      <Txt role="label" color={verifiedOnly ? 'onMint' : 'text'} numberOfLines={1}>
        {verifiedOnly ? s.filter.verifiedOnly : s.filter.unverifiedToo}
      </Txt>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  chip: {
    // The same height as the distance track beside it.
    height: size.segment + space.xxs * 2,
    alignItems: 'center',
    gap: space.xs + space.xxs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: size.lineMid,
    overflow: 'hidden',
  },
  on: {
    backgroundColor: c.mint,
    borderColor: c.mint,
  },
  off: {
    borderColor: c.outline,
  },
}));
