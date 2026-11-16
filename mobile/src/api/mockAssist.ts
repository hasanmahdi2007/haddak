/**
 * The fake assistant for mock mode. The real one asks an AI to turn a sentence into
 * search settings (docs/AI_ASSISTANT.md); this one uses plain keyword rules over the
 * seeded categories, so every answer kind can be tried without a backend:
 *
 *   "My fridge stopped working"         results (widened: the nearest is 1.4 km away)
 *   "Maths tutor near me under $20"     results with a price limit, nearest first
 *   "car noise"                         clarify (engine or wiring?)
 *   "lessons"                           clarify (which kind?)
 *   "plumber in Jdeideh"                results, two places called Jdeideh to choose from
 *   "plumber in Hamra"                  results centred on Hamra
 *   "electrician in Kfarzebian"         results, place not found, searched near the phone
 *   "swimming lessons"                  results, nobody found even across the city
 *   "there is a fire"                   emergency
 *   "tell me a joke"                    off_topic
 *   "test unavailable"                  unavailable
 */
import { MOCK_CATEGORIES, MOCK_PLACES, MOCK_PROVIDERS, type MockPlace } from './mockData';
import type { ClarifyQuestion, PriceCurrency, PriceUnit, SearchSort, Understood } from './types';

type Lang = 'en' | 'ar';

/** What the rules made of a sentence, before anything is searched. */
export type MockUnderstanding =
  | { kind: 'emergency' | 'off_topic' | 'unavailable' }
  | { kind: 'clarify'; question: ClarifyQuestion }
  | { kind: 'search'; understood: Understood; placeOptions: MockPlace[] | null; placeUnknown: string | null };

/** Lower case, no Arabic vowel marks, one form of alef, ة as ه, so spellings meet. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Arabic words often carry "al", "bi", "wa" or "li" in front: try them with and without. */
const PREFIXES = ['وال', 'بال', 'لل', 'ال', 'و', 'ب', 'ل'];

function tokensOf(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const word of text.split(/[^\p{L}\p{N}$]+/u)) {
    if (!word) continue;
    tokens.add(word);
    for (const prefix of PREFIXES) {
      if (word.startsWith(prefix) && word.length - prefix.length >= 2) tokens.add(word.slice(prefix.length));
    }
  }
  return tokens;
}

/** A keyword of several words must appear as written; one word must be a whole word (plural "s" allowed). */
function has(text: string, tokens: Set<string>, keywords: string[]): boolean {
  return keywords.some((raw) => {
    const keyword = normalise(raw);
    if (keyword.includes(' ')) return text.includes(keyword);
    return tokens.has(keyword) || tokens.has(`${keyword}s`);
  });
}

// Most specific first: the first rule that matches wins.
const CATEGORY_RULES: [slug: string, keywords: string[]][] = [
  ['car-electrician', ['car electrician', 'car electric', 'car battery', 'كهربجي سيارات', 'بطارية السيارة']],
  ['mechanic', ['mechanic', 'garage', 'car', 'sayyara', 'ميكانيكي', 'ميكانيك', 'سيارة', 'كاراج']],
  ['appliance-repair', ['fridge', 'refrigerator', 'washing machine', 'washer', 'oven', 'براد', 'غسالة', 'فرن', 'tellaje', 'براده']],
  ['phone-repair', ['phone', 'iphone', 'mobile', 'تلفون', 'موبايل', 'خليوي', 'هاتف']],
  ['laptop-repair', ['laptop', 'computer', 'pc', 'لابتوب', 'كمبيوتر', 'حاسوب']],
  ['plumber', ['plumber', 'leak', 'leaking', 'water', 'sink', 'pipe', 'sankari', 'سنكري', 'تسريب', 'مي', 'ماء', 'حنفية', 'بوري']],
  ['electrician', ['electrician', 'electricity', 'electric', 'kahraba', 'كهربجي', 'كهربا', 'كهرباء']],
  ['drawing', ['drawing', 'painting lessons', 'رسم']],
  ['house-painter', ['painter', 'paint', 'dahhan', 'دهان', 'طرش']],
  ['ac-technician', ['ac', 'air conditioner', 'aircon', 'مكيف', 'تكييف']],
  ['saxophone', ['saxophone', 'sax', 'ساكسوفون']],
  ['piano', ['piano', 'بيانو']],
  ['oud', ['oud', 'عود']],
  ['guitar', ['guitar', 'غيتار', 'جيتار']],
  ['math', ['math', 'maths', 'mathematics', 'riyadiyat', 'رياضيات']],
  ['languages', ['english', 'french', 'انكليزي', 'انجليزي', 'فرنسي']],
  ['sciences', ['physics', 'chemistry', 'فيزياء', 'كيمياء']],
  ['tutoring', ['tutor', 'teacher', '2ostez', 'استاذ', 'معلم', 'دروس خصوصيه']],
  ['pediatrician', ['pediatrician', 'child doctor', 'kids doctor', 'طبيب اطفال', 'دكتور اطفال']],
  ['dentist', ['dentist', 'tooth', 'teeth', 'toothache', 'اسنان', 'ضرس', 'سن']],
  ['dermatologist', ['dermatologist', 'skin', 'جلد']],
  ['doctors', ['doctor', 'دكتور', 'طبيب', 'حكيم']],
  ['calligraphy', ['calligraphy', 'خط عربي']],
  ['arabic-sweets', ['baklava', 'knafeh', 'kunafa', 'sweets', 'حلويات', 'كنافه', 'بقلاوه', 'حلو']],
  ['cakes', ['cake', 'birthday cake', 'كاتو', 'كيك', 'قالب حلوى']],
  ['barber', ['barber', 'haircut', 'beard', 'حلاق', 'حلاقه', 'دقن']],
  ['hair-salon', ['hair salon', 'salon', 'كوافير', 'صالون']],
  ['alterations', ['tailor', 'alteration', 'hem', 'خياط', 'تقصير']],
  ['carpet-cleaning', ['carpet', 'sofa', 'سجاد', 'كنبايه', 'كنبايات']],
  ['house-cleaning', ['cleaning', 'cleaner', 'clean', 'تنظيف', 'تنضيف']],
  ['personal-trainer', ['trainer', 'gym', 'fitness', 'مدرب']],
  ['swimming', ['swimming', 'swim', 'سباحه']],
];

const EMERGENCY = [
  'fire', 'heart attack', 'bleeding', 'accident', 'ambulance', 'unconscious', 'cant breathe',
  'not breathing', 'emergency', 'overdose', 'حريق', 'نزيف', 'حادث', 'اسعاف', 'نوبه قلبيه', 'جلطه',
  'ما عم يتنفس', 'طوارئ',
];
const CAR = ['car', 'sayyara', 'سيارة', 'سياره'];
const NOISE = ['noise', 'sound', 'sawt', 'صوت', 'طقطقه'];
const LESSONS = ['lesson', 'lessons', 'class', 'classes', 'دروس', 'درس'];
const NEAR = ['near me', 'nearby', 'close', 'closest', 'nearest', '2arib', 'areeb', 'قريب', 'حدي', 'جنبي'];
const OPEN = ['open now', 'right now', 'hala2', 'halla2', 'هلق', 'هلا', 'الان', 'مفتوح'];
const CHEAP = ['cheap', 'cheapest', 'ar5as', 'ارخص', 'رخيص'];
const CITY = ['anywhere', 'whole city', 'كل المدينه', 'وين ما كان'];
const HOUR = ['hour', 'se3a', 'ساعه', 'بالساعه'];
const VISIT = ['visit', 'زياره', 'كشفيه'];
const MONTH = ['month', 'شهر', 'بالشهر'];
const LIRA = ['lira', 'lbp', 'ليره', 'ل.ل'];

/** Categories usually priced by the hour (lessons, cleaning, training). */
const HOURLY_PARENTS = new Set(['music-lessons', 'tutoring', 'art-lessons', 'cleaning', 'fitness']);

/** Words after "in" that are not places. */
const NOT_PLACES = new Set(['me', 'my', 'the', 'a', 'an', 'home', 'house', 'town', 'area', 'general', 'english', 'french']);

const PRICE = /(?:under|below|less than|max|up to|a2al men|aqal men|اقل من|تحت|حد اقصي)\s*\$?\s*(\d+(?:[.,]\d+)?)/;

function categoryBySlug(slug: string) {
  const category = MOCK_CATEGORIES.find((c) => c.slug === slug);
  if (!category) throw new Error(`Mock assistant: unknown category ${slug}`);
  return category;
}

function parentSlug(slug: string): string {
  const category = categoryBySlug(slug);
  return category.parent_id === null ? slug : (MOCK_CATEGORIES.find((c) => c.id === category.parent_id)?.slug ?? slug);
}

/** The settings every answer starts from. */
export function baseUnderstood(slugs: string[]): Understood {
  return {
    category_slugs: slugs,
    q: null,
    place: null,
    radius_m: 1000,
    max_price: null,
    price_unit: null,
    price_currency: 'USD',
    open_now: false,
    sort: 'best',
  };
}

function clarifyCar(lang: Lang): ClarifyQuestion {
  const ar = lang === 'ar';
  return {
    text: ar ? 'من أين يأتي الصوت؟' : 'Where is the noise coming from?',
    options: [
      { label: ar ? 'من المحرّك' : 'The engine', understood: baseUnderstood(['mechanic']) },
      {
        label: ar ? 'من البطارية أو الكهرباء' : 'The battery or the wiring',
        understood: baseUnderstood(['car-electrician']),
      },
    ],
  };
}

function clarifyLessons(lang: Lang): ClarifyQuestion {
  const ar = lang === 'ar';
  return {
    text: ar ? 'أي نوع من الدروس؟' : 'What kind of lessons?',
    options: [
      { label: ar ? 'مواد المدرسة' : 'School subjects', understood: baseUnderstood(['tutoring']) },
      { label: ar ? 'موسيقى' : 'Music', understood: baseUnderstood(['music-lessons']) },
      { label: ar ? 'رسم' : 'Drawing', understood: baseUnderstood(['art-lessons']) },
      { label: ar ? 'سباحة' : 'Swimming', understood: baseUnderstood(['swimming']) },
    ],
  };
}

/** Places named in the sentence (both Jdeidehs when it says "Jdeideh"). */
function placesIn(text: string, tokens: Set<string>): MockPlace[] {
  return MOCK_PLACES.filter((place) => has(text, tokens, place.names));
}

/** "in Kfarzebian": a capitalised-looking word after "in" that is not in our list. */
function unknownPlace(original: string): string | null {
  const match = /\b(?:in|at|b|bi)\s+([A-Za-z][A-Za-z-]{3,})/.exec(original);
  if (!match) return null;
  const word = match[1];
  if (NOT_PLACES.has(word.toLowerCase())) return null;
  const tokens = tokensOf(normalise(word));
  if (CATEGORY_RULES.some(([, keywords]) => has(normalise(word), tokens, keywords))) return null;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The keyword rules. Order: unavailable, emergency, clarify, search, off topic. */
export function understandText(original: string, lang: Lang): MockUnderstanding {
  const text = normalise(original);
  const tokens = tokensOf(text);

  if (text.includes('test unavailable')) return { kind: 'unavailable' };
  if (has(text, tokens, EMERGENCY)) return { kind: 'emergency' };
  if (has(text, tokens, CAR) && has(text, tokens, NOISE)) {
    return { kind: 'clarify', question: clarifyCar(lang) };
  }

  const rule = CATEGORY_RULES.find(([, keywords]) => has(text, tokens, keywords));
  // A provider's own name ("Ali Tech") is searched as a name.
  const named = MOCK_PROVIDERS.find((p) => text.includes(normalise(p.name)));

  if (!rule && !named) {
    if (has(text, tokens, LESSONS)) return { kind: 'clarify', question: clarifyLessons(lang) };
    return { kind: 'off_topic' };
  }

  const understood = baseUnderstood(rule ? [rule[0]] : []);
  if (!rule && named) understood.q = named.name;

  if (has(text, tokens, NEAR)) {
    understood.radius_m = 500;
    understood.sort = 'distance';
  }
  if (has(text, tokens, CITY)) understood.radius_m = 20000;
  if (has(text, tokens, OPEN)) understood.open_now = true;
  if (has(text, tokens, CHEAP)) understood.sort = 'price';

  const price = PRICE.exec(text);
  if (price) {
    understood.max_price = Number(price[1].replace(',', '.'));
    const currency: PriceCurrency = has(text, tokens, LIRA) ? 'LBP' : 'USD';
    understood.price_currency = currency;
    let unit: PriceUnit = rule && HOURLY_PARENTS.has(parentSlug(rule[0])) ? 'hour' : 'visit';
    if (has(text, tokens, HOUR)) unit = 'hour';
    else if (has(text, tokens, VISIT)) unit = 'visit';
    else if (has(text, tokens, MONTH)) unit = 'month';
    understood.price_unit = unit;
  }

  const places = placesIn(text, tokens);
  const slugs = new Set(places.map((p) => p.slug));
  let placeOptions: MockPlace[] | null = null;
  let placeUnknown: string | null = null;
  if (places.length === 1) {
    const [place] = places;
    understood.place = { slug: place.slug, name_en: place.name_en, name_ar: place.name_ar, lat: place.lat, lng: place.lng };
  } else if (slugs.size > 1) {
    placeOptions = places;
  } else {
    placeUnknown = unknownPlace(original);
  }

  return { kind: 'search', understood, placeOptions, placeUnknown };
}

const RADIUS_WORDS: Record<Lang, Record<number, string>> = {
  en: { 500: '500 m', 1000: '1 km', 5000: '5 km', 20000: 'across the city' },
  ar: { 500: '500 م', 1000: '1 كم', 5000: '5 كم', 20000: 'بكل المدينة' },
};

const UNIT_WORDS: Record<Lang, Record<PriceUnit, string>> = {
  en: { hour: 'an hour', visit: 'a visit', job: 'a job', item: 'each', month: 'a month' },
  ar: { hour: 'بالساعة', visit: 'للزيارة', job: 'للعمل', item: 'للقطعة', month: 'بالشهر' },
};

const SORT_WORDS: Record<Lang, Record<SearchSort, string | null>> = {
  en: { best: null, distance: 'nearest first', price: 'cheapest first' },
  ar: { best: null, distance: 'الأقرب أولاً', price: 'الأرخص أولاً' },
};

/** The one-line summary, built from a template like the backend's (not by the AI). */
export function buildSummary(u: Understood, lang: Lang): string {
  const ar = lang === 'ar';
  const names = u.category_slugs.map((slug) => {
    const c = categoryBySlug(slug);
    return ar ? c.name_ar : c.name_en;
  });
  const what = names.length > 0 ? names.join(ar ? ' أو ' : ' or ') : `“${u.q ?? ''}”`;
  const where = u.place
    ? ar
      ? `في ${u.place.name_ar}`
      : `in ${u.place.name_en}`
    : ar
      ? 'قريب منك'
      : 'near you';
  const parts = [what, where, RADIUS_WORDS[lang][u.radius_m] ?? `${u.radius_m} m`];
  if (u.max_price !== null && u.price_unit) {
    const amount = u.price_currency === 'LBP' ? `${u.max_price} LBP` : ar ? `${u.max_price}$` : `$${u.max_price}`;
    parts.push(ar ? `حتى ${amount} ${UNIT_WORDS.ar[u.price_unit]}` : `up to ${amount} ${UNIT_WORDS.en[u.price_unit]}`);
  }
  if (u.open_now) parts.push(ar ? 'مفتوح الآن' : 'open now');
  const sort = SORT_WORDS[lang][u.sort];
  if (sort) parts.push(sort);
  return parts.join(' · ');
}

/** A short polite first message, built only from what the user said. */
export function buildDraft(original: string, lang: Lang): string {
  const said = original.trim().replace(/[.!?؟]+$/, '');
  return lang === 'ar'
    ? `مرحبا، وجدتك على تطبيق حدّك. ${said}. هل أنت متاح؟`
    : `Hello, I found you on Haddak. ${said.charAt(0).toUpperCase()}${said.slice(1)}. Are you available?`;
}
