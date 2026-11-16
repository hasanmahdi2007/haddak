import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MailX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { type AuthFailure, cancelSignIn, type SignInLink, signInWithLink, useAuth } from '@/lib/auth';
import { makeStyles, size, space, useTheme } from '@/theme';

type Params = { code?: string; error_code?: string; error_description?: string };

/** Reads `a=1&b=2` (the part after `#`). Done by hand: React Native's URLSearchParams is incomplete. */
function readFragment(url: string | null): Record<string, string> {
  const hash = url?.split('#')[1] ?? '';
  const values: Record<string, string> = {};
  for (const pair of hash.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (!key) continue;
    try {
      values[key] = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      values[key] = value;
    }
  }
  return values;
}

/**
 * Where the link in the sign-in email lands: haddak://auth-callback?code=...
 * (exp://<computer>:8081/--/auth-callback?code=... in Expo Go).
 *
 * It trades the one-time code for a session, then closes. When the sign-in
 * screen is underneath, that screen sees the user is in, closes too and finishes
 * what they were doing. Opened on its own (the app was closed), it goes Home.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useStyles();
  const auth = useAuth();
  const params = useLocalSearchParams<Params>();
  // The full link, for the #fragment that older ("implicit") links use.
  const url = Linking.useLinkingURL();
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const fragment = readFragment(url);
  const link: SignInLink = {
    code: params.code,
    accessToken: fragment.access_token,
    refreshToken: fragment.refresh_token,
    errorCode: params.error_code ?? fragment.error_code,
    errorDescription: params.error_description ?? fragment.error_description,
  };
  const hasLink = Boolean(link.code || link.accessToken || link.errorCode || link.errorDescription);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  useEffect(() => {
    if (!hasLink) return;
    let live = true;
    void signInWithLink(link).then((result) => {
      if (!live) return;
      if (result.ok) {
        AccessibilityInfo.announceForAccessibility(s.auth.signedIn);
        leave();
      } else if (auth.status === 'signedIn') {
        // An old link tapped again while already signed in: nothing went wrong.
        leave();
      } else {
        setFailure(result.failure);
        AccessibilityInfo.announceForAccessibility(s.auth.linkFailedTitle);
      }
    });
    return () => {
      live = false;
    };
    // The link's values are what matter; `link` itself is a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.code, link.accessToken, link.refreshToken, link.errorCode, link.errorDescription]);

  if (failure || !hasLink) {
    const body =
      failure === 'otherDevice'
        ? s.auth.otherDevice
        : failure === 'offline'
          ? s.auth.offline
          : failure === 'linkExpired' || !hasLink
            ? s.auth.linkExpired
            : s.auth.failed;
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.column}>
          <StateView
            icon={MailX}
            title={s.auth.linkFailedTitle}
            body={body}
            alert
            actionLabel={s.auth.newLink}
            // The sign-in screen is usually right underneath, still holding the email.
            onAction={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
            secondaryLabel={s.auth.goHome}
            onSecondary={() => {
              cancelSignIn();
              router.dismissTo('/');
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, styles.center, { paddingTop: insets.top }]} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} size="large" />
      <Txt role="bodyStrong" center>
        {s.auth.linkWorking}
      </Txt>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
    justifyContent: 'center',
  },
}));
