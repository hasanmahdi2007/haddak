"""The migrations give every database the same category tree as the dev seed.

The hosted database is never seeded, so its categories come only from the
migrations (0009, 0014, 0017, and any later one). scripts/seed.py's
CATEGORIES and ALIASES are what the app is developed and tested against.
When the two disagree, one of them is out of date: change the categories in
a new migration and in seed.py.

0017 holds the current frozen copy (0014 stays as history).
"""

import importlib.util
import sys
from pathlib import Path

from app.services.assist.normalize import normalize_text

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR / "scripts"))
from seed import ALIASES, CATEGORIES  # noqa: E402

TREE_V2 = BACKEND_DIR / "alembic/versions/0017_category_tree_v2.py"


def load_tree_v2():
    spec = importlib.util.spec_from_file_location("category_tree_v2", TREE_V2)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def seed_tree() -> set[tuple]:
    """(slug, name_en, name_ar, icon, parent slug, sort_order, aliases) rows."""
    rows = set()
    for position, (slug, name_en, name_ar, icon, children) in enumerate(CATEGORIES, start=1):
        rows.add((slug, name_en, name_ar, icon, None, position, tuple(ALIASES[slug])))
        for child_position, (child_slug, child_en, child_ar, child_icon) in enumerate(
            children, start=1
        ):
            rows.add(
                (
                    child_slug,
                    child_en,
                    child_ar,
                    child_icon,
                    slug,
                    child_position,
                    tuple(ALIASES[child_slug]),
                )
            )
    return rows


def test_the_migrations_create_the_seed_category_tree(migrated_database):
    assert set(migrated_database) == seed_tree()


def test_the_frozen_copy_in_0017_equals_the_seed():
    rows = set()
    for row in load_tree_v2().category_rows():
        rows.add(
            (
                row["slug"],
                row["name_en"],
                row["name_ar"],
                row["icon"],
                row["parent"],
                row["sort_order"],
                tuple(row["aliases"]),
            )
        )
    assert rows == seed_tree()


def test_tree_v2_has_143_categories_in_23_groups(migrated_database):
    assert len(migrated_database) == 143
    assert len([row for row in migrated_database if row[4] is None]) == 23


def test_every_category_from_0009_has_its_parent(migrated_database):
    parents = {row[0]: row[4] for row in migrated_database}

    assert parents["pharmacy"] == "doctors"
    assert parents["appliance-repair"] == "home-repair"
    assert parents["solar"] == "power"


def test_existing_categories_keep_their_parent_and_new_ones_sit_where_the_doc_says(
    migrated_database,
):
    by_slug = {row[0]: row for row in migrated_database}

    # Unchanged by 0017.
    assert by_slug["plumber"][4] == "home-repair"
    assert by_slug["phone-repair"][4] == "tech-repair"
    # New children of old groups come after the old children.
    assert by_slug["optician"][4:6] == ("doctors", 6)
    assert by_slug["locksmith"][4:6] == ("home-repair", 7)
    # New groups are numbered 14 to 23.
    assert by_slug["food-drink"][4:6] == (None, 14)
    assert by_slug["volunteering"][4:6] == (None, 23)
    assert by_slug["food-bank"][4] == "volunteering"


def test_every_category_has_3_to_8_different_search_words():
    slugs = {slug for slug, *_ in CATEGORIES}
    slugs |= {child[0] for *_, children in CATEGORIES for child in children}
    assert set(ALIASES) == slugs
    for slug, words in ALIASES.items():
        assert 3 <= len(words) <= 8, slug
        # Two words that only differ in case or Arabic letter forms are one word.
        assert len({normalize_text(word) for word in words}) == len(words), slug
