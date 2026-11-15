import { createHttpApi } from './http';
import { createMockApi } from './mock';
import type { HaddakApi } from './types';

export * from './types';
export { HARET_HREIK } from './mockData';

/**
 * Set EXPO_PUBLIC_API_URL (for example http://192.168.1.20:8000) to talk to the
 * real backend. When it is unset the app runs on built-in mock data.
 */
const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

export const isMockMode = baseUrl.length === 0;

const mock = isMockMode ? createMockApi() : null;

export const api: HaddakApi = mock ?? createHttpApi(baseUrl);

// Lets the screenshot script trigger the error state in mock mode. Off in normal
// builds: only in development, or when EXPO_PUBLIC_MOCK_CONTROLS=1 is set on purpose.
if (mock && (__DEV__ || process.env.EXPO_PUBLIC_MOCK_CONTROLS === '1')) {
  (globalThis as { __haddakMock?: unknown }).__haddakMock = mock.controls;
}
