import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { elevation, makeStyles, radius, size, space, useTheme } from '@/theme';

import { Button, type ButtonVariant } from './Button';
import { TextLink } from './TextLink';
import { Txt } from './Txt';

interface Props {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonVariant;
  /** A second, quieter way forward, drawn as a text link under the button. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Errors are announced to screen readers as alerts and drawn in the error colours. */
  alert?: boolean;
}

/**
 * Empty, error and "coming soon" states: what happened, why, and one way forward.
 * The black icon sits on a white disc lifted by the card shadow, with a small vanilla dot;
 * an error swaps both for the error colours.
 */
export function StateView({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  actionVariant = 'primary',
  secondaryLabel,
  onSecondary,
  alert = false,
}: Props) {
  const { colors } = useTheme();
  const { end } = useI18n();
  const styles = useStyles();
  return (
    <View style={styles.wrap} accessibilityRole={alert ? 'alert' : undefined}>
      <View style={[styles.disc, alert ? styles.discAlert : null]}>
        <Icon
          color={alert ? colors.onDangerSoft : colors.primary}
          size={size.stateIcon}
          strokeWidth={size.stroke}
        />
        {alert ? null : <View style={[styles.dot, end(space.xs)]} />}
      </View>
      <View style={styles.text}>
        <Txt role="headline" center accessibilityRole="header">
          {title}
        </Txt>
        <Txt color="textMuted" center>
          {body}
        </Txt>
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant={actionVariant} style={styles.action} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <TextLink label={secondaryLabel} onPress={onSecondary} style={styles.secondary} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: space.xxl,
    paddingVertical: space.huge,
    gap: space.xl,
  },
  disc: {
    width: size.stateDisc,
    height: size.stateDisc,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: elevation.card,
  },
  discAlert: {
    backgroundColor: c.dangerSoft,
    boxShadow: 'none',
  },
  dot: {
    position: 'absolute',
    top: space.xs,
    width: space.lg,
    height: space.lg,
    borderRadius: radius.pill,
    backgroundColor: c.signature,
    borderWidth: size.lineBold,
    borderColor: c.surface,
  },
  text: {
    gap: space.xs,
    maxWidth: size.measure,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: space.xs,
  },
  // Pulled up towards the button: the link's own 48 dp box already gives it air.
  secondary: {
    marginTop: -space.md,
  },
}));
