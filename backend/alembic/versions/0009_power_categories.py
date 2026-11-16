"""Power and energy categories, fridge and appliance repair, pharmacy.

A data migration (no schema change), so the new categories also reach the
hosted database, which is not filled by scripts/seed.py. Safe to run twice:
a category that already exists is left alone.
The names and icons match scripts/seed.py.

Revision ID: 0009
Revises: 0008
"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

# (slug, English name, Arabic name, icon, slug of the parent or None)
NEW_CATEGORIES = [
    ("power", "Power & energy", "كهربا وطاقة", "bolt", None),
    ("solar", "Solar panels", "طاقة شمسية", "bolt", "power"),
    ("batteries-inverters", "Batteries & inverters", "بطاريات وإنفرتر", "car-battery", "power"),
    ("generator", "Generators", "موتير / مولّد", "bolt", "power"),
    ("solar-cleaning", "Solar panel cleaning", "تنظيف ألواح", "water", "power"),
    ("appliance-repair", "Fridge & appliance repair", "تصليح براد وغسالة", "appliance",
     "home-repair"),
    ("pharmacy", "Pharmacy", "صيدلية", "stethoscope", "doctors"),
]


def upgrade() -> None:
    for position, (slug, name_en, name_ar, icon, parent) in enumerate(NEW_CATEGORIES, start=1):
        # The parent is looked up by slug. If it does not exist (an empty
        # database), the category simply becomes a top-level one.
        op.execute(
            f"""
            INSERT INTO categories (slug, name_en, name_ar, icon, parent_id, sort_order)
            VALUES (
                '{slug}', '{name_en}', '{name_ar}', '{icon}',
                {f"(SELECT id FROM categories WHERE slug = '{parent}')" if parent else "NULL"},
                {position}
            )
            ON CONFLICT (slug) DO NOTHING
            """
        )


def downgrade() -> None:
    slugs = ", ".join(f"'{slug}'" for slug, *_ in reversed(NEW_CATEGORIES))
    # Children first, then the parent. Fails if a provider already uses one.
    op.execute(f"DELETE FROM categories WHERE slug IN ({slugs}) AND parent_id IS NOT NULL")
    op.execute("DELETE FROM categories WHERE slug = 'power'")
