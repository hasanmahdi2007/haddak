import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, ExternalLink, FileText, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { AccessibilityInfo, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Field';
import { IconButton } from '@/components/IconButton';
import { Sheet } from '@/components/Sheet';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { deleteAccount } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import { legalUrl } from '@/lib/links';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

type LinkIcon = typeof FileText;

/** One row that opens a web page in the browser. */
function PageLink({ icon: Icon, label, url }: { icon: LinkIcon; label: string; url: string }) {
  const { colors } = useTheme();
  const { row } = useI18n();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url)}
      android_ripple={{ color: colors.surfaceTintStrong }}
      style={({ pressed }) => [styles.link, { flexDirection: row }, pressed ? styles.pressed : null]}
    >
      <Icon color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
      <Txt role="bodyStrong" style={styles.flex}>
        {label}
      </Txt>
      <ExternalLink color={colors.textSubtle} size={size.icon} strokeWidth={size.stroke} />
    </Pressable>
  );
}

/**
 * Account and privacy: the privacy policy, the terms, and deleting the account
 * (Google Play requires all three to be reachable in the app).
 */
export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dark } = useTheme();
  const { s, row, rtl } = useI18n();
  const auth = useAuth();
  const styles = useStyles();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const confirmDelete = async () => {
    setDeleting(true);
    setFailed(false);
    try {
      await deleteAccount();
      setConfirming(false);
      AccessibilityInfo.announceForAccessibility(s.settings.deleted);
      router.replace('/');
    } catch {
      setFailed(true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[styles.column, styles.bar, { flexDirection: row }]}>
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
        <Txt role="headline" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
          {s.settings.title}
        </Txt>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xxl }]}>
        <View style={[styles.column, styles.sections]}>
          <View style={styles.group}>
            <PageLink icon={ShieldCheck} label={s.settings.privacyPolicy} url={legalUrl('privacy')} />
            <View style={styles.divider} />
            <PageLink icon={FileText} label={s.settings.terms} url={legalUrl('terms')} />
          </View>

          {auth.status === 'signedIn' ? (
            <View style={styles.danger}>
              <Txt role="title">{s.settings.deleteTitle}</Txt>
              <Txt role="body" color="textMuted">
                {s.settings.deleteBody}
              </Txt>
              <Button
                label={s.settings.deleteAction}
                variant="outline"
                onPress={() => {
                  setFailed(false);
                  setConfirming(true);
                }}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {confirming ? (
        <Sheet title={s.settings.confirmTitle} closeLabel={s.settings.close} onClose={() => !deleting && setConfirming(false)}>
          <Txt role="body">{s.settings.deleteBody}</Txt>
          <Txt role="body" color="textMuted">
            {s.settings.confirmBody}
          </Txt>
          {failed ? <Notice>{s.settings.failed}</Notice> : null}
          <Button
            label={s.settings.confirmAction}
            variant="danger"
            loading={deleting}
            onPress={() => void confirmDelete()}
          />
          <Button label={s.settings.cancel} variant="tonal" disabled={deleting} onPress={() => setConfirming(false)} />
        </Sheet>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  bar: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  sections: {
    gap: space.xl,
  },
  group: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  link: {
    alignItems: 'center',
    gap: space.md,
    minHeight: size.touch + space.sm,
    paddingHorizontal: space.lg,
  },
  pressed: {
    backgroundColor: c.surfaceInset,
  },
  divider: {
    height: 1,
    marginHorizontal: space.lg,
    backgroundColor: c.surfaceTintStrong,
  },
  danger: {
    gap: space.sm,
  },
}));
