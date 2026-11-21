"""The migrations give every database the same category tree as the dev seed.

The hosted database is never seeded, so its categories come only from the
migrations (0009, 0014, and any later one). scripts/seed.py's CATEGORIES is
what the app is developed and tested against. When the two disagree, one of
them is out of date: change the categories in a new migration and in seed.py.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from seed import CATEGORIES  # noqa: E402


def seed_tree() -> set[tuple]:
    rows = set()
    for position, (slug, name_en, name_ar, icon, children) in enumerate(CATEGORIES, start=1):
        rows.add((slug, name_en, name_ar, icon, None, position))
        for child_position, (child_slug, child_en, child_ar, child_icon) in enumerate(
            children, start=1
        ):
            rows.add((child_slug, child_en, child_ar, child_icon, slug, child_position))
    return rows


def test_the_migrations_create_the_seed_category_tree(migrated_database):
    assert set(migrated_database) == seed_tree()


def test_every_category_from_0009_has_its_parent(migrated_database):
    parents = {row[0]: row[4] for row in migrated_database}

    assert parents["pharmacy"] == "doctors"
    assert parents["appliance-repair"] == "home-repair"
    assert parents["solar"] == "power"
