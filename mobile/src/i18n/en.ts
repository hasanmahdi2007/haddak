/** English strings. Keep keys identical to ar.ts. `{name}` marks a value filled in at runtime. */
export const en = {
  appName: 'Haddak',

  language: {
    switchTo: 'العربية',
    switchToLabel: 'Switch to Arabic',
  },

  common: {
    back: 'Back',
    tryAgain: 'Try again',
  },

  units: {
    m: '{n} m',
    km: '{n} km',
  },

  radius: {
    label: 'How far?',
    r500: '500 m',
    r1000: '1 km',
    r5000: '5 km',
    city: 'City',
    within500: 'within 500 m',
    within1000: 'within 1 km',
    within5000: 'within 5 km',
    withinCity: 'across the city',
  },

  home: {
    question: 'Who do you need nearby?',
    locating: 'Finding your location…',
    located: 'Searching around your location',
    fallback: 'Searching around Haret Hreik',
    fallbackHint: 'Turn on location to search around you.',
    useMyLocation: 'Use my location',
    categories: 'Categories',
    allCategories: 'All categories',
    allIn: 'All {name}',
    searchAll: 'Search all categories',
    searchIn: 'Search in {name}',
    categoriesError: "Couldn't load the categories",
    categoriesErrorBody: 'Check your connection and try again.',
    hasMore: '{name}, opens more choices',
  },

  results: {
    everyone: 'Everyone nearby',
    count: {
      zero: 'No results {where}',
      one: '1 result {where}',
      two: '2 results {where}',
      few: '{n} results {where}',
      many: '{n} results {where}',
      other: '{n} results {where}',
    },
    searching: 'Searching {where}…',
    viewList: 'List',
    viewMap: 'Map',
    viewToggle: 'Show results as',
    loading: 'Loading results',
    mapLabel: 'Map of results',
    mapHere: 'Your search position',
    mapSelected: 'selected',
    mapWebNote: 'Preview. The live map shows in the app.',
    emptyTitle: 'No one {where} yet',
    emptyBody: 'Haddak is still adding verified people in this area. Try a wider distance.',
    emptyAction: 'Search {where}',
    emptyCityBody: 'Haddak is still adding verified people in this area. Try another category.',
    emptyCityAction: 'Change category',
    errorTitle: "Couldn't load the results",
    errorBody: 'Check your connection and try again.',
    openProfile: 'Open profile',
  },

  badges: {
    verified: 'Verified',
    verifiedBody: 'Haddak checked proof of this work before listing it.',
    founding: 'Founding member',
    featured: 'Featured',
    featuredLabel: 'Featured, paid placement',
  },

  rating: {
    none: 'New',
    noneLabel: 'No reviews yet',
    label: {
      zero: 'No reviews yet',
      one: 'Rated {rating} out of 5, 1 review',
      two: 'Rated {rating} out of 5, 2 reviews',
      few: 'Rated {rating} out of 5, {n} reviews',
      many: 'Rated {rating} out of 5, {n} reviews',
      other: 'Rated {rating} out of 5, {n} reviews',
    },
    stars: '{n} out of 5 stars',
  },

  provider: {
    whatsapp: 'WhatsApp',
    call: 'Call',
    whatsappLabel: 'Message {name} on WhatsApp',
    callLabel: 'Call {name}',
    share: 'Share this profile',
    shareMessage: '{name} on Haddak: {url}',
    greeting: 'Hello, I found you on Haddak.',
    about: 'About',
    price: 'Price',
    rating: 'Rating',
    distance: 'Distance',
    askPrice: 'Ask',
    away: '{distance} away',
    reviews: 'Reviews',
    reviewCount: {
      zero: 'No reviews yet',
      one: '1 review',
      two: '2 reviews',
      few: '{n} reviews',
      many: '{n} reviews',
      other: '{n} reviews',
    },
    noReviews: 'No reviews yet',
    noReviewsBody: 'Be the first to contact {name}.',
    moreReviews: 'Show more reviews',
    reviewsError: "Couldn't load the reviews",
    photo: 'Photo {i} of {n}',
    noPhoto: 'No photos yet',
    whatsappFailed: "Couldn't open WhatsApp. Try calling instead.",
    callFailed: "Couldn't start the call. The number is {phone}.",
    notFoundTitle: "This profile isn't available",
    notFoundBody: 'It may have been removed, or the link is wrong.',
    notFoundAction: 'Back to search',
    errorTitle: "Couldn't load this profile",
    errorBody: 'Check your connection and try again.',
    loading: 'Loading profile',
    dismiss: 'Dismiss',
  },
};

type DeepStringify<T> = { [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]> };

export type Strings = DeepStringify<typeof en>;
