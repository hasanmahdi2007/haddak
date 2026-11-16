import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { makeStyles, motion, size, space, useTheme } from '@/theme';

import {
  CITY_RADIUS,
  HereDot,
  MapProviderCard,
  ProviderPin,
  regionFor,
  usePinLabel,
  type ResultsMapProps,
} from './MapParts';

/** How long pins keep redrawing after they change, before they are frozen again. */
const PIN_SETTLE_MS = 700;

/**
 * The results on a real map (Android and iOS; the web build uses ResultsMap.web.tsx).
 * In Expo Go this needs no API key. A store build will need a Google Maps key.
 *
 * Height: the wrapper takes all the room under the header (`flex: 1`, with a
 * floor so it can never be a sliver) and the native map is pinned to its four
 * edges. A native view sized by `flex` alone can be measured as zero on Android
 * when its parent's height arrives late; pinned edges cannot.
 */
export function ResultsMap({ center, radiusM, providers, loading, onOpenProvider }: ResultsMapProps) {
  const { colors, dark } = useTheme();
  const { s, language } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const pinLabel = usePinLabel();
  const mapRef = useRef<MapView>(null);
  // The native map ignores camera moves made before it is ready (Android shows the whole world).
  const [mapReady, setMapReady] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // If a new search no longer contains the selected provider, the selection is simply gone.
  const selected = providers.find((provider) => provider.id === selectedId) ?? null;

  const region = useMemo(
    () => regionFor(center, radiusM),
    // Only the numbers matter: `center` can be a new object with the same position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center.lat, center.lng, radiusM],
  );

  // Re-fit when the map becomes ready, and when the position or the radius changes.
  useEffect(() => {
    if (mapReady) mapRef.current?.animateToRegion(region, motion.base);
  }, [region, mapReady]);

  // A pin is a small view that the map turns into a picture. Redrawing that picture
  // on every frame is wasteful, so a pin only "tracks" its view for a moment after
  // something about the pins changed (new results, a new selection, the language,
  // light / dark), then `tracksViewChanges` goes back to false.
  const pinsKey = `${providers.map((provider) => provider.id).join(',')}|${selected?.id ?? ''}|${dark}|${language}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(pinsKey), PIN_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pinsKey]);
  const pinsChanging = settledKey !== pinsKey;

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        testID="results-map"
        style={styles.map}
        initialRegion={region}
        onMapReady={() => setMapReady(true)}
        userInterfaceStyle={dark ? 'dark' : 'light'}
        accessibilityLabel={loading ? s.results.loading : s.results.mapLabel}
        // The docked card replaces Google's own marker behaviour.
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        showsMyLocationButton={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={(event) => {
          // On iOS a tap on a pin also arrives here; only a tap on the map itself clears.
          if (event.nativeEvent.action !== 'marker-press') setSelectedId(null);
        }}
      >
        {radiusM !== CITY_RADIUS ? (
          <Circle
            center={{ latitude: center.lat, longitude: center.lng }}
            radius={radiusM}
            strokeColor={colors.accentStrong}
            strokeWidth={size.lineBold}
            fillColor={colors.accentWash}
          />
        ) : null}

        <Marker
          coordinate={{ latitude: center.lat, longitude: center.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tappable={false}
          tracksViewChanges={pinsChanging}
          accessibilityLabel={s.results.mapHere}
        >
          <HereDot />
        </Marker>

        {providers.map((provider) => {
          const isSelected = provider.id === selected?.id;
          return (
            <Marker
              key={provider.id}
              coordinate={{ latitude: provider.lat, longitude: provider.lng }}
              // The pointer's tip is at the bottom centre of the pin's box.
              anchor={{ x: 0.5, y: 1 }}
              // Selected on top, then verified over unverified, so the trusted names win an overlap.
              zIndex={isSelected ? 3 : provider.featured ? 2 : provider.verified ? 1 : 0}
              tracksViewChanges={pinsChanging}
              accessibilityLabel={pinLabel(provider, isSelected)}
              onPress={(event) => {
                event.stopPropagation();
                setSelectedId(provider.id);
              }}
            >
              <ProviderPin
                name={provider.name}
                verified={provider.verified}
                featured={provider.featured}
                selected={isSelected}
              />
            </Marker>
          );
        })}
      </MapView>

      {selected ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
          <View style={styles.dockColumn}>
            <MapProviderCard provider={selected} onPress={() => onOpenProvider(selected)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    flex: 1,
    minHeight: size.mapMin,
    alignSelf: 'stretch',
    backgroundColor: c.surfaceTint,
  },
  // Pinned to the wrapper's edges (see the note above).
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
  },
  dockColumn: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
}));
