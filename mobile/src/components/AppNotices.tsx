import { FlaskConical, MapPin } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isMockMode } from '@/api';
import { useServerWaking } from '@/api/serverStatus';
import { useI18n } from '@/i18n';
import { useLocation } from '@/lib/location';
import { elevation, makeStyles, radius, size, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { TextLink } from './TextLink';
import { Txt } from './Txt';

/**
 * Small app-wide notices, drawn by the root layout (and the Demo data pill by Home).
 */

/**
 * "Waking up the server…": a white pill at the top while a request has waited
 * more than 8 s (the free server sleeping, docs/DEPLOY.md). It never blocks a tap
 * and goes away by itself once the answer comes.
 */
export function ServerWakingNotice() {
  const waking = useServerWaking();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  if (!waking) return null;
  return (
    <View style={[styles.wakingFrame, { top: insets.top + space.sm }]} pointerEvents="none">
      <View
        style={[styles.wakingPill, { flexDirection: row }]}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={s.app.wakingUp}
      >
        <ActivityIndicator size="small" color={colors.text} />
        <Txt role="label" style={styles.wakingText}>
          {s.app.wakingUp}
        </Txt>
      </View>
    </View>
  );
}

/**
 * "Demo data": an outlined pill shown whenever the app runs on built-in fake data
 * (no EXPO_PUBLIC_API_URL), so nobody mistakes the made-up businesses for real ones.
 * Draws nothing against the real backend.
 */
export function DemoDataPill() {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  if (!isMockMode) return null;
  return (
    <View style={[styles.demoPill, { flexDirection: row }]} accessible accessibilityLabel={s.app.demoDataLabel}>
      <FlaskConical color={colors.textMuted} size={size.iconSmall} strokeWidth={size.lineBold} />
      <Txt role="badge" color="textMuted">
        {s.app.demoData}
      </Txt>
    </View>
  );
}

/**
 * The short "why we ask" card before the phone's own location dialog, on the
 * first launch only (src/lib/location.tsx decides when). "Allow" shows the
 * phone's dialog; "Not now" (or closing) searches around Haret Hreik, and the
 * "Use my location" chip on Home can ask later.
 */
export function LocationIntroSheet() {
  const location = useLocation();
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useStyles();
  if (!location.intro) return null;
  return (
    <Sheet title={s.locationIntro.title} closeLabel={s.locationIntro.close} onClose={location.skip}>
      <View style={styles.introBlock}>
        <View style={styles.introIcon}>
          <MapPin color={colors.onAccent} size={size.icon} strokeWidth={size.stroke} />
        </View>
        <Txt role="bodyLarge" color="onAccent">
          {s.locationIntro.body}
        </Txt>
      </View>
      <Button label={s.locationIntro.allow} onPress={location.allow} />
      <TextLink label={s.locationIntro.notNow} onPress={location.skip} style={styles.introLater} />
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  wakingFrame: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
  },
  wakingPill: {
    alignItems: 'center',
    gap: space.sm,
    maxWidth: size.maxContent,
    minHeight: size.touch,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: size.hairline,
    borderColor: c.border,
    boxShadow: elevation.card,
  },
  wakingText: {
    flexShrink: 1,
  },
  demoPill: {
    minHeight: size.badge,
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: c.border,
  },
  // An alice-blue info block with black words, like the other intro blocks.
  introBlock: {
    backgroundColor: c.accent,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
  },
  introIcon: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.md,
    backgroundColor: c.heroControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introLater: {
    alignSelf: 'center',
  },
}));
