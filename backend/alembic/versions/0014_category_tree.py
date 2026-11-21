"""The full category tree, so every database gets it from the migrations.

Until now the base categories (plumber, electrician, doctors, ...) came only
from scripts/seed.py, which also adds sample providers and is never run on
the hosted database. So the hosted database had only the categories of
0009, and two of those (appliance repair, pharmacy) had no parent.

Insert-or-update by slug, so it is safe on a database that was seeded: rows
keep their id (providers point at it) and get the names, icon, parent and
order below. This is a frozen copy of scripts/seed.py's CATEGORIES on the
day it was written. A later change to the categories needs a new migration;
tests/test_categories_migration.py fails when the two disagree.

Revision ID: 0014
Revises: 0013
"""

from alembic import op
from sqlalchemy import text

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None

# (slug, English name, Arabic name, icon, children)
# Each child: (slug, English name, Arabic name, icon)
CATEGORY_TREE = [
    ("tech-repair", "Tech repair", "تصليح إلكترونيات", "devices", [
        ("laptop-repair", "Laptop repair", "تصليح لابتوب", "laptop"),
        ("phone-repair", "Phone repair", "تصليح هواتف", "phone"),
        ("tv-repair", "TV repair", "تصليح تلفزيونات", "tv"),
    ]),
    ("music-lessons", "Music lessons", "دروس موسيقى", "music", [
        ("saxophone-lessons", "Saxophone lessons", "دروس ساكسفون", "saxophone"),
        ("piano-lessons", "Piano lessons", "دروس بيانو", "piano"),
        ("guitar-lessons", "Guitar lessons", "دروس غيتار", "guitar"),
        ("oud-lessons", "Oud lessons", "دروس عود", "oud"),
    ]),
    ("tutoring", "Tutoring", "دروس خصوصية", "book", [
        ("math-tutoring", "Math tutoring", "دروس رياضيات", "calculator"),
        ("physics-tutoring", "Physics tutoring", "دروس فيزياء", "atom"),
        ("english-tutoring", "English tutoring", "دروس لغة إنكليزية", "language"),
        ("french-tutoring", "French tutoring", "دروس لغة فرنسية", "language"),
    ]),
    ("doctors", "Doctors", "أطباء", "stethoscope", [
        ("dermatologist", "Dermatologist", "طبيب جلد", "skin"),
        ("dentist", "Dentist", "طبيب أسنان", "tooth"),
        ("pediatrician", "Pediatrician", "طبيب أطفال", "baby"),
        ("general-practitioner", "General practitioner", "طبيب صحة عامة", "stethoscope"),
        ("pharmacy", "Pharmacy", "صيدلية", "stethoscope"),
    ]),
    ("home-repair", "Home repair", "صيانة منزلية", "tools", [
        ("plumber", "Plumber", "سنكري", "pipe"),
        ("electrician", "Electrician", "كهربجي", "bolt"),
        ("carpenter", "Carpenter", "نجار", "hammer"),
        ("ac-repair", "AC repair", "تصليح مكيفات", "snowflake"),
        ("appliance-repair", "Fridge & appliance repair", "تصليح براد وغسالة", "appliance"),
        ("painter", "House painter", "دهّان", "paint-roller"),
    ]),
    ("power", "Power & energy", "كهربا وطاقة", "bolt", [
        ("solar", "Solar panels", "طاقة شمسية", "bolt"),
        ("batteries-inverters", "Batteries & inverters", "بطاريات وإنفرتر", "car-battery"),
        ("generator", "Generators", "موتير / مولّد", "bolt"),
        ("solar-cleaning", "Solar panel cleaning", "تنظيف ألواح", "water"),
    ]),
    ("art-lessons", "Art lessons", "دروس فنون", "palette", [
        ("drawing-lessons", "Drawing lessons", "دروس رسم", "pencil"),
        ("painting-lessons", "Painting lessons", "دروس تلوين", "brush"),
        ("calligraphy-lessons", "Arabic calligraphy", "دروس خط عربي", "pen"),
    ]),
    ("sweets-shops", "Sweets and candy shops", "حلويات وسكاكر", "candy", [
        ("arabic-sweets", "Arabic sweets", "حلويات عربية", "baklava"),
        ("candy-shop", "Candy shop", "محل سكاكر", "candy"),
        ("cake-shop", "Cake shop", "محل قوالب حلوى", "cake"),
    ]),
    ("beauty", "Beauty and grooming", "تجميل وعناية", "scissors", [
        ("barber", "Barber", "حلاق رجالي", "scissors"),
        ("hair-salon", "Hair salon", "صالون نسائي", "hair-dryer"),
        ("nail-salon", "Nail salon", "عناية بالأظافر", "nail-polish"),
    ]),
    ("car-services", "Car services", "خدمات سيارات", "car", [
        ("mechanic", "Mechanic", "ميكانيكي", "wrench"),
        ("car-electrician", "Car electrician", "كهربائي سيارات", "car-battery"),
        ("car-wash", "Car wash", "غسيل سيارات", "water"),
    ]),
    ("fitness", "Fitness", "لياقة بدنية", "dumbbell", [
        ("personal-trainer", "Personal trainer", "مدرب شخصي", "dumbbell"),
        ("yoga", "Yoga", "يوغا", "yoga"),
        ("martial-arts", "Martial arts", "فنون قتالية", "karate"),
    ]),
    ("tailoring", "Tailoring and shoe repair", "خياطة وتصليح أحذية", "needle", [
        ("tailor", "Tailor", "خياط", "needle"),
        ("shoe-repair", "Shoe repair", "كندرجي", "shoe"),
    ]),
    ("photography", "Photography", "تصوير", "camera", [
        ("photographer", "Photographer", "مصور", "camera"),
        ("videographer", "Videographer", "مصور فيديو", "video"),
    ]),
]  # fmt: skip

UPSERT = text(
    """
    INSERT INTO categories (slug, name_en, name_ar, icon, parent_id, sort_order)
    VALUES (
        :slug, :name_en, :name_ar, :icon,
        (SELECT id FROM categories WHERE slug = :parent),
        :sort_order
    )
    ON CONFLICT (slug) DO UPDATE SET
        name_en = EXCLUDED.name_en,
        name_ar = EXCLUDED.name_ar,
        icon = EXCLUDED.icon,
        parent_id = EXCLUDED.parent_id,
        sort_order = EXCLUDED.sort_order
    """
)


def category_rows():
    """Parents before their children, so a child finds its parent's id."""
    for position, (slug, name_en, name_ar, icon, children) in enumerate(CATEGORY_TREE, start=1):
        yield {
            "slug": slug,
            "name_en": name_en,
            "name_ar": name_ar,
            "icon": icon,
            "parent": None,
            "sort_order": position,
        }
        for child_position, (child_slug, child_en, child_ar, child_icon) in enumerate(
            children, start=1
        ):
            yield {
                "slug": child_slug,
                "name_en": child_en,
                "name_ar": child_ar,
                "icon": child_icon,
                "parent": slug,
                "sort_order": child_position,
            }


def upgrade() -> None:
    # Bound parameters, not text pasted into SQL: names contain quotes and Arabic.
    connection = op.get_bind()
    for row in category_rows():
        connection.execute(UPSERT, row)


def downgrade() -> None:
    # Reference data stays: providers point at these rows, and some existed
    # before this migration (seeded or from 0009), so there is nothing safe to delete.
    pass
