import { Beiruti_600SemiBold, Beiruti_700Bold } from '@expo-google-fonts/beiruti';
import {
  ReadexPro_400Regular,
  ReadexPro_500Medium,
  ReadexPro_600SemiBold,
} from '@expo-google-fonts/readex-pro';
import {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
} from '@expo-google-fonts/urbanist';
import { useFonts } from 'expo-font';
import { type ErrorBoundaryProps, SplashScreen, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { CircleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api';
import { LocationIntroSheet, ServerWakingNotice } from '@/components/AppNotices';
import { HireCheckPrompt } from '@/components/HireCheckSheet';
import { StateView } from '@/components/StateView';
import { I18nProvider, useI18n } from '@/i18n';
import { AuthProvider } from '@/lib/auth';
import { CategoriesProvider } from '@/lib/categories';
import { FavouritesProvider } from '@/lib/favourites';
import { LocationProvider } from '@/lib/location';
import { makeStyles, size, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

/**
 * Shown instead of a screen that crashed while drawing (expo-router renders it for
 * any error under this layout), so the user gets "Try again" instead of a blank
 * screen. It brings its own providers: the layout's ones may be what failed.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <CrashView retry={retry} />
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function CrashView({ retry }: { retry: () => Promise<void> }) {
  const { s } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <View style={[styles.crash, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.crashColumn}>
        <StateView
          icon={CircleAlert}
          title={s.app.crashTitle}
          body={s.app.crashBody}
          alert
          actionLabel={s.common.tryAgain}
          onAction={() => void retry()}
          secondaryLabel={s.app.crashHome}
          onSecondary={() => {
            router.replace('/');
            void retry();
          }}
        />
      </View>
    </View>
  );
}

export default function RootLayout() {
  const { colors, dark } = useTheme();
  // Font names here must match `fonts` in src/theme/tokens.ts: Urbanist for Latin
  // text, Beiruti and Readex Pro for Arabic (Urbanist has no Arabic letters).
  const [loaded, error] = useFonts({
    Urbanist_400Regular,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
    Beiruti_600SemiBold,
    Beiruti_700Bold,
    ReadexPro_400Regular,
    ReadexPro_500Medium,
    ReadexPro_600SemiBold,
  });
  const ready = loaded || error !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  // Wake the server at once, without waiting for it: the free plan sleeps after 15
  // quiet minutes and takes up to a minute to start (docs/DEPLOY.md). By the time
  // the user has picked a category, it is often awake.
  useEffect(() => {
    api.health().catch(() => undefined);
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <LocationProvider>
            <CategoriesProvider>
              <FavouritesProvider>
                <StatusBar style={dark ? 'light' : 'dark'} />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                  }}
                >
                  {/* A provider's updates open over everything, full screen, and fade in. */}
                  <Stack.Screen
                    name="stories/[providerId]"
                    options={{ presentation: 'fullScreenModal', animation: 'fade' }}
                  />
                  {/* Sign-in slides up over the screen that asked for it, and closes back to it. */}
                  <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
                </Stack>
                {/* "Did you hire them?": asks at most once per app open, only when signed in. */}
                <HireCheckPrompt />
                {/* "Why we ask for your location", before the phone's dialog (first launch only). */}
                <LocationIntroSheet />
                {/* "Waking up the server…" while a request waits more than 8 seconds. */}
                <ServerWakingNotice />
              </FavouritesProvider>
            </CategoriesProvider>
          </LocationProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const useStyles = makeStyles((c) => ({
  crash: {
    flex: 1,
    backgroundColor: c.background,
  },
  crashColumn: {
    flex: 1,
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
    justifyContent: 'center',
  },
}));
