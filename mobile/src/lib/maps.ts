import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Whether a real map (react-native-maps) can be drawn in this build.
 *
 * On Android the map is Google Maps, which needs our own API key in a real build
 * (app.config.ts reads it from GOOGLE_MAPS_ANDROID_API_KEY; docs/DEPLOY.md).
 * Without it the Google Maps SDK crashes the app the moment a map opens. Expo Go
 * brings its own key, and iOS uses Apple Maps, which needs none. When this is
 * false, the screens draw the plain stand-in the web build uses instead.
 */
const inExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.appOwnership === 'expo';
const hasKey = Boolean((Constants.expoConfig?.extra as { hasAndroidMapsKey?: boolean } | undefined)?.hasAndroidMapsKey);

export const nativeMapAvailable = Platform.OS !== 'android' || inExpoGo || hasKey;
