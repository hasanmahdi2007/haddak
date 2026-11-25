import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import type { Coordinates } from '@/api';
import { useI18n } from '@/i18n';
import { nativeMapAvailable } from '@/lib/maps';
import { makeStyles, motion, radius, size, useTheme } from '@/theme';

// The plain stand-in (no map), for a build without a Google Maps key.
import { PinPicker as PinPreview } from './PinPicker.web';

interface Props {
  value: Coordinates;
  onChange: (next: Coordinates) => void;
}

/** About 1 km across: close enough to put the pin on the right street. */
const DELTA = 0.01;

const regionAround = (point: Coordinates): Region => ({
  latitude: point.lat,
  longitude: point.lng,
  latitudeDelta: DELTA,
  longitudeDelta: DELTA,
});

/**
 * Where the business is: a map with one pin. The owner drags the pin, or taps
 * the map to move it there. (The web build uses PinPicker.web.tsx.)
 */
export function PinPicker(props: Props) {
  const { s } = useI18n();
  if (!nativeMapAvailable) return <PinPreview {...props} note={s.join.pinNoMap} />;
  return <MapPinPicker {...props} />;
}

function MapPinPicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useStyles();
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  // The position the map last centred on, so a drag does not pull the map along.
  const centred = useRef<Coordinates | null>(null);

  // Centre on the pin when it moves from outside (first position, "Use my location").
  useEffect(() => {
    if (!ready) return;
    const last = centred.current;
    if (last && last.lat === value.lat && last.lng === value.lng) return;
    centred.current = value;
    mapRef.current?.animateToRegion(regionAround(value), motion.base);
  }, [ready, value]);

  const move = (lat: number, lng: number) => {
    const next = { lat, lng };
    // Moved by hand: the map is already where the finger is.
    centred.current = next;
    onChange(next);
  };

  return (
    <View style={styles.frame} accessible accessibilityLabel={s.join.pinLabel}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={regionAround(value)}
        onMapReady={() => setReady(true)}
        onPress={(event) => move(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={{ latitude: value.lat, longitude: value.lng }}
          draggable
          onDragEnd={(event) => move(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)}
          pinColor={colors.primary}
        />
      </MapView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  frame: {
    height: size.mapPicker,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: c.surfaceTint,
  },
  // Pinned to all four edges: a native map sized by flex alone can measure as zero on Android.
  map: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
}));
