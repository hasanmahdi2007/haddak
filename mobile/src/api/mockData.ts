/**
 * Development data for mock mode. Everything here is invented: the people,
 * the reviews and the prices. Photos are placeholder stock images.
 * The real seed data lives in the backend.
 */
import type { Category, ProviderDetail } from './types';

/** Haret Hreik: the seed area and the fallback when location is unavailable. */
export const HARET_HREIK = { lat: 33.8547, lng: 35.5097 } as const;

type CategoryRow = [
  id: number,
  slug: string,
  en: string,
  ar: string,
  icon: string,
  parent: number | null,
];

// Top-level rows first, then their children. sort_order is the position within the parent.
const CATEGORY_ROWS: CategoryRow[] = [
  [1, 'tech-repair', 'Tech repair', 'تصليح إلكترونيات', 'tech', null],
  [2, 'phone-repair', 'Phone repair', 'تصليح تلفونات', 'phone', 1],
  [3, 'laptop-repair', 'Laptop repair', 'تصليح لابتوب', 'laptop', 1],
  [4, 'appliance-repair', 'Home appliances', 'أدوات كهربائية', 'appliance', 1],

  [5, 'home-repairs', 'Home repairs', 'تصليحات البيت', 'home', null],
  [6, 'plumber', 'Plumber', 'سنكري', 'plumber', 5],
  [7, 'electrician', 'Electrician', 'كهربجي', 'electrician', 5],
  [8, 'house-painter', 'House painter', 'دهّان', 'painter', 5],
  [9, 'ac-technician', 'AC technician', 'تكييف وتبريد', 'ac', 5],

  [10, 'music-lessons', 'Music lessons', 'دروس موسيقى', 'music', null],
  [11, 'saxophone', 'Saxophone', 'ساكسوفون', 'saxophone', 10],
  [12, 'piano', 'Piano', 'بيانو', 'piano', 10],
  [13, 'oud', 'Oud', 'عود', 'oud', 10],
  [14, 'guitar', 'Guitar', 'غيتار', 'guitar', 10],

  [15, 'tutoring', 'Tutoring', 'دروس خصوصية', 'tutoring', null],
  [16, 'math', 'Math', 'رياضيات', 'math', 15],
  [17, 'languages', 'English and French', 'إنكليزي وفرنسي', 'languages', 15],
  [18, 'sciences', 'Physics and chemistry', 'فيزياء وكيمياء', 'science', 15],

  [19, 'doctors', 'Doctors', 'أطباء', 'doctor', null],
  [20, 'dermatologist', 'Dermatologist', 'طبيب جلد', 'dermatologist', 19],
  [21, 'dentist', 'Dentist', 'طبيب أسنان', 'dentist', 19],
  [22, 'pediatrician', 'Pediatrician', 'طبيب أطفال', 'pediatrician', 19],

  [23, 'art-lessons', 'Art lessons', 'دروس رسم وفنون', 'art', null],
  [24, 'drawing', 'Drawing and painting', 'رسم وتلوين', 'drawing', 23],
  [25, 'calligraphy', 'Arabic calligraphy', 'خط عربي', 'calligraphy', 23],

  [26, 'sweets', 'Sweets shops', 'حلويات', 'sweets', null],
  [27, 'arabic-sweets', 'Arabic sweets', 'حلويات عربية', 'arabic-sweets', 26],
  [28, 'cakes', 'Cakes and pastry', 'كاتو وباتيسري', 'cake', 26],

  [29, 'beauty', 'Barbers and beauty', 'حلاقة وتجميل', 'beauty', null],
  [30, 'barber', 'Barber', 'حلّاق رجالي', 'barber', 29],
  [31, 'hair-salon', 'Hair salon', 'صالون نسائي', 'salon', 29],

  [32, 'car-services', 'Car services', 'خدمات سيارات', 'car', null],
  [33, 'mechanic', 'Mechanic', 'ميكانيكي', 'mechanic', 32],
  [34, 'car-electrician', 'Car electrician', 'كهربجي سيارات', 'car-electric', 32],

  [35, 'tailors', 'Tailors', 'خياطة', 'tailor', null],
  [36, 'alterations', 'Alterations', 'تصليح ثياب', 'alterations', 35],
  [37, 'custom-tailoring', 'Custom tailoring', 'تفصيل', 'tailoring', 35],

  [38, 'cleaning', 'Cleaning', 'تنظيف', 'cleaning', null],
  [39, 'house-cleaning', 'House cleaning', 'تنظيف بيوت', 'house-cleaning', 38],
  [40, 'carpet-cleaning', 'Carpets and sofas', 'سجاد وكنبايات', 'carpet', 38],

  [41, 'fitness', 'Sports and fitness', 'رياضة ولياقة', 'fitness', null],
  [42, 'personal-trainer', 'Personal trainer', 'مدرّب شخصي', 'trainer', 41],
  [43, 'swimming', 'Swimming lessons', 'دروس سباحة', 'swimming', 41],
];

function buildCategories(): Category[] {
  const counters = new Map<number | null, number>();
  const rows = CATEGORY_ROWS.map(([id, slug, name_en, name_ar, icon, parent_id]) => {
    const next = (counters.get(parent_id) ?? 0) + 1;
    counters.set(parent_id, next);
    return { id, slug, name_en, name_ar, icon, parent_id, sort_order: next };
  });
  // API order: by sort_order (ties broken by id so the list is stable).
  return rows.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export const MOCK_CATEGORIES: Category[] = buildCategories();

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1200&h=900&fit=crop&q=70`;

/** Placeholder stock photos (Unsplash), keyed by what they show. */
const PHOTOS = {
  laptopCode: photo('1517694712202-14dd9538aa97'),
  laptop: photo('1588872657578-7efd1f1555ed'),
  brass: photo('1511192336575-5a79af67a629'),
  piano: photo('1520523839897-bd0b52f945a0'),
  books: photo('1503676260728-1c00da094a0b'),
  stethoscope: photo('1576091160550-2173dba999ef'),
  cleaning: photo('1581578731548-c64695cc6952'),
  electrician: photo('1621905251189-08b45d6a269e'),
  paints: photo('1513364776144-60967b0f800f'),
  pastry: photo('1519676867240-f03562e64548'),
  barber: photo('1503951914875-452162b0f3f1'),
  engine: photo('1486262715619-67b85e0b08d3'),
  pipes: photo('1607472586893-edb57bdc0e39'),
  doctor: photo('1612349317150-e413f6a5b16d'),
  craftTools: photo('1452860606245-08befc0ff44b'),
  roller: photo('1562259949-e8e7689d7828'),
  studio: photo('1598488035139-bdbb2231ce04'),
  classroom: photo('1509062522246-3755977927d7'),
  studyGroup: photo('1522202176988-66273c2fd55f'),
  writing: photo('1434030216411-0b793f4b4173'),
  sheetMusic: photo('1507838153414-b4b713384a76'),
  bookStack: photo('1497633762265-9d179a990aa6'),
  kitchen: photo('1556911220-bff31c812dba'),
} as const;

/** Move `distanceM` metres from Haret Hreik along a compass bearing. */
function offset(distanceM: number, bearingDeg: number): { lat: number; lng: number } {
  const bearing = (bearingDeg * Math.PI) / 180;
  const north = distanceM * Math.cos(bearing);
  const east = distanceM * Math.sin(bearing);
  const lat = HARET_HREIK.lat + north / 111_320;
  const lng = HARET_HREIK.lng + east / (111_320 * Math.cos((HARET_HREIK.lat * Math.PI) / 180));
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

interface ProviderSeed {
  slug: string;
  name: string;
  categoryId: number;
  /** Metres and compass bearing from Haret Hreik. */
  at: [distanceM: number, bearingDeg: number];
  area: string;
  price: string | null;
  rating: number;
  reviews: number;
  founding?: boolean;
  featured?: boolean;
  phone: string;
  whatsapp?: string;
  description: string;
  photos: string[];
  joined: string;
}

const SEEDS: ProviderSeed[] = [
  {
    slug: 'k7m2xq',
    name: 'Ali Tech',
    categoryId: 3,
    at: [184, 40],
    area: 'Haret Hreik',
    price: 'From $10',
    rating: 4.7,
    reviews: 23,
    founding: true,
    phone: '+96100001001',
    description:
      'Laptop repair for all brands: screens, keyboards, batteries, overheating and Windows reinstalls. Most repairs are done the same day, and you get the replaced part back. Diagnosis is free if you go ahead with the repair.',
    photos: [PHOTOS.laptop, PHOTOS.laptopCode, PHOTOS.craftTools],
    joined: '2026-09-02T09:00:00Z',
  },
  {
    slug: 'h4d9mc',
    name: 'Hadi Mobile Clinic',
    categoryId: 2,
    at: [320, 200],
    area: 'Haret Hreik',
    price: 'Screens from $15',
    rating: 4.4,
    reviews: 41,
    featured: true,
    phone: '+96100001002',
    description:
      'Phone screens, batteries and charging ports replaced while you wait. iPhone, Samsung, Xiaomi and Huawei. Three-month warranty on every part.',
    photos: [PHOTOS.craftTools],
    joined: '2026-09-10T09:00:00Z',
  },
  {
    slug: 'l8p3dd',
    name: 'Laptop Doctor',
    categoryId: 3,
    at: [760, 120],
    area: 'Bir el Abed',
    price: 'Diagnosis $5',
    rating: 4.9,
    reviews: 8,
    phone: '+96100001003',
    description:
      'Motherboard-level repair and data recovery. I open the laptop in front of you and tell you honestly whether it is worth fixing.',
    photos: [PHOTOS.laptopCode, PHOTOS.laptop],
    joined: '2026-10-01T09:00:00Z',
  },
  {
    slug: 'm2z7el',
    name: 'Mazen Electronics',
    categoryId: 4,
    at: [1400, 300],
    area: 'Ghobeiry',
    price: null,
    rating: 4.1,
    reviews: 12,
    phone: '+96100001004',
    description:
      'Washing machines, fridges, microwaves and TVs repaired at your home or in the shop. Original spare parts when available.',
    photos: [],
    joined: '2026-10-05T09:00:00Z',
  },
  {
    slug: 'a9h5pl',
    name: 'Abou Hassan Plumbing',
    categoryId: 6,
    at: [450, 80],
    area: 'Haret Hreik',
    price: 'Visit $10',
    rating: 4.6,
    reviews: 57,
    founding: true,
    phone: '+96100001005',
    description:
      'Leaks, water heaters, pumps and full bathroom installations. Thirty years in the neighbourhood. Available for emergencies until 10 at night.',
    photos: [PHOTOS.pipes],
    joined: '2026-09-03T09:00:00Z',
  },
  {
    slug: 'k3s8el',
    name: 'Kassem Electric',
    categoryId: 7,
    at: [620, 250],
    area: 'Bir el Abed',
    price: 'From $15 per visit',
    rating: 4.8,
    reviews: 34,
    founding: true,
    phone: '+96100001006',
    description:
      'Home wiring, breaker panels, generator and solar changeover switches, UPS and battery installation. Licensed electrician.',
    photos: [PHOTOS.electrician],
    joined: '2026-09-05T09:00:00Z',
  },
  {
    slug: 'j6w1pt',
    name: 'Jawad Painting',
    categoryId: 8,
    at: [2300, 160],
    area: 'Burj el Barajneh',
    price: '$3 per m²',
    rating: 4.2,
    reviews: 9,
    phone: '+96100001007',
    description:
      'Interior and exterior painting, damp treatment and gypsum board. Free visit and quote.',
    photos: [PHOTOS.roller],
    joined: '2026-10-12T09:00:00Z',
  },
  {
    slug: 'c5b2ac',
    name: 'Cool Breeze AC',
    categoryId: 9,
    at: [3900, 20],
    area: 'Chiyah',
    price: 'Service $20',
    rating: 4.5,
    reviews: 18,
    featured: true,
    phone: '+96100001008',
    description:
      'Split AC installation, gas refill, cleaning and repair. Same-week appointments in summer.',
    photos: [],
    joined: '2026-10-08T09:00:00Z',
  },
  {
    slug: 'r1s4sx',
    name: 'Rami Saad',
    categoryId: 11,
    at: [540, 330],
    area: 'Haret Hreik',
    price: '$20 per lesson',
    rating: 5.0,
    reviews: 6,
    phone: '+96100001009',
    description:
      'Saxophone lessons for beginners and returning players, alto and tenor. Conservatory graduate, ten years of teaching. The first lesson is a free trial, and I can lend you an instrument for the first month.',
    photos: [PHOTOS.brass, PHOTOS.sheetMusic, PHOTOS.studio],
    joined: '2026-10-15T09:00:00Z',
  },
  {
    slug: 'm7k2pn',
    name: 'Maya Khoury Piano Studio',
    categoryId: 12,
    at: [2800, 10],
    area: 'Furn el Chebbak',
    price: '$25 per lesson',
    rating: 4.9,
    reviews: 31,
    founding: true,
    phone: '+96100001010',
    description:
      'Piano for children from age six and for adults. Classical and oriental repertoire, preparation for conservatory exams.',
    photos: [PHOTOS.piano, PHOTOS.sheetMusic],
    joined: '2026-09-08T09:00:00Z',
  },
  {
    slug: 'b3o9ud',
    name: 'Beit el Oud',
    categoryId: 13,
    at: [6200, 340],
    area: 'Hamra',
    price: '$18 per lesson',
    rating: 4.7,
    reviews: 15,
    phone: '+96100001011',
    description:
      'Oud and maqam lessons, one to one or in small groups. Instruments available to rent.',
    photos: [PHOTOS.studio],
    joined: '2026-10-20T09:00:00Z',
  },
  {
    slug: 'z2h6mt',
    name: 'Zeinab Hamdan',
    categoryId: 16,
    at: [260, 150],
    area: 'Haret Hreik',
    price: '$12 per hour',
    rating: 4.8,
    reviews: 44,
    founding: true,
    featured: true,
    phone: '+96100001012',
    description:
      'Math tutoring for grades 7 to 12, Lebanese and French programmes. Brevet and Terminale exam preparation, at my place or yours.',
    photos: [PHOTOS.writing, PHOTOS.books],
    joined: '2026-09-01T09:00:00Z',
  },
  {
    slug: 'n8l4lg',
    name: 'Nour Language Corner',
    categoryId: 17,
    at: [950, 60],
    area: 'Ghobeiry',
    price: '$10 per hour',
    rating: 4.3,
    reviews: 19,
    phone: '+96100001013',
    description:
      'English and French conversation and school support. Small groups of four at most.',
    photos: [PHOTOS.studyGroup, PHOTOS.bookStack],
    joined: '2026-10-02T09:00:00Z',
  },
  {
    slug: 'h5f1ph',
    name: 'Hussein Fakih',
    categoryId: 18,
    at: [1700, 220],
    area: 'Mreijeh',
    price: '$15 per hour',
    rating: 0,
    reviews: 0,
    phone: '+96100001014',
    description:
      'Physics and chemistry for secondary classes. Engineering graduate, new on Haddak.',
    photos: [PHOTOS.classroom],
    joined: '2026-11-10T09:00:00Z',
  },
  {
    slug: 'd4l7dm',
    name: 'Dr. Lina Mansour',
    categoryId: 20,
    at: [880, 290],
    area: 'Bir el Abed',
    price: 'Consultation $40',
    rating: 4.6,
    reviews: 62,
    phone: '+96100001015',
    whatsapp: '+96100001016',
    description:
      'Dermatology clinic: acne, eczema, hair loss, moles and skin checks for children and adults. Appointments by WhatsApp, Monday to Saturday.',
    photos: [PHOTOS.stethoscope],
    joined: '2026-09-12T09:00:00Z',
  },
  {
    slug: 'd9k3hd',
    name: 'Dr. Karim Haddad',
    categoryId: 20,
    at: [5600, 5],
    area: 'Achrafieh',
    price: 'Consultation $60',
    rating: 4.9,
    reviews: 120,
    phone: '+96100001017',
    whatsapp: '+96100001018',
    description:
      'Dermatologist, member of the Lebanese Order of Physicians. Medical and cosmetic dermatology, laser treatments.',
    photos: [PHOTOS.doctor, PHOTOS.stethoscope],
    joined: '2026-09-20T09:00:00Z',
  },
  {
    slug: 's6n2dn',
    name: 'Dr. Samer Nasser Dental Clinic',
    categoryId: 21,
    at: [410, 20],
    area: 'Haret Hreik',
    price: 'Checkup $20',
    rating: 4.5,
    reviews: 28,
    phone: '+96100001019',
    whatsapp: '+96100001020',
    description:
      'General dentistry, fillings, whitening and braces. Evening appointments available.',
    photos: [],
    joined: '2026-09-25T09:00:00Z',
  },
  {
    slug: 'r3a8pd',
    name: 'Dr. Rola Awada',
    categoryId: 22,
    at: [3100, 170],
    area: 'Burj el Barajneh',
    price: 'Visit $30',
    rating: 4.7,
    reviews: 36,
    phone: '+96100001021',
    whatsapp: '+96100001022',
    description: 'Pediatrician. Vaccinations, newborn follow-up and same-day sick visits.',
    photos: [PHOTOS.doctor],
    joined: '2026-10-03T09:00:00Z',
  },
  {
    slug: 'a1d5ar',
    name: 'Atelier Dalia',
    categoryId: 24,
    at: [1250, 100],
    area: 'Chiyah',
    price: '$15 per class',
    rating: 4.8,
    reviews: 11,
    phone: '+96100001023',
    description:
      'Drawing, watercolour and acrylic classes for children and adults. All materials included.',
    photos: [PHOTOS.paints],
    joined: '2026-10-18T09:00:00Z',
  },
  {
    slug: 'k8z2kh',
    name: 'Khatt Studio',
    categoryId: 25,
    at: [7400, 345],
    area: 'Mar Elias',
    price: '$20 per class',
    rating: 5.0,
    reviews: 3,
    phone: '+96100001024',
    description:
      'Arabic calligraphy with Mahmoud Zein: ruqaa, naskh and diwani, from the first pen stroke.',
    photos: [],
    joined: '2026-11-01T09:00:00Z',
  },
  {
    slug: 'h2r6sw',
    name: 'Helwayat Al Rida',
    categoryId: 27,
    at: [300, 270],
    area: 'Haret Hreik',
    price: 'Baklava $14 per kg',
    rating: 4.6,
    reviews: 88,
    founding: true,
    phone: '+96100001025',
    whatsapp: '+96100001026',
    description:
      'Baklava, maamoul and knefeh every morning, and trays to order for occasions. Family shop since 1994. Delivery inside Dahieh.',
    photos: [PHOTOS.pastry, PHOTOS.kitchen],
    joined: '2026-09-04T09:00:00Z',
  },
  {
    slug: 's9k4ck',
    name: 'Sukkar Patisserie',
    categoryId: 28,
    at: [2000, 45],
    area: 'Chiyah',
    price: 'Cakes from $18',
    rating: 4.4,
    reviews: 25,
    phone: '+96100001027',
    description: 'Birthday and wedding cakes made to order, with two days of notice.',
    photos: [PHOTOS.kitchen],
    joined: '2026-10-09T09:00:00Z',
  },
  {
    slug: 's1a7br',
    name: 'Salon Abbas',
    categoryId: 30,
    at: [150, 190],
    area: 'Haret Hreik',
    price: 'Haircut $5',
    rating: 4.3,
    reviews: 67,
    phone: '+96100001028',
    description:
      'Haircut, beard and hot-towel shave. No appointment needed, open until 9 at night.',
    photos: [PHOTOS.barber],
    joined: '2026-09-15T09:00:00Z',
  },
  {
    slug: 'g4a9mc',
    name: 'Garage Al Amana',
    categoryId: 33,
    at: [1100, 180],
    area: 'Mreijeh',
    price: 'Inspection $10',
    rating: 4.5,
    reviews: 39,
    phone: '+96100001029',
    description:
      'Mechanics, brakes, oil change and computer diagnosis for all car makes. You see the old part before you pay.',
    photos: [PHOTOS.engine],
    joined: '2026-09-18T09:00:00Z',
  },
  {
    slug: 'k6a3tl',
    name: 'Khayyat Abou Ali',
    categoryId: 36,
    at: [690, 15],
    area: 'Haret Hreik',
    price: 'From $3',
    rating: 4.9,
    reviews: 14,
    phone: '+96100001030',
    description:
      'Trousers shortened, zips replaced, dresses and suits adjusted. Ready the next day.',
    photos: [],
    joined: '2026-10-22T09:00:00Z',
  },
  {
    slug: 'b7h1cl',
    name: 'Bright Home Cleaning',
    categoryId: 39,
    at: [4500, 130],
    area: 'Hadath',
    price: '$8 per hour',
    rating: 4.0,
    reviews: 7,
    phone: '+96100001031',
    description:
      'House and office cleaning by trained teams of two. We bring our own supplies.',
    photos: [PHOTOS.cleaning],
    joined: '2026-10-25T09:00:00Z',
  },
  {
    slug: 't5c8ft',
    name: 'Coach Tarek',
    categoryId: 42,
    at: [12500, 30],
    area: 'Antelias',
    price: '$15 per session',
    rating: 4.6,
    reviews: 21,
    phone: '+96100001032',
    description:
      'Personal training at home or outdoors: weight loss, strength and injury recovery.',
    photos: [],
    joined: '2026-10-28T09:00:00Z',
  },
];

function categoryRef(id: number) {
  const category = MOCK_CATEGORIES.find((item) => item.id === id);
  if (!category) throw new Error(`Mock data: unknown category ${id}`);
  const { slug, name_en, name_ar, icon } = category;
  return { id, slug, name_en, name_ar, icon };
}

/** Stable fake UUID so links keep working between reloads. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** All mock providers are verified; distance_m is filled in per request. */
export const MOCK_PROVIDERS: ProviderDetail[] = SEEDS.map((seed, index) => {
  const { lat, lng } = offset(seed.at[0], seed.at[1]);
  return {
    id: uuid(index + 1),
    slug: seed.slug,
    name: seed.name,
    category: categoryRef(seed.categoryId),
    area_name: seed.area,
    price_text: seed.price,
    avg_rating: seed.rating,
    review_count: seed.reviews,
    verified: true,
    founding_member: seed.founding ?? false,
    featured: seed.featured ?? false,
    lat,
    lng,
    distance_m: null,
    cover_photo_url: seed.photos[0] ?? null,
    description: seed.description,
    phone: seed.phone,
    whatsapp: seed.whatsapp ?? null,
    photos: seed.photos,
    created_at: seed.joined,
  };
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const REVIEW_AUTHORS = [
  'Rana',
  'Hassan',
  'Mira',
  'Jad',
  'Layal',
  'Karim',
  'Nadine',
  'Ali',
  'Sara',
  'Fatima',
  'Omar',
  'Maya',
  'Hadi',
  'Zainab',
  'Georges',
  'Rima',
  'Tony',
  'Hiba',
  'Mohammad',
  'Lara',
];

/** Comments by star rating. People in Lebanon write reviews in both languages. */
export const REVIEW_COMMENTS: Record<number, string[]> = {
  5: [
    'Fixed it in an hour. Honest price.',
    'شغل نضيف وسعر منيح. بنصح فيه.',
    'Very professional and on time. Will come back.',
    'من أحسن الناس يلي تعاملت معهم بالمنطقة.',
    'Explained everything before starting and did not overcharge.',
    'خدمة ممتازة، الله يعطيه العافية.',
    'Answered on WhatsApp within minutes.',
    '',
  ],
  4: [
    'Good work. Took a day longer than promised.',
    'منيح كتير، بس الموعد تأخّر شوي.',
    'Fair price and friendly.',
    'شغله مرتّب والسعر مقبول.',
    'Would recommend, parking is difficult though.',
    '',
  ],
  3: [
    'Okay overall. Had to call twice to get an appointment.',
    'الشغل مقبول بس في أرخص.',
    'Did the job, nothing special.',
  ],
  2: ['Came late and the problem returned after a week.', 'ما كان متل ما توقّعت.'],
  1: ['Did not show up.'],
};
