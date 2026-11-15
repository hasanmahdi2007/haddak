import { MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Coordinates, ProviderSummary } from '@/api';
import { useI18n } from '@/i18n';
import type { RadiusM } from '@/lib/radius';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { FeaturedTag, VerifiedBadge } from './Badges';
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
      provider.featured ? s.badges.featuredLabel : null,
      selected ? s.results.mapSelected : null,
    ]
      .filter(Boolean)
      .join(', ');
}

// A square with three round corners, turned 45 degrees, is a teardrop whose tip
// points down. The tip then reaches below the square's own box by this share of its side.
const TIP_OVERHANG = (Math.SQRT2 - 1) / 2;

/**
 * A provider pin: a teal teardrop with a dot in it, drawn in a 48 dp box so the
 * touch target is large enough. The tip is at the bottom centre of the box.
 * Featured (paid): amber edge and a ring instead of a dot. Selected: larger.
 * Drawn with plain views only, because a map marker is turned into a picture
 * and plain views are the most reliable thing to turn into one.
 */
export function ProviderPin({ featured, selected }: { featured: boolean; selected: boolean }) {
  const styles = useStyles();
  const side = selected ? size.mapPinSelected : size.mapPin;
  // Three round corners, set one by one: a single `borderRadius` would also round the tip.
  const round = side / 2;
  return (
    <View style={styles.pinBox}>
      <View
        style={[
          styles.pin,
          {
            width: side,
            height: side,
            borderTopLeftRadius: round,
            borderTopRightRadius: round,
            borderBottomLeftRadius: round,
            marginBottom: side * TIP_OVERHANG,
          },
          featured ? styles.pinFeatured : null,
          selected ? styles.pinSelected : null,
        ]}
      >
        <View style={featured ? styles.pinRing : styles.pinDot} />
      </View>
    </View>
  );
}

/** The search position: the coral "you are here" point. */
export function HereDot() {
  const styles = useStyles();
  return <View style={styles.here} />;
}

interface DockProps {
  provider: ProviderSummary;
  onPress: () => void;
}

/**
 * The selected provider, docked at the bottom of the map: a short ProviderCard.
 * Photo, name, "category · area", then verified, rating and distance on one line.
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
    provider.verified ? s.badges.verified : null,
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
      style={({ pressed }) => [
        styles.dock,
        { flexDirection: row },
        provider.featured ? styles.dockFeatured : null,
        pressed ? styles.dockPressed : null,
      ]}
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
          {provider.verified ? <VerifiedBadge decorative /> : null}
          {provider.featured ? <FeaturedTag /> : null}
          <Rating rating={provider.avg_rating} count={provider.review_count} />
          {provider.distance_m !== null ? (
            <View style={[styles.dockFact, { flexDirection: row }]}>
              <MapPin color={colors.primary} size={size.iconSmall} strokeWidth={size.stroke} />
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

const useStyles = makeStyles((c) => ({
  pinBox: {
    width: size.touch,
    height: size.touch,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pin: {
    // The bottom-right corner stays sharp; turned 45 degrees it becomes the tip.
    borderBottomRightRadius: space.xxs,
    transform: [{ rotate: '45deg' }],
    backgroundColor: c.primary,
    borderWidth: size.lineBold,
    borderColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinFeatured: {
    borderColor: c.rating,
  },
  pinSelected: {
    backgroundColor: c.primaryPressed,
    borderWidth: size.strokeHeavy,
  },
  pinDot: {
    width: size.mapPinDot,
    height: size.mapPinDot,
    borderRadius: radius.pill,
    backgroundColor: c.onPrimary,
  },
  pinRing: {
    width: size.mapPinDot,
    height: size.mapPinDot,
    borderRadius: radius.pill,
    borderWidth: size.strokeBold,
    borderColor: c.onPrimary,
  },
  here: {
    width: size.mapHere,
    height: size.mapHere,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    borderWidth: size.strokeHeavy,
    borderColor: c.surface,
  },
  dock: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: size.lineMid,
    borderColor: c.surfaceTintStrong,
    padding: space.md,
    gap: space.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  dockFeatured: {
    borderColor: c.primary,
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
    columnGap: space.md,
    rowGap: space.xs,
    marginTop: space.xxs,
  },
  dockFact: {
    alignItems: 'center',
    gap: space.xs,
  },
}));
