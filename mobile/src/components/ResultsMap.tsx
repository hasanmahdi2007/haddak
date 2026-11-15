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
const PIN_SETTLE_MS = 600;

/**
 * The results on a real map (Android and iOS; the web build uses ResultsMap.web.tsx).
 * In Expo Go this needs no API key. A store build will need a Google Maps key.
 */
export function ResultsMap({ center, radiusM, providers, loading, onOpenProvider }: ResultsMapProps) {
  const { colors, dark } = useTheme();
  const { s } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const pinLabel = usePinLabel();
  const mapRef = useRef<MapView>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // If a new search no longer contains the selected provider, the selection is simply gone.
  const selected = providers.find((provider) => provider.id === selectedId) ?? null;

  const region = useMemo(
    () => regionFor(center, radiusM),
    // Only the numbers matter: `center` can be a new object with the same position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center.lat, center.lng, radiusM],
  );

  // Re-fit when the position or the radius changes. (`initialRegion` covers the first draw.)
  useEffect(() => {
    mapRef.current?.animateToRegion(region, motion.base);
  }, [region]);

  // A pin is a small view that the map turns into a picture. Redrawing that picture
  // on every frame is wasteful, so a pin only "tracks" its view for a moment after
  // something about the pins changed (new results, a new selection, light / dark).
  const pinsKey = `${providers.map((provider) => provider.id).join(',')}|${selected?.id ?? ''}|${dark}`;
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
            strokeColor={colors.primary}
            strokeWidth={size.lineMid}
            fillColor={colors.primaryWash}
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
              // The pin's tip is at the bottom centre of its 48 dp box.
              anchor={{ x: 0.5, y: 1 }}
              zIndex={isSelected ? 2 : provider.featured ? 1 : 0}
              tracksViewChanges={pinsChanging}
              accessibilityLabel={pinLabel(provider, isSelected)}
              onPress={(event) => {
                event.stopPropagation();
                setSelectedId(provider.id);
              }}
            >
              <ProviderPin featured={provider.featured} selected={isSelected} />
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
    backgroundColor: c.surfaceTint,
  },
  map: {
    flex: 1,
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
