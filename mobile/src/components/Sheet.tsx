import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { makeStyles, radius, size, space } from '@/theme';

import { IconButton } from './IconButton';
import { Txt } from './Txt';

interface Props {
  title: string;
  /** Read by screen readers on the close button and on the dimmed page behind. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A bottom sheet: the page ground with round top corners, rising over a dimmed
 * screen. It holds one small task (write a review, report a listing, share).
 * Back, the X and a tap on the dimmed part all close it. Render it only while
 * it is open; it fades in, since motion only marks the change of state.
 */
export function Sheet({ title, closeLabel, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const { row } = useI18n();
  const styles = useStyles();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* On Android the window itself shrinks above the keyboard; iOS needs the padding. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.frame}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.scrim]}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={[styles.head, { flexDirection: row }]}>
            <Txt role="headline" accessibilityRole="header" style={styles.title}>
              {title}
            </Txt>
            <IconButton icon={X} label={closeLabel} onPress={onClose} style={styles.close} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  frame: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: c.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: size.maxContent,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: c.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.sm,
  },
  handle: {
    alignSelf: 'center',
    width: size.sheetHandleW,
    height: size.sheetHandleH,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTintStrong,
  },
  head: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
  },
  // The title lines up with the content under it (16 from the edge, like the page).
  title: {
    flex: 1,
    paddingHorizontal: space.sm,
  },
  close: {
    backgroundColor: c.surfaceTint,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
  },
}));
