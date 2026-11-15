import { ArefRuqaa_700Bold } from '@expo-google-fonts/aref-ruqaa';
import { Beiruti_600SemiBold, Beiruti_700Bold } from '@expo-google-fonts/beiruti';
import {
  ReadexPro_400Regular,
  ReadexPro_500Medium,
  ReadexPro_600SemiBold,
} from '@expo-google-fonts/readex-pro';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nProvider } from '@/i18n';
import { CategoriesProvider } from '@/lib/categories';
import { FavouritesProvider } from '@/lib/favourites';
import { LocationProvider } from '@/lib/location';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors, dark } = useTheme();
  // Font names here must match `fonts` in src/theme/tokens.ts.
  const [loaded, error] = useFonts({
    Beiruti_600SemiBold,
    Beiruti_700Bold,
    ReadexPro_400Regular,
    ReadexPro_500Medium,
    ReadexPro_600SemiBold,
    ArefRuqaa_700Bold,
  });
  const ready = loaded || error !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <LocationProvider>
          <CategoriesProvider>
            <FavouritesProvider>
              <StatusBar style={dark ? 'light' : 'dark'} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              />
            </FavouritesProvider>
          </CategoriesProvider>
        </LocationProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
