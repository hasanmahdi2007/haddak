import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Store } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ProviderStatus } from '@/api';
import { IconButton } from '@/components/IconButton';
import { ProviderForm } from '@/components/ProviderForm';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { requireSignIn, useAuth } from '@/lib/auth';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

/**
 * "List your business": a signed-in user without a listing creates one
 * (POST /me/provider). Afterwards a result screen says what happens next,
 * then My business takes over.
 */
export default function JoinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, row, rtl } = useI18n();
  const styles = useStyles();
  const auth = useAuth();
  const signedIn = auth.status === 'signedIn';
  // Checked once on arrival: someone who already has a listing goes to My business instead.
  const [checked, setChecked] = useState<string | null>(null);
  const [done, setDone] = useState<ProviderStatus | null>(null);

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const userKey = auth.userId ?? '';

  useEffect(() => {
    if (!signedIn) return undefined;
    let current = true;
    api
      .getMyProvider()
      .then(() => {
        if (current) router.dismissTo('/my-business');
      })
      .catch(() => {
        // 404 (no listing) is the expected answer. On any other failure the form
        // shows anyway; sending it says clearly if a listing exists (409).
        if (current) setChecked(userKey);
      });
    return () => {
      current = false;
    };
  }, [signedIn, userKey, router]);

  const bar = (
    <View style={[styles.column, styles.bar, { flexDirection: row }]}>
      <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
    </View>
  );

  if (done) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {bar}
        <View style={styles.column}>
          <StateView
            icon={Store}
            title={s.join.doneTitle}
            body={done === 'pending' ? s.join.donePending : s.join.doneUnverified}
            actionLabel={s.join.doneAction}
            onAction={() => router.dismissTo('/my-business')}
          />
        </View>
      </View>
    );
  }

  if (auth.status === 'signedOut') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {bar}
        <View style={styles.column}>
          <StateView
            icon={Store}
            title={s.join.title}
            body={s.business.signInBody}
            actionLabel={s.account.signIn}
            onAction={() => requireSignIn()}
          />
        </View>
      </View>
    );
  }

  if (!signedIn || checked !== userKey) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {bar}
        <View style={[styles.column, styles.loading]} accessible accessibilityLabel={s.join.title}>
          <Skeleton height={space.huge * 3} round={radius.sheet} />
          <Skeleton height={space.huge * 5} round={radius.sheet} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {bar}
      <ProviderForm
        mode="create"
        header={
          // What this screen is for: one lavender block, as on Suggest (icon, then words).
          <View style={styles.intro}>
            <Store color={colors.onAccent} size={size.tileIcon} strokeWidth={size.stroke} />
            <View style={styles.introWords}>
              <Txt role="display" color="onAccent" accessibilityRole="header">
                {s.join.title}
              </Txt>
              <Txt color="onAccent">{s.join.intro}</Txt>
            </View>
          </View>
        }
        onSaved={(own) => {
          setDone(own.status);
          AccessibilityInfo.announceForAccessibility(s.join.doneTitle);
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  bar: {
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  loading: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  intro: {
    backgroundColor: c.accent,
    borderRadius: radius.sheet,
    padding: space.xl,
    gap: space.xl,
  },
  introWords: {
    gap: space.xs,
  },
}));
