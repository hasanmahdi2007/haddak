import * as ImagePicker from 'expo-image-picker';
import { FileCheck2, ImagePlus, LockKeyhole, RotateCcw, X } from 'lucide-react-native';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import type { Strings } from '@/i18n/en';
import { uploadImage, UploadError, uploadMode, type UploadFailure, type UploadKind } from '@/lib/upload';
import { makeStyles, opacity, radius, size, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Notice } from './Field';
import { Photo } from './Photo';
import { Txt } from './Txt';

/** A photo in the form: shown from `preview` (the file on the phone, or the saved link) while `url` is what gets saved. */
export interface PickedImage {
  key: string;
  preview: string;
  /** The uploaded link; null until the upload has finished. */
  url: string | null;
  state: 'uploading' | 'done' | 'error';
}

/** A photo that is already saved in the profile. */
export function savedImage(url: string): PickedImage {
  return { key: url, preview: url, url, state: 'done' };
}

let keyCount = 0;
const newKey = () => `picked-${Date.now()}-${(keyCount += 1)}`;

type Problem = UploadFailure | 'permission' | null;

function problemText(problem: Problem, s: Strings): string | null {
  switch (problem) {
    case 'unavailable':
      return s.join.uploadsOff;
    case 'signedOut':
      return s.join.uploadSignedOut;
    case 'permission':
      return s.join.photoPermission;
    case 'failed':
      return s.join.uploadFailed;
    default:
      return null;
  }
}

/**
 * Picking and uploading, shared by the photos and the proof.
 * `add` puts new items in the form's state, `update` changes one by key.
 */
function useUploader(
  kind: UploadKind,
  add: (items: PickedImage[]) => void,
  update: (key: string, change: Partial<PickedImage>) => void,
) {
  const [problem, setProblem] = useState<Problem>(uploadMode() === 'none' ? 'unavailable' : null);

  const upload = (item: PickedImage) => {
    update(item.key, { state: 'uploading' });
    uploadImage(kind, item.preview)
      .then((url) => update(item.key, { url, state: 'done' }))
      .catch((error: unknown) => {
        update(item.key, { state: 'error' });
        setProblem(error instanceof UploadError ? error.reason : 'failed');
      });
  };

  const pick = async (limit: number) => {
    if (limit <= 0) return;
    setProblem(uploadMode() === 'none' ? 'unavailable' : null);
    if (uploadMode() === 'none') return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: limit > 1,
        selectionLimit: limit,
        // Full quality here: the upload shrinks it once, to 1600 px and JPEG 0.8.
        quality: 1,
      });
      if (result.canceled) return;
      const items = result.assets
        .slice(0, limit)
        .map<PickedImage>((asset) => ({ key: newKey(), preview: asset.uri, url: null, state: 'uploading' }));
      add(items);
      items.forEach(upload);
    } catch {
      // The picker refused to open: usually the photo permission was turned off.
      setProblem('permission');
    }
  };

  return { pick, retry: upload, problem };
}

// ---------------------------------------------------------------------------
// Photos

interface PhotosProps {
  value: PickedImage[];
  onChange: Dispatch<SetStateAction<PickedImage[]>>;
  max: number;
  /** Category icon, drawn while a photo cannot be shown. */
  fallbackIcon: string;
}

/**
 * Up to `max` photos as square tiles, then an "Add photo" tile. The first photo
 * is the cover and says so. Each tile has a remove button at its top end; a
 * tile that failed to upload offers to try again.
 */
export function PhotoPicker({ value, onChange, max, fallbackIcon }: PhotosProps) {
  const { colors } = useTheme();
  const { s, f, row, end } = useI18n();
  const styles = useStyles();
  const { pick, retry, problem } = useUploader(
    'photo',
    (items) => onChange((list) => [...list, ...items].slice(0, max)),
    (key, change) => onChange((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item))),
  );
  const remaining = max - value.length;
  const message = problemText(problem, s);

  return (
    <View style={styles.group}>
      <View style={[styles.tiles, { flexDirection: row }]}>
        {value.map((item, index) => {
          const n = index + 1;
          return (
            <View key={item.key} style={styles.tile}>
              <Photo
                uri={item.preview}
                fallbackIcon={fallbackIcon}
                label={index === 0 ? `${f(s.join.photoLabel, { n })}, ${s.join.cover}` : f(s.join.photoLabel, { n })}
                style={styles.tilePhoto}
              />
              {item.state === 'uploading' ? (
                <View style={styles.veil} accessible accessibilityLabel={s.join.uploading}>
                  <ActivityIndicator color={colors.onScrim} />
                </View>
              ) : null}
              {item.state === 'error' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={f(s.join.retryPhoto, { n })}
                  onPress={() => retry(item)}
                  style={styles.veil}
                >
                  <RotateCcw color={colors.onScrim} size={size.icon} strokeWidth={size.stroke} />
                  <Txt role="caption" color="onScrim" center>
                    {s.join.tryAgain}
                  </Txt>
                </Pressable>
              ) : null}
              {index === 0 && item.state === 'done' ? (
                <View style={styles.coverTag}>
                  <Txt role="caption" color="onScrim" numberOfLines={1}>
                    {s.join.cover}
                  </Txt>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={f(s.join.removePhoto, { n })}
                onPress={() => onChange((list) => list.filter((other) => other.key !== item.key))}
                hitSlop={size.segmentSlop}
                style={({ pressed }) => [styles.remove, end(space.xs), pressed ? styles.dim : null]}
              >
                <X color={colors.onScrim} size={size.iconSmall} strokeWidth={size.strokeBold} />
              </Pressable>
            </View>
          );
        })}
        {remaining > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={s.join.addPhoto}
            accessibilityHint={f(s.join.photosLeft, { n: remaining })}
            accessibilityState={{ disabled: problem === 'unavailable' }}
            disabled={problem === 'unavailable'}
            onPress={() => void pick(remaining)}
            android_ripple={{ color: colors.surfaceTintStrong }}
            style={({ pressed }) => [
              styles.tile,
              styles.add,
              pressed ? styles.addPressed : null,
              problem === 'unavailable' ? styles.disabled : null,
            ]}
          >
            <ImagePlus color={colors.text} size={size.iconLarge} strokeWidth={size.stroke} />
            <Txt role="label" center>
              {s.join.addPhoto}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {message ? <Notice tone={problem === 'failed' ? 'error' : 'info'}>{message}</Notice> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Proof

interface ProofProps {
  value: PickedImage | null;
  onChange: Dispatch<SetStateAction<PickedImage | null>>;
  /** Already verified: the proof can no longer change anything, so the block only says so. */
  verified?: boolean;
}

/**
 * The optional proof: one photo of a certificate, licence or the shop front,
 * kept private. Empty, it is one grey block that opens the photo picker.
 * Chosen, it shows the photo with Change and Remove.
 */
export function ProofPicker({ value, onChange, verified = false }: ProofProps) {
  const { colors } = useTheme();
  const { s, row } = useI18n();
  const styles = useStyles();
  const { pick, retry, problem } = useUploader(
    'proof',
    (items) => onChange(items[0] ?? null),
    (key, change) => onChange((item) => (item && item.key === key ? { ...item, ...change } : item)),
  );
  const message = problemText(problem, s);

  const privacy = (
    <View style={[styles.privacy, { flexDirection: row }]}>
      <LockKeyhole color={colors.textMuted} size={size.iconSmall} strokeWidth={size.stroke} />
      <Txt role="caption" color="textMuted" style={styles.flex}>
        {s.join.proofPrivate}
      </Txt>
    </View>
  );

  if (verified) {
    return <Notice tone="success">{s.join.proofVerified}</Notice>;
  }

  return (
    <View style={styles.group}>
      {value === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.join.addProof}
          accessibilityHint={s.join.proofBody}
          accessibilityState={{ disabled: problem === 'unavailable' }}
          disabled={problem === 'unavailable'}
          onPress={() => void pick(1)}
          android_ripple={{ color: colors.surfaceTintStrong }}
          style={({ pressed }) => [
            styles.proofEmpty,
            { flexDirection: row },
            pressed ? styles.addPressed : null,
            problem === 'unavailable' ? styles.disabled : null,
          ]}
        >
          <View style={styles.proofIcon}>
            <FileCheck2 color={colors.onAccent} size={size.icon} strokeWidth={size.stroke} />
          </View>
          <View style={styles.flexGap}>
            <Txt role="action">{s.join.addProof}</Txt>
            <Txt role="label" color="textMuted">
              {s.join.proofBody}
            </Txt>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.proofChosen, { flexDirection: row }]}>
          <View style={styles.tile}>
            <Photo uri={value.preview} fallbackIcon="certificate" label={s.join.proofPhoto} style={styles.tilePhoto} />
            {value.state === 'uploading' ? (
              <View style={styles.veil}>
                <ActivityIndicator color={colors.onScrim} />
              </View>
            ) : null}
          </View>
          <View style={styles.flexGap}>
            <Txt role="bodyStrong" accessibilityLiveRegion="polite">
              {value.state === 'uploading' ? s.join.uploading : value.state === 'error' ? s.join.uploadFailed : s.join.proofAdded}
            </Txt>
            <View style={[styles.proofButtons, { flexDirection: row }]}>
              {value.state === 'error' ? (
                <Button label={s.join.tryAgain} onPress={() => retry(value)} variant="tonal" compact />
              ) : (
                <Button label={s.join.changeProof} onPress={() => void pick(1)} variant="tonal" compact />
              )}
              <Button label={s.join.removeProof} onPress={() => onChange(null)} variant="outline" compact />
            </View>
          </View>
        </View>
      )}
      {privacy}
      {message ? <Notice tone={problem === 'failed' ? 'error' : 'info'}>{message}</Notice> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  flexGap: {
    flex: 1,
    minWidth: 0,
    gap: space.xs,
  },
  group: {
    gap: space.md,
  },
  tiles: {
    flexWrap: 'wrap',
    gap: space.sm,
  },
  tile: {
    width: size.photoTile,
    height: size.photoTile,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tilePhoto: {
    width: size.photoTile,
    height: size.photoTile,
    borderRadius: radius.md,
  },
  // Over a photo that is uploading or failed: the scrim, with white marks on it.
  veil: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    padding: space.xs,
    backgroundColor: c.scrim,
  },
  coverTag: {
    position: 'absolute',
    bottom: space.xs,
    alignSelf: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: c.scrim,
  },
  // 36 dp to the eye; hitSlop brings it to 48.
  remove: {
    position: 'absolute',
    top: space.xs,
    width: size.segment,
    height: size.segment,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.scrim,
  },
  add: {
    backgroundColor: c.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    padding: space.xs,
  },
  addPressed: {
    backgroundColor: c.surfaceTintStrong,
  },
  disabled: {
    opacity: opacity.disabled,
  },
  dim: {
    opacity: opacity.pressed,
  },
  proofEmpty: {
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceTint,
    overflow: 'hidden',
  },
  proofIcon: {
    width: size.tileIconBox,
    height: size.tileIconBox,
    borderRadius: radius.md,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofChosen: {
    alignItems: 'center',
    gap: space.lg,
  },
  proofButtons: {
    flexWrap: 'wrap',
    gap: space.sm,
  },
  privacy: {
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
}));
