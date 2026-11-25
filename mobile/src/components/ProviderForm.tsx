import * as Location from 'expo-location';
import { LocateFixed } from 'lucide-react-native';
import { useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  api,
  ApiError,
  type Coordinates,
  type OwnProvider,
  type PriceCurrency,
  type PriceUnit,
  type ProviderCreateInput,
  type ProviderUpdateInput,
} from '@/api';
import { useI18n } from '@/i18n';
import type { Strings } from '@/i18n/en';
import { useCategories } from '@/lib/categories';
import { useLocation } from '@/lib/location';
import { cleanPhone, PHONE_EXAMPLE, PHONE_PATTERN, showPhone } from '@/lib/phone';
import { withTimeout } from '@/lib/timeout';
import { elevation, makeStyles, radius, size, space, useTheme } from '@/theme';

import { Button } from './Button';
import { CategoryPicker } from './CategoryPicker';
import { Field, Notice, useInputStyle } from './Field';
import { draftToHours, HoursEditor, hoursDraft, invalidDay, type HoursDraft } from './HoursEditor';
import { PhotoPicker, ProofPicker, savedImage, type PickedImage } from './PhotoPicker';
import { PinPicker } from './PinPicker';
import { SwitchRow } from './SwitchRow';
import { Txt } from './Txt';

/** Limits from docs/API.md (ProviderCreate). Photos: the API allows 10; the app keeps it to 5. */
const NAME_MAX = 100;
const AREA_MAX = 100;
const DESCRIPTION_MAX = 2000;
const PRICE_MAX = 100;
/** The structured price (docs/API.md): more than 0, up to 100,000,000. */
const AMOUNT_MAX = 100_000_000;
const PRICE_UNITS: PriceUnit[] = ['hour', 'visit', 'job', 'item', 'month'];
const CURRENCIES: PriceCurrency[] = ['USD', 'LBP'];
const PHOTO_MAX = 5;
const POSITION_TIMEOUT_MS = 10_000;

/** Where the pin starts when the phone gives no position: central Beirut. */
const BEIRUT: Coordinates = { lat: 33.8938, lng: 35.5018 };

type InputHost = ComponentRef<typeof TextInput>;
type Host = ComponentRef<typeof View> | InputHost;

interface Props {
  mode: 'create' | 'edit';
  /** The saved listing, when editing. */
  initial?: OwnProvider;
  /** Drawn at the top of the scrolling page (the alice-blue intro block when creating). */
  header?: ReactNode;
  onSaved: (own: OwnProvider) => void;
}

/** The request body from the form's values. Empty optional texts become null. */
interface Values {
  name: string;
  categoryId: number | null;
  description: string;
  price: string;
  /** The structured price, as typed ("15", "7.5"); empty when not given. */
  priceAmount: string;
  priceUnit: PriceUnit | null;
  priceCurrency: PriceCurrency;
  phone: string;
  whatsapp: string;
  area: string;
  pin: Coordinates;
  hoursOn: boolean;
  hours: HoursDraft;
  showCount: boolean;
  photos: PickedImage[];
  proof: PickedImage | null;
}

/** The typed amount as a number, or null when empty or not a number. Accepts "7,5" too. */
function parseAmount(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function toBody(v: Values): ProviderCreateInput {
  const amount = parseAmount(v.priceAmount);
  // Amount and unit go together, or both null (the API refuses one without the other).
  const priced = amount !== null && v.priceUnit !== null;
  return {
    name: v.name.trim(),
    category_id: v.categoryId ?? 0,
    description: v.description.trim(),
    price_text: v.price.trim() || null,
    price_amount: priced ? amount : null,
    price_unit: priced ? v.priceUnit : null,
    price_currency: v.priceCurrency,
    phone: cleanPhone(v.phone),
    // Empty means "same as my phone"; the backend then answers with the phone.
    whatsapp: v.whatsapp.trim() ? cleanPhone(v.whatsapp) : null,
    lat: v.pin.lat,
    lng: v.pin.lng,
    area_name: v.area.trim(),
    photos: v.photos.flatMap((photo) => (photo.url ? [photo.url] : [])),
    verification_doc_url: v.proof?.url ?? null,
    show_contact_count: v.showCount,
    opening_hours: v.hoursOn ? draftToHours(v.hours) : null,
  };
}

/** The form's starting values: empty for a new listing, the saved ones when editing. */
function startValues(initial: OwnProvider | undefined): Omit<Values, 'pin'> & { pin: Coordinates | null } {
  if (!initial) {
    return {
      name: '',
      categoryId: null,
      description: '',
      price: '',
      priceAmount: '',
      priceUnit: null,
      priceCurrency: 'USD',
      phone: '',
      whatsapp: '',
      area: '',
      pin: null,
      hoursOn: false,
      hours: hoursDraft(null),
      showCount: false,
      photos: [],
      proof: null,
    };
  }
  // The backend answers with the phone as WhatsApp when none was stored.
  const sameWhatsapp = !initial.whatsapp || initial.whatsapp === initial.phone;
  // A proof the founder declined (status back to unverified) is not shown as "added":
  // the owner is asked for a new one instead.
  const proofShown = initial.verification_doc_url && initial.status === 'pending' ? initial.verification_doc_url : null;
  return {
    name: initial.name,
    categoryId: initial.category.id,
    description: initial.description,
    price: initial.price_text ?? '',
    priceAmount: initial.price_amount != null ? String(initial.price_amount) : '',
    priceUnit: initial.price_unit ?? null,
    priceCurrency: initial.price_currency ?? 'USD',
    phone: showPhone(initial.phone),
    whatsapp: sameWhatsapp ? '' : showPhone(initial.whatsapp),
    area: initial.area_name,
    pin: { lat: initial.lat, lng: initial.lng },
    hoursOn: initial.opening_hours !== null,
    hours: hoursDraft(initial.opening_hours),
    showCount: initial.show_contact_count,
    photos: initial.photos.map(savedImage),
    proof: proofShown ? savedImage(proofShown) : null,
  };
}

/** Only the fields that changed, for PATCH. */
function changes(before: ProviderCreateInput, after: ProviderCreateInput): ProviderUpdateInput {
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof ProviderCreateInput)[]) {
    if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) diff[key] = after[key];
  }
  // The amount and the unit are checked together, so they are sent together.
  if ('price_amount' in diff || 'price_unit' in diff) {
    diff.price_amount = after.price_amount;
    diff.price_unit = after.price_unit;
  }
  return diff as ProviderUpdateInput;
}

function failureText(error: unknown, s: Strings, f: (t: string, v?: Record<string, string | number>) => string) {
  const e = s.business.errors;
  if (!(error instanceof ApiError)) return e.failed;
  switch (error.status) {
    case 0:
      return e.offline;
    case 401:
      return e.signedOut;
    case 409:
      return s.join.exists;
    case 400:
    case 422:
      return e.invalid;
    case 429:
      return error.retryAfterS ? f(e.rateLimitedFor, { n: error.retryAfterS }) : e.rateLimited;
    default:
      return e.failed;
  }
}

/**
 * POST /me/provider, sent once (never repeated by itself). When the answer is
 * lost (status 0: the listing may have been made after the phone gave up) or the
 * server says one exists (409), we ask GET /me/provider: if the user's listing is
 * there, that is a success, not an error to type everything again for.
 */
async function createOnce(body: ProviderCreateInput): Promise<OwnProvider> {
  try {
    return await api.createMyProvider(body);
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 0 && error.status !== 409)) throw error;
    try {
      return await api.getMyProvider();
    } catch {
      // Not there (404), or still no connection: report the first failure.
      throw error;
    }
  }
}

/**
 * The business form, used to create a listing (`join.tsx`) and to edit it
 * (`business-edit.tsx`). One white block per topic on the ghost-white ground:
 * what you do, how people reach you, where you are, opening hours, photos,
 * proof. The send button is docked under the page, above the keyboard.
 *
 * Errors stay hidden until the first try to send; after that they update while typing.
 */
export function ProviderForm({ mode, initial, header, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const { s, f, row } = useI18n();
  const styles = useStyles();
  const location = useLocation();
  const categories = useCategories();

  const [start] = useState(() => startValues(initial));
  const [name, setName] = useState(start.name);
  const [categoryId, setCategoryId] = useState(start.categoryId);
  const [description, setDescription] = useState(start.description);
  const [price, setPrice] = useState(start.price);
  const [priceAmount, setPriceAmount] = useState(start.priceAmount);
  const [priceUnit, setPriceUnit] = useState<PriceUnit | null>(start.priceUnit);
  const [priceCurrency, setPriceCurrency] = useState<PriceCurrency>(start.priceCurrency);
  const [phone, setPhone] = useState(start.phone);
  const [whatsapp, setWhatsapp] = useState(start.whatsapp);
  const [area, setArea] = useState(start.area);
  // Null until the owner moves the pin: until then it follows the phone's position.
  const [pinChoice, setPinChoice] = useState<Coordinates | null>(start.pin);
  const [hoursOn, setHoursOn] = useState(start.hoursOn);
  const [hours, setHours] = useState(start.hours);
  const [showCount, setShowCount] = useState(start.showCount);
  const [photos, setPhotos] = useState<PickedImage[]>(start.photos);
  const [proof, setProof] = useState<PickedImage | null>(start.proof);

  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  // Set at once on the first tap, so a second quick tap cannot send the form twice.
  const sendingRef = useRef(false);

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<ComponentRef<typeof View>>(null);
  const nameRef = useRef<InputHost>(null);
  const phoneRef = useRef<InputHost>(null);
  const whatsappRef = useRef<InputHost>(null);
  const areaRef = useRef<InputHost>(null);
  const amountRef = useRef<InputHost>(null);
  const categoryBox = useRef<ComponentRef<typeof View>>(null);
  const hoursBox = useRef<ComponentRef<typeof View>>(null);

  const pin = pinChoice ?? (location.status === 'located' ? location.coords : BEIRUT);
  const values: Values = {
    name,
    categoryId,
    description,
    price,
    priceAmount,
    priceUnit,
    priceCurrency,
    phone,
    whatsapp,
    area,
    pin,
    hoursOn,
    hours,
    showCount,
    photos,
    proof,
  };
  // What "no change" looks like when editing: the saved listing turned into a body the same way.
  const [before] = useState(() => (start.pin ? toBody({ ...start, pin: start.pin }) : null));

  // ----- Checks -----
  const example = PHONE_EXAMPLE;
  function amountProblem(): string | null {
    const typed = priceAmount.trim().length > 0;
    if (!typed) return priceUnit !== null ? s.join.priceAmountRequired : null;
    const amount = parseAmount(priceAmount);
    if (amount === null || amount <= 0 || amount > AMOUNT_MAX) return s.join.priceAmountInvalid;
    return priceUnit === null ? s.join.priceUnitRequired : null;
  }
  const problems = {
    category: categoryId === null ? s.join.categoryRequired : null,
    name: name.trim().length === 0 ? s.join.nameRequired : null,
    phone:
      phone.trim().length === 0
        ? s.join.phoneRequired
        : !PHONE_PATTERN.test(cleanPhone(phone))
          ? f(s.join.phoneInvalid, { example })
          : null,
    whatsapp:
      whatsapp.trim().length > 0 && !PHONE_PATTERN.test(cleanPhone(whatsapp))
        ? f(s.join.whatsappInvalid, { example })
        : null,
    area: area.trim().length === 0 ? s.join.areaRequired : null,
    priceAmount: amountProblem(),
  };
  const wrongDay = hoursOn ? invalidDay(hours) : null;
  const anyProblem = Object.values(problems).some(Boolean) || wrongDay !== null;
  const shown = (problem: string | null) => (showErrors ? problem : null);
  const uploading = photos.some((p) => p.state === 'uploading') || proof?.state === 'uploading';
  const notUploaded = photos.some((p) => p.state === 'error') || proof?.state === 'error';

  // ----- Keeping the field in view -----
  // Brings a field near the top of the page, clear of the keyboard. The short
  // wait lets the keyboard finish opening (and the page shrink) first.
  const reveal = (node: Host | null) => {
    setTimeout(() => {
      const content = contentRef.current;
      if (!node || !content) return;
      node.measureLayout(content, (_x, y) =>
        scrollRef.current?.scrollTo({ y: Math.max(0, y - space.huge), animated: true }),
      );
    }, 250);
  };

  // ----- Location -----
  const locateMe = async () => {
    setLocating(true);
    setLocateFailed(false);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) throw new Error('denied');
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        POSITION_TIMEOUT_MS,
      );
      setPinChoice({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      setLocateFailed(true);
      AccessibilityInfo.announceForAccessibility(s.join.locationFailed);
    } finally {
      setLocating(false);
    }
  };

  // ----- Sending -----
  const submit = async () => {
    const first =
      (problems.category && 'category') ||
      (problems.name && 'name') ||
      (problems.priceAmount && 'priceAmount') ||
      (problems.phone && 'phone') ||
      (problems.whatsapp && 'whatsapp') ||
      (problems.area && 'area') ||
      (wrongDay && 'hours') ||
      null;
    if (first) {
      setShowErrors(true);
      setFailure(s.join.fixErrors);
      AccessibilityInfo.announceForAccessibility(s.join.fixErrors);
      // Put the cursor in the first wrong field, or scroll to it.
      if (first === 'name') nameRef.current?.focus();
      else if (first === 'priceAmount') amountRef.current?.focus();
      else if (first === 'phone') phoneRef.current?.focus();
      else if (first === 'whatsapp') whatsappRef.current?.focus();
      else if (first === 'area') areaRef.current?.focus();
      else reveal(first === 'category' ? categoryBox.current : hoursBox.current);
      return;
    }
    if (uploading) {
      setFailure(s.join.waitUploads);
      return;
    }
    if (notUploaded) {
      setFailure(s.join.photoNotUploaded);
      return;
    }

    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setFailure(null);
    try {
      const body = toBody(values);
      let own: OwnProvider;
      if (mode === 'create') {
        own = await createOnce(body);
      } else {
        const diff = before ? changes(before, body) : body;
        // Verified: proof no longer matters, so it is never sent.
        if (initial?.status === 'verified') delete diff.verification_doc_url;
        own = Object.keys(diff).length > 0 || !initial ? await api.updateMyProvider(diff) : initial;
      }
      onSaved(own);
    } catch (error) {
      const text = failureText(error, s, f);
      setFailure(text);
      AccessibilityInfo.announceForAccessibility(text);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const chosenCategory = categoryId !== null ? categories.byId.get(categoryId) : undefined;
  const proofNotice =
    initial?.status === 'pending'
      ? s.join.proofPending
      : initial?.status === 'unverified' && initial.verification_doc_url && proof === null
        ? s.join.proofDeclined
        : null;

  return (
    // Shrinks the page by the keyboard's height, so the button rides above the keyboard.
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled">
        {/* The only child of the scrolling page, so a position measured inside it is a scroll position. */}
        <View ref={contentRef} collapsable={false} style={[styles.column, styles.page]}>
          {header}

          <Section title={s.join.sectionAbout}>
            <View ref={categoryBox} collapsable={false}>
              <Field label={s.join.category} error={shown(problems.category)}>
                <CategoryPicker
                  label={s.join.category}
                  value={categoryId}
                  onChange={setCategoryId}
                  error={shown(problems.category)}
                  onSearchFocus={() => reveal(categoryBox.current)}
                />
              </Field>
            </View>
            <Field label={s.join.name} aside={`${name.length} / ${NAME_MAX}`} error={shown(problems.name)}>
              <FormInput
                inputRef={nameRef}
                onReveal={reveal}
                value={name}
                onChangeText={setName}
                placeholder={s.join.namePlaceholder}
                accessibilityLabel={s.join.name}
                error={shown(problems.name)}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={NAME_MAX}
              />
            </Field>
            <Field label={s.join.description} optional aside={`${description.length} / ${DESCRIPTION_MAX}`}>
              <FormInput
                onReveal={reveal}
                value={description}
                onChangeText={setDescription}
                placeholder={s.join.descriptionPlaceholder}
                accessibilityLabel={s.join.description}
                multiline
                maxLength={DESCRIPTION_MAX}
              />
            </Field>
            <Field label={s.join.price} optional hint={s.join.priceHint}>
              <FormInput
                onReveal={reveal}
                value={price}
                onChangeText={setPrice}
                placeholder={s.join.pricePlaceholder}
                accessibilityLabel={s.join.price}
                accessibilityHint={s.join.priceHint}
                maxLength={PRICE_MAX}
              />
            </Field>
            {/* The structured price: what the price filter and "Cheapest first" use. */}
            <Field
              label={s.join.priceAmount}
              optional
              hint={s.join.priceAmountHint}
              error={shown(problems.priceAmount)}
            >
              <View style={[styles.amountRow, { flexDirection: row }]}>
                <View style={styles.flex}>
                  <FormInput
                    inputRef={amountRef}
                    onReveal={reveal}
                    value={priceAmount}
                    onChangeText={setPriceAmount}
                    placeholder="15"
                    accessibilityLabel={s.join.priceAmount}
                    accessibilityHint={s.join.priceAmountHint}
                    error={shown(problems.priceAmount)}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    maxLength={12}
                    ltr
                  />
                </View>
                <ChipGroup
                  label={s.join.priceCurrency}
                  options={CURRENCIES}
                  value={priceCurrency}
                  onChange={(next) => next && setPriceCurrency(next)}
                  text={(currency) => (currency === 'USD' ? s.join.currencyUsd : s.join.currencyLbp)}
                  style={styles.currency}
                />
              </View>
              <ChipGroup
                label={s.join.priceUnit}
                options={PRICE_UNITS}
                value={priceUnit}
                // Tapping the chosen unit again clears it.
                onChange={setPriceUnit}
                clearable
                text={(unit) => s.join.priceUnits[unit]}
              />
            </Field>
          </Section>

          <Section title={s.join.sectionContact}>
            <Field label={s.join.phone} hint={f(s.join.phoneHint, { example })} error={shown(problems.phone)}>
              <FormInput
                inputRef={phoneRef}
                onReveal={reveal}
                value={phone}
                onChangeText={setPhone}
                placeholder="+961 70 123 456"
                accessibilityLabel={s.join.phone}
                error={shown(problems.phone)}
                keyboardType="phone-pad"
                inputMode="tel"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={24}
                ltr
              />
            </Field>
            <Field label={s.join.whatsapp} optional hint={s.join.whatsappHint} error={shown(problems.whatsapp)}>
              <FormInput
                inputRef={whatsappRef}
                onReveal={reveal}
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="+961 70 123 456"
                accessibilityLabel={s.join.whatsapp}
                accessibilityHint={s.join.whatsappHint}
                error={shown(problems.whatsapp)}
                keyboardType="phone-pad"
                inputMode="tel"
                maxLength={24}
                ltr
              />
            </Field>
            <SwitchRow label={s.join.showCount} hint={s.join.showCountHint} value={showCount} onChange={setShowCount} />
          </Section>

          <Section title={s.join.sectionPlace}>
            <Field label={s.join.area} hint={s.join.areaHint} error={shown(problems.area)}>
              <FormInput
                inputRef={areaRef}
                onReveal={reveal}
                value={area}
                onChangeText={setArea}
                placeholder={s.join.areaPlaceholder}
                accessibilityLabel={s.join.area}
                error={shown(problems.area)}
                autoCapitalize="words"
                maxLength={AREA_MAX}
              />
            </Field>
            <Field label={s.join.pinTitle} hint={s.join.pinHint}>
              <PinPicker value={pin} onChange={setPinChoice} />
            </Field>
            <Button
              label={locating ? s.join.locating : s.join.useMyLocation}
              icon={LocateFixed}
              variant="tonal"
              loading={locating}
              onPress={() => void locateMe()}
            />
            {locateFailed ? <Notice tone="info">{s.join.locationFailed}</Notice> : null}
          </Section>

          <Section title={s.join.sectionHours}>
            <SwitchRow label={s.join.hoursToggle} hint={s.join.hoursToggleHint} value={hoursOn} onChange={setHoursOn} />
            {hoursOn ? (
              <View ref={hoursBox} collapsable={false}>
                <HoursEditor value={hours} onChange={setHours} errorDay={showErrors ? wrongDay : null} onFieldFocus={reveal} />
              </View>
            ) : null}
          </Section>

          <Section title={s.join.sectionPhotos} note={s.join.photosNote}>
            <PhotoPicker
              value={photos}
              onChange={setPhotos}
              max={PHOTO_MAX}
              fallbackIcon={chosenCategory?.icon ?? 'store'}
            />
          </Section>

          <Section title={s.join.sectionProof} note={s.join.proofNote}>
            {proofNotice ? <Notice tone="info">{proofNotice}</Notice> : null}
            <ProofPicker value={proof} onChange={setProof} verified={initial?.status === 'verified'} />
          </Section>
        </View>
      </ScrollView>

      {/* Outside the scrolling page, so the button is always on screen, above the keyboard too. */}
      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.column, styles.dockInner]}>
          {/* "Some answers need a fix" goes away by itself once they are fixed. */}
          {failure && !(failure === s.join.fixErrors && !anyProblem) ? <Notice tone="error">{failure}</Notice> : null}
          <View style={{ flexDirection: row }}>
            <Button
              label={mode === 'create' ? s.join.submit : s.join.save}
              onPress={() => void submit()}
              loading={sending}
              style={styles.flex}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** A white block on the ghost-white ground: a title, an optional one-line note, then its fields. */
function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Txt role="headline" accessibilityRole="header">
          {title}
        </Txt>
        {note ? (
          <Txt role="label" color="textMuted">
            {note}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

interface ChipGroupProps<T extends string> {
  /** Read by screen readers for the whole group. */
  label: string;
  options: T[];
  value: T | null;
  onChange: (next: T | null) => void;
  text: (option: T) => string;
  /** Tapping the chosen chip again un-chooses it (gives null). */
  clearable?: boolean;
  style?: object;
}

/**
 * One choice from a few, as pill chips (like the distance chips): outlined when
 * not chosen, solid black with white words when chosen. 36 dp to the eye, 48 dp
 * to the finger through hitSlop. Wraps to a second line on a narrow phone.
 */
function ChipGroup<T extends string>({ label, options, value, onChange, text, clearable, style }: ChipGroupProps<T>) {
  const { colors } = useTheme();
  const { row } = useI18n();
  const styles = useStyles();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.chips, { flexDirection: row }, style]}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(selected && clearable ? null : option)}
            hitSlop={{ top: size.segmentSlop, bottom: size.segmentSlop }}
            android_ripple={{ color: colors.surfaceTint }}
            style={({ pressed }) => [
              styles.chip,
              selected ? styles.chipSelected : null,
              pressed && !selected ? styles.chipPressed : null,
            ]}
          >
            <Txt role="label" color={selected ? 'onPrimary' : 'text'} numberOfLines={1}>
              {text(option)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

interface FormInputProps extends Omit<TextInputProps, 'style'> {
  error?: string | null;
  /** Phone numbers read left to right in Arabic too. */
  ltr?: boolean;
  inputRef?: RefObject<InputHost | null>;
  onReveal: (node: InputHost | null) => void;
}

/** A grey pill field (a block when multiline) that keeps itself above the keyboard when focused. */
function FormInput({ error, ltr, inputRef, onReveal, multiline, ...rest }: FormInputProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const inputStyle = useInputStyle();
  const [focused, setFocused] = useState(false);
  const ownRef = useRef<InputHost>(null);
  const ref = inputRef ?? ownRef;
  return (
    <TextInput
      ref={ref}
      {...rest}
      multiline={multiline}
      onFocus={() => {
        setFocused(true);
        onReveal(ref.current);
      }}
      onBlur={() => setFocused(false)}
      placeholderTextColor={colors.textSubtle}
      selectionColor={colors.primary}
      accessibilityHint={error ?? rest.accessibilityHint}
      aria-invalid={error ? true : undefined}
      style={[inputStyle(focused, error, multiline), ltr ? styles.ltr : null]}
    />
  );
}

const useStyles = makeStyles((c) => ({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  column: {
    width: '100%',
    maxWidth: size.maxContent,
    alignSelf: 'center',
  },
  page: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  section: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xl,
    boxShadow: elevation.card,
  },
  sectionHead: {
    gap: space.xxs,
    paddingHorizontal: space.xs,
  },
  ltr: {
    writingDirection: 'ltr',
  },
  amountRow: {
    alignItems: 'center',
    gap: space.sm,
  },
  currency: {
    flexWrap: 'nowrap',
  },
  chips: {
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    height: size.segment,
    minWidth: size.touch,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipPressed: {
    backgroundColor: c.surfaceInset,
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
