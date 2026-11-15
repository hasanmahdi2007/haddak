import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { motion, opacity, radius, useTheme } from '@/theme';

interface Props {
  width?: DimensionValue;
  height: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}

/** A placeholder block that pulses gently while content loads. Still when Reduce Motion is on. */
export function Skeleton({ width = '100%', height, round = radius.sm, style }: Props) {
  const { colors } = useTheme();
  const [pulse] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: opacity.skeletonLow,
          duration: motion.skeleton,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 1, duration: motion.skeleton, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: round, backgroundColor: colors.manilaDeep, opacity: pulse },
        style,
      ]}
    />
  );
}
