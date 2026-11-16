import { Award, Badge, BadgeCheck, Tag, Users } from 'lucide-react-native';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { fonts, makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

/**
 * Verified: Haddak's trust mark. A solid mint pill with a check badge and the word,
 * always with dark text. `decorative` hides it from screen readers when a parent
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
      <BadgeCheck color={colors.onMint} size={size.iconSmall} strokeWidth={size.lineBold} />
      <Txt role="caption" color="onMint" style={styles.pillText}>
        {s.badges.verified}
      </Txt>
    </View>
  );
}

/**
 * Not verified: the same pill shape in neutral grey, with the badge outline and no check.
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
      <Badge color={colors.text} size={size.iconSmall} strokeWidth={size.lineBold} />
      <Txt role="caption" color="text" style={styles.pillText}>
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

/** Founding member: an outlined pill with a medal. Quiet, so it never competes with Verified. */
export function FoundingBadge() {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.pill, styles.founding, { flexDirection: row }]} accessible accessibilityLabel={s.badges.founding}>
      <Award color={colors.text} size={size.star} strokeWidth={size.stroke} />
      <Txt role="caption" color="text" style={styles.pillText}>
        {s.badges.founding}
      </Txt>
    </View>
  );
}

/**
 * Featured means paid placement, and the screen-reader label says so.
 * A plain lavender pill with no star or medal, so it is not read as a quality award.
 */
export function FeaturedTag() {
  const { s } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.pill, styles.featured]} accessible accessibilityLabel={s.badges.featuredLabel}>
      <Txt role="caption" color="onAccent" style={styles.pillText}>
        {s.badges.featured}
      </Txt>
    </View>
  );
}

/**
 * Sponsored means the provider paid to appear first, and the label says so.
 * An ink pill with lavender text, made to sit on the lavender sponsored card;
 * on a profile it is the same pill on the page.
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
      <Txt role="caption" color="accent" style={styles.pillText}>
        {s.results.sponsored}
      </Txt>
    </View>
  );
}

/**
 * A provider's running offer, on a result card: an ink pill with a tag icon and
 * the offer's title. Ink, so it is not mistaken for the mint Verified mark or
 * the lavender paid labels.
 */
export function OfferTag({ title }: { title: string }) {
  const { colors } = useTheme();
  const { row } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.pill, styles.offer, { flexDirection: row }]}>
      <Tag color={colors.onPrimary} size={size.star} strokeWidth={size.lineBold} />
      <Txt role="caption" color="onPrimary" numberOfLines={1} style={[styles.pillText, styles.offerText]} content>
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
  pillText: {
    fontFamily: fonts.bodyMedium,
  },
  verified: {
    backgroundColor: c.mint,
  },
  notVerified: {
    backgroundColor: c.surfaceTintStrong,
  },
  founding: {
    borderWidth: size.lineMid,
    borderColor: c.outline,
  },
  featured: {
    backgroundColor: c.accent,
    paddingHorizontal: space.md,
  },
  // Always ink with lavender text, in the dark theme too (it sits on lavender).
  sponsored: {
    backgroundColor: c.onAccent,
    paddingHorizontal: space.md,
  },
  offer: {
    backgroundColor: c.primary,
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
