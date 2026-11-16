"""The free fallback: understand a sentence with word lists, no AI.

Used only when the AI cannot be asked (no API key, monthly budget used up,
this IP's daily allowance used up, or the AI request failed). It is much
less clever than the AI, but "my fridge stopped working", "el brad ma 3am
ybarred" or "baddé sankari 2arib" still find the right people.

How it works, step by step:
  1. Normalise the sentence (same rules as everywhere: lower case, no
     accents or Arabic marks, one form of alef / ya / ta marbuta). Each
     Latin word also gets its Arabizi spelling (normalize.arabizi_word):
     "7akim" -> "hakim", "baddi" -> "bade", "sannkari" -> "sankare".
  2. Small words that carry no meaning ("el", "3am", "ma", "w", "the") are
     skipped, so "may 3am tnazzel" matches the phrase "may tnazzel".
  3. Walk through the words. At each word, try the longest known phrase
     first ("car electrician" before "electrician"). A single word is
     looked up in this order:
       a. exactly as written (with a small Arabic or Latin prefix/ending
          removed: "البراد" -> "براد", "laptops" -> "laptop");
       b. its Arabizi spelling, also without a small prefix/ending
          ("lsankari" -> "sankare", "sayyarte" -> "sayart");
       c. a spelling mistake of one letter, for words of 5+ letters
          ("plumbr", "electrisien");
       d. the same consonants, for words with 4+ consonants
          ("snkri" = "sankari", "kondarje" = "kundurji");
       e. two known words typed without a space ("baddesankari").
     Steps b-e only look at category words, never at "near" / "open" words,
     never at common words (STOP_WORDS) and never at place names ("anjar"
     is a town, not "najjar"), so random text finds nothing.
  4. Simple patterns: "near me" -> 500 m, "open now" / urgent -> open_now,
     "cheap" -> sort by price, "closest" -> sort by distance,
     "under 20" / "a2al men 20" -> a price limit.
  5. A car in the sentence changes some words: "kahraba" is the electrician,
     "kahraba el sayyara" the car electrician; "moteur" is the neighbourhood
     generator, "moteur el sayyara" the engine (a mechanic).
  6. A place name: the word after "in", "b", "fi", "في"... (spelling
     mistakes allowed), or any other leftover word that is exactly a known
     place name.
  7. Nothing to search for (no category matched) -> None, and the caller
     answers "unavailable" as before.

The word lists are plain Python dictionaries so the founder can add words
without touching the logic. Words are written as people type them; they
are normalised once when this file is loaded, so accents, hamzas, doubled
letters and Arabizi digits do not matter.
"""

import re
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.models import Category
from app.services.assist.normalize import arabizi_word, normalize_text, skeleton
from app.services.assist.places import find_place

# ---------------------------------------------------------------------------
# Words for each category (slug -> words and phrases).
# English, Lebanese Arabic, Arabizi (2 = ء/ق, 3 = ع, 5 = خ, 7 = ح, 8 = غ,
# 9 = ص, 6 = ط) and French. A group slug (e.g. "home-repair") searches all of
# its children. The problem people describe counts too ("may 3am tnazzel"
# means water is dripping: a plumber).
# ---------------------------------------------------------------------------
# The word lists stay hand-wrapped, several words per line.
# fmt: off
CATEGORY_WORDS: dict[str, list[str]] = {
    # --- Tech repair ---
    "tech-repair": [
        "electronics", "electronic", "electronique", "elektroniyet", "elektroniyat",
        "iliktroniyat", "electronics repair", "gadget", "gadgets", "device", "devices",
        "appareil", "playstation", "ps4", "ps5", "xbox", "console", "ajhize", "ajhiza",
        "الكترونيات", "تصليح الكترونيات", "اجهزة", "بلايستيشن",
    ],
    "laptop-repair": [
        "laptop", "laptops", "laptob", "labtop", "labtob", "lap top", "leptop", "laptopet",
        "labtopet", "pc", "pcs", "computer", "computers", "kompyuter", "kombyuter", "komputer",
        "kumbyuter", "compiuter", "kombyutar", "desktop", "macbook", "mac book", "ordinateur",
        "ordi", "ordinateur portable", "printer", "imprimante", "wifi", "router", "routeur",
        "windows", "formatage", "virus", "keyboard", "clavier", "hard disk", "motherboard",
        "لابتوب", "لاب توب", "كمبيوتر", "كومبيوتر", "حاسوب", "حاسب", "طابعة", "راوتر",
    ],
    "phone-repair": [
        "phone", "phones", "mobile", "mobiles", "cellphone", "smartphone", "iphone", "ayfon",
        "aifon", "samsung", "galaxy", "huawei", "xiaomi", "redmi", "oppo", "telephone",
        "telefon", "telifon", "tlifon", "tlifone", "talafon", "telephone portable", "portable",
        "tablet", "tablette", "ipad", "charging port", "screen protector", "shashet tlifon",
        "تلفون", "تليفون", "موبايل", "خليوي", "جوال", "هاتف", "ايفون", "سامسونغ", "ايباد",
        "شاشة تلفون",
    ],
    "tv-repair": [
        "tv", "television", "tele", "televizion", "televizyon", "telfizyon", "tilifizyon",
        "telefizyon", "telvizyon", "talfizyon", "satellite", "satelite", "dish", "receiver",
        "resiver", "risiver", "decoder", "smart tv", "ecran tele", "plasma", "تلفزيون",
        "تلفاز", "تلفزيونات", "ستلايت", "ريسيفر", "دش",
    ],
    # --- Music lessons ---
    "music-lessons": [
        "music", "musique", "musi2a", "mousi2a", "mosi2a", "musiqa", "music lessons",
        "cours de musique", "violin", "violon", "kamanja", "kamanje", "drums", "drum",
        "tabla", "derbakke", "derbake", "durbakke", "singing", "chant", "ghina", "ghine",
        "vocal", "solfege", "nay", "flute", "accordion", "موسيقى", "دروس موسيقى", "كمنجة",
        "طبلة", "دربكة", "غناء", "ناي",
    ],
    "saxophone-lessons": [
        "saxophone", "sax", "saxo", "saxofon", "saksafon", "saxophon", "saxophone lessons",
        "sax teacher", "saxofone", "saksofon", "saxophoniste", "sax lessons", "drous sax",
        "drous saxophone", "ساكسفون", "ساكسوفون", "ساكس", "دروس ساكسفون",
    ],
    "piano-lessons": [
        "piano", "pianist", "pianiste", "byano", "piyano", "pyano", "piano lessons",
        "cours de piano", "org", "organ", "orgue", "synthesizer", "synth", "بيانو", "اورغ",
    ],
    "guitar-lessons": [
        "guitar", "guitare", "gitar", "gitara", "gitare", "guitarra", "electric guitar",
        "bass guitar", "acoustic guitar", "classical guitar", "guitarist", "guitariste",
        "drous guitar", "dars guitar", "ukulele", "غيتار", "جيتار", "قيتار", "كيتار", "دروس غيتار",
    ],
    "oud-lessons": [
        "oud", "3oud", "3od", "3ud", "aoud", "oud lessons", "oud teacher", "drous 3oud",
        "dars 3oud", "ostez 3oud", "3azef 3oud", "buzuk", "bouzouk", "buzu2", "عود", "العود",
        "دروس عود", "بزق",
    ],
    # --- Tutoring (subjects; "teacher" alone is in GENERAL_WORDS) ---
    "math-tutoring": [
        "math", "maths", "mathematics", "mathematiques", "riyadiyat", "riyadiyet",
        "riyadiyyet", "ryadiyat", "riadiyat", "algebra", "calculus", "geometry",
        "geometrie", "7isab", "hisab", "math teacher", "رياضيات", "جبر", "حساب",
    ],
    "physics-tutoring": [
        "physics", "physique", "fizya", "fiziya", "fizye", "fiziye", "fizia", "fizik",
        "physics teacher", "physic", "phisics", "drous fizya", "ostez fizya", "فيزياء", "فيزيا",
        "استاذ فيزياء", "دروس فيزياء",
    ],
    "english-tutoring": [
        "english", "anglais", "inglizi", "inglize", "engliz", "englize", "ingliziyye",
        "englizi", "inklizi", "inglish", "ingilizi", "english teacher", "ielts", "toefl",
        "انكليزي", "انجليزي", "انكلش", "انكليزية", "انجليزية",
    ],
    "french-tutoring": [
        "french", "francais", "fransawi", "fransewe", "frensawi", "fransawe", "fransawiye",
        "french teacher", "french lessons", "cours de francais", "fransi", "drous fransawe",
        "ostez fransawe", "فرنساوي", "فرنسي", "فرنسية", "استاذ فرنسي", "دروس فرنسي",
    ],
    # --- Doctors ---
    "dermatologist": [
        "dermatologist", "dermato", "dermatologue", "dermatology", "skin", "skin doctor",
        "acne", "eczema", "psoriasis", "rash", "pimples", "pimple", "bouton", "boutons", "jeled",
        "jild", "jeld", "jelde", "7akim jeld", "tbib jeld", "7ebb shabab", "7boub", "7ebbet",
        "جلد", "جلدية", "طبيب جلد", "دكتور جلد", "حكيم جلد", "حب الشباب", "حبوب", "اكزيما",
    ],
    "dentist": [
        "dentist", "dentiste", "dental", "teeth", "tooth", "toothache", "snan", "snen", "asnen",
        "asnan", "2asnen", "sinan", "7akim snen", "dakton snen", "tbib asnen", "dakton asnen",
        "doctor snan", "dersi", "derse", "dirsi", "darse", "wej3 snen", "braces",
        "orthodontist", "orthodontie", "plombage", "implant", "ضرس", "ضرسي", "اسنان", "سنان",
        "طبيب اسنان", "دكتور اسنان", "حكيم اسنان",
    ],
    "pediatrician": [
        "pediatrician", "paediatrician", "pediatre", "pediatrie", "pediatrics", "baby doctor",
        "kids doctor", "child doctor", "children doctor", "doctor atfal", "tabib atfal",
        "7akim atfal", "dakton atfal", "atfal", "doctor wlad", "7akim wlad", "dakton wlad",
        "doctor wled", "7akim wled", "اطفال", "طبيب اطفال", "دكتور اطفال", "حكيم اطفال",
        "حكيم ولاد",
    ],
    "general-practitioner": [
        "gp", "general practitioner", "general doctor", "family doctor", "generaliste",
        "medecin generaliste", "medecin traitant", "physician", "family medicine",
        "check up", "checkup", "bilan", "طبيب صحة عامة",
        "طب عام", "طبيب عام", "طبيب عائلة",
    ],
    # --- Home repair ---
    "home-repair": [
        "handyman", "bricoleur", "maintenance", "siyane", "washing machine",
        "machine a laver", "ghassele", "ghassale", "dishwasher", "jallaye", "jalaye",
        "lave vaisselle", "oven", "four", "microwave", "micro onde", "appliance", "appliances",
        "electromenager", "غسالة", "جلاية", "صيانة منزلية", "صيانة", "ميكروويف",
    ],
    "plumber": [
        "plumber", "plumbing", "plombier", "plomberie", "sankari", "sankary", "snkari",
        "sankarji", "sanakri", "sanikri", "sankarje", "leak", "leaking", "water leak",
        "fuite d eau", "pipe", "pipes", "tuyau", "tuyaux", "sink", "majle", "majli", "majla",
        "toilet", "toilette", "tawalet", "twalet", "robinet", "faucet", "tap water",
        "7anafiye", "7anafiyye", "hanafiye", "7anafiyyet", "nash", "nesh", "naz", "nazz",
        "majarir", "majrour", "majrura", "egout", "drain", "tasrib", "tasreeb", "water heater",
        "chauffe eau", "sakhan", "sa5an", "boiler", "khazzan", "5azzan", "trumba", "tromba",
        "pompe", "may tnazzel", "may ynazzel", "tnazzel may", "ynazzel may", "sakf ynazzel",
        "sakf tnazzel", "سنكري", "سمكري", "حنفية", "مجاري", "مجرور", "نش", "تسريب", "سخان",
        "مواسير", "قساطل", "قسطل", "تواليت", "مغسلة", "طرمبة", "خزان",
    ],
    "electrician": [
        "electrician", "electricien", "electrisien", "elektrisyen", "electricity", "electrical",
        "electrique", "elektrik", "kahraba", "kahrabe", "ka7raba", "kahrba", "kahrabji",
        "kahrabje", "kahrabaji", "kahrabaje", "2at3a", "2at3et kahraba", "wiring", "wires",
        "cable", "cables", "socket", "plug", "priz", "prize", "fuse", "breaker",
        "disjoncteur", "disjonctor", "jonctor", "ishtirak", "eshtirak", "abonnement",
        "generator", "generateur", "mwalled", "mowalled", "solar", "solaire", "solar panel",
        "panel", "panels", "panneau", "panneaux", "inverter", "inverteur", "onduleur",
        "unduler", "ups", "lamba", "lampa", "كهربجي", "كهربائي", "كهربا", "كهرباء", "بريز",
        "اشتراك", "مولد", "طاقة شمسية", "سولار", "انفرتر", "لمبة",
    ],
    "carpenter": [
        "carpenter", "carpentry", "menuisier", "menuiserie", "najjar", "nejjar", "najar",
        "nijjar", "wood", "wooden", "khashab", "5ashab", "kheshab", "furniture", "meuble",
        "meubles", "khzene", "khzane", "5zene", "5zane", "armoire", "placard", "wardrobe",
        "cabinets", "mobilia", "نجار", "نجارة", "خشب", "خزانة", "مفروشات", "موبيليا",
    ],
    "ac-repair": [
        # The appliance words (fridge, freezer) are here on purpose: there is no
        # appliance category yet, and in Lebanon fridges are fixed by the same
        # cooling technicians ("تبريد وتكييف") who fix air conditioners.
        "ac", "air conditioner", "air conditioning", "air condition", "aircon",
        "conditioner", "climatiseur", "clim", "climatisation", "split", "mkayyef", "mkayef",
        "mukayyef", "mekayef", "mokayyaf", "mokayaf", "mkayfet", "mkayyefet", "takyif",
        "tabrid", "fridge", "refrigerator", "frigo", "frigidaire", "brad", "brrad", "barrad",
        "tallaje", "talleje", "tallaja", "freezer", "frizer", "congelateur", "ybarred",
        "tbarred", "bybarred", "مكيف", "مكيفات", "تكييف", "تبريد", "براد", "برادات", "ثلاجة",
        "فريزر", "يبرد",
    ],
    "painter": [
        "painter", "house painter", "paint", "paint walls", "wall paint", "house painting",
        "peintre", "peindre", "repeindre", "dahhan", "dahan", "da77an", "dahhen", "ydahhen",
        "ydahen", "yedhan", "dhen", "dihan", "paint my house", "painting my house", "tarsh",
        "7iten", "7itan", "دهان", "طرش", "يدهن", "دهن", "حيطان",
    ],
    # --- Art lessons ---
    "art-lessons": [
        "art lessons", "art class", "art classes", "art teacher", "art", "arts", "fonoun",
        "fenoun", "funun", "beaux arts", "arts plastiques", "atelier d art", "fan tachkili",
        "فنون", "دروس فنون", "فن", "فن تشكيلي",
    ],
    "drawing-lessons": [
        "drawing", "draw", "dessin", "dessiner", "sketch", "sketching", "rasm", "rasem",
        "rasim", "rassem", "drous rasm", "dars rasm", "drawing class", "drawing lessons",
        "cours de dessin", "croquis", "رسم", "دروس رسم", "تعليم رسم",
    ],
    "painting-lessons": [
        "painting", "painting lessons", "painting class", "peinture", "talwin", "talween",
        "watercolor", "aquarelle", "acrylic", "acrylique", "oil painting", "rasm zeite",
        "rasem zeite", "تلوين", "دروس تلوين", "رسم زيتي", "دروس رسم زيتي", "الوان مائية",
    ],
    "calligraphy-lessons": [
        "calligraphy", "calligraphie", "arabic calligraphy", "khat 3arabe", "5at 3arabe",
        "khatt 3arabi", "5att 3arabe", "khat 3arabi", "khat diwane", "calligraphy class",
        "cours de calligraphie", "khattat", "5attat", "خط عربي", "خطاط", "تعليم خط",
        "دروس خط عربي", "خط ديواني",
    ],
    # --- Sweets ---
    "sweets-shops": [
        "sweets", "sweet", "sweet shop", "sweets shop", "dessert", "desserts", "sucreries",
        "confiserie", "حلويات", "حلوى", "محل حلويات",
    ],
    "arabic-sweets": [
        "arabic sweets", "7elwayet 3arabiye", "7elwayet", "7lwiyet", "helwayet", "7alawiyat",
        "halawiyat", "7elweyet", "baklava", "baklawa", "ba2lewa", "ba2lawa", "knefe", "kneffe",
        "knafeh", "knefeh", "kunafa", "knafe", "maamoul", "ma3moul", "ma3mul", "sfouf",
        "halawet el jeben", "namoura", "nammoura", "mafrouke", "atayef", "2atayef",
        "znoud el sett", "كنافة", "بقلاوة", "معمول", "صفوف", "حلاوة الجبن", "حلويات عربية",
        "نمورة", "قطايف", "مفروكة",
    ],
    "candy-shop": [
        "candy", "candies", "bonbon", "bonbons", "sakaker", "skaker", "sakakir", "chocolate",
        "chocolat", "chocolates", "shokola", "shokolata", "lollipop", "gummies", "marshmallow",
        "mlabbas", "dragees", "chewing gum", "3elke", "سكاكر", "شوكولا", "شوكولاتة", "ملبس",
        "علكة", "بونبون",
    ],
    "cake-shop": [
        "cake", "cakes", "birthday cake", "gateau", "gato", "gatto", "cupcake", "cupcakes",
        "patisserie", "torte", "tarte", "gato 3id milad", "كيك", "كيكة", "قالب حلوى", "تورتة",
        "كاتو", "غاتو",
    ],
    # --- Beauty ---
    "beauty": [
        "beauty", "beaute", "makeup", "make up", "maquillage", "mekyaj", "makyaj", "mekyej",
        "makeup artist", "waxing", "wax", "epilation", "laser", "laser hair removal",
        "beauty salon", "beauty center", "centre de beaute", "salon de beaute", "facial",
        "skin care", "soin", "soins", "eyebrows", "7awajeb", "7wajeb", "sourcils", "lashes",
        "مكياج", "تجميل", "عناية", "ليزر", "حواجب", "خبيرة تجميل",
    ],
    "barber": [
        "barber", "barbershop", "barber shop", "coiffeur homme", "coiffeur pour homme",
        "7alla2", "7ella2", "7alle2", "7ala2", "7la2", "hallak", "hallaq", "beard", "shave",
        "men haircut", "haircut", "da2en", "da2n", "da2ne", "le7ye", "le7ie",
        "2osso sha3re", "2oss sha3re", "2ess sha3re", "2os sha3r", "2osli sha3re",
        "حلاق", "حلاق رجالي", "دقن", "ذقن", "لحية", "حلاقة", "قص شعر",
    ],
    "hair-salon": [
        "hair salon", "hairdresser", "hairstylist", "hair stylist", "salon", "coiffeuse",
        "coiffure", "coiffeur", "kwafeer", "kwafeera", "kwafira", "kwafer", "salon nisa2e",
        "brushing", "keratin", "keratine", "highlights", "meches", "balayage", "sabgha",
        "sobgha", "hair color", "hair dye", "teinture", "lissage", "blow dry", "blowdry",
        "كوافير", "كوافيرة", "صالون", "صالون نسائي", "صبغة", "كيراتين", "سشوار",
    ],
    "nail-salon": [
        "nail", "nails", "manicure", "pedicure", "manucure", "ongles", "vernis", "manikir",
        "pedikir", "gel nails", "acrylic nails", "nail art", "nail salon", "semi permanent",
        "dawefer", "adafer", "مناكير", "باديكير", "اظافر", "ضوافر", "عناية بالاظافر",
        "مونيكير",
    ],
    # --- Car services ---
    "car-services": [
        "car", "cars", "voiture", "siyara", "sayyara", "sayara", "seyara", "siyyara",
        "sayyarte", "siyarte", "sayyarti", "sayyarat", "siyarat", "auto", "automobile",
        "vehicle", "سيارة", "سيارات", "سيارتي",
    ],
    "mechanic": [
        "mechanic", "mecanicien", "mecanique", "garage", "mikanik", "mekanik", "mikaniki",
        "mekaniki", "mekanike", "mecaniki", "engine", "brakes", "brake", "frein", "freins",
        "frem", "fram", "tires", "tyres", "tire", "pneu", "pneus", "dawelib", "dawlib",
        "dawleb", "dewleb", "vidange", "oil change", "ghayyer zeit", "gearbox",
        "boite de vitesse", "radiateur", "radiator", "amortisseur", "suspension",
        "check engine", "won t start", "wont start", "ميكانيك", "ميكانيكي", "كراج", "دواليب",
        "فرام", "زيت السيارة",
    ],
    "car-electrician": [
        "car electrician", "auto electrician", "electricien auto", "kahrabji siyarat",
        "kahrabji sayyarat", "kahraba siyara", "kahraba sayyara", "car battery",
        "batterie voiture", "batariyet sayyara", "alternator", "alternateur", "dynamo",
        "demarreur", "كهربائي سيارات", "كهربجي سيارات", "بطارية سيارة", "دينامو",
    ],
    "car-wash": [
        "car wash", "carwash", "lavage", "lavage auto", "lavage voiture", "wash my car",
        "clean my car", "ghasil siyarat", "ghasil sayyara", "ghassel sayyara", "polish",
        "polishing", "detailing", "غسيل سيارات", "غسيل سيارة", "تلميع",
    ],
    # --- Fitness ---
    "fitness": [
        "fitness", "gym", "sport", "sports", "salle de sport", "nadi", "nadi riyade",
        "musculation", "bodybuilding", "crossfit", "zumba", "aerobics", "cardio", "riyada",
        "riyade", "رياضة", "نادي", "جيم", "نادي رياضي", "لياقة",
    ],
    "personal-trainer": [
        "personal trainer", "trainer", "coach", "entraineur", "coach sportif", "mdarreb",
        "mudarrib", "mdareb", "workout", "private coach", "ydarreb", "ydarrebne",
        "مدرب", "مدرب شخصي", "مدربة", "كوتش",
    ],
    "yoga": [
        "yoga", "youga", "yoga class", "yoga studio", "yoga teacher", "hot yoga", "yogi",
        "pilates", "meditation", "stretching", "reformer", "يوغا", "يوجا", "بيلاتس", "تامل",
    ],
    "martial-arts": [
        "martial arts", "arts martiaux", "karate", "taekwondo", "tae kwon do", "judo",
        "kung fu", "kickboxing", "kick boxing", "boxing", "boxe", "mma", "jiu jitsu",
        "jujitsu", "self defense", "self defence", "malakame", "wrestling", "krav maga",
        "فنون قتالية", "كاراتيه", "تايكوندو", "جودو", "ملاكمة", "كونغ فو", "دفاع عن النفس",
    ],
    # --- Tailoring ---
    "tailoring": ["tailoring", "couture et cordonnerie", "خياطة وتصليح احذية"],
    "tailor": [
        "tailor", "couturier", "couturiere", "couture", "retouche", "retouches", "alterations",
        "alteration", "khayyat", "5ayyat", "5ayat", "khayat", "khayyata", "5ayyata",
        "2assir", "ta2sir", "y2assir", "y2assirli", "bantalon", "pantalon", "fostan",
        "خياط", "خياطة", "تقصير", "بنطلون", "فستان", "تضييق",
    ],
    "shoe-repair": [
        "shoe repair", "cobbler", "cordonnier", "cordonnerie", "kundurji", "kendarji",
        "kondorji", "kondarje", "kendarje", "kundarji", "shoe", "shoes", "chaussure",
        "chaussures", "sabbat", "soubbat", "sobbat", "sabbate", "semelle", "talon",
        "كندرجي", "صباط", "حذاء", "احذية",
    ],
    # --- Photography ---
    "photography": ["photography", "تصوير", "taswir", "tasweer"],
    "photographer": [
        "photographer", "photographe", "photo", "photos", "photoshoot", "photo shoot",
        "shooting", "msawwer", "mosawer", "msawer", "mousawer", "mosawwer", "msawra",
        "musawir", "picture", "pictures", "portrait", "wedding photographer", "ysawwer",
        "مصور", "مصورة", "تصوير فوتوغرافي",
    ],
    "videographer": [
        "videographer", "videaste", "video", "videos", "vidio", "fidyo", "filming",
        "wedding video", "montage", "drone", "cinematographer", "clip",
        "مصور فيديو", "فيديو", "تصوير فيديو", "مونتاج",
    ],
}

# Vague words, used only when nothing more precise matched:
# "piano teacher" -> piano lessons, "teacher" alone -> tutoring,
# "fever" alone -> a general practitioner, "fever, pediatrician" -> the pediatrician.
GENERAL_WORDS: dict[str, list[str]] = {
    "tutoring": [
        "tutor", "tutoring", "teacher", "teach", "lessons", "lesson", "private lessons",
        "ostez", "2ostez", "ostaz", "2ostaz", "osteze", "2osteze", "ustaz", "mo3alme",
        "m3alme", "m3allme", "mo3alim", "mou3allim", "mo3allim", "prof", "professeur",
        "cours", "cours particuliers", "soutien", "soutien scolaire", "dars", "drous",
        "dourous", "dars khsousi", "drous khsousiye", "khsousi", "homework", "wajibet",
        "wazife", "brevet", "bac", "official exams", "imti7anet", "chemistry", "chimie",
        "kimya", "biology", "science", "sciences", "history", "geography", "استاذ",
        "استاذة", "معلم", "معلمة", "مدرس", "مدرسة", "دروس", "درس", "دروس خصوصية", "فروض",
        "كيمياء",
    ],
    "doctors": [
        "doctor", "doc", "dr", "medecin", "docteur", "toubib", "tbib", "tabib", "7akim",
        "hakim", "dakton", "daktor", "doktor", "clinic", "clinique", "3iyade", "دكتور",
        "طبيب", "حكيم", "عيادة",
    ],
    "general-practitioner": [
        "fever", "flu", "grippe", "cough", "sa5ne", "s5oune", "s5ouneh", "sukhune", "s5en",
        "7arara", "rash7", "rasha7", "so3le", "سخونة", "حرارة", "رشح", "كريب", "سعلة",
    ],
    "music-lessons": ["instrument", "instruments"],
}

# Words that mean one thing at home and another when a car is mentioned:
# (slug without a car, slug with a car) -> words. "" = nothing without a car.
HOME_OR_CAR_WORDS: dict[tuple[str, str], list[str]] = {
    # "moteur": the neighbourhood generator, unless it is the car's engine.
    ("electrician", "mechanic"): ["moteur", "motor", "mator", "موتور"],
    # A battery: the house's (solar, UPS) or the car's.
    ("electrician", "car-electrician"): [
        "battery", "batterie", "batarie", "batariye", "batariyet", "batteries", "بطارية",
        "بطاريات",
    ],
    # Only about a car: "my car won't start", "ghayyer zeit el sayyara", "wash".
    ("", "mechanic"): ["start", "tdawwer", "btdawwer", "zeit", "oil", "ydakhen", "tdakhen",
                       "dekhne", "زيت"],
    ("", "car-wash"): ["wash", "ghassel", "ghasil", "ghassil", "clean", "tanzif", "غسيل"],
}

# With a car in the sentence, these categories become their car version:
# "kahraba el sayyara" -> car electrician.
CAR_VERSION = {"electrician": "car-electrician"}

# "Near me": a 500 m circle.
NEAR_WORDS = [
    "near me", "near", "nearby", "close", "close to me", "close by", "around me", "near here",
    "walking distance", "2arib", "2arib menne", "2arib mni", "arib", "2rib", "aarib", "orib",
    "2orib", "qarib", "karib", "2rayeb", "2aribe", "hon", "men hon", "janbe", "jambe",
    "7adde", "7addi", "ta7t el beit", "ta7t l beit", "proche", "pres de chez moi",
    "pres de moi", "autour de moi", "قريب", "قريبة", "قريب مني", "حدي", "تحت البيت", "جنبي",
    "هون",
]

# "Open now": only places open at this moment. Urgent words ("now",
# "urgent", "hala2", "ضروري") belong here too: the open_now search filter
# also keeps providers marked "Available now", so an urgent request gets
# the people who can come right away.
OPEN_NOW_WORDS = [
    "open now", "open", "now", "right now", "hala2", "halla2", "hala2a", "halla2a", "hal2a2",
    "fete7", "fet7", "fet7a", "fet7in", "fat7", "fete7 hala2", "maftou7", "maftou7a",
    "tonight", "urgent", "urgently", "mista3jil", "mesta3jel", "mista3jle", "maintenant",
    "ouvert", "ouverte", "هلق", "هلا", "مفتوح", "مفتوحة", "فاتح", "فاتحة", "مستعجل",
    "ضروري", "ضرورية", "عاجل", "بسرعة", "فورا", "daroure", "darouri", "daruri", "darure",
    "asap", "3ajal", "3al 3ajal", "bi sor3a", "bsor3a", "b sor3a", "fawran",
    "immediately", "right away",
]

# "Cheap" -> sort by price. "Closest" -> sort by distance.
CHEAP_WORDS = [
    "cheap", "cheapest", "cheaper", "affordable", "low price", "rkhis", "re5is",
    "rekhis", "rakhis", "rkhees", "rkhise", "ar5as", "arkhas", "a5as", "mech ghali",
    "msh ghali", "mish ghali", "mesh ghali", "pas cher", "moins cher", "le moins cher",
    "bon marche", "رخيص", "رخيصة", "ارخص", "مش غالي",
]
CLOSEST_WORDS = [
    "closest", "nearest", "a2rab", "aqrab", "le plus proche", "plus proche", "اقرب",
]

# Small words that are skipped when matching phrases: "el brad ma 3am
# ybarred" is read as "brad ybarred". They never mean anything alone.
FILLER_WORDS = {
    "el", "l", "al", "il", "3am", "ma", "w", "wa", "la", "lal", "lel", "lil", "3a", "3al",
    "ya", "the", "my", "a", "an", "of", "to", "de", "du", "d", "des", "le", "les", "un",
    "une", "mon",
}

# Words before a place name: "in Hamra", "b jounieh", "fi tripoli", "في الحمرا".
# ("a" / "à" is left out: "a plumber" would look for a place called "plumber".)
PLACE_WORDS = {"in", "at", "near", "around", "b", "bi", "bel", "fi", "fe", "في"}

# A price limit: "under 20", "a2al men 20", "ma bi zid 3an 20", "moins de 20",
# "اقل من 20".
PRICE_PATTERN = re.compile(
    r"(?<!\S)(?:under|below|less than|cheaper than|up to|max|maximum|not more than|"
    r"no more than|budget|a2al (?:men|mn|min|mi)|a2all (?:men|mn|min)|a2al|akal (?:men|mn)|"
    r"ma ba3ed|ma bi ?zid 3an|ma by?zid 3an|ma yzid 3an|"
    r"(?:mech|msh|mish|mesh) aktar (?:men|mn|min)|ta7t|taht|"
    r"moins de|jusqu a|pas plus de|"
    r"اقل من|باقل من|ب اقل من|تحت|ما بيتعدى|ما بيزيد عن|حد اقصى)"
    r" (\d+)(k)?(?: (alf|alef|الف|million|malyon|مليون))?"
)
LBP_WORDS = {
    "lira", "lera", "lerat", "ll", "lbp", "leira", "ليرة", "ليره", "alf", "alef", "الف",
    "مليون",
}
HOUR_WORDS = {
    "hour", "hours", "hr", "h", "sa3a", "se3a", "s3a", "heure", "session", "seance",
    "7essa", "ساعة", "ساعه", "بالساعة", "بالساعه", "حصة",
}
VISIT_WORDS = {
    "visit", "ziyara", "kachfiyye", "kashfiye", "kechfiye", "consultation", "consult",
    "زيارة", "كشفية", "معاينة",
}
MONTH_WORDS = {"month", "monthly", "shahr", "chahr", "shaher", "mois", "mensuel", "شهر",
               "بالشهر", "شهريا"}

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

# Common words that never mean a category and are never a place: "I need",
# "baddé", "fi 7ada", "kifak". They are also kept away from the spelling-
# mistake matching, so "kifak" is never read as some category word.
STOP_WORDS = {
    # English
    "i", "my", "me", "a", "an", "the", "is", "it", "to", "for", "of", "and", "or", "need",
    "want", "looking", "someone", "somebody", "who", "can", "fix", "repair", "broken",
    "stopped", "working", "not", "please", "good", "best", "cheap", "with", "this", "that",
    "there", "where", "what", "how", "any", "anyone", "guy", "man", "woman", "today",
    "tomorrow", "home", "house", "help", "find", "get", "have", "has", "your", "you",
    "our", "kids", "son", "daughter", "wife", "father", "mother",
    # Arabizi
    "badde", "baddi", "bade", "baddé", "bede", "bedde", "beddi", "bidde", "biddi", "bde",
    "bdi", "3ayez", "3ayze", "3awez", "ana", "enta", "inte", "fi", "hada", "7ada", "wa7ad",
    "wahad", "wa7de", "shi", "chi", "ya3ne", "mni7", "mnih", "tasli7", "msalle7", "ysalle7",
    "ysalli7", "ysalle7li", "bysalle7", "y3allem", "et3allam", "t3allem", "kifak", "kifik",
    "shu", "chou", "shou", "wen", "wein", "lesh", "kif", "ktir", "kteer", "shway", "kel",
    "kell", "kil", "hayda", "hayde", "haydi", "ebne", "ebni", "binte", "bente", "ekhte",
    "khaye", "emme", "bayye", "beit", "bet", "bayt", "3ande", "3andi", "3anna", "ma3", "men",
    "mn", "min", "3an", "3la", "3ala", "hek", "hik", "ok", "okay", "yalla", "merci",
    "shukran", "habibi", "habibti", "ya", "akhbarak", "lyom", "lyawm", "bokra", "mbere7",
    "sar", "sa2el", "fiye", "fik", "fina", "ra7", "bas", "kamen", "kaman", "aw", "yemken",
    "khalas", "5alas", "ta3ban", "ta3bane", "7elo", "7elwe", "mabsout", "zaghir", "kbir",
    "jdid", "2adim", "mesh", "mish", "msh", "mech", "la2", "eh", "aywa", "akid", "tab",
    "ghali", "5erb", "kherb", "5arban", "kharban", "khirb", "maksour", "maksoura",
    "3otlan", "3otlane", "wa2ef", "wa2fe", "ba3d", "abel", "2abel", "lezem", "byesta3mel",
    "ya3mel", "a3mel", "ta3mel", "na3mel", "3am", "dawwer", "bdawwer", "3am dawwer",
    "se3er", "si3r", "dollar", "dolar", "masari", "mosh", "okhte", "ukhti", "ekhti", "khayy",
    "khayye", "emmi", "bayyi", "jeddo", "teta", "3ammo", "khalo", "zalame", "mara", "wlad",
    "walad", "bent", "sabiyye", "milad", "3id", "3eid", "7afle", "3ers", "sahra", "telete",
    "tlete", "tnen", "arb3a", "sabt", "a7ad", "jem3a", "tayeb", "tayyeb", "ma3leh", "ma3lesh",
    "baddak", "baddik", "fakker", "ba3ref", "ba3rif", "fhemt", "7aki", "7ke", "ehke", "eza",
    "iza", "law", "lamma", "dayman", "wala", "salamet", "mar7aba", "marhaba", "ahla", "tele3",
    "tle3", "tal3a", "tel3et", "nezel", "nezle", "ijit", "raje3",
    # English words that look like category words to the spelling-mistake step
    "price", "prices", "tired", "tell", "rules", "match", "matter", "from", "doesn", "isn",
    "didn", "wasn", "won",
    # French
    "je", "cherche", "un", "une", "le", "la", "les", "pour", "de", "du", "mon", "ma",
    "besoin", "veux", "voudrais", "chez", "moi", "avec", "qui", "est", "il", "y",
    "moins", "plus", "dans", "sans", "tres", "salut", "bonjour", "prix",
    # Arabic
    "بدي", "حدا", "شي", "واحد", "تصليح", "مصلح", "منيح", "عندي", "في", "وين", "شو",
}
# fmt: on

MAX_CATEGORIES = 3
LONGEST_PHRASE = 4  # words


# ---------------------------------------------------------------------------
# Building the lookup tables (once, when the server starts)
# ---------------------------------------------------------------------------

Meaning = tuple[str, str]  # (what, value): ("category", "plumber"), ("near", "")...

NORMALIZED_FILLERS = {arabizi_word(word) for word in FILLER_WORDS}
NORMALIZED_STOP_WORDS = {normalize_text(word) for word in STOP_WORDS}
CANONICAL_STOP_WORDS = {arabizi_word(word) for word in STOP_WORDS}
NORMALIZED_PLACE_WORDS = {normalize_text(word) for word in PLACE_WORDS}


def canonical_words(text: str) -> list[str]:
    """The Arabizi spelling of each word, without the filler words."""
    words = (arabizi_word(word) for word in normalize_text(text).split())
    return [word for word in words if word not in NORMALIZED_FILLERS]


def _all_entries() -> list[tuple[str, Meaning]]:
    """Every word or phrase in the lists above, with what it means."""
    entries: list[tuple[str, Meaning]] = []
    for slug, words in CATEGORY_WORDS.items():
        entries += [(word, ("category", slug)) for word in words]
    for slug, words in GENERAL_WORDS.items():
        entries += [(word, ("general", slug)) for word in words]
    for (home_slug, car_slug), words in HOME_OR_CAR_WORDS.items():
        entries += [(word, ("home_or_car", f"{home_slug}|{car_slug}")) for word in words]
    entries += [(word, ("near", "")) for word in NEAR_WORDS]
    entries += [(word, ("open", "")) for word in OPEN_NOW_WORDS]
    entries += [(word, ("cheap", "")) for word in CHEAP_WORDS]
    entries += [(word, ("closest", "")) for word in CLOSEST_WORDS]
    return entries


def _add(index: dict, key, meaning: Meaning) -> None:
    meanings = index.setdefault(key, [])
    if meaning not in meanings:
        meanings.append(meaning)


def _build_indexes():
    """Four lookup tables, built once:

    exact     one word exactly as listed ("hala2", "7alla2", "البراد")
    phrases   Arabizi spellings of words and phrases, fillers left out
              (("may", "tnazel") for "may 3am tnazzel")
    skeletons consonants of a category word ("snkr" for "sankari")
    by_length category words by length, for one-letter spelling mistakes

    Two different words can get the same Arabizi spelling: "hala2" (now) and
    "7ala2" (barber) are both "hala". Such a spelling is left out of the
    tables where it would be ambiguous; the exact spelling still works.
    """
    exact: dict[str, list[Meaning]] = {}
    phrases: dict[tuple[str, ...], list[Meaning]] = {}
    for word, meaning in _all_entries():
        normalized = normalize_text(word)
        if " " not in normalized:
            _add(exact, normalized, meaning)
        key = tuple(canonical_words(word))
        if key:
            _add(phrases, key, meaning)

    ambiguous = {key for key, meanings in phrases.items() if len(key) == 1 and len(meanings) > 1}
    for key in ambiguous:
        del phrases[key]

    # Only category words take part in the fuzzy steps: "closed" must never
    # be read as "close" (near me), nor a common word as a category.
    fuzzy_words = {
        key[0]: meanings
        for key, meanings in phrases.items()
        if len(key) == 1
        and key[0].isascii()
        and all(what in ("category", "general") for what, _ in meanings)
    }
    skeletons: dict[str, list[Meaning]] = {}
    clashes: set[str] = set()
    for word, meanings in fuzzy_words.items():
        consonants = skeleton(word)
        if len(consonants) < 4:
            continue  # "brad" -> "brd", "anjar" -> "njr": too few letters to guess from
        if consonants in skeletons and skeletons[consonants] != meanings:
            clashes.add(consonants)  # two different words, same consonants
        skeletons[consonants] = meanings
    for consonants in clashes:
        del skeletons[consonants]

    # Spelling mistakes only between words of 5+ letters on both sides:
    # "math" / "match" or "hale" / "hafle" are too short to tell apart.
    by_length: dict[int, list[str]] = {}
    for word in fuzzy_words:
        if len(word) >= 5:
            by_length.setdefault(len(word), []).append(word)
    return exact, phrases, skeletons, by_length, sorted(" ".join(k) for k in ambiguous)


EXACT, PHRASES, SKELETONS, WORDS_BY_LENGTH, AMBIGUOUS = _build_indexes()

ARABIC_PREFIXES = ("وال", "بال", "فال", "كال", "لل", "ال", "و", "ب", "ل", "ف")
ARABIC_ENDINGS = ("ات", "ها", "نا", "كن", "هم", "لي", "ي", "ه", "ك")
LATIN_PREFIXES = ("el", "l", "bel", "w")
# Arabizi prefixes and endings, on the Arabizi spelling:
# "lsankari", "bel-brad", "sayyarte" (my car), "dawlebe" (my tyre),
# "ysalle7li" (fix it for me), "laptopet" (laptops).
# (Longer ones first, so "bel" is tried before "b".)
ARABIZI_PREFIXES = "wel bel bil lal fel el al il bl wl fl l b w".split()
ARABIZI_ENDINGS = "lak lik kun le ak ik na ne ha et at e a u".split()


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


def arabizi_forms(canonical: str) -> list[str]:
    """An Arabizi spelling, then the same without a small prefix and/or ending."""
    stems = [canonical]
    for prefix in ARABIZI_PREFIXES:
        if canonical.startswith(prefix) and len(canonical) - len(prefix) >= 3:
            stems.append(canonical[len(prefix) :])
    forms = []
    for stem in stems:
        forms.append(stem)
        for ending in ARABIZI_ENDINGS:
            if stem.endswith(ending) and len(stem) - len(ending) >= 3:
                forms.append(stem[: -len(ending)])
    return list(dict.fromkeys(forms))


def one_edit_apart(a: str, b: str) -> bool:
    """True when b is a with at most one letter added, removed or changed
    (Levenshtein distance <= 1): "plumbr" / "plumber", "electrisien" /
    "electricien" (after Arabizi spelling)."""
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) > len(b):
        a, b = b, a  # a is now the shorter (or same length)
    # Skip the common start, then the rest must match after one edit.
    i = 0
    while i < len(a) and a[i] == b[i]:
        i += 1
    if len(a) == len(b):
        return a[i + 1 :] == b[i + 1 :]  # one letter changed
    return a[i:] == b[i + 1 :]  # one letter added in b


def _misspelled(canonical: str) -> list[Meaning]:
    """Category meaning of a word one letter away from a known word, when
    exactly one meaning is that close (otherwise we cannot tell)."""
    found: list[Meaning] = []
    for length in (len(canonical) - 1, len(canonical), len(canonical) + 1):
        for known in WORDS_BY_LENGTH.get(length, []):
            if one_edit_apart(canonical, known):
                for meaning in PHRASES[(known,)]:
                    if meaning not in found:
                        found.append(meaning)
    return found if len(found) == 1 else []


def _known_alone(canonical: str) -> list[Meaning] | None:
    """Meanings of an exactly known Arabizi word; [] for a stop word; None if unknown."""
    if canonical in CANONICAL_STOP_WORDS:
        return []
    return PHRASES.get((canonical,))


def _glued(canonical: str) -> list[Meaning]:
    """Two known words typed without a space: "baddesankari" -> "bade" + "sankare".
    At least one half must be a category word."""
    for cut in range(3, len(canonical) - 2):
        left = _known_alone(canonical[:cut])
        right = _known_alone(canonical[cut:])
        if left is None or right is None:
            continue
        meanings = left + right
        if any(what in ("category", "general") for what, _ in meanings):
            return meanings
    return []


def match_word(word: str, is_place: Callable[[], bool] | None = None) -> list[Meaning]:
    """What one normalised word means ([] when nothing): the steps a-e above.

    is_place: optional check "is this word (part of) a known place name?",
    asked only when the word is not listed exactly. A place is never
    guessed to be a category word: "anjar" is a town, not "najjar".
    """
    # a. Exactly as listed (small prefixes and endings tolerated).
    for form in word_forms(word):
        if form in EXACT:
            return EXACT[form]
    if not word.isascii() or word.isdigit():
        return []
    if is_place is not None and is_place():
        return []
    canonical = arabizi_word(word)
    if canonical in CANONICAL_STOP_WORDS or canonical in NORMALIZED_FILLERS:
        return []
    # b. The Arabizi spelling (small prefixes and endings tolerated).
    for form in arabizi_forms(canonical):
        if (form,) in PHRASES:
            return PHRASES[(form,)]
    # Steps c and d only for words of 5+ letters: short words ("from",
    # "sans") have too few letters to guess from.
    if len(canonical) < 5:
        return []
    # c. One letter wrong.
    found = _misspelled(canonical)
    if found:
        return found
    # d. The same consonants: "snkri" = "sankari", "kondarje" = "kundurji".
    consonants = skeleton(canonical)
    if consonants in SKELETONS:
        return SKELETONS[consonants]
    # e. Two words without a space.
    if len(canonical) >= 7:
        return _glued(canonical)
    return []


def find_meanings(
    words: list[str], is_place: Callable[[str], bool] | None = None
) -> tuple[list[Meaning], set[int]]:
    """Every meaning found in the sentence, in order, and the positions of the
    words that were used (so they are not mistaken for a place name).

    is_place: optional check "is this text a known place name?" (it needs
    the database, so the caller passes it in).
    """

    def place_at(position: int) -> Callable[[], bool] | None:
        """A check for the word at this position: alone, or inside a place
        name of up to 3 words ("el balad", "hay al sullam")."""
        if is_place is None:
            return None
        texts = [
            " ".join(words[start:end])
            for start in range(max(0, position - 2), position + 1)
            for end in range(position + 1, min(len(words), start + 3) + 1)
        ]
        return lambda: any(is_place(text) for text in texts)

    # Positions of the words that count (filler words are skipped), with
    # their Arabizi spelling.
    content = [
        (position, arabizi_word(word))
        for position, word in enumerate(words)
        if arabizi_word(word) not in NORMALIZED_FILLERS
    ]
    meanings: list[Meaning] = []
    used: set[int] = set()
    i = 0
    while i < len(content):
        found = False
        # Longest phrase first: "car electrician" before "car".
        for length in range(min(LONGEST_PHRASE, len(content) - i), 1, -1):
            span = content[i : i + length]
            key = tuple(spelling for _, spelling in span)
            if key in PHRASES:
                meanings.extend(PHRASES[key])
                used.update(range(span[0][0], span[-1][0] + 1))
                i += length
                found = True
                break
        if found:
            continue
        position = content[i][0]
        single = match_word(words[position], place_at(position))
        if single:
            meanings.extend(single)
            used.add(position)
        i += 1
    return meanings, used


def pick_categories(meanings: list[Meaning], categories: list[Category]) -> list[str]:
    """The category slugs to search, from the meanings found (at most 3)."""
    known = {category.slug for category in categories}
    by_id = {category.id: category.slug for category in categories}
    parents = {
        category.slug: by_id[category.parent_id]
        for category in categories
        if category.parent_id in by_id
    }

    def is_car(slug: str) -> bool:
        return slug == "car-services" or parents.get(slug) == "car-services"

    precise = [value for what, value in meanings if what == "category" and value in known]
    general = [value for what, value in meanings if what == "general" and value in known]
    with_car = any(is_car(slug) for slug in precise)
    # "moteur", "batterie", "start": decided by whether a car was mentioned.
    for what, value in meanings:
        if what == "home_or_car":
            home_slug, car_slug = value.split("|")
            slug = car_slug if with_car else home_slug
            if slug in known:
                precise.append(slug)
    if with_car:
        precise = [CAR_VERSION.get(slug, slug) for slug in precise]
        precise = [slug for slug in precise if slug in known]

    slugs = list(dict.fromkeys(precise or general))
    # "plumber" and its own group "home-repair" both matched: keep the precise one.
    slugs = [slug for slug in slugs if not any(parents.get(other) == slug for other in slugs)]
    return slugs[:MAX_CATEGORIES]


def find_price(text: str, words: list[str], slugs: list[str], parents: dict[str, str]):
    """(amount, unit, currency) for "under 20", "a2al men 20$ bel se3a"...;
    None when no price limit is stated."""
    # "1,500,000" -> "1500000" before punctuation becomes a space.
    normalized = normalize_text(re.sub(r"(?<=\d)[,.](?=\d{3}\b)", "", text))
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

    # Compare Arabizi spellings: "chahr" and "shahr" are the same word.
    spellings = {arabizi_word(word) for word in words}

    def said(unit_words: set[str]) -> bool:
        return bool(spellings & {arabizi_word(word) for word in unit_words})

    # Currency words are compared as typed: "ll" (lira) must not be read as
    # the French "l" ("l'heure"), which is what its Arabizi spelling would be.
    lira = set(words) & {normalize_text(word) for word in LBP_WORDS}
    currency = "LBP" if (lira or multiplier or match.group(2)) else "USD"
    if said(HOUR_WORDS):
        unit = "hour"
    elif said(VISIT_WORDS):
        unit = "visit"
    elif said(MONTH_WORDS):
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
        and arabizi_word(word) not in CANONICAL_STOP_WORDS
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
    words = normalize_text(text).split()
    if not words:
        return None

    def is_place(name: str) -> bool:
        return bool(find_place(db, name, fuzzy=False))

    meanings, used = find_meanings(words, is_place if db is not None else None)
    slugs = pick_categories(meanings, categories)
    if not slugs:
        return None

    by_id = {category.id: category.slug for category in categories}
    parents = {
        category.slug: by_id[category.parent_id]
        for category in categories
        if category.parent_id in by_id
    }
    found = {what for what, _ in meanings}
    price = find_price(text, words, slugs, parents)
    if "cheap" in found:
        sort = "price"
    elif "closest" in found:
        sort = "distance"
    else:
        sort = "best"
    return {
        "category_slugs": slugs,
        "q": None,
        "place_name": find_place_name(db, words, used),
        "radius_m": 500 if "near" in found else None,
        "max_price": price[0] if price else None,
        "price_unit": price[1] if price else None,
        "price_currency": price[2] if price else None,
        "open_now": "open" in found,
        "sort": sort,
    }
