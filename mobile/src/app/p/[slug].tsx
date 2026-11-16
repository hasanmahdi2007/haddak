import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, UserX, WifiOff } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api';
import { IconButton } from '@/components/IconButton';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { useI18n } from '@/i18n';
import { useAsync } from '@/lib/useAsync';
import { makeStyles, radius, size, space } from '@/theme';

/**
 * A share link: haddak://p/<slug> (the QR code and the shared message carry
 * https://haddak.app/p/<slug>, which will open here once the domain is set up).
 * It looks the share code up (GET /providers/by-slug/{slug}) and replaces
 * itself with the profile, so Back does not land on this in-between page.
 */
export default function ShareLinkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { s, rtl } = useI18n();
  const styles = useStyles();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const load = useAsync(() => api.getProviderBySlug(slug), [slug]);
  const foundId = load.data?.id;

  useEffect(() => {
    if (foundId) router.replace({ pathname: '/provider/[id]', params: { id: foundId } });
  }, [foundId, router]);

  const goHome = () => router.replace('/');
  const BackIcon = rtl ? ArrowRight : ArrowLeft;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton icon={BackIcon} label={s.common.back} onPress={goHome} />
      </View>
      <View style={styles.column}>
        {load.status === 'error' && load.error.status === 404 ? (
          <StateView
            icon={UserX}
            title={s.provider.notFoundTitle}
            body={s.provider.notFoundBody}
            actionLabel={s.provider.notFoundAction}
            onAction={goHome}
          />
        ) : load.status === 'error' ? (
          <StateView
            alert
            icon={WifiOff}
            title={s.provider.errorTitle}
            body={s.provider.errorBody}
            actionLabel={s.common.tryAgain}
            onAction={load.reload}
          />
        ) : (
          // Loading, or found and about to be replaced by the profile.
          <View style={styles.loading} accessible accessibilityLabel={s.provider.loading}>
            <Skeleton height={size.tile * 2} round={radius.lg} />
            <Skeleton width="60%" height={space.xxxl} />
            <Skeleton height={space.lg} />
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  bar: {
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  loading: {
    padding: space.lg,
    gap: space.md,
  },
}));
