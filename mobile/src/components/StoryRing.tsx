import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { size, useTheme } from '@/theme';

interface Props {
  /** The provider has an update to show. Without it the photo is drawn as usual, with no ring. */
  active: boolean;
  /** Outer width and height, ring included. */
  box: number;
  /** Corner radius of the photo; the ring around it is rounded to match. */
  round: number;
  /** `ink` when the ring sits on an alice-blue or vanilla block, where olive would not stand out. */
  tone?: 'signature' | 'ink';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Haddak's mark for "this provider posted an update": an olive-yellow ring (the
 * signature vanilla's deeper `signatureStrong` shade, 3:1 or more on white, the
 * ground and vanilla) around the photo, with a thin gap between the two. It keeps
 * the photo's own shape (a rounded square, like every thumbnail in the app) rather
 * than turning it into a circle.
 * The child should fill its parent (`flex: 1` or 100% width and height).
 */
export function StoryRing({ active, box, round, tone = 'signature', children, style }: Props) {
  const { colors } = useTheme();
  const inset = active ? size.ringLine + size.ringGap : 0;
  return (
    <View
      style={[
        { width: box, height: box, borderRadius: round + inset },
        active
          ? {
              borderWidth: size.ringLine,
              // The deeper olive: plain vanilla is only 1.4:1 on white, far below the 3:1 a line needs.
              borderColor: tone === 'ink' ? colors.onAccent : colors.signatureStrong,
              padding: size.ringGap,
            }
          : null,
        style,
      ]}
    >
      <View style={{ flex: 1, borderRadius: round, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}
