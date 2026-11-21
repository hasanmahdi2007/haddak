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
  /** Stronger grey: pressed surfaces. */
  surfaceTintStrong: string;

  /** Eerie black: filled buttons, the selected chip or segment, round arrow buttons. (Near white in the dark theme.) */
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Text and icons that sit on a grey surface as a quiet action. */
  onPrimarySoft: string;
  /** Alice blue for positive marks: confirmed hires, "Hired through Haddak", icon squares. */
  primarySoft: string;

  /**
   * Trust: the Verified mark. A small solid black pill (and map disc) with a white
   * check and white words (`onTrust`). Never a large block.
   */
  trust: string;
  onTrust: string;

  /** Alice blue: the main tinted block. Featured, the sponsored card, info panels, done notices. Only ever a fill, with `onAccent` on it. */
  accent: string;
  accentSoft: string;
  onAccent: string;
  /** Slate blue for lines that must be seen on a map: the search circle. */
  accentStrong: string;
  /** See-through slate: the inside of the search circle. */
  accentWash: string;

  /**
   * Vanilla, the signature highlight. It marks Haddak's special moments only:
   * the Jarak AI mark, Sponsored, offers and their figure, "Available now".
   * Always a fill with dark words on it, never a text or line colour (too pale on white).
   */
  signature: string;
  /** Vanilla pressed. */
  signaturePressed: string;
  /**
   * A deep olive-yellow for thin lines and icons that sit on white, the ground or vanilla
   * (the story ring): 3:1 or more on all three.
   */
  signatureStrong: string;
  /** A pale vanilla wash: the claim card on an unclaimed profile. */
  signatureSoft: string;
  /** Dark ink for words and icons on a `signature` fill (AA on it). */
  onSignature: string;

  /** The alice-blue block at the top of Home and behind a written update. */
  hero: string;
  /** Black words and icons on `hero`. */
  onHero: string;
  /** Grey for supporting words on `hero` (AA on it). */
  onHeroMuted: string;
  /** Soft white for quiet controls inside the hero block (location, search by name), and while pressed. */
  heroControl: string;
  heroControlPressed: string;

  text: string;
  textMuted: string;
  /** Captions and quiet icons. */
  textSubtle: string;

  /** Light grey line: outlined pills and chips. */
  border: string;
  /** Hairlines inside a white card (between the facts, between reviews). */
  divider: string;
  /** Control boundaries (3:1 against the ground). */
  outline: string;

  /** Rating stars. */
  rating: string;

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
 * Light theme, "Pastel" (founder approval, 2026-11-17, from his reference dashboard):
 * a ghost-white ground, white cards, alice blue for the Home block and positive marks,
 * vanilla as the signature highlight and eerie black for actions and the selected state.
 * No green anywhere except WhatsApp's own button (founder, 2026-11-17).
 * Contrast (checked 2026-11-17): text 12:1 or more on every fill; textMuted 5.1:1 and
 * textSubtle 4.7:1 or more on every pastel and grey; white on primary 16:1 (11:1 pressed);
 * signatureStrong (thin vanilla lines and icons) 3.8:1 on white, 3.5:1 on the ground and
 * 3.2:1 on vanilla; outline 3.1:1 or more on white and the ground.
 */
export const lightColors: ColorTokens = {
  background: '#F6F5FA',
  surface: '#FFFFFF',
  surfaceInset: '#F6F5FA',
  surfaceTint: '#EEEDF3',
  surfaceTintStrong: '#E3E2E9',

  primary: '#212121',
  primaryPressed: '#3A3A3A',
  onPrimary: '#FFFFFF',
  onPrimarySoft: '#212121',
  primarySoft: '#D8DFE9',

  trust: '#212121',
  onTrust: '#FFFFFF',

  accent: '#D8DFE9',
  accentSoft: '#E6EBF2',
  onAccent: '#212121',
  accentStrong: '#4F6077',
  accentWash: 'rgba(79, 96, 119, 0.12)',

  signature: '#EFF0A3',
  signaturePressed: '#E2E388',
  signatureStrong: '#8A851C',
  signatureSoft: '#F7F7D4',
  onSignature: '#212121',

  hero: '#D8DFE9',
  onHero: '#212121',
  onHeroMuted: '#55575E',
  heroControl: 'rgba(255, 255, 255, 0.65)',
  heroControlPressed: '#FFFFFF',

  text: '#212121',
  textMuted: '#55575E',
  textSubtle: '#5A5C63',

  border: '#D6D5DD',
  divider: '#ECEBF1',
  outline: '#8A8C93',

  rating: '#B97A00',

  danger: '#B3261E',
  dangerPressed: '#931F18',
  onDanger: '#FFFFFF',
  dangerSoft: '#FBE4E1',
  onDangerSoft: '#7A1410',

  whatsapp: '#25D366',
  whatsappPressed: '#1EB958',
  onWhatsapp: '#062E17',

  scrim: 'rgba(33, 33, 33, 0.72)',
  onScrim: '#FFFFFF',
  shadow: 'rgba(33, 33, 33, 0.16)',

  qrPaper: '#FFFFFF',
  qrInk: '#212121',
};

/** Dark theme: ink ground, lighter ink blocks, the same lavender (still with dark text on it). */
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

  trust: '#FAFEFF',
  onTrust: '#1B1C2F',

  accent: '#B2A1FF',
  accentSoft: '#C0C4FF',
  onAccent: '#1B1C2F',
  accentStrong: '#B2A1FF',
  accentWash: 'rgba(178, 161, 255, 0.20)',

  signature: '#FF7A45',
  signaturePressed: '#F2622A',
  signatureStrong: '#FF7A45',
  signatureSoft: '#4A2A1C',
  onSignature: '#2A1306',

  hero: '#2A2C44',
  onHero: '#FFFFFF',
  onHeroMuted: '#C9CBDA',
  heroControl: 'rgba(255, 255, 255, 0.10)',
  heroControlPressed: 'rgba(255, 255, 255, 0.18)',

  text: '#F3F5F4',
  textMuted: '#BBBDCB',
  textSubtle: '#9C9EB0',

  border: '#34364D',
  divider: '#34364D',
  outline: '#7F8198',

  rating: '#F2BE4A',

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

/**
 * Font family names as loaded in src/app/_layout.tsx (useFonts).
 * Latin text is Urbanist. Urbanist has no Arabic letters, so Arabic text keeps
 * Beiruti (titles) and Readex Pro (text and controls); `Txt` picks the set.
 */
export const fonts = {
  /** Urbanist: every Latin role. */
  latin: {
    regular: 'Urbanist_400Regular',
    medium: 'Urbanist_500Medium',
    semibold: 'Urbanist_600SemiBold',
    bold: 'Urbanist_700Bold',
  },
  /** Beiruti for Arabic titles, Readex Pro for Arabic text. */
  arabic: {
    title: 'Beiruti_700Bold',
    titleMedium: 'Beiruti_600SemiBold',
    body: 'ReadexPro_400Regular',
    bodyMedium: 'ReadexPro_500Medium',
    bodyStrong: 'ReadexPro_600SemiBold',
  },
} as const;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  /** Latin titles are set a touch tight; Arabic is never letter-spaced (it breaks the joins). */
  letterSpacing?: number;
}

const L = fonts.latin;

/**
 * Type roles for Latin text (Urbanist). Titles are medium or semibold with a slight
 * negative letter-spacing: large, light-to-medium titles rather than heavy bold.
 * Sizes are scalable (sp on Android): never pass allowFontScaling={false}.
 */
export const type = {
  /** The question on Home. */
  display: { fontFamily: L.medium, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  /** The biggest words: a short update in the story viewer, the discount figure of an offer. */
  poster: { fontFamily: L.semibold, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  /** Screen and section titles. */
  headline: { fontFamily: L.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  /** Card names, titles inside a card. */
  title: { fontFamily: L.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  /** Reading text. */
  body: { fontFamily: L.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: L.semibold, fontSize: 15, lineHeight: 22 },
  /** Buttons and chips. */
  action: { fontFamily: L.semibold, fontSize: 15, lineHeight: 22 },
  /** Facts on cards: rating, distance, price. */
  data: { fontFamily: L.semibold, fontSize: 14, lineHeight: 20 },
  /** Supporting lines, tile labels. */
  label: { fontFamily: L.medium, fontSize: 13, lineHeight: 18 },
  /** Smallest text: dates, map pin names. */
  caption: { fontFamily: L.medium, fontSize: 12, lineHeight: 16 },
  /** Words inside a badge pill (Verified, Sponsored, Available now). */
  badge: { fontFamily: L.semibold, fontSize: 12, lineHeight: 16 },
  /**
   * The assistant is read by people who rarely use a phone, so its reading text,
   * buttons and typing field are a step bigger than the rest of the app.
   */
  bodyLarge: { fontFamily: L.regular, fontSize: 17, lineHeight: 24 },
  bodyLargeStrong: { fontFamily: L.semibold, fontSize: 17, lineHeight: 24 },
  actionLarge: { fontFamily: L.semibold, fontSize: 17, lineHeight: 24 },
  /** What the user types to the assistant. */
  input: { fontFamily: L.regular, fontSize: 20, lineHeight: 28 },
} as const satisfies Record<string, TypeStyle>;

const A = fonts.arabic;

/** The same roles for Arabic text: Beiruti titles, Readex Pro text, no letter-spacing. */
export const typeArabic = {
  display: { fontFamily: A.title, fontSize: 30, lineHeight: 38 },
  poster: { fontFamily: A.title, fontSize: 38, lineHeight: 48 },
  headline: { fontFamily: A.title, fontSize: 22, lineHeight: 30 },
  title: { fontFamily: A.titleMedium, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: A.body, fontSize: 15, lineHeight: 24 },
  bodyStrong: { fontFamily: A.bodyMedium, fontSize: 15, lineHeight: 24 },
  action: { fontFamily: A.bodyStrong, fontSize: 15, lineHeight: 22 },
  data: { fontFamily: A.bodyMedium, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: A.bodyMedium, fontSize: 13, lineHeight: 20 },
  caption: { fontFamily: A.body, fontSize: 12, lineHeight: 18 },
  badge: { fontFamily: A.bodyMedium, fontSize: 12, lineHeight: 18 },
  bodyLarge: { fontFamily: A.body, fontSize: 17, lineHeight: 26 },
  bodyLargeStrong: { fontFamily: A.bodyMedium, fontSize: 17, lineHeight: 26 },
  actionLarge: { fontFamily: A.bodyStrong, fontSize: 17, lineHeight: 24 },
  input: { fontFamily: A.body, fontSize: 20, lineHeight: 30 },
} as const satisfies Record<keyof typeof type, TypeStyle>;

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
  /** Small tags, the Jarak AI mark. */
  sm: 10,
  /** Thumbnails, the icon well on a tile, insets inside a card. */
  md: 16,
  /** Tiles, cards, fact blocks: very round, as in the founder's reference. */
  lg: 24,
  /** The alice-blue block on Home, big coloured blocks and the top corners of a sheet. */
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
  /** The small round black "open" button in a tile's corner. */
  arrowDisc: 28,
  /** The alice-blue or vanilla well behind a tile icon. */
  tileIconBox: 44,
  /** The white "you are here" disc in the location line. */
  pin: 28,
  /** The vanilla square with a sparkle that marks Jarak AI (Home entry, the assistant's bar). */
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
  /** The white tile that carries an offer's discount figure. */
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
 * The one elevation system. White cards lift off the tinted ground with two soft,
 * ink-tinted layers (a tight contact shadow and a wide ambient one); only the card
 * that floats over the map uses the deeper `float`. Used through the `boxShadow`
 * style, which React Native draws on Android, iOS and web alike.
 */
export const elevation = {
  card: '0px 1px 2px rgba(33, 33, 33, 0.03), 0px 6px 20px rgba(33, 33, 33, 0.04)',
  float: '0px 8px 24px rgba(33, 33, 33, 0.16)',
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
