import { requireOptionalNativeModule } from 'expo';
// Type only: importing the package itself would crash in Expo Go, which has no such native module.
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionModule as SpeechModuleType,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { Language } from '@/i18n';

type SpeechModule = typeof SpeechModuleType;

/**
 * The phone's own speech recognizer, or null when this app has none.
 * Expo Go and the web build do not include `expo-speech-recognition`; only the
 * development build does. `requireOptionalNativeModule` returns null instead of throwing,
 * so the Speak button is simply hidden there.
 */
function loadSpeech(): SpeechModule | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    const native = requireOptionalNativeModule<SpeechModule>('ExpoSpeechRecognition');
    if (!native) return null;
    // A phone without any recognizer (no Google app, for example) gets no button either.
    return native.isRecognitionAvailable() ? native : null;
  } catch {
    return null;
  }
}

const speech = loadSpeech();

/** True when this build can listen. Decided once: native modules do not come and go. */
export const VOICE_AVAILABLE = speech !== null;

/** Why listening stopped without a sentence. The screen turns each into plain words. */
export type VoiceProblem = 'blocked' | 'denied' | 'unheard' | 'network' | 'failed';

/** Asks the recognizer which of our wanted languages it knows, and whether it has it offline. */
async function chooseLanguage(
  module: SpeechModule,
  language: Language,
): Promise<{ lang: string; onDevice: boolean }> {
  const wanted = language === 'ar' ? ['ar-LB', 'ar'] : ['en-US'];
  let locales: string[] = [];
  let installed: string[] = [];
  try {
    // Android 12 and older answer with empty lists; then we just try the first wanted language.
    const found = await module.getSupportedLocales({});
    locales = found.locales.map((l) => l.toLowerCase());
    installed = found.installedLocales.map((l) => l.toLowerCase());
  } catch {
    // Not knowing is fine.
  }
  const known = (list: string[], lang: string) =>
    list.includes(lang.toLowerCase()) || (!lang.includes('-') && list.some((l) => l.startsWith(`${lang}-`)));
  const lang = wanted.find((l) => known(locales, l)) ?? wanted[0];
  // On-device is free and private, but only when that language pack is already on the phone.
  let onDevice = false;
  try {
    onDevice = module.supportsOnDeviceRecognition() && known(installed, lang);
  } catch {
    onDevice = false;
  }
  return { lang, onDevice };
}

interface VoiceOptions {
  language: Language;
  /** The words heard so far, while the person is still talking. */
  onPartial: (text: string) => void;
  /** Listening ended with a sentence: the screen sends it. */
  onFinal: (text: string) => void;
}

/**
 * Tap to talk: `start()` listens until the person stops speaking (the phone decides),
 * or until `stop()`. Partial words arrive through `onPartial`, the whole sentence through `onFinal`.
 */
export function useVoice({ language, onPartial, onFinal }: VoiceOptions) {
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<VoiceProblem | null>(null);

  // Callbacks change on every render of the screen; the native listeners read the latest one.
  const partialRef = useRef(onPartial);
  const finalRef = useRef(onFinal);
  useEffect(() => {
    partialRef.current = onPartial;
    finalRef.current = onFinal;
  });

  // What was heard in this round, and how this round was started (for one fallback retry).
  const heard = useRef('');
  type Attempt = { lang: string; onDevice: boolean; retried: boolean };
  const attempt = useRef<Attempt | null>(null);
  const retry = useRef<Attempt | null>(null);

  const begin = useCallback((lang: string, onDevice: boolean) => {
    if (!speech) return;
    speech.start({
      lang,
      interimResults: true,
      // One sentence, then stop by itself: the phone ends it after a short silence.
      continuous: false,
      requiresOnDeviceRecognition: onDevice,
      maxAlternatives: 1,
      addsPunctuation: false,
    });
  }, []);

  useEffect(() => {
    if (!speech) return;
    const subs = [
      speech.addListener('start', () => {
        setListening(true);
      }),
      speech.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
        const words = event.results[0]?.transcript ?? '';
        if (!words) return;
        heard.current = words;
        partialRef.current(words);
      }),
      speech.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
        const now = attempt.current;
        // The offline pack or "ar-LB" was refused: try once more, online and with plain "ar".
        // The phone always sends "end" after an error, so the new round starts there.
        if (event.error === 'language-not-supported' && now && !now.retried) {
          retry.current = { lang: now.lang === 'ar-LB' ? 'ar' : now.lang, onDevice: false, retried: true };
          return;
        }
        attempt.current = null;
        setListening(false);
        if (event.error === 'aborted') return;
        if (event.error === 'not-allowed') setProblem('denied');
        else if (event.error === 'no-speech' || event.error === 'speech-timeout')
          setProblem('unheard');
        else if (event.error === 'network') setProblem('network');
        else setProblem('failed');
      }),
      speech.addListener('end', () => {
        const again = retry.current;
        if (again) {
          retry.current = null;
          attempt.current = again;
          heard.current = '';
          begin(again.lang, again.onDevice);
          return;
        }
        // Ended by an error (already shown) or by leaving the screen.
        if (!attempt.current) {
          setListening(false);
          return;
        }
        attempt.current = null;
        setListening(false);
        const words = heard.current.trim();
        heard.current = '';
        if (words) finalRef.current(words);
        else setProblem('unheard');
      }),
    ];
    return () => {
      subs.forEach((sub) => sub.remove());
      // Leaving the screen stops the microphone at once, without sending.
      attempt.current = null;
      retry.current = null;
      try {
        speech.abort();
      } catch {
        // Nothing was running.
      }
    };
  }, [begin]);

  const start = useCallback(async () => {
    if (!speech || attempt.current) return;
    setProblem(null);
    try {
      const permission = await speech.requestPermissionsAsync();
      if (!permission.granted) {
        // "Don't ask again" (or refused twice on Android): only Settings can turn it back on.
        setProblem(permission.canAskAgain ? 'denied' : 'blocked');
        return;
      }
      const { lang, onDevice } = await chooseLanguage(speech, language);
      attempt.current = { lang, onDevice, retried: false };
      heard.current = '';
      // Show the listening state at once; the native "start" event confirms it.
      setListening(true);
      begin(lang, onDevice);
    } catch {
      attempt.current = null;
      setListening(false);
      setProblem('failed');
    }
  }, [begin, language]);

  /** Stop listening now; what was heard so far is sent. */
  const stop = useCallback(() => {
    if (!speech) return;
    try {
      speech.stop();
    } catch {
      setListening(false);
    }
  }, []);

  const clearProblem = useCallback(() => setProblem(null), []);

  return { available: VOICE_AVAILABLE, listening, problem, start, stop, clearProblem };
}
