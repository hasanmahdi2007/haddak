/**
 * Haddak design tokens. This file mirrors DESIGN.md; change them together.
 * Screens and components never use a raw colour or size: they read from here.
 */

export interface ColorTokens {
  /** Page ground. */
  background: string;
  /** Raised content and insets: docks, the facts strip inside a card, the map card. */
  surface: string;
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

  /** Mint: the trust colour. Verified, "Open now", positive marks. Only ever a fill, with `onMint` on it. */
  mint: string;
  onMint: string;

  /** Lavender: the accent. Category icon blocks, Featured, decorative blocks. Only ever a fill, with `onAccent` on it. */
  accent: string;
  accentSoft: string;
  onAccent: string;
  /** Deeper lavender for lines that must be seen on a map: the search circle. */
  accentStrong: string;
  /** See-through lavender: the inside of the search circle. */
  accentWash: string;

  /** The ink block on Home (a lighter ink in the dark theme, so it still reads as a block). */
  hero: string;
  onHero: string;
  onHeroMuted: string;

  text: string;
  textMuted: string;
  /** Captions and quiet icons. */
  textSubtle: string;

  /** Dividers and muted fills. */
  border: string;
  /** Control boundaries (3:1 against the ground). */
  outline: string;

  /** Rating stars. */
  rating: string;

  /** Dark green for the ring of the "Open now" dot, where mint alone would be too faint. */
  success: string;

  /** Errors only. */
  danger: string;
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
}

/** Light theme: near-white ground, soft grey blocks, ink for text and actions, mint for trust, lavender as the accent. */
export const lightColors: ColorTokens = {
  background: '#FAFEFF',
  surface: '#FFFFFF',
  surfaceTint: '#EFF1EE',
  surfaceTintStrong: '#D0D2CF',

  primary: '#1B1C2F',
  primaryPressed: '#34364F',
  onPrimary: '#FFFFFF',
  onPrimarySoft: '#1B1C2F',

  mint: '#A4F5A6',
  onMint: '#1B1C2F',

  accent: '#B2A1FF',
  accentSoft: '#C0C4FF',
  onAccent: '#1B1C2F',
  accentStrong: '#6F5BD6',
  accentWash: 'rgba(178, 161, 255, 0.24)',

  hero: '#1B1C2F',
  onHero: '#FFFFFF',
  onHeroMuted: '#C9CBDA',

  text: '#1B1C2F',
  textMuted: '#55576A',
  textSubtle: '#666879',

  border: '#D0D2CF',
  outline: '#85878F',

  rating: '#B97A00',

  success: '#1F7A3A',

  danger: '#B3261E',
  dangerSoft: '#FBE4E1',
  onDangerSoft: '#7A1410',

  whatsapp: '#25D366',
  whatsappPressed: '#1EB958',
  onWhatsapp: '#062E17',

  scrim: 'rgba(27, 28, 47, 0.72)',
  onScrim: '#FFFFFF',
  shadow: 'rgba(27, 28, 47, 0.20)',
};

/** Dark theme: ink ground, lighter ink blocks, the same mint and lavender (still with dark text on them). */
export const darkColors: ColorTokens = {
  background: '#12131F',
  surface: '#2A2C44',
  surfaceTint: '#1D1E32',
  surfaceTintStrong: '#3A3C57',

  primary: '#FAFEFF',
  primaryPressed: '#D0D2CF',
  onPrimary: '#1B1C2F',
  onPrimarySoft: '#FAFEFF',

  mint: '#A4F5A6',
  onMint: '#1B1C2F',

  accent: '#B2A1FF',
  accentSoft: '#C0C4FF',
  onAccent: '#1B1C2F',
  accentStrong: '#B2A1FF',
  accentWash: 'rgba(178, 161, 255, 0.20)',

  hero: '#2A2C44',
  onHero: '#FFFFFF',
  onHeroMuted: '#C9CBDA',

  text: '#F3F5F4',
  textMuted: '#BBBDCB',
  textSubtle: '#9C9EB0',

  border: '#34364D',
  outline: '#7F8198',

  rating: '#F2BE4A',

  success: '#1F7A3A',

  danger: '#FFB4AB',
  dangerSoft: '#5C1612',
  onDangerSoft: '#FFDAD5',

  whatsapp: '#25D366',
  whatsappPressed: '#1EB958',
  onWhatsapp: '#062E17',

  scrim: 'rgba(10, 11, 20, 0.72)',
  onScrim: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.50)',
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
  display: { fontFamily: fonts.title, fontSize: 30, lineHeight: 40 },
  /** Screen titles, provider name. */
  headline: { fontFamily: fonts.title, fontSize: 24, lineHeight: 34 },
  /** Card names, section titles. */
  title: { fontFamily: fonts.titleMedium, fontSize: 19, lineHeight: 28 },
  /** Reading text. */
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 24 },
  /** Buttons and chips. */
  action: { fontFamily: fonts.bodyStrong, fontSize: 15, lineHeight: 22 },
  /** Facts on cards: rating, distance, price. */
  data: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 22 },
  /** Supporting lines, tile labels. */
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 20 },
  /** Smallest text: badge labels, dates. */
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
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
  /** Thumbnails, the icon block on a tile, the facts strip. */
  md: 14,
  /** Tiles, cards, fact blocks. */
  lg: 24,
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
  icon: 20,
  iconSmall: 16,
  iconLarge: 24,
  /** Icon on a category tile. */
  tileIcon: 28,
  /** Category tile minimum height. */
  tile: 112,
  /** The lavender block behind a tile icon. */
  tileIconBox: 44,
  /** The mint "you are here" disc in the location line. */
  pin: 28,
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
  /** The "search position" dot on the map. */
  mapHere: 20,
  /** The least height the map may ever have. */
  mapMin: 280,
  /** Photo on the card docked over the map. */
  dockThumb: 64,
  /** Widest the content column grows on tablets and web. */
  maxContent: 560,
} as const;

/** Durations in milliseconds. Motion only marks a state change. */
export const motion = {
  fast: 120,
  base: 200,
  skeleton: 900,
} as const;

/** Opacity steps. */
export const opacity = {
  pressed: 0.72,
  disabled: 0.45,
  skeletonLow: 0.45,
} as const;
