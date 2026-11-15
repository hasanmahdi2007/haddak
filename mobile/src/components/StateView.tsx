import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { makeStyles, size, space, useTheme } from '@/theme';

import { Button, type ButtonVariant } from './Button';
import { Txt } from './Txt';

interface Props {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonVariant;
  /** Errors are announced to screen readers as alerts. */
  alert?: boolean;
}

/** Empty, error and "coming soon" states: what happened, why, and one way forward. */
export function StateView({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  actionVariant = 'primary',
  alert = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.wrap} accessibilityRole={alert ? 'alert' : undefined}>
      <Icon color={colors.textSubtle} size={size.stateIcon} strokeWidth={size.lineMid} />
      <View style={styles.text}>
        <Txt role="title" center accessibilityRole="header">
          {title}
        </Txt>
        <Txt color="textMuted" center>
          {body}
        </Txt>
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant={actionVariant} style={styles.action} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: space.xxl,
    paddingVertical: space.huge,
    gap: space.lg,
  },
  text: {
    gap: space.xs,
    maxWidth: size.measure,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: space.sm,
  },
}));
