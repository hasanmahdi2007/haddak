/**
 * Haddak design tokens. This file mirrors DESIGN.md; change them together.
 * Screens and components never use a raw colour or size: they read from here.
 */

export interface ColorTokens {
  /** Page ground. */
  background: string;
  /** White: every card, tile and block that sits on the ground (with `elevation.card`). */
  surface: string;
  /** Faint neutral inset inside a white card: the facts strip, stat tiles, today's hours. */
  surfaceInset: string;
  /** Soft grey: cards, tiles, fields, control tracks. */
  surfaceTint: string;
  /** Stronger grey: pressed surfaces, skeleton blocks, the "Not verified" pill. */
  surfaceTintStrong: string;

  /** Ink: text, primary buttons and the selected state. (In the dark theme it flips to near white.) */
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Text and icons that sit on a grey surface as a quiet action. */
  onPrimarySoft: string;
  /** Pale purple well behind a primary icon: category tiles, section icons. */
  primarySoft: string;

  /** Mint: the trust colour. Verified, "Open now", positive marks. Only ever a fill, with `onMint` on it. */
  mint: string;
  onMint: string;

  /** Soft lavender: the accent. Featured, the sponsored card, intro blocks. Only ever a fill, with `onAccent` on it. */
  accent: string;
  accentSoft: string;
  onAccent: string;
  /** Deeper purple for lines that must be seen on a map: the search circle. */
  accentStrong: string;
  /** See-through purple: the inside of the search circle. */
  accentWash: string;

  /**
   * "Haddak Tangerine", the signature. It marks Haddak's special moments only:
   * the Jarak AI mark, Sponsored, the offer figure, "Available now", the story ring.
   * Always a fill or an icon colour, never body text on white (it is 2.6:1 there).
   */
  signature: string;
  /** A pale tangerine wash for a background behind the signature. */
  signatureSoft: string;
  /** Dark ink for words and icons on a `signature` fill (AA on it). */
  onSignature: string;

  /** The soft lavender block at the top of Home (a lighter ink in the dark theme, so it still reads as a block). */
  hero: string;
  onHero: string;
  onHeroMuted: string;
  /** See-through white for quiet controls inside the hero block (location, search by name). */
  heroControl: string;

  text: string;
  textMuted: string;
  /** Captions and quiet icons. */
  textSubtle: string;

  /** Dividers and muted fills. */
  border: string;
  /** Hairlines inside a white card (between the facts, between reviews). */
  divider: string;
  /** Control boundaries (3:1 against the ground). */
  outline: string;

  /** Rating stars. */
  rating: string;

  /** Dark green for the ring of the "Open now" dot, where mint alone would be too faint. */
  success: string;

  /** Errors only, and the emergency numbers in the assistant. */
  danger: string;
  dangerPressed: string;
  /** Text on a solid `danger` fill (the emergency Call buttons). */
  onDanger: string;
  dangerSoft: string;
  onDangerSoft: string;

  /** WhatsApp's own green, used only on the WhatsApp action. */
  whatsapp: string;
  whatsappPressed: string;
  onWhatsapp: string;

  /** Behind controls that sit on photos. */
  scrim: string;
  onScrim: string;
  /** The soft shadow under the one thing that floats: the card docked over the map. */
  shadow: string;

  /** The share sticker: pure white paper and dark ink in both themes, so a printed or
   *  shown QR code always scans (dark on light, never inverted). */
  qrPaper: string;
  qrInk: string;
}

/**
 * Light theme: a cool near-white ground, white cards, neutral grey fields, a deep purple for
 * actions, mint for trust, soft lavender for the Home block and paid marks, tangerine as the signature.
 * Contrast (checked 2026-11-17): text 11:1 or more on every fill; textMuted 5.2:1 and
 * textSubtle 5.0:1 on the strongest grey, 4.6:1 or more on lavender; white on primary 6:1;
 * onSignature on signature 6.8:1; outline 3.2:1 or more on every grey.
 */
export const lightColors: ColorTokens = {
  background: '#F6F5FA',
  surface: '#FFFFFF',
  surfaceInset: '#F2F1F7',
  surfaceTint: '#ECEBF2',
  surfaceTintStrong: '#DEDCE8',

  primary: '#5F52C7',
  primaryPressed: '#4D41AE',
  onPrimary: '#FFFFFF',
  onPrimarySoft: '#1B1C2F',
  primarySoft: '#ECE9FB',

  mint: '#B4EEBE',
  onMint: '#1B1C2F',

  accent: '#D8D0FA',
  accentSoft: '#E4E0F5',
  onAccent: '#1B1C2F',
  accentStrong: '#5F52C7',
  accentWash: 'rgba(95, 82, 199, 0.12)',

  signature: '#FF7A45',
  signatureSoft: '#FFE8DC',
  onSignature: '#2A1306',

  hero: '#E6E0FB',
  onHero: '#1B1C2F',
  onHeroMuted: '#44465A',
  heroControl: 'rgba(255, 255, 255, 0.72)',

  text: '#1B1C2F',
  textMuted: '#55576A',
  textSubtle: '#585A6E',

  border: '#DEDCE8',
  divider: '#ECEBF2',
  outline: '#7A788F',

  rating: '#B97A00',

  success: '#1F7A3A',

  danger: '#B3261E',
  dangerPressed: '#931F18',
  onDanger: '#FFFFFF',
  dangerSoft: '#FBE4E1',
  onDangerSoft: '#7A1410',

  whatsapp: '#25D366',
  whatsappPressed: '#1EB958',
  onWhatsapp: '#062E17',

  scrim: 'rgba(27, 28, 47, 0.72)',
  onScrim: '#FFFFFF',
  shadow: 'rgba(27, 28, 47, 0.20)',

  qrPaper: '#FFFFFF',
  qrInk: '#1B1C2F',
};

/** Dark theme: ink ground, lighter ink blocks, the same mint and lavender (still with dark text on them). */
export const darkColors: ColorTokens = {
  background: '#12131F',
  surface: '#2A2C44',
  surfaceInset: '#232539',
  surfaceTint: '#1D1E32',
  surfaceTintStrong: '#3A3C57',

  primary: '#FAFEFF',
  primaryPressed: '#D0D2CF',
  onPrimary: '#1B1C2F',
  onPrimarySoft: '#FAFEFF',
  primarySoft: '#35325A',

  mint: '#A4F5A6',
  onMint: '#1B1C2F',

  accent: '#B2A1FF',
  accentSoft: '#C0C4FF',
  onAccent: '#1B1C2F',
  accentStrong: '#B2A1FF',
  accentWash: 'rgba(178, 161, 255, 0.20)',

  signature: '#FF7A45',
  signatureSoft: '#4A2A1C',
  onSignature: '#2A1306',

  hero: '#2A2C44',
  onHero: '#FFFFFF',
  onHeroMuted: '#C9CBDA',
  heroControl: 'rgba(255, 255, 255, 0.10)',

  text: '#F3F5F4',
  textMuted: '#BBBDCB',
  textSubtle: '#9C9EB0',

  border: '#34364D',
  divider: '#34364D',
  outline: '#7F8198',

  rating: '#F2BE4A',

  success: '#1F7A3A',

  danger: '#FFB4AB',
  dangerPressed: '#FF8A7E',
  onDanger: '#3B0906',
  dangerSoft: '#5C1612',
  onDangerSoft: '#FFDAD5',

  whatsapp: '#25D366',
  whatsappPressed: '#1EB958',
  onWhatsapp: '#062E17',

  scrim: 'rgba(10, 11, 20, 0.72)',
  onScrim: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.50)',

  qrPaper: '#FFFFFF',
  qrInk: '#1B1C2F',
};

/** Font family names as loaded in src/theme/fonts.ts. */
export const fonts = {
  /** Beiruti: titles. */
  title: 'Beiruti_700Bold',
  titleMedium: 'Beiruti_600SemiBold',
  /** Readex Pro: text and controls. */
  body: 'ReadexPro_400Regular',
  bodyMedium: 'ReadexPro_500Medium',
  bodyStrong: 'ReadexPro_600SemiBold',
} as const;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

/** Type roles. Sizes are scalable (sp on Android): never pass allowFontScaling={false}. */
export const type = {
  /** The question on Home. */
  display: { fontFamily: fonts.title, fontSize: 30, lineHeight: 38 },
  /** The biggest words: a short update in the story viewer, the discount figure of an offer. */
  poster: { fontFamily: fonts.title, fontSize: 38, lineHeight: 48 },
  /** Screen and section titles. */
  headline: { fontFamily: fonts.title, fontSize: 22, lineHeight: 30 },
  /** Card names, titles inside a card. */
  title: { fontFamily: fonts.titleMedium, fontSize: 18, lineHeight: 26 },
  /** Reading text. */
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 24 },
  /** Buttons and chips. */
  action: { fontFamily: fonts.bodyStrong, fontSize: 15, lineHeight: 22 },
  /** Facts on cards: rating, distance, price. */
  data: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
  /** Supporting lines, tile labels. */
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 20 },
  /** Smallest text: badge labels, dates. */
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  /**
   * The assistant is read by people who rarely use a phone, so its reading text,
   * buttons and typing field are a step bigger than the rest of the app.
   */
  bodyLarge: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26 },
  bodyLargeStrong: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 26 },
  actionLarge: { fontFamily: fonts.bodyStrong, fontSize: 17, lineHeight: 24 },
  /** What the user types to the assistant. */
  input: { fontFamily: fonts.body, fontSize: 20, lineHeight: 30 },
} as const satisfies Record<string, TypeStyle>;

export type TypeRole = keyof typeof type;

/** 4-point spacing scale. */
export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  /** Small tags. */
  sm: 8,
  /** Thumbnails, the icon well on a tile, insets inside a card. */
  md: 12,
  /** Tiles, cards, fact blocks. */
  lg: 20,
  /** The ink block on Home and the top corners of the profile sheet. */
  sheet: 28,
  /** Buttons, fields, chips, segmented controls. */
  pill: 999,
} as const;

/** Fixed sizes. */
export const size = {
  /** Minimum touch target (Material: 48 dp). */
  touch: 48,
  /** Icon in an empty or error state, and the disc behind it. */
  stateIcon: 36,
  stateDisc: 88,
  /** Widest a centred message runs. */
  measure: 340,
  /** Primary buttons. */
  button: 52,
  /** The assistant's main actions (Send, WhatsApp, Call, the example chips): bigger for unsure hands. */
  buttonLarge: 56,
  /** The "Ask Haddak" entry on Home. */
  askEntry: 72,
  /** Least height of the assistant's typing field (about three lines). */
  askInput: 132,
  icon: 20,
  iconSmall: 16,
  iconLarge: 24,
  /** Icon on a category tile. */
  tileIcon: 28,
  /** Category tile minimum height. */
  tile: 104,
  /** The pale purple well behind a tile icon. */
  tileIconBox: 44,
  /** The mint "you are here" disc in the location line. */
  pin: 28,
  /** The tangerine square with a sparkle that marks Jarak AI (Home entry, the assistant's bar). */
  jarakMark: 28,
  /** Thumbnail on a provider card. */
  thumb: 84,
  /** Visible height of a compact control: a segment, a filter chip (touch target is still 48 through hitSlop). */
  segment: 36,
  /** How much hitSlop a compact control needs above and below to reach 48 dp. */
  segmentSlop: 6,
  /** Height of a badge pill (Verified, Not verified, Featured). */
  badge: 24,
  /** Small round marks: the tick on a chosen tile, the disc in a map pin. */
  badgeDisc: 22,
  /** The round mark in the verification block on a profile. */
  trustDisc: 40,
  strokeHeavy: 3.5,
  hairline: 1,
  /** Border weights. */
  lineMid: 1.5,
  lineBold: 2,
  /** Stroke for line icons, and for the small check marks. */
  stroke: 1.75,
  strokeBold: 2.75,
  /** Gallery height as a share of its width. */
  galleryRatio: 0.72,
  /** The same, when the provider has no photos. */
  galleryRatioEmpty: 0.46,
  /** How far the profile sheet rises over the photo. */
  sheetOverlap: 28,
  /** Stars in a review. */
  star: 14,
  /** Map pins: the round mark inside the name label, normal and selected, and the pointer under it. */
  mapPinDisc: 18,
  mapPinDiscSelected: 22,
  mapPinTip: 10,
  /** Longest name a map pin shows before it is cut with an ellipsis. */
  mapPinChars: 18,
  /** A pin with no room for its name: the round mark alone, and the box around it that takes the tap. */
  mapDot: 22,
  mapDotBox: 32,
  /** The small switch inside the "Verified only" filter: its track and the round thumb. */
  switchTrackW: 36,
  switchTrackH: 22,
  switchThumb: 16,
  /** The "search position" dot on the map. */
  mapHere: 20,
  /** The least height the map may ever have. */
  mapMin: 280,
  /** Photo on the card docked over the map. */
  dockThumb: 64,
  /** A provider in the "Updates nearby" row: the ringed photo, and the width its name may take. */
  storyBubble: 68,
  storyBubbleSlot: 80,
  /** The ring that says "this provider posted an update", and the gap between it and the photo. */
  ringLine: 2.5,
  ringGap: 3,
  /** The small photo beside a name: the story viewer's header, the ringed photo on a profile. */
  avatar: 44,
  avatarLarge: 60,
  /** Progress segments at the top of the story viewer. */
  storyBar: 4,
  /** The tangerine block that carries an offer's discount figure. */
  offerFigure: 92,
  /** Widest the content column grows on tablets and web. */
  maxContent: 560,
  /** A star in the "rate this provider" picker (each sits in a 48 dp target). */
  starPick: 32,
  /** The QR code on the share sticker, and the white margin around it (the scanner's quiet zone). */
  qr: 196,
  qrQuietZone: 16,
  /** The printable poster: its height as a share of its width (A4 is 297 / 210), and
   *  the QR code's width as a share of the poster's width. */
  posterRatio: 1.414,
  posterQrShare: 0.46,
  /** The grab handle at the top of a bottom sheet. */
  sheetHandleW: 36,
  sheetHandleH: 4,
  /** The map in the business form where the owner drops their pin. */
  mapPicker: 240,
  /** A chosen photo in the business form, and the "Add photo" tile beside it. */
  photoTile: 96,
  /** An "HH:MM" field in the opening-hours editor. */
  timeField: 84,
} as const;

/**
 * The one elevation system. White cards lift off the near-white ground with two soft,
 * ink-tinted layers (a tight contact shadow and a wide ambient one); only the card
 * that floats over the map uses the deeper `float`. Used through the `boxShadow`
 * style, which React Native draws on Android, iOS and web alike.
 */
export const elevation = {
  card: '0px 1px 2px rgba(27, 28, 47, 0.05), 0px 4px 14px rgba(27, 28, 47, 0.06)',
  float: '0px 8px 24px rgba(27, 28, 47, 0.20)',
} as const;

/** Pressed controls shrink a touch: feedback you can see on every platform. */
export const press = {
  scale: 0.98,
} as const;

/** Durations in milliseconds. Motion only marks a state change. */
export const motion = {
  fast: 120,
  base: 200,
  skeleton: 900,
  /** How long one update stays up in the story viewer before the next one. */
  story: 6000,
  /** How long the small notice at the bottom stays. */
  notice: 2600,
} as const;

/** Opacity steps. */
export const opacity = {
  pressed: 0.72,
  disabled: 0.45,
  skeletonLow: 0.45,
} as const;
