import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Building2, Printer, Share2, Store, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ProviderDetail } from '@/api';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Skeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { Txt } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { ar } from '@/i18n/ar';
import { en } from '@/i18n/en';
import { shareUrl } from '@/lib/links';
import { useAsync } from '@/lib/useAsync';
import { makeStyles, radius, size, space, useTheme, type TypeRole } from '@/theme';

/** The app's general link, for the building poster (the domain is not registered yet). */
const APP_URL = 'https://haddak.app';

type Kind = 'business' | 'building';

/**
 * A printable poster, in English and Arabic side by side, dark ink on white.
 *
 * - "Your business": the provider's name and category and a big QR code of
 *   their link, for a shop window or a van.
 * - "For a building": for the natour (building caretaker) to put up at the
 *   entrance; its QR code opens Haddak itself.
 *
 * A real A4 PDF needs the `expo-print` package, which is not installed yet, so
 * for now the owner takes a screenshot (or prints the page from a browser).
 * The poster is always white with dark ink, in the dark theme too, so it
 * prints cleanly and the code always scans.
 */
export default function PosterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { dark, colors } = useTheme();
  const { s, f, row, rtl } = useI18n();
  const styles = useStyles();
  const params = useLocalSearchParams<{ slug: string; kind?: string }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'building' ? 'building' : 'business');
  const load = useAsync(() => api.getProviderBySlug(params.slug), [params.slug]);

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // The paper fills the column; its QR code grows with it.
  const paperWidth = Math.min(width, size.maxContent) - space.lg * 2;

  const url = kind === 'building' || !load.data ? APP_URL : shareUrl(load.data.slug);
  const share = () => {
    const message =
      kind === 'building' || !load.data
        ? f(s.poster.shareBuilding, { url })
        : f(s.provider.shareMessage, { name: load.data.name, url });
    Share.share({ message }).catch(() => undefined);
  };
  // Only the web build can print the page directly; on a phone a PDF needs expo-print.
  const canPrint = Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function';

  const kinds: { key: Kind; label: string; icon: typeof Store }[] = [
    { key: 'business', label: s.poster.kindBusiness, icon: Store },
    { key: 'building', label: s.poster.kindBuilding, icon: Building2 },
  ];

  let body;
  if (kind === 'business' && load.status === 'error') {
    body = (
      <StateView
        alert
        icon={WifiOff}
        title={s.poster.errorTitle}
        body={s.results.errorBody}
        actionLabel={s.common.tryAgain}
        onAction={load.reload}
      />
    );
  } else if (kind === 'business' && load.status === 'loading') {
    body = (
      <View accessible accessibilityLabel={s.poster.title}>
        <Skeleton height={paperWidth * size.posterRatio} round={radius.md} />
      </View>
    );
  } else {
    body = (
      <>
        {kind === 'business' && load.data ? (
          <BusinessPoster provider={load.data} url={url} width={paperWidth} />
        ) : (
          <BuildingPoster url={url} width={paperWidth} />
        )}
        <Button label={s.poster.share} icon={Share2} onPress={share} />
        {canPrint ? <Button label={s.poster.print} icon={Printer} variant="tonal" onPress={() => window.print()} /> : null}
        <Txt role="label" color="textMuted" center>
          {canPrint ? s.poster.printWebHint : s.poster.printHint}
        </Txt>
        {kind === 'building' ? (
          <Txt role="caption" color="textSubtle" center>
            {s.poster.natourNote}
          </Txt>
        ) : null}
      </>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[styles.column, styles.bar, { flexDirection: row }]}>
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
        <Txt role="display" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
          {s.poster.title}
        </Txt>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={[styles.column, styles.page]}>
          {/* Which poster: a grey pill track with two segments, like List / Map on Results. */}
          <View style={[styles.track, { flexDirection: row }]} accessibilityRole="tablist" accessibilityLabel={s.poster.kindLabel}>
            {kinds.map(({ key, label, icon: Icon }) => {
              const active = kind === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                  onPress={() => setKind(key)}
                  hitSlop={{ top: size.segmentSlop, bottom: size.segmentSlop }}
                  android_ripple={{ color: colors.surfaceTintStrong }}
                  style={[styles.segment, { flexDirection: row }, active ? styles.segmentActive : null]}
                >
                  <Icon color={active ? colors.onPrimary : colors.text} size={size.iconSmall} strokeWidth={size.lineBold} />
                  <Txt role="label" color={active ? 'onPrimary' : 'text'} numberOfLines={1}>
                    {label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          {body}
        </View>
      </ScrollView>
    </View>
  );
}

/** "Haddak" and "حدّك" at the two top corners: English on the left, Arabic on the right, in both app languages. */
function Wordmarks() {
  const styles = useStyles();
  return (
    <View style={styles.wordmarks}>
      <Txt role="headline" color="qrInk" ltr>
        {en.appName}
      </Txt>
      <Txt role="headline" color="qrInk" content>
        {ar.appName}
      </Txt>
    </View>
  );
}

/**
 * One message in two columns: English on the left, Arabic on the right, with a
 * thin ink line between them. The order is fixed (it is printed), not mirrored.
 */
function Bilingual({ en: english, ar: arabic, role = 'bodyStrong' }: { en: string; ar: string; role?: TypeRole }) {
  const styles = useStyles();
  return (
    <View style={styles.bilingual}>
      <Txt role={role} color="qrInk" center content style={styles.half}>
        {english}
      </Txt>
      <View style={styles.divider} />
      <Txt role={role} color="qrInk" center content style={styles.half}>
        {arabic}
      </Txt>
    </View>
  );
}

/** The QR code with its white quiet zone, sized from the poster's width. */
function PosterQr({ url, width, label }: { url: string; width: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <QRCode
        value={url}
        size={Math.round(width * size.posterQrShare)}
        color={colors.qrInk}
        backgroundColor={colors.qrPaper}
        quietZone={size.qrQuietZone}
        // Medium error correction: still scans with a scuff or a bit of glare.
        ecl="M"
      />
    </View>
  );
}

/** The link under the code, for people who type it. */
function Link({ url }: { url: string }) {
  return (
    <Txt role="label" color="qrInk" center ltr selectable>
      {url.replace('https://', '')}
    </Txt>
  );
}

function BusinessPoster({ provider, url, width }: { provider: ProviderDetail; url: string; width: number }) {
  const { f } = useI18n();
  const styles = useStyles();
  return (
    <View style={[styles.paper, { minHeight: width * size.posterRatio }]}>
      <View style={styles.top}>
        <Wordmarks />
        <View style={styles.rule} />
        <Txt role="poster" color="qrInk" center content numberOfLines={3}>
          {provider.name}
        </Txt>
        <Bilingual en={provider.category.name_en} ar={provider.category.name_ar} role="title" />
      </View>
      <View style={styles.middle}>
        <PosterQr url={url} width={width} label={f(en.poster.qrBusiness, { name: provider.name })} />
        <Bilingual en={en.poster.scanToContact} ar={ar.poster.scanToContact} />
        <Link url={url} />
      </View>
      <View style={styles.bottom}>
        <View style={styles.rule} />
        <Bilingual en={en.poster.tagline} ar={ar.poster.tagline} role="title" />
      </View>
    </View>
  );
}

function BuildingPoster({ url, width }: { url: string; width: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.paper, { minHeight: width * size.posterRatio }]}>
      <View style={styles.top}>
        <Wordmarks />
        <View style={styles.rule} />
        <Bilingual en={en.poster.buildingQuestion} ar={ar.poster.buildingQuestion} role="headline" />
      </View>
      <View style={styles.middle}>
        <PosterQr url={url} width={width} label={en.poster.qrBuilding} />
        <Bilingual en={en.poster.buildingScan} ar={ar.poster.buildingScan} />
        <Link url={url} />
      </View>
      {/* Left blank for now: natour codes are not live yet. */}
      <View style={styles.natour}>
        <Txt role="label" color="qrInk" ltr>
          {en.poster.natourCode}
        </Txt>
        <Txt role="label" color="qrInk" content>
          {ar.poster.natourCode}
        </Txt>
      </View>
      <View style={styles.bottom}>
        <View style={styles.rule} />
        <Bilingual en={en.poster.tagline} ar={ar.poster.tagline} role="title" />
      </View>
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
    paddingVertical: space.xs,
  },
  flex: {
    flex: 1,
  },
  page: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.lg,
  },
  track: {
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTint,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: size.segment,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + space.xxs,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segmentActive: {
    backgroundColor: c.primary,
  },
  // The sheet of paper: pure white with dark ink in both themes (qrPaper / qrInk).
  paper: {
    backgroundColor: c.qrPaper,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
    justifyContent: 'space-between',
    gap: space.lg,
  },
  top: {
    gap: space.md,
  },
  middle: {
    alignItems: 'center',
    gap: space.sm,
  },
  bottom: {
    gap: space.md,
  },
  // Fixed left-to-right on purpose: the poster is printed, not mirrored.
  wordmarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rule: {
    height: size.strokeHeavy,
    borderRadius: radius.pill,
    backgroundColor: c.qrInk,
  },
  bilingual: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: space.md,
  },
  // minWidth 0 lets a long line wrap inside its half instead of pushing the poster wider.
  half: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    alignSelf: 'stretch',
    width: size.hairline,
    backgroundColor: c.qrInk,
  },
  // An empty box the natour can write a code in later.
  natour: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: size.touch + space.lg,
    padding: space.md,
    borderWidth: size.lineBold,
    borderStyle: 'dashed',
    borderColor: c.qrInk,
    borderRadius: radius.md,
  },
}));
