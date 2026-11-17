import { Printer, Share2 } from 'lucide-react-native';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useI18n } from '@/i18n';
import { shareUrl } from '@/lib/links';
import { makeStyles, radius, size, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Txt } from './Txt';

interface Props {
  /** The provider's share code: the link is https://haddak.app/p/<slug>. */
  slug: string;
  name: string;
  /** Given: a "Print a poster" button under Share, which calls this (the caller closes its sheet and opens the poster). */
  onPoster?: () => void;
}

/**
 * A provider's link as a sticker: the name, a QR code of the link, and the
 * Haddak wordmark on white paper, then a Share button that sends the link.
 *
 * Providers print it for their door or counter, so the sticker stays dark ink
 * on pure white in every theme (`qrInk` on `qrPaper`), with a white margin round
 * the code (the quiet zone scanners need). Used on the profile; My business can
 * place it too.
 */
export function ShareProfile({ slug, name, onPoster }: Props) {
  const { colors } = useTheme();
  const { s, f } = useI18n();
  const styles = useStyles();
  const url = shareUrl(slug);

  const share = () => {
    Share.share({ message: f(s.provider.shareMessage, { name, url }) }).catch(() => undefined);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.sticker}>
        <Txt role="title" color="qrInk" center numberOfLines={2} content>
          {name}
        </Txt>
        <View accessible accessibilityRole="image" accessibilityLabel={f(s.share.qrLabel, { name })}>
          <QRCode
            value={url}
            size={size.qr}
            color={colors.qrInk}
            backgroundColor={colors.qrPaper}
            quietZone={size.qrQuietZone}
            // Medium error correction: still scans with a scuff or a bit of glare on a door.
            ecl="M"
          />
        </View>
        <View style={styles.foot}>
          <Txt role="headline" color="qrInk" center>
            {s.appName}
          </Txt>
          <Txt role="label" color="qrInk" center>
            {s.share.scan}
          </Txt>
          <Txt role="caption" color="qrInk" center ltr selectable>
            {url}
          </Txt>
        </View>
      </View>
      <Button label={s.share.send} icon={Share2} onPress={share} />
      {onPoster ? <Button label={s.share.poster} icon={Printer} variant="tonal" onPress={onPoster} /> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    gap: space.md,
  },
  sticker: {
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.qrPaper,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },
  foot: {
    alignItems: 'center',
  },
}));
