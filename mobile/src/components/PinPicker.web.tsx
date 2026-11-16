import { MapPin } from 'lucide-react-native';
import { View } from 'react-native';

import type { Coordinates } from '@/api';
import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

interface Props {
  value: Coordinates;
  onChange: (next: Coordinates) => void;
}

/**
 * Web stand-in for the pin map. `react-native-maps` does not run in a browser,
 * and the web build is only used for screenshots, so this shows the chosen
 * position on a plain block. "Use my location" under it still moves the pin.
 */
export function PinPicker({ value }: Props) {
  const { colors } = useTheme();
  const { s, f } = useI18n();
  const styles = useStyles();
  const coords = f(s.join.pinCoords, { lat: value.lat.toFixed(5), lng: value.lng.toFixed(5) });

  return (
    <View style={styles.frame} accessible accessibilityLabel={`${s.join.pinLabel} ${coords}`}>
      <View style={styles.pin}>
        <MapPin color={colors.onPrimary} size={size.iconLarge} strokeWidth={size.stroke} />
      </View>
      <Txt role="caption" color="textMuted" ltr center>
        {coords}
      </Txt>
      <Txt role="caption" color="textSubtle" center style={styles.note}>
        {s.join.pinWeb}
      </Txt>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  frame: {
    height: size.mapPicker,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.lg,
  },
  pin: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    maxWidth: size.measure,
  },
}));
