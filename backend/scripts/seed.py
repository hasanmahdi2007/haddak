"""Fill the development database with categories, fake providers, reviews,
stories and banners.

    python scripts/seed.py

Safe to run again: rows are matched by slug and updated, never duplicated.
Development only - every provider here is invented.
"""

import random
import sys
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

# Allow `python scripts/seed.py` to import the `app` package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import Banner, Category, Provider, Review, Story  # noqa: E402
from app.services.geo import point_for_storage, project_point  # noqa: E402
from app.services.ratings import recalculate_rating  # noqa: E402

# Every provider is placed at a known distance from this point (Haret Hreik).
CENTER_LAT = 33.8547
CENTER_LNG = 35.5097

# Fixed namespace so the fake user ids are the same on every run and machine.
SEED_NAMESPACE = uuid.UUID("6f1d0c3e-2b7a-4c58-9f0e-3a1b5d7c9e11")

# ---------------------------------------------------------------------------
# Categories: (slug, English name, Arabic name, icon key, children)
# Each child: (slug, English name, Arabic name, icon key)
# ---------------------------------------------------------------------------
CATEGORIES = [
    (
        "tech-repair",
        "Tech repair",
        "تصليح إلكترونيات",
        "devices",
        [
            ("laptop-repair", "Laptop repair", "تصليح لابتوب", "laptop"),
            ("phone-repair", "Phone repair", "تصليح هواتف", "phone"),
            ("tv-repair", "TV repair", "تصليح تلفزيونات", "tv"),
        ],
    ),
    (
        "music-lessons",
        "Music lessons",
        "دروس موسيقى",
        "music",
        [
            ("saxophone-lessons", "Saxophone lessons", "دروس ساكسفون", "saxophone"),
            ("piano-lessons", "Piano lessons", "دروس بيانو", "piano"),
            ("guitar-lessons", "Guitar lessons", "دروس غيتار", "guitar"),
            ("oud-lessons", "Oud lessons", "دروس عود", "oud"),
        ],
    ),
    (
        "tutoring",
        "Tutoring",
        "دروس خصوصية",
        "book",
        [
            ("math-tutoring", "Math tutoring", "دروس رياضيات", "calculator"),
            ("physics-tutoring", "Physics tutoring", "دروس فيزياء", "atom"),
            ("english-tutoring", "English tutoring", "دروس لغة إنكليزية", "language"),
            ("french-tutoring", "French tutoring", "دروس لغة فرنسية", "language"),
        ],
    ),
    (
        "doctors",
        "Doctors",
        "أطباء",
        "stethoscope",
        [
            ("dermatologist", "Dermatologist", "طبيب جلد", "skin"),
            ("dentist", "Dentist", "طبيب أسنان", "tooth"),
            ("pediatrician", "Pediatrician", "طبيب أطفال", "baby"),
            ("general-practitioner", "General practitioner", "طبيب صحة عامة", "stethoscope"),
        ],
    ),
    (
        "home-repair",
        "Home repair",
        "صيانة منزلية",
        "tools",
        [
            ("plumber", "Plumber", "سنكري", "pipe"),
            ("electrician", "Electrician", "كهربجي", "bolt"),
            ("carpenter", "Carpenter", "نجار", "hammer"),
            ("ac-repair", "AC repair", "تصليح مكيفات", "snowflake"),
            ("painter", "House painter", "دهّان", "paint-roller"),
        ],
    ),
    (
        "art-lessons",
        "Art lessons",
        "دروس فنون",
        "palette",
        [
            ("drawing-lessons", "Drawing lessons", "دروس رسم", "pencil"),
            ("painting-lessons", "Painting lessons", "دروس تلوين", "brush"),
            ("calligraphy-lessons", "Arabic calligraphy", "دروس خط عربي", "pen"),
        ],
    ),
    (
        "sweets-shops",
        "Sweets and candy shops",
        "حلويات وسكاكر",
        "candy",
        [
            ("arabic-sweets", "Arabic sweets", "حلويات عربية", "baklava"),
            ("candy-shop", "Candy shop", "محل سكاكر", "candy"),
            ("cake-shop", "Cake shop", "محل قوالب حلوى", "cake"),
        ],
    ),
    (
        "beauty",
        "Beauty and grooming",
        "تجميل وعناية",
        "scissors",
        [
            ("barber", "Barber", "حلاق رجالي", "scissors"),
            ("hair-salon", "Hair salon", "صالون نسائي", "hair-dryer"),
            ("nail-salon", "Nail salon", "عناية بالأظافر", "nail-polish"),
        ],
    ),
    (
        "car-services",
        "Car services",
        "خدمات سيارات",
        "car",
        [
            ("mechanic", "Mechanic", "ميكانيكي", "wrench"),
            ("car-electrician", "Car electrician", "كهربائي سيارات", "car-battery"),
            ("car-wash", "Car wash", "غسيل سيارات", "water"),
        ],
    ),
    (
        "fitness",
        "Fitness",
        "لياقة بدنية",
        "dumbbell",
        [
            ("personal-trainer", "Personal trainer", "مدرب شخصي", "dumbbell"),
            ("yoga", "Yoga", "يوغا", "yoga"),
            ("martial-arts", "Martial arts", "فنون قتالية", "karate"),
        ],
    ),
    (
        "tailoring",
        "Tailoring and shoe repair",
        "خياطة وتصليح أحذية",
        "needle",
        [
            ("tailor", "Tailor", "خياط", "needle"),
            ("shoe-repair", "Shoe repair", "كندرجي", "shoe"),
        ],
    ),
    (
        "photography",
        "Photography",
        "تصوير",
        "camera",
        [
            ("photographer", "Photographer", "مصور", "camera"),
            ("videographer", "Videographer", "مصور فيديو", "video"),
        ],
    ),
]

# ---------------------------------------------------------------------------
# Providers. Columns:
#   slug, name, category slug, area, distance from the centre in metres,
#   compass bearing in degrees (0 = north, 90 = east), number of reviews,
#   typical rating, price text, flags.
# Flags: "featured" (sponsored for the next 30 days), "was-featured" (expired
# yesterday), "founding", "no-photos", and for the status:
#   "pending"    - proof sent, waiting for the founder (listed without the badge)
#   "unverified" - no proof (listed without the badge)
#   "community"  - with "unverified": published from a suggestion, no owner
# No status flag means verified.
# ---------------------------------------------------------------------------
PROVIDERS = [
    # --- within 500 m ---
    ("ali-tech", "Ali Tech", "laptop-repair", "Haret Hreik", 60, 20, 23, 4.7, "From $10", {"founding"}),
    ("hadi-sax", "Hadi Saxophone Studio", "saxophone-lessons", "Haret Hreik", 120, 135, 12, 4.9, "$20 per lesson", {"featured", "founding"}),
    ("dr-rima-skin", "Dr. Rima Khalil - Dermatology", "dermatologist", "Haret Hreik", 180, 250, 41, 4.6, "Consultation $30", set()),
    ("abu-hassan-plumbing", "Abu Hassan Plumbing", "plumber", "Haret Hreik", 240, 310, 8, 4.3, "Visit from $15", set()),
    ("sweet-corner", "Sweet Corner", "candy-shop", "Haret Hreik", 300, 75, 30, 4.4, None, {"founding"}),
    ("maya-math", "Maya - Math Tutor", "math-tutoring", "Haret Hreik", 350, 190, 5, 5.0, "$15 per hour", set()),
    ("fix-phone-hh", "FixPhone", "phone-repair", "Haret Hreik", 420, 345, 0, 0, "Screen from $25", {"no-photos"}),
    ("studio-lina-art", "Studio Lina", "drawing-lessons", "Bir el Abed", 470, 40, 16, 4.8, "$12 per class", set()),
    # --- 500 m to 1 km ---
    ("karim-electric", "Karim Electric", "electrician", "Bir el Abed", 540, 60, 19, 4.5, "Visit from $10", {"featured", "founding"}),
    ("piano-with-nour", "Piano with Nour", "piano-lessons", "Bir el Abed", 620, 15, 27, 4.9, "$25 per lesson", set()),
    ("halawiyat-al-baba", "Halawiyat Al Baba", "arabic-sweets", "Ghobeiry", 700, 330, 55, 4.7, None, {"featured"}),
    ("salon-jad", "Salon Jad", "barber", "Rouweiss", 780, 170, 14, 4.2, "Haircut $5", set()),
    ("ghobeiry-laptops", "Ghobeiry Laptop Clinic", "laptop-repair", "Ghobeiry", 850, 350, 3, 3.7, "Diagnosis free", set()),
    ("dr-samer-dental", "Dr. Samer Fakih - Dentist", "dentist", "Bourj el Barajneh", 930, 215, 33, 4.5, "Check-up $20", set()),
    ("physics-with-omar", "Physics with Omar", "physics-tutoring", "Rouweiss", 980, 120, 9, 4.6, "$18 per hour", {"was-featured"}),
    ("english-with-rana", "Rana's English Lessons", "english-tutoring", "Haret Hreik", 450, 280, 4, 4.6, "$30 per hour", set()),
    # --- 1 km to 5 km ---
    ("chiyah-carpentry", "Chiyah Carpentry", "carpenter", "Chiyah", 1200, 45, 11, 4.4, "From 1,500,000 LL", set()),
    ("math-with-georges", "Georges - Math and Physics Tutor", "math-tutoring", "Badaro", 2400, 20, 11, 4.7, "$25 per hour", set()),
    ("mreijeh-motors", "Mreijeh Motors", "mechanic", "Mreijeh", 1400, 155, 22, 4.1, "Oil change $20", set()),
    ("cool-air-ac", "Cool Air", "ac-repair", "Bir Hassan", 1600, 295, 17, 4.6, "Service from $20", {"founding"}),
    ("guitar-zone", "Guitar Zone", "guitar-lessons", "Laylaki", 2100, 150, 6, 4.8, "$15 per lesson", set()),
    ("cake-house-chebbak", "The Cake House", "cake-shop", "Furn el Chebbak", 2300, 35, 38, 4.7, "Cakes from $18", set()),
    ("english-with-sara", "English with Sara", "english-tutoring", "Jnah", 2200, 280, 13, 4.9, "$15 per hour", set()),
    ("hadath-fit", "Hadath Fit - Personal Training", "personal-trainer", "Hadath", 3300, 145, 10, 4.5, "$12 per session", set()),
    ("mazraa-tailor", "Abu Ali Tailor", "tailor", "Mazraa", 3200, 325, 25, 4.8, None, set()),
    ("achrafieh-oud", "Oud House", "oud-lessons", "Achrafieh", 3700, 15, 7, 5.0, "$30 per lesson", {"featured"}),
    ("baabda-lens", "Baabda Lens Photography", "photographer", "Baabda", 3900, 125, 15, 4.6, "Sessions from $50", set()),
    ("verdun-derma", "Verdun Skin Clinic", "dermatologist", "Verdun", 4100, 326, 48, 4.3, "Consultation $40", set()),
    # --- beyond 5 km ---
    ("hamra-laptops", "Hamra Computer Lab", "laptop-repair", "Hamra", 5600, 330, 44, 4.6, "From $15", set()),
    ("khalde-car-wash", "Khalde Car Wash", "car-wash", "Khalde", 9000, 204, 20, 4.0, "Wash $5", set()),
    ("jounieh-piano", "Jounieh Piano Academy", "piano-lessons", "Jounieh", 17000, 35, 18, 4.7, "$30 per lesson", set()),
    ("saida-sweets", "Saida Sweets", "arabic-sweets", "Saida", 36000, 202, 60, 4.8, None, {"founding"}),
    # --- pending (listed without the badge; proof waits for the founder) ---
    ("pending-painter", "Hussein Painting", "painter", "Haret Hreik", 200, 90, 0, 0, None, {"pending"}),
    ("pending-yoga", "Zen Yoga Studio", "yoga", "Bir el Abed", 650, 20, 0, 0, "$10 per class", {"pending"}),
    # --- unverified (listed without the badge); "community" ones have no owner ---
    ("unv-mobile-fix", "Hassan Mobile Fix", "phone-repair", "Haret Hreik", 150, 200, 2, 4.0, "Screen from $20", {"unverified"}),
    ("unv-oum-ali-sweets", "Oum Ali Sweets", "arabic-sweets", "Haret Hreik", 330, 110, 0, 0, None, {"unverified", "community"}),
    ("unv-barber-rami", "Rami Barber Shop", "barber", "Bir el Abed", 520, 30, 4, 4.5, "Haircut $4", {"unverified"}),
    ("unv-abu-fadi-electric", "Abu Fadi Electrician", "electrician", "Ghobeiry", 690, 300, 0, 0, None, {"unverified", "community"}),
    ("unv-french-nadine", "French with Nadine", "french-tutoring", "Rouweiss", 810, 160, 1, 5.0, "$12 per hour", {"unverified"}),
    ("unv-shoe-repair", "Abu Mahmoud Shoe Repair", "shoe-repair", "Bourj el Barajneh", 950, 230, 0, 0, None, {"unverified", "community"}),
]  # fmt: skip

# Structured prices (what search filters and sorts on): slug -> (amount,
# unit, currency). price_text above stays the description shown on the
# profile. Lessons and training per hour, doctors and home visits per visit,
# repairs and services per job, products per item. Tutors on both sides of
# $20/hour, so "a tutor under $20 an hour" has something to find and to skip.
# Providers missing here have no structured price.
STRUCTURED_PRICES = {
    "ali-tech": (10, "job", "USD"),
    "hadi-sax": (20, "hour", "USD"),
    "dr-rima-skin": (30, "visit", "USD"),
    "abu-hassan-plumbing": (15, "visit", "USD"),
    "maya-math": (15, "hour", "USD"),
    "fix-phone-hh": (25, "job", "USD"),
    "studio-lina-art": (12, "hour", "USD"),
    "karim-electric": (10, "visit", "USD"),
    "piano-with-nour": (25, "hour", "USD"),
    "salon-jad": (5, "item", "USD"),
    "dr-samer-dental": (20, "visit", "USD"),
    "physics-with-omar": (18, "hour", "USD"),
    "english-with-rana": (30, "hour", "USD"),
    "chiyah-carpentry": (1500000, "job", "LBP"),
    "math-with-georges": (25, "hour", "USD"),
    "mreijeh-motors": (20, "job", "USD"),
    "cool-air-ac": (20, "job", "USD"),
    "guitar-zone": (15, "hour", "USD"),
    "cake-house-chebbak": (18, "item", "USD"),
    "english-with-sara": (15, "hour", "USD"),
    "hadath-fit": (12, "hour", "USD"),
    "achrafieh-oud": (30, "hour", "USD"),
    "baabda-lens": (50, "job", "USD"),
    "verdun-derma": (40, "visit", "USD"),
    "hamra-laptops": (15, "job", "USD"),
    "khalde-car-wash": (5, "item", "USD"),
    "jounieh-piano": (30, "hour", "USD"),
    "pending-yoga": (10, "hour", "USD"),
    "unv-mobile-fix": (20, "job", "USD"),
    "unv-barber-rami": (4, "item", "USD"),
    "unv-french-nadine": (12, "hour", "USD"),
}

# One-sentence pitch of the four sponsored ("featured") providers.
SPONSOR_HOOKS = {
    "hadi-sax": "First saxophone lesson free this month.",
    "halawiyat-al-baba": "Fresh knafeh every morning from 7.",
    "karim-electric": "At your door within the hour, day or night.",
    "achrafieh-oud": "Learn oud from a conservatory teacher.",
}

# Active stories of verified providers: slug -> list of (text, hours ago, with image?).
STORIES = {
    "hadi-sax": [
        ("Two evening slots opened up this week. Message me to book.", 2, False),
        ("Student concert on Saturday at 6. Everyone is welcome!", 9, True),
    ],
    "halawiyat-al-baba": [
        ("Fresh maamoul just out of the oven.", 1, True),
    ],
    "ali-tech": [
        ("New batch of laptop batteries arrived. Most models in stock.", 4, False),
        ("Open until 9 tonight.", 20, False),
    ],
    "sweet-corner": [
        ("New imported chocolates on the shelf today.", 6, True),
    ],
    "karim-electric": [
        ("Generator switch installations: booking for next week.", 12, False),
    ],
    "piano-with-nour": [
        ("Recital photos are up. So proud of my students!", 15, True),
    ],
}

# Active banners: slug -> (title, text, discount percent, days it runs).
BANNERS = {
    "ali-tech": ("Back to school offer", "All laptop repairs this week.", 20, 7),
    "halawiyat-al-baba": ("Weekend special", "Buy 1 kg of baklava, get 250 g free.", None, 3),
    "salon-jad": ("Student discount", None, 15, 7),
}

# ---------------------------------------------------------------------------
# Opening hours (Lebanon local time; shape in docs/API.md). Chosen by category
# below. A missing day means closed that day.
# ---------------------------------------------------------------------------
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"]

# Shops and workshops: Monday to Saturday, all day.
HOURS_SHOP = {day: [["09:00", "19:00"]] for day in WEEKDAYS + ["sat"]}
# Clinics: closed for lunch, Saturday morning only.
HOURS_CLINIC = {
    **{day: [["09:00", "13:00"], ["15:00", "19:00"]] for day in WEEKDAYS},
    "sat": [["09:00", "13:00"]],
}
# Lessons and training: after school and work, plus Saturday morning.
HOURS_LESSONS = {**{day: [["15:00", "20:00"]] for day in WEEKDAYS}, "sat": [["10:00", "14:00"]]}
# Sweets shops: every day, late.
HOURS_EVERY_DAY = {day: [["08:00", "22:00"]] for day in WEEKDAYS + ["sat", "sun"]}

HOURS_BY_TOP_CATEGORY = {
    "doctors": HOURS_CLINIC,
    "music-lessons": HOURS_LESSONS,
    "tutoring": HOURS_LESSONS,
    "art-lessons": HOURS_LESSONS,
    "fitness": HOURS_LESSONS,
    "sweets-shops": HOURS_EVERY_DAY,
}  # every other category: HOURS_SHOP

# These providers have not given hours (opening_hours = null, open_now = null).
NO_HOURS_SLUGS = {
    "abu-hassan-plumbing",
    "maya-math",
    "fix-phone-hh",
    "baabda-lens",
    "pending-painter",
}

# These providers chose to show "contacts this month" on their public profile.
SHOW_CONTACT_COUNT_SLUGS = {
    "ali-tech",
    "hadi-sax",
    "sweet-corner",
    "karim-electric",
    "halawiyat-al-baba",
    "cool-air-ac",
}

REVIEWER_NAMES = [
    "Rana", "Hassan", "Zeinab", "Mohammad", "Lea", "Jad", "Fatima", "Karim", "Nour", "Ali",
    "Maya", "Hussein", "Sara", "Omar", "Layal", "Rami", "Dana", "Bilal", "Hiba", "Tarek",
]  # fmt: skip

COMMENTS_BY_RATING = {
    5: ["Excellent, highly recommended.", "Fast, friendly and fair price.", "ممتاز، أنصح به بشدة.", ""],
    4: ["Good service, will come back.", "Very good overall.", "خدمة جيدة.", ""],
    3: ["Okay, nothing special.", "Did the job but took a while.", ""],
    2: ["Arrived late and was hard to reach.", "Not great."],
    1: ["Bad experience.", "Would not recommend."],
}  # fmt: skip


def seed_categories(db: Session) -> dict[str, Category]:
    """Insert or update every category. Returns them keyed by slug."""
    by_slug: dict[str, Category] = {}

    def upsert(slug, name_en, name_ar, icon, parent_id, sort_order) -> Category:
        category = db.scalar(select(Category).where(Category.slug == slug))
        if category is None:
            category = Category(slug=slug)
            db.add(category)
        category.name_en = name_en
        category.name_ar = name_ar
        category.icon = icon
        category.parent_id = parent_id
        category.sort_order = sort_order
        db.flush()  # gives a new row its id, needed as the children's parent_id
        by_slug[slug] = category
        return category

    for position, (slug, name_en, name_ar, icon, children) in enumerate(CATEGORIES, start=1):
        parent = upsert(slug, name_en, name_ar, icon, None, position)
        for child_position, child in enumerate(children, start=1):
            child_slug, child_en, child_ar, child_icon = child
            upsert(child_slug, child_en, child_ar, child_icon, parent.id, child_position)
    return by_slug


def featured_until_for(flags: set[str], today: date) -> date | None:
    if "featured" in flags:
        return today + timedelta(days=30)
    if "was-featured" in flags:
        return today - timedelta(days=1)
    return None


def opening_hours_for(
    slug: str, category: Category, categories: dict[str, Category]
) -> dict | None:
    if slug in NO_HOURS_SLUGS:
        return None
    # Providers sit in a child category; the hours depend on its parent.
    top_slug = next(c.slug for c in categories.values() if c.id == category.parent_id)
    return HOURS_BY_TOP_CATEGORY.get(top_slug, HOURS_SHOP)


def seed_provider(
    db: Session, row: tuple, number: int, categories: dict[str, Category]
) -> Provider:
    slug, name, category_slug, area, distance_m, bearing, _reviews, _rating, price, flags = row
    lat, lng = project_point(db, CENTER_LAT, CENTER_LNG, distance_m, bearing)
    category = categories[category_slug]

    # "Community" listings were published from a suggestion: nobody owns them.
    is_community = "community" in flags

    provider = db.scalar(select(Provider).where(Provider.slug == slug))
    if provider is None:
        provider = Provider(slug=slug)
        db.add(provider)
    provider.owner_user_id = None if is_community else uuid.uuid5(SEED_NAMESPACE, f"owner-{slug}")
    provider.source = "suggestion" if is_community else "owner"

    provider.name = name
    provider.category_id = category.id
    provider.description = (
        f"{name} - {category.name_en.lower()} in {area}. "
        "This is sample text for development; real providers write their own."
    )
    provider.price_text = price
    amount, unit, currency = STRUCTURED_PRICES.get(slug, (None, None, "USD"))
    provider.price_amount = amount
    provider.price_unit = unit
    provider.price_currency = currency
    # Sample numbers must never reach a real person. Lebanese numbers never
    # start with 0 after +961, so +9610000xxxx cannot be dialled or messaged.
    provider.phone = f"+9610000{1000 + number}"
    # Every third provider has a separate WhatsApp number; the rest use the phone.
    provider.whatsapp = f"+9610000{5000 + number}" if number % 3 == 0 else None
    provider.location = point_for_storage(lat, lng)
    provider.area_name = area
    if "no-photos" in flags or is_community:
        provider.photos = []
    else:
        provider.photos = [
            f"https://picsum.photos/seed/{slug}/800/600",
            f"https://picsum.photos/seed/{slug}-2/800/600",
            f"https://picsum.photos/seed/{slug}-3/800/600",
        ]
    # Only providers who sent proof have a document: not the unverified ones.
    if "unverified" in flags:
        provider.verification_doc_url = None
        provider.status = "unverified"
    else:
        provider.verification_doc_url = f"https://example.com/verification-docs/{slug}.pdf"
        provider.status = "pending" if "pending" in flags else "verified"
    provider.sponsor_hook = SPONSOR_HOOKS.get(slug)
    provider.founding_member = "founding" in flags
    provider.featured_until = featured_until_for(flags, datetime.now(UTC).date())
    provider.opening_hours = opening_hours_for(slug, category, categories)
    provider.show_contact_count = slug in SHOW_CONTACT_COUNT_SLUGS
    db.flush()
    return provider


def seed_reviews(db: Session, provider: Provider, review_count: int, typical_rating: float) -> None:
    """Create real review rows, then compute the average from them, so the
    numbers on the profile always agree with the review list."""
    # Seeded with the slug: the same "random" ratings on every run.
    rng = random.Random(provider.slug)

    for index in range(review_count):
        rating = min(5, max(1, round(rng.gauss(typical_rating, 0.6))))
        comment = rng.choice(COMMENTS_BY_RATING[rating])
        user_id = uuid.uuid5(SEED_NAMESPACE, f"reviewer-{index}")

        already_there = db.scalar(
            select(Review.id).where(Review.provider_id == provider.id, Review.user_id == user_id)
        )
        if already_there is None:
            db.add(
                Review(
                    provider_id=provider.id,
                    user_id=user_id,
                    author_name=REVIEWER_NAMES[index % len(REVIEWER_NAMES)],
                    rating=rating,
                    comment=comment,
                    # Spread the dates out so "newest first" has a visible order.
                    created_at=datetime.now(UTC) - timedelta(days=3 * index + 1),
                )
            )
    recalculate_rating(db, provider)


def seed_stories_and_banners(db: Session, providers: dict[str, Provider]) -> None:
    """Fresh stories and banners on every run, so they are always active.

    Stories live 24 hours: the seeded providers' old ones are deleted and
    written again with times counted back from now.
    """
    now = datetime.now(UTC)
    seeded_ids = [provider.id for provider in providers.values()]
    db.execute(delete(Story).where(Story.provider_id.in_(seeded_ids)))
    db.execute(delete(Banner).where(Banner.provider_id.in_(seeded_ids)))

    for slug, stories in STORIES.items():
        for index, (text, hours_ago, with_image) in enumerate(stories):
            created_at = now - timedelta(hours=hours_ago)
            image_url = f"https://picsum.photos/seed/{slug}-story-{index}/720/1280"
            db.add(
                Story(
                    provider_id=providers[slug].id,
                    text=text,
                    image_url=image_url if with_image else None,
                    created_at=created_at,
                    expires_at=created_at + timedelta(hours=24),
                )
            )

    for slug, (title, text, discount_percent, days) in BANNERS.items():
        db.add(
            Banner(
                provider_id=providers[slug].id,
                title=title,
                text=text,
                discount_percent=discount_percent,
                starts_at=now,
                expires_at=now + timedelta(days=days),
            )
        )


def main() -> None:
    with SessionLocal() as db:
        categories = seed_categories(db)
        providers: dict[str, Provider] = {}
        for number, row in enumerate(PROVIDERS, start=1):
            provider = seed_provider(db, row, number, categories)
            seed_reviews(db, provider, review_count=row[6], typical_rating=row[7])
            providers[provider.slug] = provider
        seed_stories_and_banners(db, providers)
        db.commit()  # one transaction: either everything is seeded or nothing

        pending = sum(1 for row in PROVIDERS if "pending" in row[9])
        unverified = sum(1 for row in PROVIDERS if "unverified" in row[9])
        verified = len(PROVIDERS) - pending - unverified
        story_count = sum(len(stories) for stories in STORIES.values())
        priced = sum(1 for row in PROVIDERS if row[0] in STRUCTURED_PRICES)
        print(
            f"Seeded {len(categories)} categories and {len(PROVIDERS)} providers "
            f"({verified} verified, {pending} pending, {unverified} unverified; "
            f"{priced} with a structured price), "
            f"{len(SPONSOR_HOOKS)} sponsored, {story_count} stories and {len(BANNERS)} banners "
            f"around {CENTER_LAT}, {CENTER_LNG}."
        )


if __name__ == "__main__":
    main()
