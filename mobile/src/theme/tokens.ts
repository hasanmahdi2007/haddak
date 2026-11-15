/**
 * Haddak design tokens. This file mirrors DESIGN.md; change them together.
 * Screens and components never use a raw colour or size: they read from here.
 */

export interface ColorTokens {
  /** Page ground: document paper. */
  paper: string;
  /** Raised content: a white sheet on the paper. */
  sheet: string;
  /** Manila: category tiles, photo placeholders. */
  manila: string;
  /** Pressed manila, skeleton blocks. */
  manilaDeep: string;

  /** Stamp-pad ink blue: trust and action. */
  ink: string;
  inkPressed: string;
  onInk: string;
  /** Tonal ink: selected tiles, secondary buttons. */
  inkWash: string;
  onInkWash: string;

  /** The coloured header on Home. */
  shell: string;
  onShell: string;
  onShellMuted: string;
  shellLine: string;

  text: string;
  textMuted: string;
  textSubtle: string;

  /** Dividers and card edges. */
  hairline: string;
  /** Control boundaries (3:1 against the ground). */
  outline: string;

  /** Merit: rating stars and the featured label. */
  saffron: string;
  saffronWash: string;
  onSaffronWash: string;

  /** Founding member. */
  cedar: string;
  cedarWash: string;
  onCedarWash: string;

  /** Errors only. */
  carmine: string;
  carmineWash: string;
  onCarmineWash: string;

  /** WhatsApp's own green, used only on the WhatsApp action. */
  whatsapp: string;
  whatsappPressed: string;
  onWhatsapp: string;

  /** Behind controls that sit on photos. */
  scrim: string;
  onScrim: string;
}

export const lightColors: ColorTokens = {
  paper: '#F4F1EA',
  sheet: '#FFFFFF',
  manila: '#EAE3D2',
  manilaDeep: '#DDD4BE',

  ink: '#24338F',
  inkPressed: '#1B2770',
  onInk: '#FFFFFF',
  inkWash: '#E2E6F8',
  onInkWash: '#1B2770',

  shell: '#24338F',
  onShell: '#FFFFFF',
  onShellMuted: '#CDD3F4',
  shellLine: '#8F99DC',

  text: '#17192B',
  textMuted: '#4A4E63',
  textSubtle: '#5C6074',

  hairline: '#DAD4C5',
  outline: '#8A8473',

  saffron: '#C48600',
  saffronWash: '#FBE7B0',
  onSaffronWash: '#553B00',

  cedar: '#1F6B4C',
  cedarWash: '#DCEDE2',
  onCedarWash: '#154D36',

  carmine: '#B3261E',
  carmineWash: '#FBE4E1',
  onCarmineWash: '#7A1410',

  whatsapp: '#25D366',
  whatsappPressed: '#1EB958',
  onWhatsapp: '#062E17',

  scrim: 'rgba(23, 25, 43, 0.62)',
  onScrim: '#FFFFFF',
};

export const darkColors: ColorTokens = {
  paper: '#111325',
  sheet: '#1A1D33',
  manila: '#272B47',
  manilaDeep: '#343959',

  ink: '#B4BDFF',
  inkPressed: '#9AA5F5',
  onInk: '#121A55',
  inkWash: '#2B3170',
  onInkWash: '#DDE1FF',

  shell: '#1B2260',
  onShell: '#FFFFFF',
  onShellMuted: '#C3CAF5',
  shellLine: '#7E88CC',

  text: '#ECEDF7',
  textMuted: '#BDC0D4',
  textSubtle: '#A1A5BD',

  hairline: '#2E3252',
  outline: '#7F84A6',

  saffron: '#F2BE4A',
  saffronWash: '#4A3A10',
  onSaffronWash: '#FBE3A6',

  cedar: '#7FCFA6',
  cedarWash: '#173D2D',
  onCedarWash: '#BFE8D2',

  carmine: '#FFB4AB',
  carmineWash: '#5C1612',
  onCarmineWash: '#FFDAD5',

  whatsapp: '#25D366',
  whatsappPressed: '#1EB958',
  onWhatsapp: '#062E17',

  scrim: 'rgba(10, 11, 24, 0.66)',
  onScrim: '#FFFFFF',
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
  /** Tags and the fiscal stamp. */
  sm: 6,
  /** Tiles, cards, thumbnails. */
  md: 10,
  /** Buttons. */
  lg: 14,
  /** Chips and round controls. */
  pill: 999,
} as const;

/** Fixed sizes. */
export const size = {
  /** Minimum touch target (Material: 48 dp). */
  touch: 48,
  /** Visible height of a chip (its touch target is still 48). */
  chip: 40,
  /** Icon in an empty or error state. */
  stateIcon: 36,
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
  tile: 104,
  /** Thumbnail on a provider card. */
  thumb: 84,
  /** Seal sizes: beside a name, and on the profile. */
  sealSmall: 22,
  sealLarge: 96,
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
