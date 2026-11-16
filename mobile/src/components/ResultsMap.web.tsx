import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space } from '@/theme';

import {
  CITY_RADIUS,
  HereDot,
  MapProviderCard,
  ProviderPin,
  metresPerDegree,
  regionFor,
  usePinLabel,
  type ResultsMapProps,
} from './MapParts';
import { Txt } from './Txt';

/**
 * Web stand-in for the map. `react-native-maps` does not run in a browser, and the
 * web build is only used for screenshots, so this plots the same pins, circle and
 * docked card on a plain grey panel, at the same scale the real map would use.
 */
export function ResultsMap({ center, radiusM, providers, loading, onOpenProvider }: ResultsMapProps) {
  const { s } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const pinLabel = usePinLabel();
  const [panel, setPanel] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = providers.find((provider) => provider.id === selectedId) ?? null;

  // The panel's width shows the region's width; the same scale is used top to bottom.
  const region = regionFor(center, radiusM);
  const metres = metresPerDegree(center.lat);
  const pxPerMetre = panel.width / (region.longitudeDelta * metres.lng);
  const point = (lat: number, lng: number) => ({
    x: panel.width / 2 + (lng - center.lng) * metres.lng * pxPerMetre,
    y: panel.height / 2 - (lat - center.lat) * metres.lat * pxPerMetre,
  });
  const circle = radiusM * 2 * pxPerMetre;

  return (
    <View
      testID="results-map"
      accessibilityLabel={loading ? s.results.loading : s.results.mapLabel}
      style={styles.wrap}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setPanel({ width, height });
      }}
    >
      {/* A tap on the empty panel clears the selection, as on the real map. */}
      <Pressable accessible={false} style={styles.fill} onPress={() => setSelectedId(null)} />

      {panel.width > 0 ? (
        <>
          {radiusM !== CITY_RADIUS ? (
            <View
              pointerEvents="none"
              style={[
                styles.circle,
                {
                  width: circle,
                  height: circle,
                  left: panel.width / 2 - circle / 2,
                  top: panel.height / 2 - circle / 2,
                },
              ]}
            />
          ) : null}

          <View
            pointerEvents="none"
            accessibilityLabel={s.results.mapHere}
            style={[
              styles.spot,
              { left: panel.width / 2 - size.mapHere / 2, top: panel.height / 2 - size.mapHere / 2 },
            ]}
          >
            <HereDot />
          </View>

          {providers.map((provider) => {
            const isSelected = provider.id === selected?.id;
            const { x, y } = point(provider.lat, provider.lng);
            return (
              <Pressable
                key={provider.id}
                accessibilityRole="button"
                accessibilityLabel={pinLabel(provider, isSelected)}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedId(provider.id)}
                // The pointer's tip (bottom centre of the pin, whatever its width) sits on the position.
                style={[
                  styles.spot,
                  {
                    left: x,
                    top: y,
                    transform: [{ translateX: '-50%' }, { translateY: '-100%' }],
                    zIndex: isSelected ? 3 : provider.featured ? 2 : provider.verified ? 1 : 0,
                  },
                ]}
              >
                <ProviderPin
                  name={provider.name}
                  verified={provider.verified}
                  featured={provider.featured}
                  selected={isSelected}
                />
              </Pressable>
            );
          })}
        </>
      ) : null}

      <View pointerEvents="none" style={styles.note}>
        <Txt role="caption" color="textMuted">
          {s.results.mapWebNote}
        </Txt>
      </View>

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
    backgroundColor: c.surfaceTint,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  circle: {
    position: 'absolute',
    borderRadius: radius.pill,
    backgroundColor: c.accentWash,
    borderWidth: size.lineBold,
    borderColor: c.accentStrong,
  },
  spot: {
    position: 'absolute',
  },
  note: {
    position: 'absolute',
    top: space.md,
    alignSelf: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
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
