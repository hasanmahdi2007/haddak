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

  /** The one bright accent of a design option (a sun, a sticker). Never text on white. */
  accent: string;
  onAccent: string;
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

  accent: '#C48600',
  onAccent: '#FFFFFF',
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

  accent: '#F2BE4A',
  onAccent: '#3A2A00',
};

/**
 * DESIGN OPTIONS (temporary, until the founder picks one).
 * Three bright looks for the Home screen. Choose one with the env var
 * EXPO_PUBLIC_DESIGN_VARIANT=a|b|c (default a). See design-preview/options/OPTIONS.md.
 * The token names above are kept (paper, ink, manila...) so Results and Profile
 * still compile; each option only gives them new values.
 */
export type VariantId = 'a' | 'b' | 'c';

/** Colours of one category tile. */
export interface TileTone {
  bg: string;
  /** Small shape behind the icon; the same as bg when there is none. */
  bubble: string;
  icon: string;
  label: string;
}

/** Everything that differs between the options besides colour. */
export interface Look {
  id: VariantId;
  name: string;
  /** bubble: icon in a circle over a centred label. row: icon beside the label. poster: icon top, label bottom. */
  tile: 'bubble' | 'row' | 'poster';
  columns: 2 | 3;
  /** Tiles take these in turn. */
  tones: TileTone[];
  /** How a chosen tile is shown: filled with the primary colour, or ringed. */
  selectedTile: 'fill' | 'ring';
  /** wash: tinted header with a sun. plain: white with a location pill. sticker: white with the name on a sticker. */
  header: 'wash' | 'plain' | 'sticker';
  /** pills: separate chips. track: one segmented track. */
  chips: 'pills' | 'track';
  tileRadius: number;
  buttonRadius: number;
  chipRadius: number;
}

// Shared by all three options: one meaning each, as before.
const sharedColors = {
  sheet: '#FFFFFF',
  onInk: '#FFFFFF',
  saffron: '#B97A00',
  saffronWash: '#FFEFC2',
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
  onScrim: '#FFFFFF',
};

/** A. Dekkaneh: warm. Vermilion and sun yellow on white, peach and butter tiles. */
const colorsA: ColorTokens = {
  ...sharedColors,
  paper: '#FFFFFF',
  manila: '#FFF1E7',
  manilaDeep: '#FFDFCB',
  ink: '#D9361A',
  inkPressed: '#B52A12',
  inkWash: '#FFE3D3',
  onInkWash: '#8F1F0A',
  shell: '#FFF1E7',
  onShell: '#2A1610',
  onShellMuted: '#6B4A40',
  shellLine: '#AD8172',
  text: '#2A1610',
  textMuted: '#6B4A40',
  textSubtle: '#7A5A50',
  hairline: '#F3DDD0',
  outline: '#AD8172',
  scrim: 'rgba(42, 22, 16, 0.62)',
  accent: '#FFC233',
  onAccent: '#3A2400',
};

/** B. Corniche: fresh. Sea teal on white with aqua washes and one coral point. */
const colorsB: ColorTokens = {
  ...sharedColors,
  paper: '#FFFFFF',
  manila: '#E6F7FA',
  manilaDeep: '#C9EBF1',
  ink: '#00708A',
  inkPressed: '#005A70',
  inkWash: '#D3F1F6',
  onInkWash: '#004E61',
  shell: '#FFFFFF',
  onShell: '#0C2A33',
  onShellMuted: '#45636C',
  shellLine: '#6A96A1',
  text: '#0C2A33',
  textMuted: '#45636C',
  textSubtle: '#52707A',
  hairline: '#D5ECF1',
  outline: '#6A96A1',
  scrim: 'rgba(12, 42, 51, 0.62)',
  accent: '#FF6A4D',
  onAccent: '#4A1206',
};

/** C. Balat: bold. Five tile colours on white, held together by one indigo-black. */
const colorsC: ColorTokens = {
  ...sharedColors,
  paper: '#FFFFFF',
  manila: '#F1F0F8',
  manilaDeep: '#DDDBEC',
  ink: '#17153B',
  inkPressed: '#2C2A5C',
  inkWash: '#E9E8F7',
  onInkWash: '#17153B',
  shell: '#FFFFFF',
  onShell: '#17153B',
  onShellMuted: '#55536F',
  shellLine: '#8D8BA3',
  text: '#17153B',
  textMuted: '#55536F',
  textSubtle: '#646280',
  hairline: '#E6E5EF',
  outline: '#8D8BA3',
  scrim: 'rgba(23, 21, 59, 0.62)',
  accent: '#FFD12E',
  onAccent: '#17153B',
};

const WHITE = '#FFFFFF';

export const variants: Record<VariantId, { colors: ColorTokens; look: Look }> = {
  a: {
    colors: colorsA,
    look: {
      id: 'a',
      name: 'Dekkaneh',
      tile: 'bubble',
      columns: 3,
      // Two tones over three columns make a checkerboard.
      tones: [
        { bg: '#FFE7D6', bubble: WHITE, icon: '#D9361A', label: '#2A1610' },
        { bg: '#FFEFAE', bubble: WHITE, icon: '#9A5B00', label: '#2A1610' },
      ],
      selectedTile: 'fill',
      header: 'wash',
      chips: 'pills',
      tileRadius: 22,
      buttonRadius: 999,
      chipRadius: 999,
    },
  },
  b: {
    colors: colorsB,
    look: {
      id: 'b',
      name: 'Corniche',
      tile: 'row',
      columns: 2,
      // White tiles; the colour sits in a solid teal square behind a white icon.
      tones: [{ bg: WHITE, bubble: '#00708A', icon: WHITE, label: '#0C2A33' }],
      selectedTile: 'fill',
      header: 'plain',
      chips: 'track',
      tileRadius: 16,
      buttonRadius: 16,
      chipRadius: 12,
    },
  },
  c: {
    colors: colorsC,
    look: {
      id: 'c',
      name: 'Balat',
      tile: 'poster',
      columns: 3,
      // Five tones over three columns: no two neighbours match.
      tones: [
        { bg: '#2D4FE0', bubble: '#2D4FE0', icon: WHITE, label: WHITE },
        { bg: '#FFC629', bubble: '#FFC629', icon: '#2B1D00', label: '#2B1D00' },
        { bg: '#D4330F', bubble: '#D4330F', icon: WHITE, label: WHITE },
        { bg: '#087F4E', bubble: '#087F4E', icon: WHITE, label: WHITE },
        { bg: '#D61F69', bubble: '#D61F69', icon: WHITE, label: WHITE },
      ],
      selectedTile: 'ring',
      header: 'sticker',
      chips: 'pills',
      tileRadius: 20,
      buttonRadius: 18,
      chipRadius: 14,
    },
  },
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
  /** Bottom corners of the tinted Home header. */
  sheet: 28,
  /** Chips and round controls. */
  pill: 999,
} as const;

/** Fixed sizes. */
export const size = {
  /** Minimum touch target (Material: 48 dp). */
  touch: 48,
  /** Visible height of a chip (its touch target is still 48). */
  chip: 44,
  /** Icon in an empty or error state. */
  stateIcon: 36,
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
  tile: 98,
  /** The same, for the row layout (icon beside the label). */
  tileRow: 66,
  /** Shape behind a tile icon. */
  tileBubble: 44,
  /** The coral "you are here" disc in the location pill. */
  pin: 28,
  /** The sun in the corner of the warm header. */
  sun: 150,
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
  /** The same, when the provider has no photos. */
  galleryRatioEmpty: 0.42,
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
