import { Sparkles } from 'lucide-react-native';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, radius, size, useTheme } from '@/theme';

/**
 * The Jarak AI mark: a small vanilla square with a black sparkle, beside the
 * assistant's name on Home and in its own screen bar. Vanilla is Haddak's
 * signature highlight, kept for its special moments. Decorative: the name next
 * to it already says what it is, so screen readers skip it.
 */
export function JarakMark({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.mark, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Sparkles color={colors.onSignature} size={size.iconSmall} strokeWidth={size.lineBold} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  mark: {
    width: size.jarakMark,
    height: size.jarakMark,
    borderRadius: radius.sm,
    backgroundColor: c.signature,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
