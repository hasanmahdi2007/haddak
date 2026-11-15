import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, type TypeRole } from '@/theme';

import { Txt } from './Txt';

interface Props {
  /** From the API: true, false, or null when the provider gave no hours. */
  open: boolean | null;
  role?: TypeRole;
}

/**
 * "Open now" or "Closed", with a small dot. Draws nothing when hours are unknown.
 * The words carry the meaning; the dot also differs in shape (filled or a ring),
 * so it never depends on colour alone.
 */
export function OpenStatus({ open, role = 'label' }: Props) {
  const { s, row } = useI18n();
  const styles = useStyles();
  if (open === null) return null;
  return (
    <View style={[styles.wrap, { flexDirection: row }]}>
      <View style={[styles.dot, open ? styles.dotOpen : styles.dotClosed]} />
      <Txt role={role} color={open ? 'success' : 'textMuted'} numberOfLines={1}>
        {open ? s.hours.openNow : s.hours.closedNow}
      </Txt>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    alignItems: 'center',
    gap: space.xs,
  },
  dot: {
    width: space.sm,
    height: space.sm,
    borderRadius: radius.pill,
  },
  dotOpen: {
    backgroundColor: c.success,
  },
  dotClosed: {
    borderWidth: size.lineMid,
    borderColor: c.textSubtle,
  },
}));
