import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The app's config: everything in app.json, plus the values that come from the
 * build environment and so cannot live in a checked-in JSON file.
 *
 * GOOGLE_MAPS_ANDROID_API_KEY: the Google "Maps SDK for Android" key the map and
 * the pin picker need in a real Android build (Expo Go brings its own). It is an
 * EAS environment variable, never committed; see docs/DEPLOY.md. Without it the
 * key is left out, and the app shows a plain "map not available" block instead
 * of the map (see src/lib/maps.ts).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = (process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '').trim();
  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(mapsKey ? { googleMaps: { apiKey: mapsKey } } : {}),
      },
    },
    extra: {
      ...config.extra,
      // Read by the app to know whether a native Android map can be drawn.
      hasAndroidMapsKey: mapsKey.length > 0,
    },
  };
};
