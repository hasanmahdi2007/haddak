"""Category tree v2: 85 new categories (143 in all) and search words for every one.

The founder widened the scope to every paid service and shop (docs/PROJECT.md,
"Category tree v2" in docs/SCHEMA.md). This adds new children to existing
groups (optician, locksmith, tyres, nursery, ...) and ten new groups (food &
drink, groceries, fashion, home shops, pets, everyday services, phones &
electronics, events, books & gifts, volunteering). It also fills
categories.aliases (0016) for every category, old and new.

Same insert-or-update by slug as 0014: existing rows keep their id (providers
point at it) and their parent, and get the names, icon, order and aliases
below. This is a frozen copy of scripts/seed.py's CATEGORIES and ALIASES on
the day it was written; tests/test_categories_migration.py fails when the two
disagree. A later change to the categories needs a new migration.

Revision ID: 0017
Revises: 0016
"""

from alembic import op
from sqlalchemy import text

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None

# (slug, English name, Arabic name, icon, aliases, children)
# Each child: (slug, English name, Arabic name, icon, aliases)
CATEGORY_TREE = [
    ("tech-repair", "Tech repair", "تصليح إلكترونيات", "devices", ["electronics repair", "تصليح الكترونيات", "صيانة اجهزة", "ajhize", "gadget repair", "tasli7 electronics"], [
        ("laptop-repair", "Laptop repair", "تصليح لابتوب", "laptop", ["computer repair", "pc repair", "تصليح كمبيوتر", "تصليح لابتوب", "labtop", "kombyuter", "laptop"]),
        ("phone-repair", "Phone repair", "تصليح هواتف", "phone", ["mobile repair", "screen repair", "تصليح تلفونات", "تصليح موبايل", "tasli7 tlifonet", "iphone repair"]),
        ("tv-repair", "TV repair", "تصليح تلفزيونات", "tv", ["television repair", "تصليح تلفزيون", "تلفزيون", "satellite", "ستلايت", "telfizyon"]),
    ]),
    ("music-lessons", "Music lessons", "دروس موسيقى", "music", ["music", "موسيقى", "musi2a", "music school", "معهد موسيقى", "cours de musique"], [
        ("saxophone-lessons", "Saxophone lessons", "دروس ساكسفون", "saxophone", ["saxophone", "sax", "ساكسفون", "ساكسوفون", "saksafon"]),
        ("piano-lessons", "Piano lessons", "دروس بيانو", "piano", ["piano", "بيانو", "byano", "piano teacher", "اورغ"]),
        ("guitar-lessons", "Guitar lessons", "دروس غيتار", "guitar", ["guitar", "غيتار", "جيتار", "gitar", "guitare"]),
        ("oud-lessons", "Oud lessons", "دروس عود", "oud", ["oud", "عود", "3oud", "buzuk", "بزق"]),
    ]),
    ("tutoring", "Tutoring", "دروس خصوصية", "book", ["tutor", "teacher", "private lessons", "استاذ", "دروس", "ostez", "2ostez", "drous khsousiye"], [
        ("math-tutoring", "Math tutoring", "دروس رياضيات", "calculator", ["math", "maths", "رياضيات", "استاذ رياضيات", "riyadiyat", "math teacher"]),
        ("physics-tutoring", "Physics tutoring", "دروس فيزياء", "atom", ["physics", "فيزياء", "فيزيا", "fizya", "physique"]),
        ("english-tutoring", "English tutoring", "دروس لغة إنكليزية", "language", ["english", "انكليزي", "انجليزي", "inglizi", "ielts", "toefl"]),
        ("french-tutoring", "French tutoring", "دروس لغة فرنسية", "language", ["french", "فرنساوي", "فرنسي", "fransawi", "francais"]),
        ("nursery", "Nursery", "حضانة", "baby", ["daycare", "kindergarten", "حضانة", "روضة", "7adane", "hadane", "garderie", "creche"]),
        ("language-school", "Language school", "مدرسة لغات", "languages", ["language courses", "languages", "معهد لغات", "لغات", "lughat", "langues", "ecole de langues"]),
    ]),
    ("doctors", "Doctors", "أطباء", "stethoscope", ["doctor", "clinic", "دكتور", "طبيب", "حكيم", "عيادة", "7akim", "dakton"], [
        ("dermatologist", "Dermatologist", "طبيب جلد", "skin", ["skin doctor", "دكتور جلد", "حكيم جلد", "جلدية", "dermato", "7akim jeled"]),
        ("dentist", "Dentist", "طبيب أسنان", "tooth", ["dental", "اسنان", "دكتور اسنان", "حكيم اسنان", "snan", "7akim snen", "dentiste"]),
        ("pediatrician", "Pediatrician", "طبيب أطفال", "baby", ["kids doctor", "دكتور اطفال", "حكيم ولاد", "طبيب ولاد", "7akim wlad", "pediatre"]),
        ("general-practitioner", "General practitioner", "طبيب صحة عامة", "stethoscope", ["gp", "family doctor", "طبيب عام", "دكتور عام", "طب عام", "medecin traitant"]),
        ("pharmacy", "Pharmacy", "صيدلية", "stethoscope", ["pharmacie", "drugstore", "chemist", "صيدلي", "دوا", "saydaliye", "saydalie"]),
        ("optician", "Optician", "نظارات", "glasses", ["glasses", "contact lenses", "نظارات", "نضارات", "عدسات", "nadarat", "opticien", "lunettes"]),
        ("medical-lab", "Medical lab", "مختبر", "flask", ["laboratory", "lab", "blood test", "مختبر", "تحاليل", "تحليل دم", "ma5tabar", "laboratoire"]),
        ("physiotherapist", "Physiotherapist", "علاج فيزيائي", "activity", ["physio", "physiotherapy", "علاج فيزيائي", "فيزيو", "3ilej fizye2e", "kine", "kinesitherapeute"]),
        ("hospital", "Hospital", "مستشفى", "hospital", ["emergency", "hospitals", "مستشفى", "طوارئ", "mustashfa", "mestashfa", "hopital"]),
    ]),
    ("home-repair", "Home repair", "صيانة منزلية", "tools", ["handyman", "maintenance", "صيانة", "تصليحات", "siyane", "bricoleur"], [
        ("plumber", "Plumber", "سنكري", "pipe", ["plumbing", "pipes", "سمكري", "سنكري", "تمديدات صحية", "sankari", "sankary", "plombier"]),
        ("electrician", "Electrician", "كهربجي", "bolt", ["electricity", "electrical", "كهربائي", "كهربجي", "كهربا", "kahrabji", "kahraba", "electricien"]),
        ("carpenter", "Carpenter", "نجار", "hammer", ["carpentry", "woodwork", "نجار", "نجارة", "najjar", "nejjar", "menuisier"]),
        ("ac-repair", "AC repair", "تصليح مكيفات", "snowflake", ["air conditioner", "aircon", "مكيف", "مكيفات", "تكييف", "mkayyef", "clim"]),
        ("appliance-repair", "Fridge & appliance repair", "تصليح براد وغسالة", "appliance", ["fridge repair", "washing machine repair", "appliances", "براد", "غسالة", "تصليح براد", "brad", "ghassele"]),
        ("painter", "House painter", "دهّان", "paint-roller", ["painting", "paint", "دهان", "طرش", "dahhan", "dahan", "peintre"]),
        ("locksmith", "Locksmith", "مفاتيحي", "key", ["keys", "lock", "key copy", "مفاتيح", "نسخ مفاتيح", "mfetee7", "serrurier"]),
        ("cleaning", "Cleaning", "تنظيف", "sparkles", ["cleaner", "house cleaning", "deep cleaning", "تنظيف بيوت", "تنظيفات", "عاملة تنظيف", "tanzif", "menage"]),
        ("movers", "Movers", "نقل عفش", "truck", ["moving", "removals", "نقل اثاث", "عفش", "na2el 3afesh", "demenagement"]),
        ("pest-control", "Pest control", "رش مبيدات", "bug", ["exterminator", "insects", "termites", "مبيدات", "رش حشرات", "صراصير", "rash mbidet", "desinsectisation"]),
        ("water-tank-cleaning", "Water tank cleaning", "تنظيف خزانات", "container", ["water tank", "tank cleaning", "تنظيف خزان", "تعقيم خزانات", "خزانات", "khazzan", "5azzan"]),
        ("glass-aluminium", "Glass & aluminium", "زجاج وألمنيوم", "window", ["glass", "aluminium", "aluminum", "زجاج", "قزاز", "الومنيوم", "alminyom", "2zez"]),
        ("tiler", "Tiler", "مبلّط", "grid", ["tiles", "tiling", "مبلط", "بلاط", "سيراميك", "ballat", "carrelage"]),
        ("welder", "Blacksmith & welder", "حدّاد", "anvil", ["blacksmith", "welding", "حداد", "تلحيم", "حدادة", "7addad", "haddad", "ferronnerie"]),
        ("upholsterer", "Upholsterer", "منجّد", "armchair", ["upholstery", "sofa repair", "منجد", "تنجيد", "mnajjed", "tanjid", "tapissier"]),
    ]),
    ("power", "Power & energy", "كهربا وطاقة", "bolt", ["electricity", "energy", "كهرباء", "طاقة", "kahraba", "ta2a"], [
        ("solar", "Solar panels", "طاقة شمسية", "bolt", ["solar energy", "solar system", "طاقة شمسية", "الواح شمسية", "سولار", "ta2a shamsiye", "solaire"]),
        ("batteries-inverters", "Batteries & inverters", "بطاريات وإنفرتر", "car-battery", ["inverter", "battery", "انفرتر", "بطارية", "بطاريات", "onduleur", "ups", "batariye"]),
        ("generator", "Generators", "موتير / مولّد", "bolt", ["generator", "مولد", "موتير", "اشتراك", "mwalled", "moteur", "ishtirak", "amper"]),
        ("solar-cleaning", "Solar panel cleaning", "تنظيف ألواح", "water", ["panel cleaning", "solar cleaning", "تنظيف الواح", "تنظيف طاقة شمسية", "tanzif solar"]),
    ]),
    ("art-lessons", "Art lessons", "دروس فنون", "palette", ["art", "art classes", "فنون", "رسم", "fonoun", "beaux arts"], [
        ("drawing-lessons", "Drawing lessons", "دروس رسم", "pencil", ["drawing", "sketching", "رسم", "rasm", "dessin"]),
        ("painting-lessons", "Painting lessons", "دروس تلوين", "brush", ["painting", "watercolor", "تلوين", "talwin", "peinture"]),
        ("calligraphy-lessons", "Arabic calligraphy", "دروس خط عربي", "pen", ["calligraphy", "خط عربي", "خطاط", "khat 3arabi", "calligraphie"]),
    ]),
    ("sweets-shops", "Sweets and candy shops", "حلويات وسكاكر", "candy", ["sweets", "dessert", "desserts", "حلويات", "حلو", "7elwayet"], [
        ("arabic-sweets", "Arabic sweets", "حلويات عربية", "baklava", ["knefe", "baklawa", "كنافة", "بقلاوة", "معمول", "ma3moul", "halawiyat", "7elwayet 3arabiye"]),
        ("candy-shop", "Candy shop", "محل سكاكر", "candy", ["candy", "chocolate", "سكاكر", "شوكولا", "sakaker", "bonbon"]),
        ("cake-shop", "Cake shop", "محل قوالب حلوى", "cake", ["cake", "birthday cake", "كيك", "قالب حلوى", "gateau", "gato", "patisserie"]),
    ]),
    ("beauty", "Beauty and grooming", "تجميل وعناية", "scissors", ["beauty salon", "makeup", "laser", "تجميل", "مكياج", "ليزر", "beaute"], [
        ("barber", "Barber", "حلاق رجالي", "scissors", ["haircut", "barbershop", "حلاق", "حلاقة", "7alla2", "hallak", "coiffeur homme"]),
        ("hair-salon", "Hair salon", "صالون نسائي", "hair-dryer", ["hairdresser", "salon", "كوافير", "كوافيرة", "صالون", "kwafeer", "coiffure"]),
        ("nail-salon", "Nail salon", "عناية بالأظافر", "nail-polish", ["nails", "manicure", "pedicure", "مناكير", "اظافر", "ongles"]),
        ("spa-massage", "Spa & massage", "سبا ومساج", "flower", ["massage", "spa", "مساج", "سبا", "حمام مغربي", "masaj", "hammam"]),
    ]),
    ("car-services", "Car services", "خدمات سيارات", "car", ["car", "auto", "سيارة", "سيارات", "sayyara", "siyarat", "voiture"], [
        ("mechanic", "Mechanic", "ميكانيكي", "wrench", ["garage", "car repair", "ميكانيك", "كراج", "mikanik", "mekaniki", "mecanicien"]),
        ("car-electrician", "Car electrician", "كهربائي سيارات", "car-battery", ["auto electrician", "car battery", "كهربجي سيارات", "kahrabji siyarat", "electricien auto"]),
        ("car-wash", "Car wash", "غسيل سيارات", "water", ["carwash", "detailing", "غسيل سيارات", "تلميع", "ghasil siyarat", "lavage"]),
        ("tyres", "Tyres", "دواليب", "tyre", ["tires", "flat tire", "دواليب", "كاوتشوك", "dawelib", "kawchouk", "pneus"]),
        ("car-parts", "Car parts", "قطع سيارات", "cog", ["spare parts", "auto parts", "قطع غيار", "قطع سيارات", "2ita3 siyarat", "pieces auto"]),
        ("driving-school", "Driving school", "مدرسة سواقة", "steering", ["driving lessons", "driving instructor", "دروس سواقة", "سواقة", "swa2a", "auto ecole"]),
        ("fuel-station", "Fuel station", "محطة بنزين", "fuel", ["gas station", "petrol", "بنزين", "محطة", "benzine", "mahatta", "station essence"]),
        ("car-rental", "Car rental", "تأجير سيارات", "car-key", ["rent a car", "rental", "تاجير سيارات", "ايجار سيارة", "ta2jir siyarat", "location voiture"]),
        ("towing", "Towing", "سحب سيارات", "tow-truck", ["tow truck", "breakdown", "سحب سيارات", "ونش", "رافعة", "winch", "depanneuse"]),
    ]),
    ("fitness", "Fitness", "لياقة بدنية", "dumbbell", ["gym", "sport", "جيم", "نادي رياضي", "رياضة", "nadi", "salle de sport"], [
        ("personal-trainer", "Personal trainer", "مدرب شخصي", "dumbbell", ["coach", "trainer", "مدرب", "كوتش", "mdarreb", "coach sportif"]),
        ("yoga", "Yoga", "يوغا", "yoga", ["pilates", "meditation", "يوجا", "بيلاتس", "yoga studio"]),
        ("martial-arts", "Martial arts", "فنون قتالية", "karate", ["karate", "taekwondo", "boxing", "judo", "kickboxing", "كاراتيه", "ملاكمة", "mma"]),
        ("sports-shop", "Sports shop", "أدوات رياضة", "trophy", ["sports store", "sportswear", "ادوات رياضية", "ملابس رياضة", "سبور", "articles de sport"]),
    ]),
    ("tailoring", "Tailoring and shoe repair", "خياطة وتصليح أحذية", "needle", ["tailor", "alterations", "خياطة", "khayyat", "couture"], [
        ("tailor", "Tailor", "خياط", "needle", ["alterations", "خياطة", "تقصير", "khayyat", "5ayyat", "couturier", "retouche"]),
        ("shoe-repair", "Shoe repair", "كندرجي", "shoe", ["cobbler", "تصليح احذية", "تصليح صبابيط", "كندرجي", "kundurji", "cordonnier"]),
    ]),
    ("photography", "Photography", "تصوير", "camera", ["photo", "camera", "تصوير", "taswir", "photoshoot"], [
        ("photographer", "Photographer", "مصور", "camera", ["photo", "photoshoot", "wedding photographer", "مصور", "msawwer", "photographe"]),
        ("videographer", "Videographer", "مصور فيديو", "video", ["video", "drone", "فيديو", "تصوير فيديو", "مونتاج", "montage"]),
    ]),
    ("food-drink", "Food & drink", "أكل وشرب", "utensils", ["food", "eat", "drinks", "اكل", "مطاعم", "akel", "manger"], [
        ("restaurant", "Restaurant", "مطعم", "utensils", ["restaurants", "dining", "مطعم", "مطاعم", "mat3am", "resto"]),
        ("shawarma-manakish", "Shawarma & manakish", "شاورما ومناقيش", "sandwich", ["shawarma", "manakish", "falafel", "شاورما", "مناقيش", "منقوشة", "فلافل", "man2ouche"]),
        ("fast-food", "Fast food", "وجبات سريعة", "burger", ["burger", "pizza", "sandwiches", "برغر", "بيتزا", "سندويشات", "fast food"]),
        ("cafe", "Café", "كافيه", "coffee", ["coffee", "coffee shop", "قهوة", "مقهى", "كافيه", "ahwe", "2ahwe"]),
        ("bakery", "Bakery", "فرن", "croissant", ["bread", "خبز", "فرن", "كعك", "forn", "furn", "boulangerie", "ka3ek"]),
        ("juice-ice-cream", "Juice & ice cream", "عصير وبوظة", "ice-cream", ["ice cream", "juice", "بوظة", "عصير", "كوكتيل", "booza", "3asir", "glace"]),
        ("catering", "Catering", "تموين حفلات", "chef-hat", ["caterer", "buffet", "تموين", "بوفيه", "tamwin", "traiteur"]),
    ]),
    ("groceries", "Groceries", "سمانة وخضرة", "cart", ["grocery", "سمانة", "خضرة", "بقالة", "samane", "epicerie"], [
        ("supermarket", "Supermarket", "سوبرماركت", "cart", ["super market", "market", "hypermarket", "سوبر ماركت", "ماركت", "supermarche"]),
        ("mini-market", "Mini-market", "دكّانة", "store", ["mini market", "convenience store", "دكانة", "دكان", "dekkene", "dikkene"]),
        ("greengrocer", "Greengrocer", "خضرجي", "apple", ["vegetables", "fruits", "خضرة", "خضار", "فواكه", "khedra", "5edra", "khodarji"]),
        ("butcher", "Butcher", "لحّام", "beef", ["meat", "لحام", "لحمة", "ملحمة", "la77am", "lahham", "boucherie"]),
        ("roastery", "Roastery & nuts", "محمصة", "nut", ["nuts", "coffee beans", "مكسرات", "محمصة", "قلوبات", "mo7masa", "torrefaction"]),
        ("water-delivery", "Drinking water", "مي للشرب", "droplets", ["water", "water gallons", "مي", "مياه", "مي شرب", "قناني مي", "mayy", "eau potable"]),
    ]),
    ("fashion", "Fashion", "أزياء", "shirt", ["clothes", "boutique", "تياب", "ثياب", "ملابس", "tyeb", "mode"], [
        ("kids-clothes", "Kids' clothes", "ألبسة ولاد", "baby", ["children clothes", "baby clothes", "تياب ولاد", "ملابس اطفال", "tyeb wled", "vetements enfants"]),
        ("clothes", "Clothes", "ألبسة", "shirt", ["clothing", "boutique", "تياب", "ثياب", "ملابس", "tyeb", "vetements"]),
        ("shoes", "Shoes", "أحذية", "shoe", ["shoe store", "sneakers", "صبابيط", "صباط", "احذية", "sobbat", "chaussures"]),
        ("bags-accessories", "Bags & accessories", "شنط واكسسوارات", "bag", ["bags", "accessories", "wallets", "شنط", "شنطة", "اكسسوارات", "shanta", "sacs"]),
        ("jewellery", "Jewellery", "مجوهرات", "gem", ["jewelry", "gold", "دهب", "ذهب", "صايغ", "mjawharat", "bijouterie"]),
        ("perfume-cosmetics", "Perfume & cosmetics", "عطور وتجميل", "spray", ["perfume", "cosmetics", "عطور", "عطر", "مستحضرات تجميل", "3otour", "parfum"]),
    ]),
    ("home-shops", "Home shops", "أدوات ومفروشات", "sofa", ["home store", "home goods", "ادوات منزلية", "مفروشات", "maison"], [
        ("hardware", "Hardware", "خردوات وعدّة", "hammer", ["tools", "bricolage", "خردوات", "عدة", "عدة وخردوات", "5erdawet", "khurdawat", "quincaillerie"]),
        ("furniture", "Furniture", "مفروشات", "sofa", ["furniture store", "sofa", "مفروشات", "موبيليا", "اثاث", "kanabe", "meubles"]),
        ("appliance-store", "Appliances store", "أدوات كهربائية منزلية", "fridge", ["appliances", "home appliances", "اجهزة منزلية", "ادوات كهربائية", "electromenager"]),
        ("electrical-supplies", "Electrical supplies", "لوازم كهرباء", "plug", ["electrical supplies", "cables", "لوازم كهربائية", "ادوات كهرباء", "materiel electrique"]),
        ("paint-shop", "Paint shop", "دهانات", "paint-bucket", ["paint", "paint store", "دهان", "دهانات", "بوية", "bouya", "peinture"]),
        ("lighting", "Lighting", "إنارة", "lamp", ["lights", "lamps", "led", "انارة", "اضاءة", "ثريات", "لمبات", "luminaire"]),
        ("curtains", "Curtains", "برادي", "blinds", ["curtain", "blinds", "برادي", "برداية", "ستائر", "baradi", "rideaux"]),
        ("gas-cylinders", "Gas cylinders", "قناني غاز", "flame", ["gas", "gas delivery", "غاز", "قنينة غاز", "ghaz", "2annine ghaz", "bouteille de gaz"]),
    ]),
    ("pets", "Pets", "حيوانات أليفة", "paw", ["animals", "cat", "dog", "حيوانات", "بسين", "كلب", "7ayawanet"], [
        ("vet", "Vet", "طبيب بيطري", "stethoscope", ["veterinarian", "veterinary", "animal doctor", "بيطري", "دكتور حيوانات", "7akim 7ayawanet", "veterinaire"]),
        ("pet-shop", "Pet shop", "محل حيوانات", "paw", ["pet store", "pet food", "اكل قطط", "اكل كلاب", "حيوانات", "animalerie"]),
        ("pet-grooming", "Pet grooming", "تزيين حيوانات", "scissors", ["grooming", "dog grooming", "pet salon", "حلاقة كلاب", "تحميم حيوانات", "toilettage"]),
    ]),
    ("everyday-services", "Everyday services", "خدمات يومية", "briefcase", ["services", "errands", "daily services", "خدمات", "خدمة", "khadamet"], [
        ("laundry", "Laundry & dry cleaning", "مصبغة", "washing-machine", ["dry cleaning", "pressing", "مصبغة", "غسيل تياب", "كوي", "masbagha", "laverie"]),
        ("printing", "Printing & copies", "طباعة وتصوير", "printer", ["print", "photocopy", "copies", "طباعة", "تصوير اوراق", "tbe3a", "imprimerie"]),
        ("money-transfer", "Money transfer", "تحويل أموال", "banknote", ["transfer", "western union", "omt", "whish money", "تحويل اموال", "تحويل مصاري", "صراف", "bureau de change"]),
        ("real-estate", "Real estate", "مكتب عقارات", "building", ["real estate agent", "apartment", "rent", "عقارات", "شقق", "ايجار", "سمسار", "immobilier"]),
        ("travel-agency", "Travel agency", "مكتب سفريات", "plane", ["travel", "tickets", "flights", "سفر", "تذاكر", "حجوزات", "safar", "agence de voyage"]),
        ("lawyer", "Lawyer", "محامي", "scale", ["attorney", "legal", "محامي", "محامية", "قانوني", "mo7ami", "avocat"]),
        ("accountant", "Accountant", "محاسب", "calculator", ["accounting", "tax", "bookkeeping", "محاسبة", "ضرائب", "mo7aseb", "comptable"]),
        ("insurance", "Insurance", "تأمين", "shield", ["car insurance", "health insurance", "insurance agent", "تامين", "ta2min", "assurance"]),
    ]),
    ("phones-electronics", "Phones & electronics", "تلفونات وإلكترونيات", "smartphone", ["electronics", "phones", "gadgets", "الكترونيات", "تلفونات", "tlifonet", "electronique"], [
        ("phone-shop", "Phone shop", "محل تلفونات", "smartphone", ["mobile shop", "cellular", "خليوي", "موبايلات", "tlifonet", "iphone", "samsung"]),
        ("computer-shop", "Computer shop", "محل كمبيوتر", "monitor", ["computers", "laptops", "pc store", "كمبيوتر", "لابتوب", "kombyuter", "informatique"]),
        ("electronics-shop", "Electronics shop", "محل إلكترونيات", "cpu", ["electronics", "gaming", "playstation", "chargers", "الكترونيات", "electronique"]),
    ]),
    ("events", "Events", "مناسبات", "party", ["parties", "occasions", "حفلات", "مناسبات", "7aflet", "evenements"], [
        ("florist", "Florist", "زهور", "flower", ["flowers", "flower shop", "bouquet", "زهور", "ورد", "ازهار", "wared", "fleuriste"]),
        ("wedding-planner", "Wedding & event planner", "منظّم أعراس وحفلات", "heart", ["wedding", "event planner", "عرس", "اعراس", "منظم حفلات", "زفة", "3ers", "zaffe"]),
        ("party-supplies", "Party supplies", "لوازم حفلات", "party-popper", ["balloons", "party decoration", "birthday decoration", "بالونات", "زينة", "zine", "cotillons"]),
        ("event-venue", "Event venue", "صالة مناسبات", "venue", ["hall", "venue", "wedding venue", "reception hall", "صالة", "قاعة", "salle"]),
    ]),
    ("books-gifts", "Books & gifts", "كتب وهدايا", "gift", ["books", "gifts", "كتب", "هدايا", "kteb", "hadaya", "librairie"], [
        ("bookshop", "Bookshop", "مكتبة", "book", ["books", "bookstore", "كتب", "روايات", "kteb", "librairie"]),
        ("stationery", "Stationery", "قرطاسية", "pencil", ["school supplies", "pens", "copybooks", "قرطاسية", "ادوات مدرسية", "2artasiye", "papeterie"]),
        ("gift-shop", "Gift shop", "هدايا", "gift", ["gifts", "souvenirs", "هدايا", "تحف", "hadaya", "hdeye", "cadeaux"]),
        ("toy-shop", "Toy shop", "ألعاب ولاد", "blocks", ["toys", "kids toys", "العاب", "لعب", "al3ab", "jouets"]),
    ]),
    ("volunteering", "Volunteering & NGOs", "تطوّع وجمعيات", "hand-heart", ["volunteer", "charity", "تطوع", "متطوع", "جمعيات", "خيرية", "tatawo3", "benevolat"], [
        ("ngo", "NGO", "جمعية", "hand-heart", ["association", "charity", "organisation", "جمعية خيرية", "مؤسسة", "jam3iye"]),
        ("community-centre", "Community centre", "مركز اجتماعي", "users", ["community center", "youth center", "مركز اجتماعي", "نادي اجتماعي", "markaz", "centre communautaire"]),
        ("food-bank", "Food bank", "بنك طعام", "soup", ["food donations", "food aid", "free food", "مساعدات غذائية", "حصص غذائية", "food parcels"]),
    ]),
]  # fmt: skip

UPSERT = text(
    """
    INSERT INTO categories (slug, name_en, name_ar, icon, parent_id, sort_order, aliases)
    VALUES (
        :slug, :name_en, :name_ar, :icon,
        (SELECT id FROM categories WHERE slug = :parent),
        :sort_order, :aliases
    )
    ON CONFLICT (slug) DO UPDATE SET
        name_en = EXCLUDED.name_en,
        name_ar = EXCLUDED.name_ar,
        icon = EXCLUDED.icon,
        parent_id = EXCLUDED.parent_id,
        sort_order = EXCLUDED.sort_order,
        aliases = EXCLUDED.aliases
    """
)


def category_rows():
    """Parents before their children, so a child finds its parent's id."""
    for position, (slug, name_en, name_ar, icon, aliases, children) in enumerate(
        CATEGORY_TREE, start=1
    ):
        yield {
            "slug": slug,
            "name_en": name_en,
            "name_ar": name_ar,
            "icon": icon,
            "aliases": aliases,
            "parent": None,
            "sort_order": position,
        }
        for child_position, (
            child_slug,
            child_en,
            child_ar,
            child_icon,
            child_aliases,
        ) in enumerate(children, start=1):
            yield {
                "slug": child_slug,
                "name_en": child_en,
                "name_ar": child_ar,
                "icon": child_icon,
                "aliases": child_aliases,
                "parent": slug,
                "sort_order": child_position,
            }


def upgrade() -> None:
    # Bound parameters, not text pasted into SQL: names contain quotes and Arabic.
    # A Python list is sent as a Postgres TEXT[] by the driver.
    connection = op.get_bind()
    for row in category_rows():
        connection.execute(UPSERT, row)


def downgrade() -> None:
    # Reference data stays: providers may already point at the new rows, so
    # there is nothing safe to delete. The aliases go with the column when
    # 0016 is downgraded.
    pass
