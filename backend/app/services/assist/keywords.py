"""The free fallback: understand a sentence with word lists, no AI.

Used only when the AI cannot be asked (no API key, monthly budget used up,
this IP's daily allowance used up, or the AI request failed). It is much
less clever than the AI, but "my fridge stopped working" or
"baddé sankari 2arib" still find the right people.

How it works, step by step:
  1. Normalise the sentence (same rules as everywhere: lower case, no
     accents or Arabic marks, one form of alef / ya / ta marbuta).
  2. Walk through the words. At each word, try the longest known phrase
     first ("car electrician" before "electrician"). A word may also match
     after removing a small prefix or ending ("البراد" -> "براد",
     "laptops" -> "laptop").
  3. Simple patterns: "near me" -> 500 m, "open now" -> open_now,
     "under 20" / "a2al men 20" -> a price limit.
  4. A place name: the word after "in", "b", "fi", "في"... (spelling
     mistakes allowed), or any other leftover word that is exactly a known
     place name.
  5. Nothing to search for (no category matched) -> None, and the caller
     answers "unavailable" as before.

The word lists are plain Python dictionaries so the founder can add words
without touching the logic. Words are written as people type them; they
are normalised when this file is loaded, so accents and hamzas do not matter.
"""

import difflib
import re

from sqlalchemy.orm import Session

from app.models import Category
from app.services.assist.normalize import normalize_text
from app.services.assist.places import find_place

# ---------------------------------------------------------------------------
# Words for each category (slug -> words and phrases).
# English, Lebanese Arabic, Arabizi (2 = ء/ق, 3 = ع, 5 = خ, 7 = ح) and French.
# A group slug (e.g. "home-repair") searches all of its children.
# ---------------------------------------------------------------------------
# The word lists stay hand-wrapped, several words per line.
# fmt: off
CATEGORY_WORDS: dict[str, list[str]] = {
    # --- Tech repair ---
    "tech-repair": [
        "electronics", "electronic", "electronique", "elektroniyet", "الكترونيات",
        "تصليح الكترونيات",
    ],
    "laptop-repair": [
        "laptop", "laptob", "labtop", "labtob", "lap top", "leptop", "pc", "computer",
        "computers", "kompyuter", "kombyuter", "compiuter", "macbook", "ordinateur", "ordi",
        "ordinateur portable", "لابتوب", "لاب توب", "لابتوب", "كمبيوتر", "كومبيوتر", "حاسوب",
        "حاسب",
    ],
    "phone-repair": [
        "phone", "phones", "mobile", "cellphone", "smartphone", "iphone", "samsung",
        "telephone", "tel", "telefon", "telifon", "tlifon", "talafon", "telephone portable",
        "portable", "تلفون", "تليفون", "موبايل", "خليوي", "جوال", "هاتف", "ايفون",
    ],
    "tv-repair": [
        "tv", "television", "tele", "televizion", "televizyon", "telfizyon", "tilifizyon",
        "satellite", "receiver", "تلفزيون", "تلفاز", "تلفزيونات", "ستلايت", "ريسيفر",
    ],
    # --- Music lessons ---
    "music-lessons": [
        "music", "musique", "musi2a", "mousi2a", "mosi2a", "music lessons", "violin", "violon",
        "kamanja", "drums", "batterie", "tabla", "derbakke", "singing", "chant", "ghina",
        "موسيقى", "دروس موسيقى", "كمنجة", "طبلة", "دربكة", "غناء",
    ],
    "saxophone-lessons": ["saxophone", "sax", "saxo", "ساكسفون", "ساكسوفون"],
    "piano-lessons": ["piano", "pianist", "org", "بيانو", "اورغ"],
    "guitar-lessons": ["guitar", "guitare", "gitar", "gitara", "غيتار", "جيتار", "قيتار"],
    "oud-lessons": ["oud", "3oud", "3od", "عود"],
    # --- Tutoring (subjects; "teacher" alone is in GENERAL_WORDS) ---
    "math-tutoring": [
        "math", "maths", "mathematics", "mathematiques", "riyadiyat", "riyadiyet", "riyadiyyet",
        "riyada2", "algebra", "calculus", "رياضيات", "جبر",
    ],
    "physics-tutoring": [
        "physics", "physique", "fizya", "fiziya", "fizye", "fiziye", "فيزياء", "فيزيا",
    ],
    "english-tutoring": [
        "english", "anglais", "inglizi", "inglize", "engliz", "englize", "ingliziyye",
        "انكليزي", "انجليزي", "انكلش", "انكليزية",
    ],
    "french-tutoring": [
        "french", "francais", "fransawi", "fransewe", "frensawi", "فرنساوي", "فرنسي", "فرنسية",
    ],
    # --- Doctors ---
    "dermatologist": [
        "dermatologist", "dermato", "dermatologue", "skin", "acne", "eczema", "rash", "jeled",
        "jild", "جلد", "جلدية", "طبيب جلد", "دكتور جلد",
    ],
    "dentist": [
        "dentist", "dentiste", "dental", "teeth", "tooth", "toothache", "snan", "asnen",
        "2asnen", "sinan", "ضرس", "اسنان", "سنان", "طبيب اسنان", "دكتور اسنان", "dakton asnen",
        "doctor snan",
    ],
    "pediatrician": [
        "pediatrician", "paediatrician", "pediatre", "pediatrie", "pediatrics", "baby doctor",
        "kids doctor", "child doctor", "doctor atfal", "tabib atfal", "atfal", "اطفال",
        "طبيب اطفال", "دكتور اطفال",
    ],
    "general-practitioner": [
        "gp", "general practitioner", "generaliste", "family doctor", "fever", "flu", "grippe",
        "sa5ne", "s5oune", "سخونة", "حرارة", "رشح", "طبيب صحة عامة",
    ],
    # --- Home repair ---
    "home-repair": [
        "handyman", "bricoleur", "washing machine", "machine a laver", "ghassele", "ghassale",
        "dishwasher", "jallaye", "lave vaisselle", "oven", "غسالة", "جلاية", "صيانة منزلية",
    ],
    "plumber": [
        "plumber", "plumbing", "plombier", "plomberie", "sankari", "sankary", "snkari",
        "sankarji", "sanakri", "سنكري", "سمكري", "leak", "leaking", "water leak", "pipe",
        "pipes", "sink", "toilet", "tawalet", "robinet", "faucet", "tap water", "7anafiye",
        "7anafiyye", "hanafiye", "nash", "nesh", "majarir", "حنفية", "مجاري", "نش", "تسريب",
        "water heater", "chauffe eau", "sakhan", "سخان",
    ],
    "electrician": [
        "electrician", "electricien", "electricity", "electrical", "kahraba", "kahrabji",
        "kahrabje", "kahrabaji", "ka7raba", "wiring", "socket", "plug", "priz", "fuse",
        "breaker", "disjoncteur", "كهربجي", "كهربائي", "كهربا", "كهرباء", "بريز",
    ],
    "carpenter": [
        "carpenter", "carpentry", "menuisier", "menuiserie", "najjar", "nejjar", "najar",
        "wood", "khashab", "5ashab", "furniture", "meuble", "نجار", "نجارة", "خشب",
    ],
    "ac-repair": [
        # The appliance words (fridge, freezer) are here on purpose: there is no
        # appliance category yet, and in Lebanon fridges are fixed by the same
        # cooling technicians ("تبريد وتكييف") who fix air conditioners.
        "ac", "a c", "air conditioner", "air conditioning", "aircon", "conditioner",
        "climatiseur", "clim", "climatisation", "mkayyef", "mkayef", "mukayyef", "mekayef",
        "mkayfet", "tabrid", "fridge", "refrigerator", "frigo", "frigidaire", "brad", "brrad",
        "barrad", "tallaje", "freezer", "frizer", "congelateur", "مكيف", "مكيفات", "تكييف",
        "تبريد", "براد", "برادات", "ثلاجة", "فريزر",
    ],
    "painter": [
        "painter", "house painter", "paint", "paint walls", "house painting", "peintre",
        "dahhan", "dahan", "da77an", "paint my house", "painting my house", "دهان", "طرش",
        "tarsh",
    ],
    # --- Art lessons ---
    "art-lessons": ["art lessons", "art class", "art", "arts", "فنون", "دروس فنون"],
    "drawing-lessons": ["drawing", "draw", "dessin", "sketch", "rasm", "رسم", "دروس رسم"],
    "painting-lessons": [
        "painting", "painting lessons", "painting class", "peinture", "talwin", "watercolor",
        "acrylic", "oil painting", "تلوين", "دروس تلوين",
    ],
    "calligraphy-lessons": [
        "calligraphy", "calligraphie", "arabic calligraphy", "khat 3arabe", "5at 3arabe",
        "khatt 3arabi", "خط عربي",
    ],
    # --- Sweets ---
    "sweets-shops": [
        "sweets", "dessert", "desserts", "7elwayet", "7lwiyet", "helwayet", "7alawiyat",
        "حلويات",
    ],
    "arabic-sweets": [
        "arabic sweets", "7elwayet 3arabiye", "baklava", "ba2lewa", "ba2lawa", "knefe",
        "kneffe", "knafeh", "knefeh", "kunafa", "maamoul", "ma3moul", "sfouf",
        "halawet el jeben", "كنافة", "بقلاوة", "معمول", "صفوف", "حلاوة الجبن", "حلويات عربية",
    ],
    "candy-shop": [
        "candy", "candies", "bonbon", "bonbons", "sakaker", "skaker", "chocolate", "chocolat",
        "shokola", "lollipop", "سكاكر", "شوكولا", "شوكولاتة", "ملبس",
    ],
    "cake-shop": [
        "cake", "cakes", "birthday cake", "gateau", "gato", "gatto", "cupcake", "patisserie",
        "torte", "كيك", "كيكة", "قالب حلوى", "تورتة",
    ],
    # --- Beauty ---
    "beauty": [
        "beauty", "beaute", "makeup", "make up", "maquillage", "mekyaj", "makyaj", "waxing",
        "epilation", "beauty salon", "salon de beaute", "مكياج", "تجميل", "عناية",
    ],
    "barber": [
        "barber", "barbershop", "coiffeur homme", "7alla2", "7ella2", "hallak", "7ala2",
        "beard", "shave", "da2en", "da2n", "le7ye", "حلاق", "حلاق رجالي", "دقن", "ذقن", "لحية",
        "حلاقة",
    ],
    "hair-salon": [
        "hair salon", "hairdresser", "salon", "coiffeuse", "coiffure", "kwafeer", "kwafeera",
        "kwafira", "brushing", "keratin", "highlights", "meches", "sabgha", "hair color",
        "كوافير", "كوافيرة", "صالون", "صالون نسائي", "صبغة", "كيراتين",
    ],
    "nail-salon": [
        "nail", "nails", "manicure", "pedicure", "manucure", "ongles", "vernis", "manikir",
        "nail salon", "مناكير", "اظافر", "ضوافر", "عناية بالاظافر",
    ],
    # --- Car services ---
    "car-services": [
        "car", "cars", "voiture", "siyara", "sayyara", "seyara", "auto", "automobile", "سيارة",
        "سيارات",
    ],
    "mechanic": [
        "mechanic", "mecanicien", "mecanique", "garage", "mikanik", "mekanik", "mikaniki",
        "mekaniki", "engine", "moteur", "brakes", "frein", "freins", "tires", "tyres",
        "dawelib", "ميكانيك", "ميكانيكي", "كراج", "دواليب", "فرام",
    ],
    "car-electrician": [
        "car electrician", "auto electrician", "electricien auto", "kahrabji siyarat",
        "kahrabji sayyarat", "kahraba siyara", "car battery", "batterie voiture",
        "كهربائي سيارات", "كهربجي سيارات", "بطارية سيارة",
    ],
    "car-wash": [
        "car wash", "carwash", "lavage", "lavage auto", "wash my car", "clean my car",
        "ghasil siyarat", "ghasil sayyara", "غسيل سيارات", "غسيل سيارة",
    ],
    # --- Fitness ---
    "fitness": [
        "fitness", "gym", "sport", "sports", "salle de sport", "nadi", "رياضة", "نادي", "جيم",
    ],
    "personal-trainer": [
        "personal trainer", "trainer", "coach", "entraineur", "mdarreb", "mudarrib", "workout",
        "مدرب", "مدرب شخصي",
    ],
    "yoga": ["yoga", "pilates", "meditation", "يوغا", "يوغا", "بيلاتس"],
    "martial-arts": [
        "martial arts", "arts martiaux", "karate", "taekwondo", "judo", "kung fu", "kickboxing",
        "boxing", "mma", "jiu jitsu", "malakame", "فنون قتالية", "كاراتيه", "تايكوندو", "جودو",
        "ملاكمة",
    ],
    # --- Tailoring ---
    "tailoring": ["tailoring", "خياطة وتصليح احذية"],
    "tailor": [
        "tailor", "couturier", "couturiere", "couture", "retouche", "alterations", "khayyat",
        "5ayyat", "5ayat", "khayat", "خياط", "خياطة", "تقصير",
    ],
    "shoe-repair": [
        "shoe repair", "cobbler", "cordonnier", "kundurji", "kendarji", "kondorji", "shoe",
        "shoes", "chaussure", "chaussures", "sabbat", "كندرجي", "صباط", "حذاء", "احذية",
    ],
    # --- Photography ---
    "photography": ["photography", "تصوير", "taswir", "tasweer"],
    "photographer": [
        "photographer", "photographe", "photo", "photos", "photoshoot", "msawwer", "mosawer",
        "msawer", "picture", "pictures", "مصور",
    ],
    "videographer": [
        "videographer", "video", "videos", "filming", "wedding video", "fidyo", "montage",
        "فيديو", "مصور فيديو",
    ],
}

# Vague words, used only when nothing more precise matched:
# "piano teacher" -> piano lessons, "teacher" alone -> tutoring.
GENERAL_WORDS: dict[str, list[str]] = {
    "tutoring": [
        "tutor", "tutoring", "teacher", "teach", "lessons", "lesson", "private lessons",
        "ostez", "2ostez", "ostaz", "2ostaz", "osteze", "2osteze", "mo3alme", "m3alme",
        "m3allme", "mo3alim", "mou3allim", "mo3allim", "prof", "professeur", "cours",
        "cours particuliers", "soutien", "dars", "drous", "dourous", "homework", "wajibet",
        "chemistry", "chimie", "kimya", "biology", "science", "sciences", "استاذ", "استاذة",
        "معلم", "معلمة", "مدرس", "مدرسة", "دروس", "درس", "دروس خصوصية", "فروض", "كيمياء",
    ],
    "doctors": [
        "doctor", "doc", "medecin", "docteur", "toubib", "tbib", "7akim", "hakim", "clinic",
        "clinique", "3iyade", "دكتور", "طبيب", "حكيم", "عيادة",
    ],
    "music-lessons": ["instrument", "instruments"],
}

# "Near me": a 500 m circle.
NEAR_WORDS = [
    "near me", "near", "nearby", "close", "close to me", "close by", "around me", "near here",
    "2arib", "2arib menne", "2arib mni", "arib", "2rib", "qarib", "karib", "7adde",
    "ta7t el beit", "ta7t l beit", "proche", "a cote", "pres de chez moi", "قريب", "قريبة",
    "قريب مني", "حدي", "تحت البيت",
]

# "Open now": only places open at this moment.
OPEN_NOW_WORDS = [
    "open now", "open", "now", "right now", "hala2", "halla2", "hala2a", "halla2a", "fete7",
    "fet7a", "fet7in", "fat7", "maftou7", "maftou7a", "tonight", "urgent", "urgently",
    "mista3jil", "maintenant", "ouvert", "ouverte", "هلق", "مفتوح", "مفتوحة", "فاتح", "فاتحة",
    "مستعجل",
]

# Words before a place name: "in Hamra", "b jounieh", "fi tripoli", "في الحمرا".
# ("a" / "à" is left out: "a plumber" would look for a place called "plumber".)
PLACE_WORDS = {"in", "at", "near", "around", "b", "bi", "bel", "fi", "fe", "في"}

# A price limit: "under 20", "a2al men 20", "moins de 20", "اقل من 20".
PRICE_PATTERN = re.compile(
    r"(?<!\S)(?:under|below|less than|cheaper than|up to|max|maximum|"
    r"a2al (?:men|mn|min|mi)|a2al|akal (?:men|mn)|ma ba3ed|"
    r"moins de|jusqu a|pas plus de|"
    r"اقل من|تحت|ما بيتعدى|حد اقصى)"
    r" (\d+)(k)?(?: (alf|alef|الف|million|malyon|مليون))?"
)
LBP_WORDS = {"lira", "lera", "ll", "lbp", "ليرة", "ليره", "alf", "alef", "الف", "مليون"}
HOUR_WORDS = {"hour", "hr", "sa3a", "se3a", "heure", "ساعة", "ساعه", "بالساعة", "بالساعه"}
VISIT_WORDS = {"visit", "ziyara", "kachfiyye", "consultation", "زيارة", "كشفية"}
MONTH_WORDS = {"month", "monthly", "shahr", "mois", "شهر", "بالشهر"}

# The price unit people usually mean, by category group.
UNIT_BY_GROUP = {
    "tutoring": "hour",
    "music-lessons": "hour",
    "art-lessons": "hour",
    "fitness": "hour",
    "doctors": "visit",
    "tech-repair": "job",
    "home-repair": "job",
    "car-services": "job",
    "tailoring": "job",
    "photography": "job",
    "sweets-shops": "item",
    "beauty": "item",
}

# Common words that are never a place. Leftover words are checked against
# the places table only after these are removed.
STOP_WORDS = {
    "i", "my", "me", "a", "an", "the", "is", "it", "to", "for", "of", "and", "or", "need",
    "want", "looking", "someone", "somebody", "who", "can", "fix", "repair", "broken",
    "stopped", "working", "not", "please", "good", "best", "cheap", "badde", "baddi", "bade",
    "baddé", "bede", "fi", "hada", "wa7ad", "wahad", "shi", "chi", "ya3ne", "mni7", "tasli7",
    "msalle7", "je", "cherche", "un", "une", "le", "la", "les", "pour", "de", "du", "mon", "ma",
    "بدي", "حدا", "شي", "واحد", "تصليح", "مصلح", "منيح",
}
# fmt: on

MAX_CATEGORIES = 3
LONGEST_PHRASE = 4  # words


def _key(phrase: str) -> tuple[str, ...]:
    return tuple(normalize_text(phrase).split())


def _build_index() -> dict[tuple[str, ...], list[tuple[str, str]]]:
    """phrase (as a tuple of words) -> what it means.

    Each meaning is (what, value): ("category", slug), ("general", slug),
    ("near", "") or ("open", "").
    """
    index: dict[tuple[str, ...], list[tuple[str, str]]] = {}

    def add(phrase: str, meaning: tuple[str, str]) -> None:
        meanings = index.setdefault(_key(phrase), [])
        if meaning not in meanings:
            meanings.append(meaning)

    for slug, words in CATEGORY_WORDS.items():
        for word in words:
            add(word, ("category", slug))
    for slug, words in GENERAL_WORDS.items():
        for word in words:
            add(word, ("general", slug))
    for word in NEAR_WORDS:
        add(word, ("near", ""))
    for word in OPEN_NOW_WORDS:
        add(word, ("open", ""))
    return index


INDEX = _build_index()
# Latin single words of 5+ letters, for small spelling mistakes ("plumbr").
# Only category words: "closed" must not be read as "close" (near me).
FUZZY_KEYS = sorted(
    key[0]
    for key, meanings in INDEX.items()
    if len(key) == 1
    and len(key[0]) >= 5
    and key[0].isascii()
    and all(what in ("category", "general") for what, _ in meanings)
)
NORMALIZED_STOP_WORDS = {normalize_text(word) for word in STOP_WORDS}
NORMALIZED_PLACE_WORDS = {normalize_text(word) for word in PLACE_WORDS}

ARABIC_PREFIXES = ("وال", "بال", "فال", "كال", "لل", "ال", "و", "ب", "ل", "ف")
ARABIC_ENDINGS = ("ات", "ها", "نا", "كن", "هم", "ي", "ه", "ك")
LATIN_PREFIXES = ("el", "l", "bel", "w")


def _is_arabic(word: str) -> bool:
    return any("؀" <= ch <= "ۿ" for ch in word)


def word_forms(word: str) -> list[str]:
    """The word itself, then the word without a small prefix or ending.

    "البراد" -> "براد", "برادي" (my fridge) -> "براد", "laptops" -> "laptop",
    "lbrad" -> "brad", "brade" -> "brad". The word itself is always tried first.
    """
    forms = [word]
    if _is_arabic(word):
        stems = [word]
        for prefix in ARABIC_PREFIXES:
            if word.startswith(prefix) and len(word) - len(prefix) >= 2:
                stems.append(word[len(prefix) :])
        for stem in stems:
            forms.append(stem)
            for ending in ARABIC_ENDINGS:
                if stem.endswith(ending) and len(stem) - len(ending) >= 2:
                    forms.append(stem[: -len(ending)])
    else:
        for prefix in LATIN_PREFIXES:
            if word.startswith(prefix) and len(word) - len(prefix) >= 3:
                forms.append(word[len(prefix) :])
        for ending in ("s", "e", "i"):
            if word.endswith(ending) and len(word) - len(ending) >= 4:
                forms.append(word[: -len(ending)])
    return list(dict.fromkeys(forms))  # no repeats, order kept


def _match_one_word(word: str) -> list[tuple[str, str]]:
    for form in word_forms(word):
        meanings = INDEX.get((form,))
        if meanings:
            return meanings
    # A small spelling mistake in a longer Latin word: "plumbr", "electrcian".
    if len(word) >= 5 and word.isascii() and not word.isdigit():
        close = difflib.get_close_matches(word, FUZZY_KEYS, n=1, cutoff=0.85)
        if close:
            return INDEX[(close[0],)]
    return []


def find_meanings(words: list[str]) -> tuple[list[tuple[str, str]], set[int]]:
    """Every meaning found in the sentence, in order, and the positions of the
    words that were used (so they are not mistaken for a place name)."""
    meanings: list[tuple[str, str]] = []
    used: set[int] = set()
    i = 0
    while i < len(words):
        found = False
        # Longest phrase first: "car electrician" before "car".
        for length in range(min(LONGEST_PHRASE, len(words) - i), 1, -1):
            phrase = tuple(words[i : i + length])
            if phrase in INDEX:
                meanings.extend(INDEX[phrase])
                used.update(range(i, i + length))
                i += length
                found = True
                break
        if found:
            continue
        single = _match_one_word(words[i])
        if single:
            meanings.extend(single)
            used.add(i)
        i += 1
    return meanings, used


def find_price(normalized: str, words: list[str], slugs: list[str], parents: dict[str, str]):
    """(amount, unit, currency) for "under 20", "a2al men 20$ bel se3a"...;
    None when no price limit is stated."""
    match = PRICE_PATTERN.search(normalized)
    if match is None:
        return None
    amount = float(match.group(1))  # Python reads Arabic digits (٢٠) too
    multiplier = match.group(3)
    if match.group(2) or (multiplier and multiplier in {"alf", "alef", "الف"}):
        amount *= 1000
    elif multiplier:
        amount *= 1_000_000
    if amount <= 0:
        return None

    word_set = set(words)
    currency = "LBP" if (word_set & LBP_WORDS or multiplier or match.group(2)) else "USD"
    if word_set & HOUR_WORDS:
        unit = "hour"
    elif word_set & VISIT_WORDS:
        unit = "visit"
    elif word_set & MONTH_WORDS:
        unit = "month"
    else:
        # The usual unit for the first category: tutors charge by the hour.
        first = slugs[0]
        unit = UNIT_BY_GROUP.get(parents.get(first, first), "job")
    return amount, unit, currency


def place_candidates(words: list[str], used: set[int]) -> tuple[list[str], list[str]]:
    """Possible place names.

    Returns (after_place_word, exact_only):
      - the words right after "in", "b", "في"... (spelling mistakes are
        allowed for those, the place lookup is fuzzy);
      - every other leftover word, and Arabic words glued to "ب"
        ("بجونيه", "بالحمرا"): these must be exactly a place name.
    Two-word names are tried before one-word names.
    """
    free = [
        i
        for i, word in enumerate(words)
        if i not in used
        and word not in NORMALIZED_STOP_WORDS
        and word not in NORMALIZED_PLACE_WORDS
        and not word.isdigit()
        and len(word) >= 3
    ]

    after: list[str] = []
    for i, word in enumerate(words):
        if word in NORMALIZED_PLACE_WORDS and i + 1 in free:
            if i + 2 in free:
                after.append(f"{words[i + 1]} {words[i + 2]}")
            after.append(words[i + 1])

    exact_only: list[str] = []
    for i in free:
        if i + 1 in free:
            exact_only.append(f"{words[i]} {words[i + 1]}")
    exact_only.extend(words[i] for i in free)
    for i in free:
        word = words[i]
        if _is_arabic(word) and word.startswith("ب") and len(word) >= 4:
            exact_only.append(word[1:])  # "بالحمرا" -> "الحمرا", "بجونيه" -> "جونيه"
            if word.startswith("بال") and len(word) >= 6:
                exact_only.append(word[3:])  # "بالحمرا" -> "حمرا"
    return list(dict.fromkeys(after)), list(dict.fromkeys(exact_only))


def find_place_name(db: Session, words: list[str], used: set[int]) -> str | None:
    after, exact_only = place_candidates(words, used)
    for candidate in after[:4]:
        if find_place(db, candidate):
            return candidate
    for candidate in exact_only[:10]:
        if find_place(db, candidate, fuzzy=False):
            return candidate
    return None


def understand(db: Session, text: str, categories: list[Category]) -> dict | None:
    """Search settings for the sentence (same keys as an AI answer), or None
    when no category matched."""
    normalized = normalize_text(text)
    words = normalized.split()
    if not words:
        return None

    known = {category.slug for category in categories}
    by_id = {category.id: category.slug for category in categories}
    parents = {
        category.slug: by_id[category.parent_id]
        for category in categories
        if category.parent_id in by_id
    }

    meanings, used = find_meanings(words)
    precise = [value for what, value in meanings if what == "category" and value in known]
    general = [value for what, value in meanings if what == "general" and value in known]
    slugs = list(dict.fromkeys(precise or general))
    # "plumber" and its own group "home-repair" both matched: keep the precise one.
    slugs = [slug for slug in slugs if not any(parents.get(other) == slug for other in slugs)]
    slugs = slugs[:MAX_CATEGORIES]
    if not slugs:
        return None

    price = find_price(normalized, words, slugs, parents)
    return {
        "category_slugs": slugs,
        "q": None,
        "place_name": find_place_name(db, words, used),
        "radius_m": 500 if any(what == "near" for what, _ in meanings) else None,
        "max_price": price[0] if price else None,
        "price_unit": price[1] if price else None,
        "price_currency": price[2] if price else None,
        "open_now": any(what == "open" for what, _ in meanings),
        "sort": "best",
    }
