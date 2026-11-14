"""Fill the development database with categories, fake providers and reviews.

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

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import Category, Provider, Review  # noqa: E402
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
# Flags: "featured" (featured for the next 30 days), "was-featured" (expired
# yesterday), "founding", "pending" (not public yet), "no-photos".
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
    ("karim-electric", "Karim Electric", "electrician", "Bir el Abed", 540, 60, 19, 4.5, "Visit from $10", {"founding"}),
    ("piano-with-nour", "Piano with Nour", "piano-lessons", "Bir el Abed", 620, 15, 27, 4.9, "$25 per lesson", set()),
    ("halawiyat-al-baba", "Halawiyat Al Baba", "arabic-sweets", "Ghobeiry", 700, 330, 55, 4.7, None, {"featured"}),
    ("salon-jad", "Salon Jad", "barber", "Rouweiss", 780, 170, 14, 4.2, "Haircut $5", set()),
    ("ghobeiry-laptops", "Ghobeiry Laptop Clinic", "laptop-repair", "Ghobeiry", 850, 350, 3, 3.7, "Diagnosis free", set()),
    ("dr-samer-dental", "Dr. Samer Fakih - Dentist", "dentist", "Bourj el Barajneh", 930, 215, 33, 4.5, "Check-up $20", set()),
    ("physics-with-omar", "Physics with Omar", "physics-tutoring", "Rouweiss", 980, 120, 9, 4.6, "$18 per hour", {"was-featured"}),
    # --- 1 km to 5 km ---
    ("chiyah-carpentry", "Chiyah Carpentry", "carpenter", "Chiyah", 1200, 45, 11, 4.4, None, set()),
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
    # --- pending (must not appear publicly) ---
    ("pending-painter", "Hussein Painting", "painter", "Haret Hreik", 200, 90, 0, 0, None, {"pending"}),
    ("pending-yoga", "Zen Yoga Studio", "yoga", "Bir el Abed", 650, 20, 0, 0, "$10 per class", {"pending"}),
]  # fmt: skip

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


def seed_provider(
    db: Session, row: tuple, number: int, categories: dict[str, Category]
) -> Provider:
    slug, name, category_slug, area, distance_m, bearing, _reviews, _rating, price, flags = row
    lat, lng = project_point(db, CENTER_LAT, CENTER_LNG, distance_m, bearing)
    category = categories[category_slug]

    provider = db.scalar(select(Provider).where(Provider.slug == slug))
    if provider is None:
        provider = Provider(slug=slug, owner_user_id=uuid.uuid5(SEED_NAMESPACE, f"owner-{slug}"))
        db.add(provider)

    provider.name = name
    provider.category_id = category.id
    provider.description = (
        f"{name} - {category.name_en.lower()} in {area}. "
        "This is sample text for development; real providers write their own."
    )
    provider.price_text = price
    provider.phone = f"+96170{100000 + number * 1111}"
    # Every third provider has a separate WhatsApp number; the rest use the phone.
    provider.whatsapp = f"+96171{200000 + number * 1111}" if number % 3 == 0 else None
    provider.location = point_for_storage(lat, lng)
    provider.area_name = area
    if "no-photos" in flags:
        provider.photos = []
    else:
        provider.photos = [
            f"https://picsum.photos/seed/{slug}/800/600",
            f"https://picsum.photos/seed/{slug}-2/800/600",
            f"https://picsum.photos/seed/{slug}-3/800/600",
        ]
    provider.verification_doc_url = f"https://example.com/verification-docs/{slug}.pdf"
    provider.status = "pending" if "pending" in flags else "verified"
    provider.founding_member = "founding" in flags
    provider.featured_until = featured_until_for(flags, datetime.now(UTC).date())
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


def main() -> None:
    with SessionLocal() as db:
        categories = seed_categories(db)
        for number, row in enumerate(PROVIDERS, start=1):
            provider = seed_provider(db, row, number, categories)
            seed_reviews(db, provider, review_count=row[6], typical_rating=row[7])
        db.commit()  # one transaction: either everything is seeded or nothing

        pending = sum(1 for row in PROVIDERS if "pending" in row[9])
        print(
            f"Seeded {len(categories)} categories and {len(PROVIDERS)} providers "
            f"({len(PROVIDERS) - pending} verified, {pending} pending) "
            f"around {CENTER_LAT}, {CENTER_LNG}."
        )


if __name__ == "__main__":
    main()
