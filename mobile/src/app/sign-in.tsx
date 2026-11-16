import { useRouter } from 'expo-router';
import { KeyRound, LockKeyhole, MailCheck, X } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field, Notice, useInputStyle } from '@/components/Field';
import { IconButton } from '@/components/IconButton';
import { StateView } from '@/components/StateView';
import { TextLink } from '@/components/TextLink';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import {
  type AuthFailure,
  cancelSignIn,
  finishSignIn,
  sendCode,
  signInConfigured,
  useAuth,
  verifyCode,
} from '@/lib/auth';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

const CODE_LENGTH = 6;
/** Supabase sends at most one code per address a minute, so the resend link waits that long. */
const RESEND_WAIT_S = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Step = 'email' | 'code';

/**
 * Sign-in, opened as a modal by `requireSignIn()` (src/lib/auth.ts).
 * Step 1 asks for an email and has Supabase send a 6-digit code to it.
 * Step 2 takes the code. Once Supabase accepts it, the modal closes by itself
 * and the user is back on the screen that asked, with their action finished.
 */
export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, f, row } = useI18n();
  const styles = useStyles();
  const inputStyle = useInputStyle();
  const auth = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showEmailError, setShowEmailError] = useState(false);
  const [failure, setFailure] = useState<{ kind: AuthFailure; retryAfterS: number | null } | null>(null);
  const [resent, setResent] = useState(false);
  // When the resend link opens again (ms since 1970), and a clock that ticks once a second until then.
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);
  const finished = useRef(false);

  // Signed in (just now, or already when the screen opened): close and carry on.
  useEffect(() => {
    if (auth.status !== 'signedIn' || finished.current) return;
    finished.current = true;
    AccessibilityInfo.announceForAccessibility(s.auth.signedIn);
    finishSignIn();
  }, [auth.status, s.auth.signedIn]);

  // Closed any other way (back gesture, swipe down): drop the action that was waiting.
  useEffect(
    () => () => {
      if (!finished.current) cancelSignIn();
    },
    [],
  );

  useEffect(() => {
    if (resendAt <= Date.now()) return undefined;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= resendAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const close = () => {
    cancelSignIn();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const trimmed = email.trim().toLowerCase();
  const emailProblem = EMAIL.test(trimmed) ? null : s.auth.emailInvalid;
  const waitS = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const failed = (kind: AuthFailure, retryAfterS: number | null) => {
    setFailure({ kind, retryAfterS });
    if (kind === 'rateLimited' && retryAfterS) {
      setResendAt(Date.now() + retryAfterS * 1000);
      setNow(Date.now());
    }
  };

  const requestCode = async (again: boolean) => {
    if (emailProblem) {
      setShowEmailError(true);
      AccessibilityInfo.announceForAccessibility(emailProblem);
      return;
    }
    setBusy(true);
    setFailure(null);
    setResent(false);
    const result = await sendCode(trimmed);
    setBusy(false);
    if (!result.ok) {
      failed(result.failure, result.retryAfterS);
      return;
    }
    setResendAt(Date.now() + RESEND_WAIT_S * 1000);
    setNow(Date.now());
    setCode('');
    if (again) {
      setResent(true);
      AccessibilityInfo.announceForAccessibility(s.auth.resent);
    } else {
      setStep('code');
      AccessibilityInfo.announceForAccessibility(s.auth.codeTitle);
    }
    // The keyboard comes up on the code boxes.
    setTimeout(() => codeRef.current?.focus(), 250);
  };

  const checkCode = async (typed: string) => {
    if (typed.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setFailure(null);
    setResent(false);
    const result = await verifyCode(trimmed, typed);
    setBusy(false);
    // Success needs nothing here: the store turns "signed in" and the effect above closes the screen.
    if (!result.ok) {
      failed(result.failure, result.retryAfterS);
      // Start again on a wrong code, so the next try is typed into empty boxes.
      if (result.failure === 'wrongCode' || result.failure === 'expired') setCode('');
      codeRef.current?.focus();
    }
  };

  const onCodeChange = (text: string) => {
    // Pasted codes often come with spaces ("123 456"); only the digits count.
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (failure && failure.kind !== 'rateLimited') setFailure(null);
    if (digits.length === CODE_LENGTH) void checkCode(digits);
  };

  const failureText = (kind: AuthFailure, retryAfterS: number | null): string => {
    switch (kind) {
      case 'invalidEmail':
        return s.auth.emailInvalid;
      case 'notAllowed':
        return s.auth.notAllowed;
      case 'wrongCode':
        return s.auth.wrongCode;
      case 'expired':
        return s.auth.expired;
      case 'rateLimited':
        return retryAfterS ? f(s.auth.rateLimitedFor, { n: retryAfterS }) : s.auth.rateLimited;
      case 'offline':
        return s.auth.offline;
      case 'notConfigured':
        return s.auth.notConfiguredBody;
      default:
        return s.auth.failed;
    }
  };

  const bar = (
    <View style={[styles.column, styles.bar, { flexDirection: row }]}>
      <IconButton icon={X} label={s.auth.close} onPress={close} />
    </View>
  );

  if (!signInConfigured) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {bar}
        <View style={styles.column}>
          <StateView
            icon={KeyRound}
            title={s.auth.notConfiguredTitle}
            body={s.auth.notConfiguredBody}
            actionLabel={s.common.back}
            onAction={close}
          />
        </View>
      </View>
    );
  }

  const emailError = showEmailError ? emailProblem : null;
  const time = `0:${String(waitS).padStart(2, '0')}`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {bar}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={[styles.column, styles.page]}>
            {/* What this step is for: one lavender block, built like the Suggest intro. */}
            <View style={styles.intro}>
              {step === 'email' ? (
                <KeyRound color={colors.onAccent} size={size.tileIcon} strokeWidth={size.stroke} />
              ) : (
                <MailCheck color={colors.onAccent} size={size.tileIcon} strokeWidth={size.stroke} />
              )}
              <View style={styles.introWords}>
                <Txt role="display" color="onAccent" accessibilityRole="header">
                  {step === 'email' ? s.auth.title : s.auth.codeTitle}
                </Txt>
                <Txt color="onAccent">
                  {step === 'email' ? s.auth.intro : f(s.auth.codeIntro, { email: `⁦${trimmed}⁩` })}
                </Txt>
              </View>
            </View>

            {step === 'email' ? (
              <>
                <Field label={s.auth.email} error={emailError}>
                  <TextInput
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (failure) setFailure(null);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={s.auth.emailPlaceholder}
                    placeholderTextColor={colors.textSubtle}
                    accessibilityLabel={s.auth.email}
                    aria-invalid={emailError ? true : undefined}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    inputMode="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="send"
                    onSubmitEditing={() => void requestCode(false)}
                    maxLength={254}
                    selectionColor={colors.primary}
                    // An address reads left to right in Arabic too.
                    style={[inputStyle(focused, emailError), styles.ltr]}
                  />
                </Field>
                <View style={[styles.privacy, { flexDirection: row }]}>
                  <LockKeyhole color={colors.textSubtle} size={size.iconSmall} strokeWidth={size.stroke} />
                  <Txt role="caption" color="textSubtle" style={styles.flex}>
                    {s.auth.privacy}
                  </Txt>
                </View>
              </>
            ) : (
              <View style={styles.codeBlock}>
                <Txt role="bodyStrong" style={styles.inset}>
                  {s.auth.code}
                </Txt>
                {/* Six boxes drawn over one invisible field, so typing, pasting and the
                    keyboard's "fill code" suggestion all work. Digits always run left to right. */}
                <Pressable
                  onPress={() => codeRef.current?.focus()}
                  accessible={false}
                  style={styles.codeRow}
                >
                  {Array.from({ length: CODE_LENGTH }, (_, i) => {
                    const active = focused && (i === code.length || (i === CODE_LENGTH - 1 && code.length === CODE_LENGTH));
                    const wrong = failure?.kind === 'wrongCode' || failure?.kind === 'expired';
                    return (
                      <View
                        key={i}
                        style={[styles.box, active ? styles.boxActive : null, wrong && !code ? styles.boxError : null]}
                      >
                        <Txt role="headline" ltr center>
                          {code[i] ?? ''}
                        </Txt>
                      </View>
                    );
                  })}
                  <TextInput
                    ref={codeRef}
                    value={code}
                    onChangeText={onCodeChange}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    accessibilityLabel={s.auth.code}
                    accessibilityHint={failure ? failureText(failure.kind, failure.retryAfterS) : undefined}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    maxLength={CODE_LENGTH + 2}
                    caretHidden
                    editable={!busy}
                    style={styles.codeInput}
                  />
                </Pressable>
                <View style={[styles.codeLinks, { flexDirection: row }]}>
                  {waitS > 0 ? (
                    <Txt role="label" color="textMuted" style={styles.inset} accessibilityLiveRegion="polite">
                      {f(s.auth.resendIn, { time })}
                    </Txt>
                  ) : (
                    <TextLink label={s.auth.resend} onPress={() => void requestCode(true)} />
                  )}
                  <TextLink
                    label={s.auth.changeEmail}
                    onPress={() => {
                      setStep('email');
                      setCode('');
                      setFailure(null);
                      setResent(false);
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Outside the scrolling page, so the button rides above the keyboard. */}
        <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
          <View style={[styles.column, styles.dockInner]}>
            {failure ? <Notice>{failureText(failure.kind, failure.retryAfterS)}</Notice> : null}
            {resent && !failure ? <Notice tone="success">{s.auth.resent}</Notice> : null}
            {step === 'email' ? (
              <Button label={s.auth.sendCode} onPress={() => void requestCode(false)} loading={busy} />
            ) : (
              <Button
                label={s.auth.verify}
                onPress={() => void checkCode(code)}
                loading={busy}
                disabled={code.length !== CODE_LENGTH}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
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
  page: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.xxl,
    gap: space.xxl,
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
  ltr: {
    writingDirection: 'ltr',
  },
  privacy: {
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.xl,
    marginTop: -space.sm,
  },
  inset: {
    paddingHorizontal: space.xl,
  },
  codeBlock: {
    gap: space.sm,
  },
  codeRow: {
    // Digits read left to right in Arabic too, so this row never flips.
    flexDirection: 'row',
    gap: space.sm,
  },
  // One white tile per digit on the lavender ground; the next one to fill gets the ink edge.
  box: {
    flex: 1,
    height: size.button + space.sm,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: size.lineBold,
    borderColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: c.primary,
  },
  boxError: {
    borderColor: c.danger,
  },
  // Covers the boxes and takes the touches and the typing, but is not seen.
  codeInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    fontSize: 1,
  },
  codeLinks: {
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.xs,
  },
  dock: {
    backgroundColor: c.background,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  dockInner: {
    gap: space.sm,
  },
}));
