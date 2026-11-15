import type { Strings } from './en';

/**
 * Arabic strings, written the way people in Lebanon read apps: simple, light
 * Lebanese wording, not a word-for-word translation of the English.
 * Digits stay Western (1, 2, 3), as on Lebanese price lists and phone numbers.
 */
export const ar: Strings = {
  appName: 'حدّك',

  language: {
    switchTo: 'English',
    switchToLabel: 'غيّر اللغة للإنكليزية',
  },

  common: {
    back: 'رجوع',
    tryAgain: 'جرّب مرة تانية',
  },

  units: {
    m: '{n} م',
    km: '{n} كم',
  },

  radius: {
    label: 'لأي مسافة؟',
    r500: '500 م',
    r1000: '1 كم',
    r5000: '5 كم',
    city: 'المدينة',
    within500: 'ضمن 500 م',
    within1000: 'ضمن 1 كم',
    within5000: 'ضمن 5 كم',
    withinCity: 'بكل المدينة',
  },

  home: {
    question: 'مين بدّك حدّك؟',
    locating: 'عم نحدّد موقعك…',
    located: 'عم نبحث حول موقعك',
    fallback: 'عم نبحث حول حارة حريك',
    fallbackHint: 'شغّل الموقع لنبحث حواليك.',
    useMyLocation: 'استعمل موقعي',
    categories: 'الفئات',
    allCategories: 'كل الفئات',
    allIn: 'كل {name}',
    searchAll: 'ابحث بكل الفئات',
    searchIn: 'ابحث في {name}',
    categoriesError: 'ما قدرنا نحمّل الفئات',
    categoriesErrorBody: 'تأكّد من الإنترنت وجرّب مرة تانية.',
    hasMore: '{name}، في خيارات أكتر',
  },

  results: {
    everyone: 'كل القريبين',
    count: {
      zero: 'ما في نتائج {where}',
      one: 'نتيجة واحدة {where}',
      two: 'نتيجتين {where}',
      few: '{n} نتائج {where}',
      many: '{n} نتيجة {where}',
      other: '{n} نتيجة {where}',
    },
    searching: 'عم نبحث {where}…',
    viewList: 'لائحة',
    viewMap: 'خريطة',
    viewToggle: 'طريقة عرض النتائج',
    loading: 'عم نحمّل النتائج',
    mapTitle: 'الخريطة جايي قريباً',
    mapBody: 'بالتحديث الجايي بتشوف هالنتائج على الخريطة. هلّق كل شي موجود باللائحة.',
    mapAction: 'رجوع للّائحة',
    emptyTitle: 'ما في حدا {where} بعد',
    emptyBody: 'حدّك بعده عم يضيف ناس موثّقين بهالمنطقة. جرّب مسافة أبعد.',
    emptyAction: 'ابحث {where}',
    emptyCityBody: 'حدّك بعده عم يضيف ناس موثّقين بهالمنطقة. جرّب فئة تانية.',
    emptyCityAction: 'غيّر الفئة',
    errorTitle: 'ما قدرنا نحمّل النتائج',
    errorBody: 'تأكّد من الإنترنت وجرّب مرة تانية.',
    openProfile: 'افتح الصفحة',
  },

  badges: {
    verified: 'موثّق',
    verifiedBody: 'حدّك تأكّد من إثبات هالشغل قبل ما يعرضه.',
    founding: 'عضو مؤسّس',
    featured: 'مميّز',
    featuredLabel: 'مميّز، ظهور مدفوع',
  },

  rating: {
    none: 'جديد',
    noneLabel: 'ما في تقييمات بعد',
    label: {
      zero: 'ما في تقييمات بعد',
      one: 'التقييم {rating} من 5، تقييم واحد',
      two: 'التقييم {rating} من 5، تقييمين',
      few: 'التقييم {rating} من 5، {n} تقييمات',
      many: 'التقييم {rating} من 5، {n} تقييم',
      other: 'التقييم {rating} من 5، {n} تقييم',
    },
    stars: '{n} نجوم من 5',
  },

  provider: {
    whatsapp: 'واتساب',
    call: 'اتصال',
    whatsappLabel: 'راسل {name} على واتساب',
    callLabel: 'اتّصل بـ {name}',
    share: 'شارك هالصفحة',
    shareMessage: '{name} على حدّك: {url}',
    greeting: 'مرحبا، لقيتك على تطبيق حدّك.',
    about: 'نبذة',
    price: 'السعر',
    rating: 'التقييم',
    distance: 'المسافة',
    askPrice: 'اسأل',
    away: 'على بعد {distance}',
    reviews: 'التقييمات',
    reviewCount: {
      zero: 'ما في تقييمات بعد',
      one: 'تقييم واحد',
      two: 'تقييمين',
      few: '{n} تقييمات',
      many: '{n} تقييم',
      other: '{n} تقييم',
    },
    noReviews: 'ما في تقييمات بعد',
    noReviewsBody: 'كون أول واحد بيتواصل مع {name}.',
    moreReviews: 'اعرض تقييمات أكتر',
    reviewsError: 'ما قدرنا نحمّل التقييمات',
    photo: 'صورة {i} من {n}',
    noPhoto: 'ما في صور بعد',
    whatsappFailed: 'ما قدرنا نفتح واتساب. جرّب الاتصال.',
    callFailed: 'ما قدرنا نبدأ الاتصال. الرقم: {phone}',
    notFoundTitle: 'هالصفحة مش متوفّرة',
    notFoundBody: 'يمكن انشالت، أو الرابط غلط.',
    notFoundAction: 'رجوع للبحث',
    errorTitle: 'ما قدرنا نحمّل هالصفحة',
    errorBody: 'تأكّد من الإنترنت وجرّب مرة تانية.',
    loading: 'عم نحمّل الصفحة',
    dismiss: 'سكّر',
  },
};
