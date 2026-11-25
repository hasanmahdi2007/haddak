import { getAccessToken, handleUnauthorized } from '@/lib/auth';
import { getDeviceId } from '@/lib/deviceId';

import { createHttpApi } from './http';
import type { createMockApi } from './mock';
import type { HaddakApi } from './types';

export * from './types';

/**
 * Set EXPO_PUBLIC_API_URL (for example http://192.168.1.20:8000) to talk to the
 * real backend. When it is unset the app runs on built-in mock data, and a
 * "Demo data" pill says so on screen.
 */
const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

export const isMockMode = baseUrl.length === 0;

// A release build with fake data must never reach testers or the store by accident
// (a local release build started without the URL, say). It refuses to start, unless
// EXPO_PUBLIC_ALLOW_MOCK=1 says the demo build is wanted (screenshots, a demo phone).
if (isMockMode && !__DEV__ && process.env.EXPO_PUBLIC_ALLOW_MOCK !== '1') {
  throw new Error('EXPO_PUBLIC_API_URL is missing in a release build (set EXPO_PUBLIC_ALLOW_MOCK=1 for a demo build).');
}

// The mock (about 2,400 lines of fake data) is loaded only in mock mode. The build
// writes the URL into the code, so with a URL this line becomes `null` and the
// mock files are left out of the app. It is one expression on purpose: that is
// what lets the bundler drop it.
const mockModule: { createMockApi: typeof createMockApi } | null = process.env.EXPO_PUBLIC_API_URL
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./mock');

// Both clients send the signed-in user's token (src/lib/auth.ts) when there is one.
const mock = isMockMode && mockModule ? mockModule.createMockApi(getAccessToken) : null;

export const api: HaddakApi =
  mock ?? createHttpApi(baseUrl, getAccessToken, handleUnauthorized, getDeviceId);

// Lets the screenshot script trigger the error state in mock mode. Off in normal
// builds: only in development, or when EXPO_PUBLIC_MOCK_CONTROLS=1 is set on purpose.
if (mock && (__DEV__ || process.env.EXPO_PUBLIC_MOCK_CONTROLS === '1')) {
  (globalThis as { __haddakMock?: unknown }).__haddakMock = mock.controls;
}
