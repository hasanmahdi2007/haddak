import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, type TypeRole } from '@/theme';

import { Txt } from './Txt';

interface Props {
  /** From the API: true, false, or null when the provider gave no hours. */
  open: boolean | null;
  role?: TypeRole;
  /** On an alice-blue or vanilla block the words are always dark, in both themes. */
  onPastel?: boolean;
}

/**
 * "Open now" or "Closed", with a small dot. Draws nothing when hours are unknown.
 * The words carry the meaning and are always ink. No pill around it: the dot is a
 * solid black dot when open and an empty grey ring when closed, so it never
 * depends on colour alone (and there is no green: the founder ruled it out).
 */
export function OpenStatus({ open, role = 'label', onPastel = false }: Props) {
  const { s, row } = useI18n();
  const styles = useStyles();
  if (open === null) return null;
  return (
    <View style={[styles.wrap, { flexDirection: row }]}>
      <View style={[styles.dot, open ? styles.dotOpen : styles.dotClosed]} />
      <Txt role={role} color={onPastel ? 'onAccent' : open ? 'text' : 'textMuted'} numberOfLines={1}>
        {open ? s.hours.openNow : s.hours.closedNow}
      </Txt>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    alignItems: 'center',
    gap: space.xs + space.xxs,
  },
  dot: {
    width: space.md - space.xxs,
    height: space.md - space.xxs,
    borderRadius: radius.pill,
    borderWidth: size.lineMid,
  },
  dotOpen: {
    backgroundColor: c.text,
    borderColor: c.text,
  },
  dotClosed: {
    borderColor: c.textSubtle,
  },
}));
