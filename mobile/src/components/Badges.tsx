import { Award, Check } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { fonts, makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

/** How far the seal is turned, like a stamp pressed by hand. */
const SEAL_TILT = '-9deg';

/**
 * The verified seal: Haddak's signature. A round double-ring ink stamp.
 * Small, it carries a check mark; large, it carries the word "موثّق" (verified)
 * in ruqaa, the script of Lebanese stamps, whatever the app language.
 */
export function Seal({ large = false }: { large?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();

  if (!large) {
    return (
      <View style={styles.sealSmall}>
        <View style={styles.sealSmallCore}>
          <Check color={colors.onInk} size={size.sealCheck} strokeWidth={size.strokeHeavy} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sealLarge}>
      <View style={styles.sealRing}>
        {/* Decorative lettering: fixed size so it always fits the ring. */}
        <Text allowFontScaling={false} style={styles.sealWord}>
          موثّق
        </Text>
        <Check color={colors.ink} size={size.iconSmall} strokeWidth={size.strokeBold} />
      </View>
    </View>
  );
}

/** Seal plus the word "Verified": the inline form used beside a name or in a badge row. */
export function VerifiedBadge() {
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.inline, { flexDirection: row }]} accessible accessibilityLabel={s.badges.verified}>
      <Seal />
      <Txt role="label" color="ink">
        {s.badges.verified}
      </Txt>
    </View>
  );
}

/** Founding member: a small fiscal stamp with a perforated edge. */
export function FoundingStamp() {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.stamp, { flexDirection: row }]} accessible accessibilityLabel={s.badges.founding}>
      <Award color={colors.onCedarWash} size={size.iconSmall} strokeWidth={size.stroke} />
      <Txt role="caption" color="onCedarWash" style={styles.tagText}>
        {s.badges.founding}
      </Txt>
    </View>
  );
}

/** Featured means paid placement, and the screen-reader label says so. */
export function FeaturedTag() {
  const { s } = useI18n();
  const styles = useStyles();
  return (
    <View style={styles.featured} accessible accessibilityLabel={s.badges.featuredLabel}>
      <Txt role="caption" color="onSaffronWash" style={styles.tagText}>
        {s.badges.featured}
      </Txt>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  sealSmall: {
    width: size.sealSmall,
    height: size.sealSmall,
    borderRadius: radius.pill,
    borderWidth: size.lineMid,
    borderColor: c.ink,
    padding: size.lineMid,
    transform: [{ rotate: SEAL_TILT }],
  },
  sealSmallCore: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: c.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealLarge: {
    width: size.sealLarge,
    height: size.sealLarge,
    borderRadius: radius.pill,
    borderWidth: size.lineBold,
    borderColor: c.ink,
    backgroundColor: c.sheet,
    padding: size.sealGap,
    transform: [{ rotate: SEAL_TILT }],
  },
  sealRing: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: c.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealWord: {
    fontFamily: fonts.seal,
    fontSize: size.sealWord,
    lineHeight: size.sealWordLine,
    color: c.ink,
    textAlign: 'center',
    marginTop: -space.xs,
  },
  inline: {
    alignItems: 'center',
    gap: space.xs + space.xxs,
  },
  stamp: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.sm,
    borderWidth: size.hairline,
    borderStyle: 'dashed',
    borderColor: c.cedar,
    backgroundColor: c.cedarWash,
  },
  featured: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.sm,
    backgroundColor: c.saffronWash,
  },
  tagText: {
    fontFamily: fonts.bodyMedium,
  },
}));
