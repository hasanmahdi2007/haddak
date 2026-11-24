/**
 * Development data for mock mode. Everything here is invented: the people,
 * the reviews and the prices. Photos are placeholder stock images.
 * The real seed data lives in the backend.
 */
import type {
  Banner,
  Category,
  DayKey,
  OpeningHours,
  PlaceOption,
  PriceUnit,
  ProviderDetail,
  Story,
  TimeRange,
} from './types';

/** Haret Hreik: the seed area and the fallback when location is unavailable. */
export const HARET_HREIK = { lat: 33.8547, lng: 35.5097 } as const;

type CategoryRow = [
  id: number,
  slug: string,
  en: string,
  ar: string,
  icon: string,
  parent: number | null,
  /** Extra search words (Arabic, English, Arabizi), like the backend's `aliases`. */
  aliases?: string[],
];

// Top-level rows first, then their children. sort_order is the position within the parent.
const CATEGORY_ROWS: CategoryRow[] = [
  [1, 'tech-repair', 'Tech repair', 'تصليح إلكترونيات', 'tech', null],
  [2, 'phone-repair', 'Phone repair', 'تصليح تلفونات', 'phone', 1],
  [3, 'laptop-repair', 'Laptop repair', 'تصليح لابتوب', 'laptop', 1],
  [4, 'appliance-repair', 'Home appliances', 'أدوات كهربائية', 'appliance', 1],

  // Same slug as the backend ("home-repair"), so Home's short list finds it.
  [5, 'home-repair', 'Home repairs', 'تصليحات البيت', 'home', null, ['maintenance', 'صيانة']],
  [6, 'plumber', 'Plumber', 'سنكري', 'plumber', 5, ['sankari', 'sankary', 'plumbing', 'سباك', 'تمديدات']],
  [7, 'electrician', 'Electrician', 'كهربجي', 'electrician', 5, ['kahrabje', 'kahraba', 'كهربائي']],
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

  [19, 'doctors', 'Doctors', 'أطباء', 'doctor', null, ['doctor', 'dr', 'hakim', 'حكيم', 'دكتور']],
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
  [30, 'barber', 'Barber', 'حلّاق رجالي', 'barber', 29, ['7ella2', 'hallak', 'haircut', 'حلاق']],
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

  // Category tree v2 (docs/SCHEMA.md, 2026-11-24): a few new children under the old
  // groups, then the new groups. Not every v2 category is here; enough to try the
  // "All categories" screen, its filter and text search in mock mode.
  [44, 'pharmacy', 'Pharmacy', 'صيدلية', 'stethoscope', 19, ['pharmacie', 'saydaliyye', 'dawa', 'دوا']],
  [45, 'optician', 'Optician', 'نظارات', 'glasses', 19, ['glasses', 'nadarat', 'عوينات']],
  [46, 'hospital', 'Hospital', 'مستشفى', 'hospital', 19, ['mustashfa', 'emergency', 'طوارئ']],
  [47, 'locksmith', 'Locksmith', 'مفاتيحي', 'key', 5, ['keys', 'mafatihje', 'مفاتيح']],
  [48, 'movers', 'Movers', 'نقل عفش', 'truck', 5, ['moving', 'na2el 3afesh', 'عفش']],
  [49, 'tyres', 'Tyres', 'دواليب', 'tyre', 32, ['tires', 'dawalib', 'كوشوك']],
  [50, 'fuel-station', 'Fuel station', 'محطة بنزين', 'fuel', 32, ['gas station', 'benzine', 'بنزين']],

  [51, 'power', 'Power & energy', 'كهربا وطاقة', 'bolt', null, ['electricity', 'كهربا']],
  [52, 'solar', 'Solar panels', 'طاقة شمسية', 'bolt', 51, ['solar', 'alwa7', 'ألواح']],
  [53, 'generator', 'Generators', 'موتير / مولّد', 'bolt', 51, ['moteur', 'motor', 'اشتراك']],

  [54, 'food-drink', 'Food & drink', 'أكل وشرب', 'utensils', null, ['food', 'akl', 'eat', 'أكل']],
  [55, 'restaurant', 'Restaurant', 'مطعم', 'utensils', 54, ['resto', 'mat3am', 'مطاعم']],
  [56, 'shawarma-manakish', 'Shawarma & manakish', 'شاورما ومناقيش', 'sandwich', 54, ['falafel', 'فلافل', 'man2oushe', 'manousheh', 'منقوشة', 'shawarma']],
  [57, 'fast-food', 'Fast food', 'وجبات سريعة', 'burger', 54, ['burger', 'pizza', 'بيتزا', 'برغر']],
  [58, 'cafe', 'Café', 'كافيه', 'coffee', 54, ['coffee', 'ahwe', 'قهوة']],
  [59, 'bakery', 'Bakery', 'فرن', 'croissant', 54, ['furn', 'bread', 'خبز', 'كعك']],
  [60, 'juice-ice-cream', 'Juice & ice cream', 'عصير وبوظة', 'ice-cream', 54, ['juice', '3asir', 'booza', 'بوظة']],

  [61, 'groceries', 'Groceries', 'سمانة وخضرة', 'cart', null, ['grocery', 'sammane']],
  [62, 'supermarket', 'Supermarket', 'سوبرماركت', 'cart', 61, ['market', 'سوبر ماركت']],
  [63, 'mini-market', 'Mini-market', 'دكّانة', 'store', 61, ['dekkene', 'دكان', 'ميني ماركت']],
  [64, 'greengrocer', 'Greengrocer', 'خضرجي', 'apple', 61, ['vegetables', 'khodra', 'خضرة', 'فواكه']],
  [65, 'butcher', 'Butcher', 'لحّام', 'beef', 61, ['meat', 'la77am', 'لحمة']],

  [66, 'fashion', 'Fashion', 'أزياء', 'shirt', null, ['clothes', 'تياب']],
  [67, 'clothes', 'Clothes', 'ألبسة', 'shirt', 66, ['boutique', 'tiyab', 'ثياب']],
  [68, 'shoes', 'Shoes', 'أحذية', 'shoe', 66, ['sneakers', 'sabbat', 'صبابيط']],
  [69, 'jewellery', 'Jewellery', 'مجوهرات', 'gem', 66, ['jewelry', 'gold', 'dahab', 'دهب']],
  [70, 'perfume-cosmetics', 'Perfume & cosmetics', 'عطور وتجميل', 'spray', 66, ['perfume', '3otour', 'makeup', 'مكياج']],

  [71, 'home-shops', 'Home shops', 'أدوات ومفروشات', 'sofa', null, ['home', 'furniture']],
  [72, 'hardware', 'Hardware', 'خردوات وعدّة', 'hammer', 71, ['tools', 'khordawet', 'عدة']],
  [73, 'furniture', 'Furniture', 'مفروشات', 'sofa', 71, ['sofa', 'كنباي']],
  [74, 'gas-cylinders', 'Gas cylinders', 'قناني غاز', 'flame', 71, ['gas', 'ghaz', 'غاز']],

  [75, 'pets', 'Pets', 'حيوانات أليفة', 'paw', null, ['pet', 'animals']],
  [76, 'vet', 'Vet', 'طبيب بيطري', 'stethoscope', 75, ['veterinary', 'بيطري']],
  [77, 'pet-shop', 'Pet shop', 'محل حيوانات', 'paw', 75, ['cat food', 'dog food', 'أكل قطط']],

  [78, 'everyday-services', 'Everyday services', 'خدمات يومية', 'briefcase', null, ['services']],
  [79, 'laundry', 'Laundry & dry cleaning', 'مصبغة', 'washing-machine', 78, ['dry cleaning', 'masbagha', 'كوي']],
  [80, 'printing', 'Printing & copies', 'طباعة وتصوير', 'printer', 78, ['print', 'copies', 'photocopy']],
  [81, 'money-transfer', 'Money transfer', 'تحويل أموال', 'banknote', 78, ['omt', 'whish', 'western union', 'صيرفة']],
  [82, 'lawyer', 'Lawyer', 'محامي', 'scale', 78, ['avocat', 'mo7ame', 'محامية']],

  [83, 'phones-electronics', 'Phones & electronics', 'تلفونات وإلكترونيات', 'smartphone', null, ['electronics']],
  [84, 'phone-shop', 'Phone shop', 'محل تلفونات', 'smartphone', 83, ['mobile', 'iphone', 'خطوط', 'تشريج']],
  [85, 'computer-shop', 'Computer shop', 'محل كمبيوتر', 'monitor', 83, ['pc', 'laptop shop', 'كمبيوتر']],

  [86, 'events', 'Events', 'مناسبات', 'party', null, ['party', 'wedding', 'عرس']],
  [87, 'florist', 'Florist', 'زهور', 'flower', 86, ['flowers', 'ward', 'ورد']],
  [88, 'event-venue', 'Event venue', 'صالة مناسبات', 'venue', 86, ['hall', 'salle', 'صالة']],

  [89, 'books-gifts', 'Books & gifts', 'كتب وهدايا', 'gift', null, ['gifts', 'books']],
  [90, 'bookshop', 'Bookshop', 'مكتبة', 'book', 89, ['books', 'maktabe', 'كتب']],
  [91, 'stationery', 'Stationery', 'قرطاسية', 'pencil', 89, ['school supplies', 'قرطاسيه']],
  [92, 'toy-shop', 'Toy shop', 'ألعاب ولاد', 'blocks', 89, ['toys', 'al3ab', 'العاب']],

  [93, 'volunteering', 'Volunteering & NGOs', 'تطوّع وجمعيات', 'hand-heart', null, ['volunteer', 'charity', 'خيرية']],
  [94, 'ngo', 'NGO', 'جمعية', 'hand-heart', 93, ['association', 'jam3iyye', 'منظمة']],
  [95, 'food-bank', 'Food bank', 'بنك طعام', 'soup', 93, ['food aid', 'حصص غذائية']],
];

function buildCategories(): Category[] {
  const counters = new Map<number | null, number>();
  const rows = CATEGORY_ROWS.map(([id, slug, name_en, name_ar, icon, parent_id, aliases = []]) => {
    const next = (counters.get(parent_id) ?? 0) + 1;
    counters.set(parent_id, next);
    return { id, slug, name_en, name_ar, icon, parent_id, sort_order: next, aliases };
  });
  // API order: by sort_order (ties broken by id so the list is stable).
  return rows.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export const MOCK_CATEGORIES: Category[] = buildCategories();

/**
 * A few places for the mock assistant, like the backend's small hand-made `places`
 * table: names people type (English, Arabic, Arabizi), a centre and a search radius.
 * Centres are approximate. Two "Jdeideh"s exist, so the assistant asks which one.
 */
export interface MockPlace extends PlaceOption {
  lat: number;
  lng: number;
  names: string[];
}

export const MOCK_PLACES: MockPlace[] = [
  { slug: 'haret-hreik', name_en: 'Haret Hreik', name_ar: 'حارة حريك', district: 'Baabda', lat: 33.8547, lng: 35.5097, names: ['haret hreik', 'hreik', 'حارة حريك', 'حريك'] },
  { slug: 'ghobeiry', name_en: 'Ghobeiry', name_ar: 'الغبيري', district: 'Baabda', lat: 33.8655, lng: 35.4985, names: ['ghobeiry', 'ghbeire', 'الغبيري', 'غبيري'] },
  { slug: 'hamra', name_en: 'Hamra', name_ar: 'الحمرا', district: 'Beirut', lat: 33.8963, lng: 35.4823, names: ['hamra', 'الحمرا', 'الحمراء', 'حمرا'] },
  { slug: 'jounieh', name_en: 'Jounieh', name_ar: 'جونيه', district: 'Keserwan', lat: 33.9808, lng: 35.6178, names: ['jounieh', 'jouniyeh', 'جونيه', 'جونية'] },
  { slug: 'jdeideh-metn', name_en: 'Jdeideh', name_ar: 'الجديدة', district: 'Metn', lat: 33.8925, lng: 35.5592, names: ['jdeideh', 'jdeide', 'الجديدة', 'جديدة'] },
  { slug: 'jdeidet-marjayoun', name_en: 'Jdeideh', name_ar: 'الجديدة', district: 'Marjayoun', lat: 33.3622, lng: 35.5844, names: ['jdeideh', 'jdeide', 'الجديدة', 'جديدة'] },
];

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
  /** Default true. False: Haddak has not checked this one. */
  verified?: boolean;
  /** Default true. False: listed from a suggestion, no owner yet. */
  claimed?: boolean;
  /** A paid card above the results, with this one-line hook. */
  sponsorHook?: string;
  /** Null only for a listing imported from OpenStreetMap without a number. */
  phone: string | null;
  whatsapp?: string;
  /** 'osm': imported from OpenStreetMap (shown with attribution). */
  dataSource?: 'osm';
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
    sponsorHook: 'Screen replaced in 30 minutes, or it is free.',
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
  // Not verified yet. The first two were listed from a suggestion and have no owner.
  {
    slug: 'u1r4sp',
    name: 'Rami Phone Corner',
    categoryId: 2,
    at: [240, 300],
    area: 'Haret Hreik',
    price: null,
    rating: 0,
    reviews: 0,
    verified: false,
    claimed: false,
    phone: '+96100001033',
    description: '',
    photos: [],
    joined: '2026-11-10T09:00:00Z',
  },
  {
    slug: 'u2k8bz',
    name: 'Um Khalil Home Sweets',
    categoryId: 27,
    at: [390, 150],
    area: 'Haret Hreik',
    price: null,
    rating: 0,
    reviews: 0,
    verified: false,
    claimed: false,
    phone: '+96100001034',
    description: '',
    photos: [],
    joined: '2026-11-11T09:00:00Z',
  },
  {
    slug: 'u3j5el',
    name: 'Jad Electric',
    categoryId: 7,
    at: [520, 250],
    area: 'Haret Hreik',
    price: 'Visit $8',
    rating: 4.3,
    reviews: 3,
    verified: false,
    phone: '+96100001035',
    description: 'House wiring, fuse boxes and generator switch-overs.',
    photos: [PHOTOS.electrician],
    joined: '2026-11-12T09:00:00Z',
  },
  {
    slug: 'u4n7lp',
    name: 'Nour Laptop Fix',
    categoryId: 3,
    at: [610, 20],
    area: 'Bir el Abed',
    price: 'From $8',
    rating: 4.0,
    reviews: 2,
    verified: false,
    phone: '+96100001036',
    description: 'Laptop cleaning, new batteries and Windows installs from home.',
    photos: [],
    joined: '2026-11-13T09:00:00Z',
  },
  {
    slug: 'u5s2br',
    name: 'Salon Abou Fadi',
    categoryId: 30,
    at: [820, 95],
    area: 'Bir el Abed',
    price: 'Haircut $4',
    rating: 0,
    reviews: 0,
    verified: false,
    phone: '+96100001037',
    description: 'Neighbourhood barber: haircut, beard and hot towel.',
    photos: [PHOTOS.barber],
    joined: '2026-11-14T09:00:00Z',
  },
  // Imported from OpenStreetMap: no owner, no number, no photos. Shows the claim card
  // and the attribution line.
  {
    slug: 'o1d6cm',
    name: 'Centre Dentaire Al Amal',
    categoryId: 21,
    at: [700, 200],
    area: 'Haret Hreik',
    price: null,
    rating: 0,
    reviews: 0,
    verified: false,
    claimed: false,
    phone: null,
    dataSource: 'osm',
    description: '',
    photos: [],
    joined: '2026-11-17T09:00:00Z',
  },
];

function categoryRef(id: number) {
  const category = MOCK_CATEGORIES.find((item) => item.id === id);
  if (!category) throw new Error(`Mock data: unknown category ${id}`);
  const { slug, name_en, name_ar, icon } = category;
  return { id, slug, name_en, name_ar, icon };
}

// Opening hours, shared out by position in the list so the mock shows every case:
// a split day, a short Saturday, long days, evenings only, and no hours given.
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
const everyDay = (ranges: TimeRange[], days: readonly DayKey[]): OpeningHours =>
  Object.fromEntries(days.map((day) => [day, ranges]));

const HOURS_PATTERNS: (OpeningHours | null)[] = [
  // Shop with a lunch break, a short Saturday, closed on Sunday.
  { ...everyDay([['09:00', '13:00'], ['15:00', '19:00']], WEEKDAYS), sat: [['10:00', '14:00']] },
  // Open long hours every day.
  everyDay([['08:00', '22:00']], [...WEEKDAYS, 'sat', 'sun']),
  // Mornings only, Monday to Saturday.
  everyDay([['08:00', '14:00']], [...WEEKDAYS, 'sat']),
  // Afternoons and evenings (after-school teachers), closed on Friday.
  everyDay([['15:00', '21:00']], ['mon', 'tue', 'wed', 'thu', 'sat', 'sun']),
  // Hours not provided.
  null,
];

/** Providers (by position) that chose to show how many people contacted them this month. */
const CONTACT_COUNTS: Record<number, number> = { 0: 12, 1: 31, 3: 2, 6: 1, 10: 104, 14: 7 };

const FOLLOWER_COUNTS: Record<number, number> = { 0: 48, 1: 132, 4: 17, 9: 64, 20: 211, 22: 9 };

/** "Yes, I hired them" answers in the last 90 days, by provider index. Others have none. */
const CONFIRMED_HIRES: Record<number, number> = { 0: 7, 1: 12, 2: 3, 4: 5, 5: 2, 9: 4 };

/**
 * Structured prices (amount in USD, unit), by slug, for the price filter. They match
 * each `price_text`; "$3 per m²" has no unit in the list, so it stays text only,
 * like a provider who never filled the structured fields in.
 */
const STRUCTURED_PRICES: Record<string, [amount: number, unit: PriceUnit]> = {
  k7m2xq: [10, 'job'],
  h4d9mc: [15, 'job'],
  l8p3dd: [5, 'visit'],
  a9h5pl: [10, 'visit'],
  k3s8el: [15, 'visit'],
  c5b2ac: [20, 'visit'],
  r1s4sx: [20, 'hour'],
  m7k2pn: [25, 'hour'],
  b3o9ud: [18, 'hour'],
  z2h6mt: [12, 'hour'],
  n8l4lg: [10, 'hour'],
  h5f1ph: [15, 'hour'],
  d4l7dm: [40, 'visit'],
  d9k3hd: [60, 'visit'],
  s6n2dn: [20, 'visit'],
  r3a8pd: [30, 'visit'],
  a1d5ar: [15, 'hour'],
  k8z2kh: [20, 'hour'],
  h2r6sw: [14, 'item'],
  s9k4ck: [18, 'item'],
  s1a7br: [5, 'job'],
  g4a9mc: [10, 'visit'],
  k6a3tl: [3, 'job'],
  b7h1cl: [8, 'hour'],
  t5c8ft: [15, 'hour'],
  u3j5el: [8, 'visit'],
  u4n7lp: [8, 'job'],
  u5s2br: [4, 'job'],
};

/** Stable fake UUID so links keep working between reloads. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/**
 * Shops and places "imported from OpenStreetMap" in the v2 categories (all names
 * invented): not verified, no owner, about half with a number. They make the mock
 * big enough to show paging ("Showing 20 of N"), map clusters and text search
 * ("falafel", "فرن", an area name) in mock mode.
 */
const OSM_FILL: [name: string, categoryId: number, area: string][] = [
  ['Falafel Al Hayy', 56, 'Haret Hreik'],
  ['Manakish Um Ali', 56, 'Haret Hreik'],
  ['Shawarma Al Mafraq', 56, 'Bir el Abed'],
  ['Furn Al Saha', 59, 'Haret Hreik'],
  ['Furn Al Kanise', 59, 'Ghobeiry'],
  ['Snack Al Jisr', 57, 'Ghobeiry'],
  ['Burger Spot Hreik', 57, 'Haret Hreik'],
  ['Ahwet Al Hara', 58, 'Haret Hreik'],
  ['Café Zawaya', 58, 'Bir el Abed'],
  ['Booza Al Dayaa', 60, 'Haret Hreik'],
  ['Juice Corner', 60, 'Rouweiss'],
  ['Mat3am Al Bayt', 55, 'Chiyah'],
  ['Supermarket Al Amana', 62, 'Haret Hreik'],
  ['Dekkene Abou Hassan', 63, 'Haret Hreik'],
  ['Mini Market Al Nour', 63, 'Bir el Abed'],
  ['Khodra Al Bustan', 64, 'Ghobeiry'],
  ['Lahhame Al Kheir', 65, 'Haret Hreik'],
  ['Boutique Lara', 67, 'Haret Hreik'],
  ['Shoe Box', 68, 'Bir el Abed'],
  ['Dahab Al Sharq', 69, 'Ghobeiry'],
  ['Perfume Lab', 70, 'Haret Hreik'],
  ['Khordawet Al Mahatta', 72, 'Chiyah'],
  ['Ghaz Al Dahye', 74, 'Haret Hreik'],
  ['Pharmacie Al Shifa', 44, 'Haret Hreik'],
  ['Pharmacie Al Rahma', 44, 'Ghobeiry'],
  ['Optic Vision', 45, 'Haret Hreik'],
  ['Masbagha Al Nadafa', 79, 'Haret Hreik'],
  ['Print Point', 80, 'Bir el Abed'],
  ['Hreik Money Transfer', 81, 'Haret Hreik'],
  ['Phone Zone', 84, 'Haret Hreik'],
  ['Moteur Al Hayy', 53, 'Haret Hreik'],
  ['Pet Corner', 77, 'Bir el Abed'],
  ['Ward w Zahr', 87, 'Ghobeiry'],
  ['Maktabet Al Jil', 90, 'Haret Hreik'],
  ['Toy Planet', 92, 'Chiyah'],
  ['Jam3iyyet Al Hayy', 94, 'Haret Hreik'],
];

const OSM_SEEDS: ProviderSeed[] = OSM_FILL.map(([name, categoryId, area], i) => ({
  slug: `osm${String(i + 1).padStart(3, '0')}`,
  name,
  categoryId,
  // Spread over about 4 km, with a dense knot near the centre so the map has clusters.
  at: [i < 12 ? 90 + i * 35 : 300 + ((i * 397) % 3900), (i * 71) % 360],
  area,
  price: null,
  rating: 0,
  reviews: 0,
  verified: false,
  claimed: false,
  phone: i % 2 === 0 ? `+961000020${String(i).padStart(2, '0')}` : null,
  dataSource: 'osm',
  description: '',
  photos: [],
  joined: '2026-11-20T09:00:00Z',
}));

/** Most mock providers are verified; a few are not. distance_m is filled in per request. */
export const MOCK_PROVIDERS: ProviderDetail[] = [...SEEDS, ...OSM_SEEDS].map((seed, index) => {
  const { lat, lng } = offset(seed.at[0], seed.at[1]);
  return {
    id: uuid(index + 1),
    slug: seed.slug,
    name: seed.name,
    category: categoryRef(seed.categoryId),
    area_name: seed.area,
    price_text: seed.price,
    price_amount: STRUCTURED_PRICES[seed.slug]?.[0] ?? null,
    price_unit: STRUCTURED_PRICES[seed.slug]?.[1] ?? null,
    price_currency: STRUCTURED_PRICES[seed.slug] ? 'USD' : null,
    avg_rating: seed.rating,
    review_count: seed.reviews,
    verified: seed.verified ?? true,
    claimed: seed.claimed ?? true,
    sponsored: seed.sponsorHook !== undefined,
    sponsor_hook: seed.sponsorHook ?? null,
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
    opening_hours: HOURS_PATTERNS[index % HOURS_PATTERNS.length],
    contacts_this_month: CONTACT_COUNTS[index] ?? null,
    // Filled in per request from the clock (see mock.ts).
    open_now: null,
    // The mock API keeps the "Available now" switches and fills this in.
    available_now: false,
    // Stories and banners are also filled in per request (mockStories and mockBanner below).
    has_active_story: false,
    banner_title: null,
    data_source: seed.dataSource ?? null,
    active_banner: null,
    follower_count: FOLLOWER_COUNTS[index] ?? (index * 7) % 23,
    is_following: false,
    confirmed_hires: CONFIRMED_HIRES[index] ?? 0,
  };
});

// ---------------------------------------------------------------------------
// Stories and banners
// ---------------------------------------------------------------------------

const HOUR_MS = 3_600_000;

/** Stories by provider number (1 is the first seed): [hours ago, text, photo or null]. Newest first. */
const STORY_SEEDS: Record<number, [hoursAgo: number, text: string, image: string | null][]> = {
  1: [
    [2, 'Two MacBook screens done before noon. Walk in, no appointment needed today.', null],
    [9, 'A new batch of original chargers arrived.', PHOTOS.laptop],
  ],
  2: [[1, 'iPhone 13 screens are back in stock. 30 minutes while you wait.', null]],
  5: [[5, 'On call tonight until 11 for leaks and blocked drains.', null]],
  10: [
    [3, 'Two evening piano slots opened for December: Tuesday and Thursday at 6.', null],
    [20, 'Our students played their first recital on Saturday. Proud of every one of them.', null],
  ],
  21: [[4, 'معمول العيد جاهز. الطلبيات لآخر الأسبوع.', null]],
  23: [[7, 'Open this Sunday from 10 to 4.', null]],
};

/** Offers by provider number: [title, text, discount percent, days left]. */
const BANNER_SEEDS: Record<
  number,
  [title: string, text: string | null, discount: number | null, daysLeft: number]
> = {
  2: ['Screen week', 'Every phone screen replacement, fitted while you wait.', 20, 5],
  10: ['First lesson free', 'Try one piano lesson before you decide.', null, 12],
  21: ['Eid boxes', 'Order a mixed box of 1 kg or more.', 15, 1],
};

/** The number at the end of a mock id (see `uuid`). */
const numberOf = (providerId: string) => Number(providerId.slice(-12));

/** A provider's active stories, dated back from this moment. */
export function mockStories(providerId: string): Story[] {
  const now = Date.now();
  return (STORY_SEEDS[numberOf(providerId)] ?? []).map(([hoursAgo, text, image], i) => ({
    id: `${providerId.slice(0, 24)}${String(700000000000 + i)}`,
    provider_id: providerId,
    text,
    image_url: image,
    created_at: new Date(now - hoursAgo * HOUR_MS).toISOString(),
    // A story lives for 24 hours.
    expires_at: new Date(now + (24 - hoursAgo) * HOUR_MS).toISOString(),
  }));
}

/** A provider's running offer, or null. */
export function mockBanner(providerId: string): Banner | null {
  const seed = BANNER_SEEDS[numberOf(providerId)];
  if (!seed) return null;
  const [title, text, discount_percent, daysLeft] = seed;
  const now = Date.now();
  return {
    title,
    text,
    discount_percent,
    starts_at: new Date(now - 48 * HOUR_MS).toISOString(),
    expires_at: new Date(now + daysLeft * 24 * HOUR_MS).toISOString(),
  };
}

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
