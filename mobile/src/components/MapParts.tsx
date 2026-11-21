import { Check, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Coordinates, ProviderSummary } from '@/api';
import { useI18n } from '@/i18n';
import type { RadiusM } from '@/lib/radius';
import { elevation, makeStyles, radius, size, space, useTheme } from '@/theme';

import { FeaturedTag, NotVerifiedBadge, VerifiedBadge } from './Badges';
import { OpenStatus } from './OpenStatus';
import { Photo } from './Photo';
import { Rating } from './Rating';
import { Txt } from './Txt';

/**
 * The pieces the map view shares between the phone (ResultsMap.tsx, a real map)
 * and the web build (ResultsMap.web.tsx, a plain preview): the props, the area
 * to show for a radius, which pins have room for their name, the pin in its two
 * forms (name pill and dot), the "search position" dot and the docked card.
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

/** How many metres one degree of latitude and of longitude are at this latitude. */
export function metresPerDegree(lat: number): { lat: number; lng: number } {
  return { lat: METRES_PER_DEGREE, lng: METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180) };
}

/**
 * The area the map really shows when asked for `region` in a view of this size.
 * A map keeps one scale in both directions, so it shows the asked region plus
 * whatever extra the longer side of the view has room for.
 */
export function fitRegion(region: MapRegion, width: number, height: number): MapRegion {
  const metres = metresPerDegree(region.latitude);
  const pxPerMetre = Math.min(
    width / (region.longitudeDelta * metres.lng),
    height / (region.latitudeDelta * metres.lat),
  );
  return {
    ...region,
    longitudeDelta: width / (pxPerMetre * metres.lng),
    latitudeDelta: height / (pxPerMetre * metres.lat),
  };
}

/**
 * Where a position lands on screen, in dp from the top left of the map, when
 * the map shows exactly `shown`. Straight-line maths: at city scale the real
 * map projection differs from this by less than a pixel.
 */
export function screenPoint(
  lat: number,
  lng: number,
  shown: MapRegion,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: width / 2 + ((lng - shown.longitude) / shown.longitudeDelta) * width,
    y: height / 2 - ((lat - shown.latitude) / shown.latitudeDelta) * height,
  };
}

/** A pin is drawn either as a pill with the name, or as the round mark alone. */
export type PinForm = 'pill' | 'dot';

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Rough drawn sizes in dp, used only to decide which names fit. They lean
// large on purpose: a name hidden too early is better than two names overlapping.
const CHAR_W = 6.8; // one caption letter, on average
const CHAR_W_SELECTED = 7.6; // one label letter
const PILL_EXTRA = 44; // disc, gap, padding and edges around the name
const PILL_EXTRA_SELECTED = 56;
const PILL_H = 38; // pill plus the pointer under it
const PILL_H_SELECTED = 44;
/** Air kept between two names. */
const PILL_GAP = space.xs;

/**
 * Decides which pins have room to show their name.
 *
 * Pins are taken in order of importance: the selected one, then sponsored and
 * featured, then verified, then the rest, each group in the order the search
 * ranked them. A pin gets its name pill only if that pill would cover neither
 * a name nor a dot placed before it; otherwise it becomes a dot. Names are
 * drawn over dots (see pinZIndex), so a name is always readable; a less
 * important dot can end up partly or fully under a name until the user zooms
 * in. Zooming in spreads the pins apart, so more names fit; tapping a dot
 * selects it, which always shows its name.
 *
 * Returns the form of every pin, by provider id.
 */
export function layoutPins(
  providers: ProviderSummary[],
  selectedId: string | null,
  shown: MapRegion,
  width: number,
  height: number,
  fontScale = 1,
): Map<string, PinForm> {
  const forms = new Map<string, PinForm>();
  if (width <= 0 || height <= 0) return forms;

  const weight = (provider: ProviderSummary) =>
    provider.id === selectedId ? 0 : provider.sponsored || provider.featured ? 1 : provider.verified ? 2 : 3;
  // Array.sort is stable, so inside one group the search order (the rank) is kept.
  const ordered = [...providers].sort((a, b) => weight(a) - weight(b));
  // Pins stop growing with the system font size at 1.2 (see ProviderPin).
  const scale = Math.min(Math.max(fontScale, 1), 1.2);
  const half = size.mapDot / 2;
  // The room taken so far, by names and by dots.
  const placed: Box[] = [];

  for (const provider of ordered) {
    const isSelected = provider.id === selectedId;
    const { x, y } = screenPoint(provider.lat, provider.lng, shown, width, height);
    const letters = pinName(provider.name).length;
    const w =
      (isSelected ? letters * CHAR_W_SELECTED : letters * CHAR_W) * scale +
      (isSelected ? PILL_EXTRA_SELECTED : PILL_EXTRA);
    const h = isSelected ? PILL_H_SELECTED : PILL_H;
    // The pointer's tip is on the position, so the pill sits above it, centred.
    const pill: Box = {
      left: x - w / 2 - PILL_GAP,
      right: x + w / 2 + PILL_GAP,
      top: y - h - PILL_GAP,
      bottom: y,
    };
    // The selected pin always shows its name, whatever is under it.
    if (isSelected || !placed.some((other) => overlaps(pill, other))) {
      forms.set(provider.id, 'pill');
      placed.push(pill);
    } else {
      forms.set(provider.id, 'dot');
      placed.push({ left: x - half, right: x + half, top: y - half, bottom: y + half });
    }
  }
  return forms;
}

/**
 * Which pin is drawn over which. The selected pin is on top. Then names:
 * featured over verified over the rest. Dots are at the bottom, so a dot can
 * never cut through a name.
 */
export function pinZIndex(provider: ProviderSummary, form: PinForm, selected: boolean): number {
  if (selected) return 5;
  if (form === 'dot') return 1;
  return provider.sponsored || provider.featured ? 4 : provider.verified ? 3 : 2;
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
  /** Paid to appear first: the round mark gets the vanilla signature. */
  sponsored?: boolean;
}

/**
 * A provider pin: a small pill that carries the provider's name, with a pointer
 * under it whose tip marks the position. The name can be read without tapping.
 *
 * - Verified: white pill, ink edge, a black disc with a white check before the name.
 * - Not verified: grey pill, grey edge, an empty grey ring and a muted name.
 * - Featured (paid): the pill is alice-blue.
 * - Sponsored (paid): the round mark is vanilla (a vanilla ring around the
 *   black disc when the provider is also verified, so trust still reads first).
 * - Selected: the pill fills ink and grows a little.
 *
 * It sits in a box at least 48 dp high so it is easy to tap; the tip is at the
 * bottom centre of that box. Drawn with plain views and one line of text only,
 * because a map marker is turned into a picture and those are the most reliable
 * things to turn into one.
 */
export function ProviderPin({ name, verified, featured, selected, sponsored = false }: PinProps) {
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
            sponsored ? (verified ? styles.discSponsoredRing : styles.discSponsored) : null,
          ]}
        >
          {verified ? (
            <Check color={colors.onTrust} size={disc - space.sm} strokeWidth={size.strokeHeavy} />
          ) : null}
        </View>
        <Txt
          role={selected ? 'label' : 'badge'}
          color={look.text}
          numberOfLines={1}
          // A pin is a picture of fixed size: very large system text must not push the name out of it.
          maxFontSizeMultiplier={1.2}
          content
        >
          {pinName(name)}
        </Txt>
      </View>
    </View>
  );
}

/**
 * A pin that has no room for its name: the round mark alone, centred on the
 * position. Verified: a black disc with a white check and a white edge. Not verified:
 * a grey disc with a grey ring. Featured (paid): the disc is alice-blue. Sponsored
 * (paid): the disc is vanilla, or the black disc gets a vanilla ring when verified.
 * Tapping it selects the provider, which shows the name.
 */
export function ProviderDot({ verified, featured, sponsored = false }: Pick<PinProps, 'verified' | 'featured' | 'sponsored'>) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.dotBox} collapsable={false}>
      <View
        style={[
          styles.dot,
          featured ? styles.dotFeatured : verified ? styles.dotVerified : styles.dotPlain,
          sponsored ? (verified ? styles.discSponsoredRing : styles.discSponsored) : null,
        ]}
      >
        {verified ? (
          <Check color={colors.onTrust} size={size.mapDot - space.sm - space.xxs} strokeWidth={size.strokeHeavy} />
        ) : null}
      </View>
    </View>
  );
}

/** The search position: a alice-blue point with an ink ring. */
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
    backgroundColor: c.trust,
  },
  pinDiscPlain: {
    borderWidth: size.lineBold,
    borderColor: c.outline,
  },
  // Sponsored marks: a vanilla disc with a dark edge, or a vanilla ring around the black check.
  discSponsored: {
    backgroundColor: c.signature,
    borderWidth: size.lineMid,
    borderColor: c.onSignature,
  },
  // Olive, the deeper vanilla: plain vanilla would vanish against the white pill.
  discSponsoredRing: {
    borderWidth: size.lineBold,
    borderColor: c.signatureStrong,
  },
  // A clear box a little larger than the mark, so a finger finds it.
  dotBox: {
    width: size.mapDotBox,
    height: size.mapDotBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: size.mapDot,
    height: size.mapDot,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: size.lineMid,
  },
  dotVerified: {
    backgroundColor: c.trust,
    borderColor: c.onTrust,
  },
  dotFeatured: {
    backgroundColor: c.accent,
    borderColor: c.onAccent,
  },
  dotPlain: {
    backgroundColor: c.surfaceTint,
    borderWidth: size.lineBold,
    borderColor: c.outline,
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
    boxShadow: elevation.float,
  },
  dockPressed: {
    backgroundColor: c.surfaceInset,
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
