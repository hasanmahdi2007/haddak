/**
 * Haddak design tokens. This file mirrors DESIGN.md; change them together.
 * Screens and components never use a raw colour or size: they read from here.
 */

export interface ColorTokens {
  /** Page ground. */
  background: string;
  /** Raised content: cards, tiles, docked bars. */
  surface: string;
  /** Pale aqua: location pill, chip track, fact strips, photo placeholders. */
  surfaceTint: string;
  /** Stronger aqua: tile and card edges, pressed surfaces, skeleton blocks. */
  surfaceTintStrong: string;

  /** Sea teal: the brand, actions and the verified seal. */
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Soft teal fill behind secondary things (the verified line). */
  primarySoft: string;
  onPrimarySoft: string;

  text: string;
  textMuted: string;
  /** Captions and quiet icons. */
  textSubtle: string;

  /** Dividers. */
  border: string;
  /** Control boundaries (3:1 against the ground). */
  outline: string;

  /** Rating stars and the Featured label. */
  rating: string;
  ratingSoft: string;
  onRatingSoft: string;

  /** Founding member. */
  success: string;
  successSoft: string;
  onSuccessSoft: string;

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

  /** Coral: the one bright point (the "you are here" dot, the tick on a chosen tile). Never text on white. */
  accent: string;
  onAccent: string;
}

/** Light theme: white ground, sea teal, aqua surfaces, one coral point. */
export const lightColors: ColorTokens = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceTint: '#E6F7FA',
  surfaceTintStrong: '#C9EBF1',

  primary: '#00708A',
  primaryPressed: '#005A70',
  onPrimary: '#FFFFFF',
  primarySoft: '#D3F1F6',
  onPrimarySoft: '#004E61',

  text: '#0C2A33',
  textMuted: '#45636C',
  textSubtle: '#52707A',

  border: '#D5ECF1',
  outline: '#6A96A1',

  rating: '#B97A00',
  ratingSoft: '#FFEFC2',
  onRatingSoft: '#553B00',

  success: '#1F6B4C',
  successSoft: '#DCEDE2',
  onSuccessSoft: '#154D36',

  danger: '#B3261E',
  dangerSoft: '#FBE4E1',
  onDangerSoft: '#7A1410',

  whatsapp: '#25D366',
  whatsappPressed: '#1EB958',
  onWhatsapp: '#062E17',

  scrim: 'rgba(12, 42, 51, 0.72)',
  onScrim: '#FFFFFF',

  accent: '#FF6A4D',
  onAccent: '#4A1206',
};

/** Dark theme: the same sea at night. Deep blue-green ground, a lighter teal that keeps its contrast. */
export const darkColors: ColorTokens = {
  background: '#061A20',
  surface: '#0B252D',
  surfaceTint: '#11343F',
  surfaceTintStrong: '#1A4856',

  primary: '#4CC2DB',
  primaryPressed: '#7AD3E6',
  onPrimary: '#00232C',
  primarySoft: '#104452',
  onPrimarySoft: '#C2EDF6',

  text: '#E9F6F9',
  textMuted: '#AECAD1',
  textSubtle: '#93B3BC',

  border: '#1C3E49',
  outline: '#6C96A1',

  rating: '#F2BE4A',
  ratingSoft: '#4A3A10',
  onRatingSoft: '#FBE3A6',

  success: '#7FCFA6',
  successSoft: '#173D2D',
  onSuccessSoft: '#BFE8D2',

  danger: '#FFB4AB',
  dangerSoft: '#5C1612',
  onDangerSoft: '#FFDAD5',

  whatsapp: '#25D366',
  whatsappPressed: '#1EB958',
  onWhatsapp: '#062E17',

  scrim: 'rgba(3, 14, 18, 0.72)',
  onScrim: '#FFFFFF',

  accent: '#FF7A5F',
  onAccent: '#3A0D03',
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
  /** Aref Ruqaa: only inside the verified seal. */
  seal: 'ArefRuqaa_700Bold',
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
  /** Tags. */
  sm: 8,
  /** Chips, thumbnails, the icon square on a tile. */
  md: 12,
  /** Tiles, cards, buttons, the chip track. */
  lg: 16,
  /** The top corners of the profile sheet where it overlaps the photo. */
  sheet: 24,
  /** Round controls and pills. */
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
  button: 56,
  icon: 20,
  iconSmall: 16,
  iconLarge: 24,
  /** Icon on a category tile. */
  tileIcon: 28,
  /** Category tile minimum height. */
  tile: 66,
  /** The teal square behind a tile icon. */
  tileIconBox: 44,
  /** The coral "you are here" disc in the location pill. */
  pin: 28,
  /** Thumbnail on a provider card. */
  thumb: 88,
  /** Visible height of a view-toggle segment (its touch target is still 48). */
  segment: 40,
  /** Seal sizes: in a badge, and on the profile. */
  sealSmall: 22,
  sealLarge: 92,
  /** Check mark inside the small seal. */
  sealCheck: 11,
  strokeHeavy: 3.5,
  hairline: 1,
  /** Border weights: seal rings, selected tiles. */
  lineMid: 1.5,
  lineBold: 2,
  /** Stroke for line icons, and for the small check marks. */
  stroke: 1.75,
  strokeBold: 2.75,
  /** The word inside the large seal (fixed, decorative). */
  sealWord: 27,
  sealWordLine: 40,
  /** Gap between the seal's two rings. */
  sealGap: 4,
  /** Gallery height as a share of its width. */
  galleryRatio: 0.72,
  /** The same, when the provider has no photos. */
  galleryRatioEmpty: 0.46,
  /** How far the profile sheet rises over the photo. */
  sheetOverlap: 24,
  /** Stars in a review. */
  star: 14,
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
