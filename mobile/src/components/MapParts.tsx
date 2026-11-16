import { Check, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Coordinates, ProviderSummary } from '@/api';
import { useI18n } from '@/i18n';
import type { RadiusM } from '@/lib/radius';
import { fonts, makeStyles, radius, size, space, useTheme } from '@/theme';

import { FeaturedTag, NotVerifiedBadge, VerifiedBadge } from './Badges';
import { OpenStatus } from './OpenStatus';
import { Photo } from './Photo';
import { Rating } from './Rating';
import { Txt } from './Txt';

/**
 * The pieces the map view shares between the phone (ResultsMap.tsx, a real map)
 * and the web build (ResultsMap.web.tsx, a plain preview): the props, the area
 * to show for a radius, the pin, the "search position" dot and the docked card.
 */

export interface ResultsMapProps {
  /** The search position. */
  center: Coordinates;
  radiusM: RadiusM;
  /** The same providers the list shows. Empty while a search is running. */
  providers: ProviderSummary[];
  loading: boolean;
  onOpenProvider: (provider: ProviderSummary) => void;
}

/** "City" has no circle: it is a whole-city search, not a distance. */
export const CITY_RADIUS: RadiusM = 20000;

const METRES_PER_DEGREE = 111_320;
/** Air around the circle, so it does not touch the screen edges. */
const FIT_PADDING = 1.3;

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * The area to show so the whole search circle fits: its diameter plus some air,
 * in degrees. One degree of longitude is shorter than one of latitude away from
 * the equator, hence the cosine. The same span is used for "City" (20 km), so
 * every result is on screen.
 */
export function regionFor(center: Coordinates, radiusM: RadiusM): MapRegion {
  const spanM = radiusM * 2 * FIT_PADDING;
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: spanM / METRES_PER_DEGREE,
    longitudeDelta: spanM / (METRES_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180)),
  };
}

/** How many metres one degree of longitude is at this latitude (used by the web preview). */
export function metresPerDegree(lat: number): { lat: number; lng: number } {
  return { lat: METRES_PER_DEGREE, lng: METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180) };
}

/** What a screen reader says for a pin. */
export function usePinLabel() {
  const { s, categoryName } = useI18n();
  return (provider: ProviderSummary, selected: boolean) =>
    [
      provider.name,
      categoryName(provider.category),
      provider.verified ? s.badges.verified : s.badges.notVerified,
      provider.featured ? s.badges.featuredLabel : null,
      selected ? s.results.mapSelected : null,
    ]
      .filter(Boolean)
      .join(', ');
}

/** A name as a pin shows it: cut to about 18 characters, with an ellipsis. */
export function pinName(name: string): string {
  const clean = name.trim();
  return clean.length > size.mapPinChars ? `${clean.slice(0, size.mapPinChars - 1).trimEnd()}…` : clean;
}

interface PinProps {
  name: string;
  verified: boolean;
  featured: boolean;
  selected: boolean;
}

/**
 * A provider pin: a small pill that carries the provider's name, with a pointer
 * under it whose tip marks the position. The name can be read without tapping.
 *
 * - Verified: white pill, ink edge, a mint disc with a check before the name.
 * - Not verified: grey pill, grey edge, an empty grey ring and a muted name.
 * - Featured (paid): the pill is lavender.
 * - Selected: the pill fills ink and grows a little.
 *
 * It sits in a box at least 48 dp high so it is easy to tap; the tip is at the
 * bottom centre of that box. Drawn with plain views and one line of text only,
 * because a map marker is turned into a picture and those are the most reliable
 * things to turn into one.
 */
export function ProviderPin({ name, verified, featured, selected }: PinProps) {
  const { colors } = useTheme();
  const { row } = useI18n();
  const styles = useStyles();
  const disc = selected ? size.mapPinDiscSelected : size.mapPinDisc;

  const look = selected
    ? { bg: colors.primary, edge: colors.primary, text: 'onPrimary' as const }
    : featured
      ? { bg: colors.accent, edge: colors.onAccent, text: 'onAccent' as const }
      : verified
        ? { bg: colors.surface, edge: colors.primary, text: 'text' as const }
        : { bg: colors.surfaceTint, edge: colors.outline, text: 'textMuted' as const };

  return (
    // `collapsable={false}` keeps this view real on Android, so the map can measure and draw it.
    <View style={styles.pinBox} collapsable={false}>
      <View style={[styles.pinTip, { backgroundColor: look.edge }]} />
      <View
        style={[
          styles.pinLabel,
          { flexDirection: row, backgroundColor: look.bg, borderColor: look.edge },
          selected ? styles.pinLabelSelected : null,
        ]}
      >
        <View
          style={[
            styles.pinDisc,
            { width: disc, height: disc },
            verified ? styles.pinDiscVerified : styles.pinDiscPlain,
          ]}
        >
          {verified ? (
            <Check color={colors.onMint} size={disc - space.sm} strokeWidth={size.strokeHeavy} />
          ) : null}
        </View>
        <Txt
          role={selected ? 'label' : 'caption'}
          color={look.text}
          numberOfLines={1}
          // A pin is a picture of fixed size: very large system text must not push the name out of it.
          maxFontSizeMultiplier={1.2}
          style={styles.pinName}
          content
        >
          {pinName(name)}
        </Txt>
      </View>
    </View>
  );
}

/** The search position: a lavender point with an ink ring. */
export function HereDot() {
  const styles = useStyles();
  return <View style={styles.here} />;
}

interface DockProps {
  provider: ProviderSummary;
  onPress: () => void;
}

/**
 * The selected provider, docked at the bottom of the map: a short ProviderCard
 * that floats (the only shadow in the app). Photo, name, "category · area", then
 * the verified mark, rating, distance and open status on one line.
 * The whole card is one button that opens the profile.
 */
export function MapProviderCard({ provider, onPress }: DockProps) {
  const { colors } = useTheme();
  const { s, f, row, plural, categoryName, distance } = useI18n();
  const styles = useStyles();
  const place = `${categoryName(provider.category)} · ${provider.area_name}`;

  const spoken = [
    provider.name,
    place,
    provider.verified ? s.badges.verified : s.badges.notVerified,
    provider.featured ? s.badges.featuredLabel : null,
    provider.open_now === null ? null : provider.open_now ? s.hours.openNow : s.hours.closedNow,
    plural(s.rating.label, provider.review_count, { rating: provider.avg_rating.toFixed(1) }),
    provider.distance_m !== null ? f(s.provider.away, { distance: distance(provider.distance_m) }) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      testID="map-dock"
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={s.results.openProfile}
      accessibilityLiveRegion="polite"
      onPress={onPress}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={({ pressed }) => [styles.dock, { flexDirection: row }, pressed ? styles.dockPressed : null]}
    >
      <Photo uri={provider.cover_photo_url} fallbackIcon={provider.category.icon} style={styles.dockThumb} />
      <View style={styles.dockMain}>
        <Txt role="title" numberOfLines={1} content>
          {provider.name}
        </Txt>
        <Txt role="label" color="textMuted" numberOfLines={1}>
          {place}
        </Txt>
        <View style={[styles.dockFacts, { flexDirection: row }]}>
          {provider.verified ? <VerifiedBadge decorative /> : <NotVerifiedBadge decorative />}
          {provider.featured ? <FeaturedTag /> : null}
          <Rating rating={provider.avg_rating} count={provider.review_count} />
          {provider.distance_m !== null ? (
            <View style={[styles.dockFact, { flexDirection: row }]}>
              <MapPin color={colors.textSubtle} size={size.iconSmall} strokeWidth={size.stroke} />
              <Txt role="data" numberOfLines={1}>
                {distance(provider.distance_m)}
              </Txt>
            </View>
          ) : null}
          <OpenStatus open={provider.open_now} />
        </View>
      </View>
    </Pressable>
  );
}

// The pointer is a small square turned 45 degrees, half hidden behind the pill.
// Turned, it is wider than its own box by this much on each side.
const TIP_OVERHANG = (size.mapPinTip * (Math.SQRT2 - 1)) / 2;

const useStyles = makeStyles((c) => ({
  pinBox: {
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: space.xxs,
    // Room for the pointer: its lowest corner touches the bottom edge of the box.
    paddingBottom: size.mapPinTip / 2 + TIP_OVERHANG,
  },
  pinTip: {
    position: 'absolute',
    bottom: TIP_OVERHANG,
    width: size.mapPinTip,
    height: size.mapPinTip,
    borderRadius: space.xxs,
    transform: [{ rotate: '45deg' }],
  },
  pinLabel: {
    alignItems: 'center',
    gap: space.xs,
    borderWidth: size.lineMid,
    borderRadius: radius.pill,
    paddingVertical: space.xxs + 1,
    paddingStart: space.xxs + 1,
    paddingEnd: space.sm,
  },
  pinLabelSelected: {
    borderWidth: size.lineBold,
    paddingVertical: space.xs,
    paddingStart: space.xs,
    paddingEnd: space.md,
  },
  pinDisc: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDiscVerified: {
    backgroundColor: c.mint,
  },
  pinDiscPlain: {
    borderWidth: size.lineBold,
    borderColor: c.outline,
  },
  pinName: {
    fontFamily: fonts.bodyStrong,
  },
  here: {
    width: size.mapHere,
    height: size.mapHere,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    borderWidth: size.strokeHeavy,
    borderColor: c.onAccent,
  },
  dock: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
    alignItems: 'center',
    boxShadow: `0px 8px 24px ${c.shadow}`,
  },
  dockPressed: {
    backgroundColor: c.surfaceTint,
  },
  dockThumb: {
    width: size.dockThumb,
    height: size.dockThumb,
    borderRadius: radius.md,
  },
  dockMain: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
  dockFacts: {
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.sm,
    rowGap: space.xs,
    marginTop: space.xxs,
  },
  dockFact: {
    alignItems: 'center',
    gap: space.xs,
  },
}));
