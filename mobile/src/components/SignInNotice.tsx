import { LogIn } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { onSignInRequired } from '@/lib/auth';
import { makeStyles, motion, radius, size, space, useTheme } from '@/theme';

import { Txt } from './Txt';

/**
 * The small "Sign-in is coming soon" notice: an ink pill near the bottom of the
 * screen that shows for a moment each time `requireSignIn()` is called.
 * It never takes a touch, and screen readers hear it as an announcement.
 */
export function SignInNotice() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  // Goes up by one on every call, so calling twice restarts the timer.
  const [shown, setShown] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fade] = useState(() => new Animated.Value(0));
  const message = s.auth.comingSoon;

  useEffect(
    () =>
      onSignInRequired(() => {
        setVisible(true);
        setShown((n) => n + 1);
        AccessibilityInfo.announceForAccessibility(message);
      }),
    [message],
  );

  useEffect(() => {
    if (shown === 0) return undefined;
    const native = Platform.OS !== 'web';
    Animated.timing(fade, { toValue: 1, duration: motion.fast, useNativeDriver: native }).start();
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: motion.base, useNativeDriver: native }).start(
        ({ finished }) => {
          if (finished) setVisible(false);
        },
      );
    }, motion.notice);
    return () => clearTimeout(timer);
  }, [shown, fade]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      // Above the action bar docked at the bottom of a profile.
      style={[styles.layer, { bottom: insets.bottom + size.button + space.xxxl }]}
    >
      <Animated.View style={[styles.pill, { flexDirection: row, opacity: fade }]}>
        <LogIn color={colors.onPrimary} size={size.iconSmall} strokeWidth={size.lineBold} />
        <Txt role="label" color="onPrimary">
          {message}
        </Txt>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  layer: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
  },
  pill: {
    alignItems: 'center',
    gap: space.sm,
    minHeight: size.segment + space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
  },
}));
