import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, opacity, size, space } from '@/theme';

import { Txt } from './Txt';

interface Props {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** A quiet secondary action: underlined ink text in a 48 dp touch target. */
export function TextLink({ label, onPress, style }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.target, pressed ? styles.pressed : null, style]}
    >
      <Txt role="label" color="primary" center style={styles.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  target: {
    minHeight: size.touch,
    minWidth: size.touch,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: opacity.pressed,
  },
  text: {
    textDecorationLine: 'underline',
  },
}));
