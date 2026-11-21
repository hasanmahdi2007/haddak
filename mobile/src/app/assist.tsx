import * as Speech from 'expo-speech';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Info,
  List,
  Mic,
  Pencil,
  Phone,
  Send,
  Siren,
  Square,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  type TextStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type ProviderDetail, type ProviderSummary, type Understood, type UnderstoodInput } from '@/api';
import { AssistCard } from '@/components/AssistCard';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { JarakMark } from '@/components/JarakMark';
import { Txt, useTypeScale } from '@/components/Txt';
import { useI18n } from '@/i18n';
import { useCategories } from '@/lib/categories';
import { EMERGENCY_NUMBERS } from '@/lib/emergency';
import { telUrl, whatsappUrl } from '@/lib/links';
import { parseRadius, radiusPhrase, widerRadius } from '@/lib/radius';
import {
  ASSIST_TEXT_MAX as TEXT_MAX,
  ASSIST_TEXT_MIN as TEXT_MIN,
  ASSIST_TOP as TOP,
  type Ask,
  type AssistPhase,
  useAssist,
} from '@/lib/useAssist';
import { useVoice, type VoiceProblem } from '@/lib/useVoice';
import { elevation, makeStyles, opacity, radius, size, space, type as typeLatin, useTheme } from '@/theme';

// Web only: the field shows focus itself, so the browser's ring is turned off.
const NO_FOCUS_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

export default function AssistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s, f, plural, row, rtl, textAlign, writingDirection, language, distance } = useI18n();
  const styles = useStyles();
  const typeScale = useTypeScale();
  const params = useLocalSearchParams<{ text?: string; listen?: string }>();
  const { byId } = useCategories();

  // A sentence tapped on Home arrives with the link and is asked at once.
  const [initial] = useState(() => (params.text ?? '').slice(0, TEXT_MAX).trim());
  const autoAsk = initial.length >= TEXT_MIN;
  const [text, setText] = useState(initial);
  // The question last sent, shown in the compact bar once there is an answer.
  const [asked, setAsked] = useState(initial);
  // After an answer the big field folds into one line; Edit opens it again.
  const [editing, setEditing] = useState(false);
  const { phase, details, run, ask, retry, fetchDetail } = useAssist(autoAsk);
  const [busy, setBusy] = useState<{ id: string; type: 'whatsapp' | 'call' } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  // "Speak" on Home opens this screen with listen=1: start listening at once, no keyboard.
  const [autoListen] = useState(() => params.listen === '1' && !autoAsk);

  /** Start a question from a tap: stop reading aloud, close the keyboard, show "Looking…". */
  function start(next: Ask) {
    Speech.stop();
    setSpeaking(false);
    setNotice(null);
    setEditing(false);
    Keyboard.dismiss();
    ask(next);
  }

  const send = (words = text) => {
    const trimmed = words.trim();
    if (trimmed.length < TEXT_MIN) return;
    setText(words);
    setAsked(trimmed);
    start({ kind: 'text', text: trimmed });
  };

  // Speaking: the words appear in the field as they are heard, and are sent when the person stops.
  const voice = useVoice({
    language,
    onPartial: setText,
    onFinal: (words) => send(words.slice(0, TEXT_MAX)),
  });

  function listen() {
    Speech.stop();
    setSpeaking(false);
    setNotice(null);
    Keyboard.dismiss();
    setText('');
    void voice.start();
  }

  // Once something is asked, the question is a one-line bar, unless the person is
  // changing it (Edit) or speaking (the heard words fill the big field).
  const compact = phase.status !== 'idle' && !editing && !voice.listening;

  function edit() {
    // A failed microphone round may have emptied the field: start from the last question.
    if (text.trim().length === 0) setText(asked);
    setEditing(true);
  }

  const listenStarted = useRef(false);
  useEffect(() => {
    if (!autoListen || !voice.available || listenStarted.current) return;
    listenStarted.current = true;
    listen();
    // Once, on arrival; `listen` is a plain function that changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoListen, voice.available]);

  const sendSettings = (understood: UnderstoodInput) => {
    const before = phase.status === 'done' ? phase : null;
    start({ kind: 'understood', understood, text: before?.text ?? text.trim(), draft: before?.draft ?? null });
  };

  // The sentence from Home (the hook already started in "Looking…"), asked once.
  const autoAsked = useRef(false);
  useEffect(() => {
    if (!autoAsk || autoAsked.current) return;
    autoAsked.current = true;
    void run({ kind: 'text', text: initial });
  }, [autoAsk, initial, run]);

  // Stop talking when the screen closes.
  useEffect(() => () => void Speech.stop(), []);

  async function contact(provider: ProviderSummary, type: 'whatsapp' | 'call', draft: string | null) {
    setNotice(null);
    let detail: ProviderDetail | undefined = details[provider.id];
    try {
      if (!detail) {
        setBusy({ id: provider.id, type });
        detail = await fetchDetail(provider.id);
      }
    } catch {
      setBusy(null);
      setNotice(s.assist.errorBody);
      return;
    }
    setBusy(null);
    // Some OpenStreetMap listings have no number: say so instead of opening nothing.
    const phone = detail.phone;
    if (!phone) {
      setNotice(s.provider.noPhone);
      return;
    }
    api.logContactEvent(provider.id, type).catch(() => undefined);
    const url =
      type === 'whatsapp'
        ? // The assistant's draft when there is one, otherwise the usual greeting.
          whatsappUrl(detail.whatsapp ?? phone, draft ?? s.provider.greeting)
        : telUrl(phone);
    try {
      await Linking.openURL(url);
    } catch {
      setNotice(type === 'whatsapp' ? s.provider.whatsappFailed : f(s.provider.callFailed, { phone }));
    }
  }

  async function callEmergency(number: string) {
    try {
      await Linking.openURL(telUrl(number));
    } catch {
      setNotice(f(s.provider.callFailed, { phone: number }));
    }
  }

  /** The full results screen with the same settings, where they can be changed. */
  function openResults(u: Understood) {
    const categories = [...byId.values()];
    const chosen = u.category_slugs
      .map((slug) => categories.find((c) => c.slug === slug))
      .filter((c) => c !== undefined);
    // Results shows one category: several children of one parent become the parent.
    const parents = new Set(chosen.map((c) => c.parent_id));
    const parentId = chosen.length > 1 && parents.size === 1 ? [...parents][0] : null;
    const categoryId = parentId ?? chosen[0]?.id;
    const q = u.q && u.q.trim().length >= TEXT_MIN ? u.q.trim().slice(0, 60) : undefined;
    router.push({
      pathname: '/results',
      params: {
        radius: String(u.radius_m),
        ...(categoryId !== undefined ? { category_id: String(categoryId) } : {}),
        ...(q ? { q } : {}),
        ...(u.max_price !== null && u.price_unit
          ? { max_price: String(u.max_price), price_unit: u.price_unit, price_currency: u.price_currency }
          : {}),
        ...(u.open_now ? { open_now: '1' } : {}),
        ...(u.sort !== 'best' ? { sort: u.sort } : {}),
        ...(u.place
          ? {
              lat: String(u.place.lat),
              lng: String(u.place.lng),
              place: language === 'ar' ? u.place.name_ar : u.place.name_en,
            }
          : {}),
      },
    });
  }

  function suggest(u: Understood | null) {
    const slug = u?.category_slugs[0];
    const category = slug ? [...byId.values()].find((c) => c.slug === slug) : undefined;
    router.push({ pathname: '/suggest', params: category ? { category_id: String(category.id) } : {} });
  }

  /** Reads the summary, any note, and the top three names with how far they are. */
  function readAloud(lines: string[]) {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const stop = () => setSpeaking(false);
    Speech.speak(lines.join('. '), {
      language: language === 'ar' ? 'ar' : 'en-US',
      rate: 0.9,
      onDone: stop,
      onStopped: stop,
      onError: stop,
    });
  }

  /** Why the microphone gave nothing back, in plain words. */
  function voiceProblemText(problem: VoiceProblem) {
    switch (problem) {
      case 'denied':
        return s.assist.voiceDenied;
      case 'blocked':
        return s.assist.voiceBlocked;
      case 'unheard':
        return s.assist.voiceUnheard;
      case 'network':
        return s.assist.voiceNetwork;
      default:
        return s.assist.voiceFailed;
    }
  }

  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const ForwardIcon = rtl ? ArrowLeft : ArrowRight;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const canSend = text.trim().length >= TEXT_MIN;
  const comma = language === 'ar' ? '، ' : ', ';
  /** A note in plain words: a microphone problem. */
  const note = (words: string) => (
    <View style={[styles.note, { flexDirection: row }]}>
      <Info color={colors.textMuted} size={size.icon} strokeWidth={size.stroke} />
      <Txt role="bodyLarge" style={styles.noteText}>
        {words}
      </Txt>
    </View>
  );

  /** One short muted line under the summary: the place was not found, or we looked further. */
  const quietNote = (words: string) => (
    <View key={words} style={[styles.quietNote, { flexDirection: row }]}>
      <Info color={colors.textMuted} size={size.iconSmall} strokeWidth={size.stroke} style={styles.quietIcon} />
      <Txt role="body" color="textMuted" style={styles.noteText}>
        {words}
      </Txt>
    </View>
  );

  /**
   * The summary ("Plumber · near you · 1 km") as one compact alice-blue row that opens the
   * full list (a round black arrow says so), with Read aloud as a small white disc at its
   * end when there is something to read.
   */
  const summaryRow = (u: Understood, summary: string, spoken: string[] | null) => (
    <View style={[styles.summary, { flexDirection: row }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={f(s.assist.summaryLabel, { summary })}
        onPress={() => openResults(u)}
        android_ripple={{ color: colors.accentSoft }}
        style={({ pressed }) => [styles.summaryTap, { flexDirection: row }, pressed ? styles.summaryPressed : null]}
      >
        <Txt role="title" color="onAccent" numberOfLines={2} style={styles.noteText}>
          {summary}
        </Txt>
        <View style={styles.summaryGo}>
          <ForwardIcon color={colors.onPrimary} size={size.iconSmall} strokeWidth={size.lineBold} />
        </View>
      </Pressable>
      {spoken ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speaking ? s.assist.stopReading : s.assist.readAloud}
          accessibilityState={{ selected: speaking }}
          onPress={() => readAloud(spoken)}
          android_ripple={{ color: colors.surfaceTintStrong, borderless: true }}
          style={({ pressed }) => [styles.readButton, pressed ? styles.readButtonPressed : null]}
        >
          {speaking ? (
            <Square color={colors.onPrimarySoft} size={size.icon} strokeWidth={size.lineBold} />
          ) : (
            <Volume2 color={colors.onPrimarySoft} size={size.icon} strokeWidth={size.lineBold} />
          )}
        </Pressable>
      ) : null}
    </View>
  );

  /** A question with big choices: clarify, or two places with one name. */
  const choices = (question: string, options: { key: string; label: string; onPress: () => void }[]) => (
    <View style={styles.block}>
      <Txt role="headline" accessibilityRole="header">
        {question}
      </Txt>
      <View style={styles.stack}>
        {options.map((option) => (
          <Button key={option.key} label={option.label} onPress={option.onPress} large />
        ))}
      </View>
    </View>
  );

  function answer(done: Extract<AssistPhase, { status: 'done' }>) {
    const { response, draft } = done;
    const u = response.understood;

    if (response.kind === 'emergency') {
      return (
        <View style={styles.emergency} accessibilityRole="alert">
          <View style={[styles.emergencyHead, { flexDirection: row }]}>
            <Siren color={colors.onDangerSoft} size={size.iconLarge} strokeWidth={size.lineBold} />
            <Txt role="headline" color="onDangerSoft" style={styles.noteText}>
              {s.assist.emergencyTitle}
            </Txt>
          </View>
          <Txt role="bodyLarge" color="onDangerSoft">
            {s.assist.emergencyBody}
          </Txt>
          <View style={styles.stack}>
            {EMERGENCY_NUMBERS.map(({ key, number }) => (
              <Button
                key={key}
                label={`${s.assist[key]}  ${number}`}
                accessibilityLabel={f(s.assist.emergencyCall, { name: s.assist[key], number })}
                icon={Phone}
                variant="danger"
                large
                onPress={() => void callEmergency(number)}
              />
            ))}
          </View>
        </View>
      );
    }

    if (response.kind === 'off_topic' || response.kind === 'unavailable') {
      // `unavailable` never gets here (it becomes a name search), but nothing is left blank.
      return (
        <View style={styles.stack}>
          <View style={styles.block}>
            <Txt role="bodyLargeStrong">{s.assist.offTopic}</Txt>
          </View>
        </View>
      );
    }

    if (response.kind === 'clarify' && response.question) {
      return choices(
        response.question.text,
        response.question.options.map((option, i) => ({
          key: String(i),
          label: option.label,
          onPress: () => sendSettings(option.understood),
        })),
      );
    }

    if (response.place_options && response.place_options.length > 0 && u) {
      const first = response.place_options[0];
      return choices(
        f(s.assist.placeQuestion, { place: language === 'ar' ? first.name_ar : first.name_en }),
        response.place_options.map((place) => ({
          key: place.slug,
          label: language === 'ar' ? `${place.name_ar}، ${place.district}` : `${place.name_en}, ${place.district}`,
          onPress: () => sendSettings({ ...u, place: { slug: place.slug } }),
        })),
      );
    }

    if (!u || !response.results) return null;

    const items = response.results.items;
    const total = response.results.total;
    const radiusM = parseRadius(u.radius_m);
    const where = radiusPhrase(s, radiusM);
    const notes = [
      response.place_unknown ? f(s.assist.placeUnknown, { place: response.place_unknown }) : null,
      response.widened && total > 0 ? f(s.assist.widened, { where }) : null,
    ].filter((line) => line !== null);
    const summary = response.summary ?? '';
    const top = items.slice(0, TOP);

    /** The summary with its notes tight under it, as one group. */
    const head = (spoken: string[] | null) => (
      <View style={styles.head}>
        {summaryRow(u, summary, spoken)}
        {notes.map(quietNote)}
      </View>
    );

    if (items.length === 0) {
      const wider = widerRadius(radiusM);
      return (
        <View style={styles.stack}>
          {head(null)}
          <View style={styles.block}>
            <Txt role="headline" accessibilityRole="header">
              {s.assist.emptyTitle}
            </Txt>
            <Txt role="bodyLarge" color="textMuted">
              {wider ? s.assist.emptyBody : s.assist.emptyCityBody}
            </Txt>
            <View style={styles.stack}>
              {wider ? (
                <Button
                  label={s.assist.searchWider}
                  accessibilityLabel={`${s.assist.searchWider}, ${radiusPhrase(s, wider)}`}
                  large
                  onPress={() => sendSettings({ ...u, radius_m: wider })}
                />
              ) : null}
              <Button
                label={s.assist.suggest}
                variant={wider ? 'tonal' : 'primary'}
                large
                onPress={() => suggest(u)}
              />
            </View>
          </View>
        </View>
      );
    }

    const spoken = [
      summary,
      ...notes,
      ...top.map((p) =>
        p.distance_m !== null ? `${p.name}${comma}${f(s.provider.away, { distance: distance(p.distance_m) })}` : p.name,
      ),
    ];

    return (
      <View style={styles.stack}>
        {head(spoken)}
        {notice ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Txt role="body" color="onDangerSoft">
              {notice}
            </Txt>
          </View>
        ) : null}
        {top.map((provider) => (
          <AssistCard
            key={provider.id}
            provider={provider}
            busy={busy?.id === provider.id ? busy.type : null}
            onOpen={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })}
            onWhatsApp={() => void contact(provider, 'whatsapp', draft)}
            onCall={() => void contact(provider, 'call', draft)}
          />
        ))}
        {total > TOP ? (
          <Button
            label={plural(s.assist.seeAll, total)}
            icon={List}
            variant="white"
            large
            onPress={() => openResults(u)}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={[styles.column, styles.bar, { flexDirection: row }]}>
        <IconButton icon={BackIcon} label={s.common.back} onPress={goBack} />
        <JarakMark style={styles.barMark} />
        <Txt role="headline" accessibilityRole="header" numberOfLines={1} style={styles.barTitle}>
          {s.assist.title}
        </Txt>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.huge }]}
      >
        <View style={[styles.column, styles.page]}>
          {compact ? (
            // After an answer: the question as one white line, with the microphone and Edit.
            <View style={[styles.askedBar, { flexDirection: row }]}>
              {/* Tapping the words also opens them; screen readers use the Edit button. */}
              <Pressable
                onPress={edit}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.askedTap}
              >
                <Txt role="bodyLarge" numberOfLines={1} content>
                  {asked}
                </Txt>
              </Pressable>
              {voice.available ? (
                <IconButton
                  icon={Mic}
                  label={s.assist.speak}
                  onPress={listen}
                  color={colors.onPrimarySoft}
                  style={styles.askedMic}
                />
              ) : null}
              <Button
                label={s.assist.edit}
                accessibilityLabel={f(s.assist.editLabel, { text: asked })}
                icon={Pencil}
                variant="tonal"
                compact
                onPress={edit}
              />
            </View>
          ) : (
            <>
            {/* The question: a big white field, then Speak and Send. */}
            <View style={[styles.field, voice.listening ? styles.fieldListening : null]}>
              {voice.listening ? (
                // While listening: a clear sign at the top of the field; the words fill in under it.
                <View style={[styles.listeningHead, { flexDirection: row }]} accessibilityLiveRegion="polite" accessible>
                  <View style={styles.listeningDisc}>
                    <Mic color={colors.onAccent} size={size.iconLarge} strokeWidth={size.lineBold} />
                  </View>
                  <View style={styles.noteText}>
                    <Txt role="headline">{s.assist.listening}</Txt>
                    <Txt role="bodyLarge" color="textMuted">
                      {s.assist.listeningBody}
                    </Txt>
                  </View>
                </View>
              ) : null}
              <View style={[styles.fieldTop, { flexDirection: row }]}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  editable={!voice.listening}
                  multiline
                  // On arrival with nothing asked, and when Edit opens the field again.
                  autoFocus={editing || (!autoAsk && !autoListen)}
                  maxLength={TEXT_MAX}
                  placeholder={s.assist.placeholder}
                  placeholderTextColor={colors.textSubtle}
                  accessibilityLabel={s.assist.inputLabel}
                  accessibilityHint={s.assist.hint}
                  // The keyboard's Enter key sends, the way people expect in a chat.
                  returnKeyType="send"
                  enterKeyHint="send"
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={() => send()}
                  selectionColor={colors.accentStrong}
                  textAlignVertical="top"
                  // Tall while nothing is asked yet; once there is an answer it shrinks, so the answer starts higher.
                  style={[
                    styles.input,
                    typeScale.input,
                    phase.status === 'idle' ? styles.inputTall : null,
                    NO_FOCUS_RING,
                    { textAlign, writingDirection },
                  ]}
                />
                {text.length > 0 && !voice.listening ? (
                  <IconButton icon={X} label={s.assist.clear} onPress={() => setText('')} color={colors.textMuted} />
                ) : null}
              </View>
            </View>
            {voice.listening ? (
              <Button label={s.assist.stopListening} icon={Square} large onPress={voice.stop} />
            ) : (
              <View style={[styles.actions, { flexDirection: row }]}>
                {/* Only in a build with the speech module: Expo Go and the web never show it. */}
                {voice.available ? (
                  <Button
                    label={s.assist.speak}
                    accessibilityHint={s.assist.speakHint}
                    icon={Mic}
                    variant="tonal"
                    large
                    disabled={phase.status === 'loading'}
                    onPress={listen}
                    style={styles.action}
                  />
                ) : null}
                <Button
                  label={s.assist.send}
                  accessibilityHint={canSend ? undefined : s.assist.sendHint}
                  icon={Send}
                  large
                  disabled={!canSend || phase.status === 'loading'}
                  onPress={() => send()}
                  style={styles.action}
                />
              </View>
            )}
            </>
          )}
          {voice.problem ? (
            <View style={styles.stack} accessibilityLiveRegion="polite">
              {note(voiceProblemText(voice.problem))}
              {voice.problem === 'blocked' ? (
                <Button
                  label={s.assist.openSettings}
                  variant="tonal"
                  large
                  onPress={() => {
                    voice.clearProblem();
                    Linking.openSettings().catch(() => undefined);
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {/* The answer. Screen readers hear it as it arrives. */}
          <View accessibilityLiveRegion="polite" style={styles.stack}>
            {phase.status === 'loading' ? (
              <View style={[styles.block, styles.looking, { flexDirection: row }]} accessible>
                <ActivityIndicator color={colors.primary} size="large" />
                <View style={styles.noteText}>
                  <Txt role="headline">{s.assist.looking}</Txt>
                  <Txt role="bodyLarge" color="textMuted">
                    {s.assist.lookingBody}
                  </Txt>
                </View>
              </View>
            ) : null}

            {phase.status === 'error' ? (
              <View style={styles.errorBlock} accessibilityRole="alert">
                <View style={[styles.emergencyHead, { flexDirection: row }]}>
                  <WifiOff color={colors.onDangerSoft} size={size.iconLarge} strokeWidth={size.stroke} />
                  <Txt role="headline" color="onDangerSoft" style={styles.noteText}>
                    {s.assist.errorTitle}
                  </Txt>
                </View>
                <Txt role="bodyLarge" color="onDangerSoft">
                  {phase.rateLimited ? s.assist.rateLimited : s.assist.errorBody}
                </Txt>
                {phase.rateLimited ? null : (
                  <Button
                    label={s.common.tryAgain}
                    large
                    onPress={() => {
                      Keyboard.dismiss();
                      retry();
                    }}
                  />
                )}
              </View>
            ) : null}

            {phase.status === 'done' ? answer(phase) : null}
          </View>
        </View>
      </ScrollView>
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
    paddingStart: space.xs,
    paddingEnd: space.lg,
    paddingVertical: space.xs,
  },
  // A little air between the vanilla Jarak AI mark and the name.
  barMark: {
    marginEnd: space.xs,
  },
  barTitle: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  page: {
    gap: space.md,
  },
  stack: {
    gap: space.md,
  },
  // The typing field: a white block, big type. Its edge turns ink while listening.
  field: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: size.lineBold,
    borderColor: c.surface,
    padding: space.md,
    gap: space.sm,
    boxShadow: elevation.card,
  },
  fieldListening: {
    borderColor: c.primary,
  },
  listeningHead: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
  },
  // An alice-blue disc with the microphone: the "listening" sign.
  listeningDisc: {
    width: size.buttonLarge,
    height: size.buttonLarge,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: space.md,
  },
  action: {
    flex: 1,
  },
  fieldTop: {
    alignItems: 'flex-start',
  },
  input: {
    ...typeLatin.input,
    flex: 1,
    minWidth: 0,
    minHeight: size.touch,
    color: c.text,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  inputTall: {
    minHeight: size.askInput,
  },
  // A white block for a question, a message or "Looking…".
  block: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    boxShadow: elevation.card,
  },
  looking: {
    alignItems: 'center',
    gap: space.lg,
  },
  note: {
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  noteText: {
    flex: 1,
    minWidth: 0,
  },
  // The question after an answer: one white pill line, with the microphone and Edit at its end.
  askedBar: {
    alignItems: 'center',
    gap: space.xs,
    minHeight: size.buttonLarge,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    paddingStart: space.lg,
    paddingEnd: space.xs,
    paddingVertical: space.xxs,
    boxShadow: elevation.card,
  },
  askedTap: {
    flex: 1,
    minWidth: 0,
    minHeight: size.touch,
    justifyContent: 'center',
  },
  askedMic: {
    backgroundColor: c.surfaceInset,
  },
  // The summary and its notes, kept tight together.
  head: {
    gap: space.sm,
  },
  // The summary: one alice-blue row that opens the full list, Read aloud at its end.
  summary: {
    alignItems: 'center',
    gap: space.xs,
    minHeight: size.buttonLarge,
    backgroundColor: c.accent,
    borderRadius: radius.lg,
    paddingStart: space.lg,
    paddingEnd: space.xs,
    paddingVertical: space.xs,
    overflow: 'hidden',
  },
  summaryTap: {
    flex: 1,
    minWidth: 0,
    minHeight: size.touch,
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
  },
  summaryPressed: {
    opacity: opacity.pressed,
  },
  // The round black "open" arrow of the founder's reference.
  summaryGo: {
    width: size.arrowDisc,
    height: size.arrowDisc,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readButton: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readButtonPressed: {
    backgroundColor: c.surfaceInset,
  },
  quietNote: {
    alignItems: 'flex-start',
    gap: space.xs + space.xxs,
    paddingHorizontal: space.sm,
  },
  // Lines the small icon up with the first line of 24 dp text.
  quietIcon: {
    marginTop: space.xs,
  },
  emergency: {
    backgroundColor: c.dangerSoft,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
  },
  emergencyHead: {
    alignItems: 'center',
    gap: space.sm,
  },
  errorBlock: {
    backgroundColor: c.dangerSoft,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
  },
  notice: {
    backgroundColor: c.dangerSoft,
    borderRadius: radius.md,
    padding: space.md,
  },
}));
