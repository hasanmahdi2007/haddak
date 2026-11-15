import { Award, Check } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { fonts, makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

/** How far the large seal is turned, like a stamp pressed by hand. */
const SEAL_TILT = '-8deg';

/**
 * The verified seal: Haddak's trust mark, always teal.
 * Small, it is a teal disc inside a teal ring, with a white check.
 * Large, it is a white disc with two teal rings and the word "موثّق" (verified)
 * in ruqaa, the script of Lebanese stamps, whatever the app language.
 */
export function Seal({ large = false }: { large?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();

  if (!large) {
    return (
      <View style={styles.sealSmall}>
        <View style={styles.sealSmallCore}>
          <Check color={colors.onPrimary} size={size.sealCheck} strokeWidth={size.strokeHeavy} />
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
        <Check color={colors.primary} size={size.iconSmall} strokeWidth={size.strokeBold} />
      </View>
    </View>
  );
}

/**
 * Small seal plus the word "Verified": the form used on cards and on the profile.
 * `decorative` hides it from screen readers when a parent already says "Verified".
 */
export function VerifiedBadge({ decorative = false }: { decorative?: boolean }) {
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View
      style={[styles.inline, { flexDirection: row }]}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : s.badges.verified}
    >
      <Seal />
      <Txt role="label" color="primary">
        {s.badges.verified}
      </Txt>
    </View>
  );
}

/** Founding member: a green tag with a medal. */
export function FoundingBadge() {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.tag, styles.founding, { flexDirection: row }]} accessible accessibilityLabel={s.badges.founding}>
      <Award color={colors.onSuccessSoft} size={size.star} strokeWidth={size.stroke} />
      <Txt role="caption" color="onSuccessSoft" style={styles.tagText}>
        {s.badges.founding}
      </Txt>
    </View>
  );
}

/**
 * Featured means paid placement, and the screen-reader label says so.
 * It is a plain amber tag with no star or medal, so it is not read as a quality award.
 */
export function FeaturedTag() {
  const { s } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.tag, styles.featured]} accessible accessibilityLabel={s.badges.featuredLabel}>
      <Txt role="caption" color="onRatingSoft" style={styles.tagText}>
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
    borderColor: c.primary,
    padding: size.lineMid,
  },
  sealSmallCore: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealLarge: {
    width: size.sealLarge,
    height: size.sealLarge,
    borderRadius: radius.pill,
    borderWidth: size.lineBold,
    borderColor: c.primary,
    backgroundColor: c.surface,
    padding: size.sealGap,
    transform: [{ rotate: SEAL_TILT }],
  },
  sealRing: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealWord: {
    fontFamily: fonts.seal,
    fontSize: size.sealWord,
    lineHeight: size.sealWordLine,
    color: c.primary,
    textAlign: 'center',
    marginTop: -space.xs,
  },
  inline: {
    alignItems: 'center',
    gap: space.xs + space.xxs,
  },
  tag: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.sm,
  },
  founding: {
    backgroundColor: c.successSoft,
  },
  featured: {
    backgroundColor: c.ratingSoft,
  },
  tagText: {
    fontFamily: fonts.bodyMedium,
  },
}));
