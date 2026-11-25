import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { isAllowedImage } from '@/lib/imageHosts';
import { makeStyles, motion, size, useTheme } from '@/theme';

import { CategoryIcon } from './CategoryIcon';

interface Props {
  uri: string | null;
  /** Category icon key, shown on a alice-blue block when there is no photo or it fails to load. */
  fallbackIcon: string;
  fallbackIconSize?: number;
  /** Describe the photo for screen readers; leave out when it is decorative. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A provider photo. Many providers will have none, so the fallback is a designed state.
 * Only pictures from our own storage (or still on the phone) are loaded; any other
 * link shows the fallback (src/lib/imageHosts.ts).
 */
export function Photo({ uri, fallbackIcon, fallbackIconSize = size.tileIcon, label, style }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const showImage = isAllowedImage(uri) && !failed;

  return (
    <View
      style={[styles.frame, style]}
      accessible={Boolean(label)}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
    >
      <CategoryIcon icon={fallbackIcon} color={colors.onAccent} size={fallbackIconSize} />
      {showImage ? (
        <Image
          source={{ uri: uri ?? undefined }}
          style={styles.image}
          contentFit="cover"
          transition={motion.base}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  frame: {
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
}));
