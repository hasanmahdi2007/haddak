import { Award, Badge, BadgeCheck, Handshake, Tag, Users, Zap } from 'lucide-react-native';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

/**
 * Verified: Haddak's trust mark. A small solid black pill with a white check badge and
 * white words. `decorative` hides it from screen readers when a parent
 * already says "Verified".
 */
export function VerifiedBadge({ decorative = false }: { decorative?: boolean }) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View
      style={[styles.pill, styles.verified, { flexDirection: row }]}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : s.badges.verified}
    >
      <BadgeCheck color={colors.onTrust} size={size.iconSmall} strokeWidth={size.lineBold} />
      <Txt role="badge" color="onTrust">
        {s.badges.verified}
      </Txt>
    </View>
  );
}

/**
 * "Available now": the owner said they can take a job right away (it turns
 * itself off after 2, 4 or 8 hours). A vanilla pill (the signature highlight, one
 * of Haddak's special moments) with a lightning icon, so it never reads as the
 * black Verified mark.
 */
export function AvailableTag({ decorative = false }: { decorative?: boolean }) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View
      style={[styles.pill, styles.signature, { flexDirection: row }]}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : s.badges.availableNow}
    >
      <Zap color={colors.onSignature} size={size.iconSmall} strokeWidth={size.lineBold} fill={colors.onSignature} />
      <Txt role="badge" color="onSignature">
        {s.badges.availableNow}
      </Txt>
    </View>
  );
}

/**
 * "Hired through Haddak" on a review: the author told Haddak they hired this
 * provider. Alice blue (the positive colour) with a handshake and no check, so it is
 * not mistaken for the black Verified mark.
 */
export function HiredBadge() {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.pill, styles.hired, { flexDirection: row }]} accessible accessibilityLabel={s.hire.mark}>
      <Handshake color={colors.primary} size={size.iconSmall} strokeWidth={size.stroke} />
      <Txt role="badge" color="onPrimarySoft">
        {s.hire.mark}
      </Txt>
    </View>
  );
}

/**
 * Not verified: the same pill shape as an outlined grey pill, with the badge outline and no check.
 * It is deliberately not a warning colour: it states a fact, it does not accuse anyone.
 */
export function NotVerifiedBadge({ decorative = false }: { decorative?: boolean }) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View
      style={[styles.pill, styles.notVerified, { flexDirection: row }]}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : s.badges.notVerified}
    >
      <Badge color={colors.textMuted} size={size.iconSmall} strokeWidth={size.lineBold} />
      <Txt role="badge" color="textMuted">
        {s.badges.notVerified}
      </Txt>
    </View>
  );
}

/** "Listed by the community": nobody owns this listing yet; it came from a suggestion. */
export function CommunityLabel() {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.community, { flexDirection: row }]}>
      <Users color={colors.textMuted} size={size.star} strokeWidth={size.stroke} />
      <Txt role="caption" color="textMuted" numberOfLines={1}>
        {s.badges.community}
      </Txt>
    </View>
  );
}

/**
 * Founding member: a medal and the words, with no pill around them. Quiet on purpose,
 * so it never competes with Verified (one fewer box on a busy card).
 */
export function FoundingBadge() {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.founding, { flexDirection: row }]} accessible accessibilityLabel={s.badges.founding}>
      <Award color={colors.textMuted} size={size.iconSmall} strokeWidth={size.stroke} />
      <Txt role="badge" color="textMuted">
        {s.badges.founding}
      </Txt>
    </View>
  );
}

/**
 * Featured means paid placement, and the screen-reader label says so.
 * A plain alice-blue pill with no star or medal, so it is not read as a quality award.
 */
export function FeaturedTag() {
  const { s } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.pill, styles.featured]} accessible accessibilityLabel={s.badges.featuredLabel}>
      <Txt role="badge" color="onAccent">
        {s.badges.featured}
      </Txt>
    </View>
  );
}

/**
 * Sponsored means the provider paid to appear first, and the label says so.
 * A vanilla pill (the signature highlight) with dark words; it reads on the
 * alice-blue sponsored card and on the page alike.
 */
export function SponsoredTag({ decorative = false }: { decorative?: boolean }) {
  const { s } = useI18n();
  const styles = useStyles();
  return (
    <View
      style={[styles.pill, styles.sponsored]}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : s.results.sponsoredLabel}
    >
      <Txt role="badge" color="onSignature">
        {s.results.sponsored}
      </Txt>
    </View>
  );
}

/**
 * A provider's running offer, on a result card: a vanilla pill (offers are a
 * signature moment) with a tag icon and the offer's title in dark words.
 */
export function OfferTag({ title }: { title: string }) {
  const { colors } = useTheme();
  const { row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.pill, styles.offer, { flexDirection: row }]}>
      <Tag color={colors.onSignature} size={size.star} strokeWidth={size.lineBold} />
      <Txt role="badge" color="onSignature" numberOfLines={1} style={styles.offerText} content>
        {title}
      </Txt>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pill: {
    minHeight: size.badge,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
  },
  verified: {
    backgroundColor: c.trust,
  },
  // Outlined: a light grey edge, no fill. The words carry the meaning.
  notVerified: {
    borderWidth: size.hairline,
    borderColor: c.border,
  },
  hired: {
    alignSelf: 'flex-start',
    backgroundColor: c.primarySoft,
  },
  founding: {
    minHeight: size.badge,
    alignItems: 'center',
    gap: space.xs,
  },
  featured: {
    backgroundColor: c.accent,
    paddingHorizontal: space.md,
  },
  // The signature fills: Sponsored, Available now and offers. Dark words on vanilla (13:1).
  signature: {
    backgroundColor: c.signature,
  },
  sponsored: {
    backgroundColor: c.signature,
    paddingHorizontal: space.md,
  },
  offer: {
    backgroundColor: c.signature,
    paddingHorizontal: space.md,
    maxWidth: '100%',
  },
  offerText: {
    flexShrink: 1,
  },
  community: {
    alignItems: 'center',
    gap: space.xs,
  },
}));
