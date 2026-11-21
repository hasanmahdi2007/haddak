import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { AccessibilityInfo, TextInput, View } from 'react-native';

import { api, ApiError } from '@/api';
import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Field, Notice, useInputStyle } from './Field';
import { ProofPicker, type PickedImage } from './PhotoPicker';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

/** Limit of `message` in POST /providers/{id}/claim. */
const MESSAGE_MAX = 500;

interface Props {
  providerId: string;
  name: string;
  onClose: () => void;
}

/**
 * "Is this your business? Claim it": an optional message and an optional proof
 * photo (private, through the same uploader as profile proof), then send. The
 * founder approves by hand; after that the listing shows in My business.
 * Opened only when signed in (the profile screen calls requireSignIn first).
 */
export function ClaimSheet({ providerId, name, onClose }: Props) {
  const { colors } = useTheme();
  const { s, f } = useI18n();
  const styles = useStyles();
  const inputStyle = useInputStyle();
  const [message, setMessage] = useState('');
  const [proof, setProof] = useState<PickedImage | null>(null);
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploading = proof?.state === 'uploading';

  const send = async () => {
    if (sending || uploading) return;
    setSending(true);
    setError(null);
    try {
      await api.claimProvider(providerId, {
        message: message.trim() || null,
        // A proof that failed to upload is simply not sent; the claim still works without it.
        verification_doc_url: proof?.state === 'done' ? proof.url : null,
      });
      setSent(true);
      AccessibilityInfo.announceForAccessibility(s.claim.thanksTitle);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSending(false);
    }
  };

  // The backend's 409 has three causes; its message tells them apart.
  const errorText = (cause: unknown) => {
    if (!(cause instanceof ApiError)) return s.claim.failed;
    if (cause.status === 429) return s.claim.rateLimited;
    if (cause.status === 404) return s.claim.gone;
    if (cause.status === 409) {
      if (/already asked/i.test(cause.message)) return s.claim.alreadyAsked;
      if (/provider profile/i.test(cause.message)) return s.claim.hasProfile;
      return s.claim.alreadyOwned;
    }
    return s.claim.failed;
  };

  if (sent) {
    return (
      <Sheet title={f(s.claim.title, { name })} closeLabel={s.claim.close} onClose={onClose}>
        <View style={styles.thanks} accessibilityLiveRegion="polite">
          <View style={styles.thanksDisc}>
            <Check color={colors.onSignature} size={size.iconLarge} strokeWidth={size.strokeBold} />
          </View>
          <Txt role="title" center>
            {s.claim.thanksTitle}
          </Txt>
          <Txt color="textMuted" center>
            {s.claim.thanksBody}
          </Txt>
        </View>
        <Button label={s.claim.done} onPress={onClose} />
      </Sheet>
    );
  }

  return (
    <Sheet title={f(s.claim.title, { name })} closeLabel={s.claim.close} onClose={onClose}>
      <Txt color="textMuted">{s.claim.intro}</Txt>

      <Field label={s.claim.message} optional aside={`${message.length} / ${MESSAGE_MAX}`}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={s.claim.messagePlaceholder}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={s.claim.message}
          multiline
          maxLength={MESSAGE_MAX}
          selectionColor={colors.primary}
          style={inputStyle(focused, null, true)}
        />
      </Field>

      <Field label={s.claim.proof} optional hint={s.claim.proofNote}>
        <ProofPicker value={proof} onChange={setProof} />
      </Field>

      {error ? <Notice>{error}</Notice> : null}
      <Button label={s.claim.send} onPress={() => void send()} loading={sending} disabled={uploading} />
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  thanks: {
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.xl,
  },
  // A claim is one of Haddak's special moments, so the thank-you mark is vanilla.
  thanksDisc: {
    width: size.trustDisc + space.md,
    height: size.trustDisc + space.md,
    borderRadius: radius.pill,
    backgroundColor: c.signature,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
}));
