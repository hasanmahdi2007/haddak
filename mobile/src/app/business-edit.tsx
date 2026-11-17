import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Store, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, type OwnProvider } from '@/api';
import { IconButton } from '@/components/IconButton';
import { ProviderForm } from '@/components/ProviderForm';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { requireSignIn, useAuth } from '@/lib/auth';
import { makeStyles, radius, size, space } from '@/theme';

type Load = { status: 'loading' } | { status: 'none' } | { status: 'error' } | { status: 'ready'; own: OwnProvider };

/**
 * "Edit listing", opened from My business: the same form as "List your
 * business", filled with the saved listing. Saving sends only what changed
 * (PATCH /me/provider) and goes back to My business, which reloads.
 */
export default function BusinessEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { s, row, rtl } = useI18n();
  const styles = useStyles();
  const auth = useAuth();
  const signedIn = auth.status === 'signedIn';
  const [attempt, setAttempt] = useState(0);
  const key = `${auth.userId ?? ''}:${attempt}`;
  const [settled, setSettled] = useState<{ key: string; load: Load } | null>(null);
  const load: Load = settled && settled.key === key ? settled.load : { status: 'loading' };

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/my-business'));

  useEffect(() => {
    if (!signedIn) return undefined;
    let current = true;
    api
      .getMyProvider()
      .then((own) => {
        if (current) setSettled({ key, load: { status: 'ready', own } });
      })
      .catch((error: unknown) => {
        if (!current) return;
        const status = error instanceof ApiError && error.status === 404 ? 'none' : 'error';
        setSettled({ key, load: { status } });
      });
    return () => {
      current = false;
    };
  }, [signedIn, key]);

  let body;
  if (auth.status === 'signedOut') {
    body = (
      <StateView
        icon={Store}
        title={s.join.editTitle}
        body={s.business.signInBody}
        actionLabel={s.account.signIn}
        onAction={() => requireSignIn()}
      />
    );
  } else if (load.status === 'none') {
    body = (
      <StateView
        icon={Store}
        title={s.join.noneTitle}
        body={s.join.noneBody}
        actionLabel={s.join.noneAction}
        onAction={() => router.replace('/join')}
      />
    );
  } else if (load.status === 'error') {
    body = (
      <StateView
        icon={WifiOff}
        title={s.business.errorTitle}
        body={s.account.errorBody}
        actionLabel={s.common.tryAgain}
        onAction={() => setAttempt((n) => n + 1)}
      />
    );
  } else if (load.status === 'loading' || !signedIn) {
    body = (
      <View style={styles.loading} accessible accessibilityLabel={s.join.editTitle}>
        <Skeleton height={space.huge * 5} round={radius.lg} />
        <Skeleton height={space.huge * 4} round={radius.lg} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={[styles.column, styles.bar, { flexDirection: row }]}>
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
        <Txt role="headline" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
          {s.join.editTitle}
        </Txt>
      </View>
      {body ? (
        <View style={styles.column}>{body}</View>
      ) : load.status === 'ready' ? (
        <ProviderForm
          mode="edit"
          initial={load.own}
          onSaved={() => {
            AccessibilityInfo.announceForAccessibility(s.join.saved);
            goBack();
          }}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  bar: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  loading: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
}));
