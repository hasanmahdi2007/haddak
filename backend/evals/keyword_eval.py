"""Phrase test for the FREE keyword path only (no AI, no network, no database).

    python evals/keyword_eval.py            # scores, per style
    python evals/keyword_eval.py --misses   # also lists every phrase that missed

It reads evals/assist_phrases.jsonl (the same file as scripts/eval_assist.py)
and runs each sentence through app/services/assist/keywords.py, exactly as
the backend does when there is no ANTHROPIC_API_KEY. It costs nothing.

What is scored:
  categories   phrases that expect a search with categories: the answer must
               share a slug with the expected list and have no slug outside
               expected + "also_ok" (same rule as eval_assist.py).
  no match     off-topic and emergency phrases, and searches for something we
               do not list (a vet, a pharmacy): the keyword path must find
               nothing, so it never invents a category for random text.
  other fields open_now, sort and price, when the phrase lists them.
Clarify phrases without categories are not scored (only the AI can ask back).
Place names need the database, so place lookup is switched off here.
"""

import argparse
import sys
from collections import defaultdict
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "scripts"))

# The phrases file, the scoring rule and the seed categories are shared with
# the AI phrase test, so both tests judge the same way.
from eval_assist import field_is_right, load_phrases, seed_categories  # noqa: E402

from app.services.assist import keywords  # noqa: E402

OTHER_FIELDS = ["open_now", "sort", "max_price", "price_unit", "price_currency"]


def no_place_lookup(db, words, used):
    """Stand-in for keywords.find_place_name: places live in the database."""
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--misses", action="store_true", help="list every miss")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # Arabic text on a Windows console

    keywords.find_place_name = no_place_lookup
    categories = seed_categories()

    right = defaultdict(int)  # (group, style) -> phrases right
    total = defaultdict(int)
    misses = []

    for phrase in load_phrases():
        expect = phrase["expect"]
        style = phrase.get("style", "?")
        found = keywords.understand(None, phrase["text"], categories)
        slugs = found["category_slugs"] if found else []

        if expect["kind"] in ("off_topic", "emergency") or (
            expect["kind"] == "search" and expect.get("category_slugs") == []
        ):
            group, ok = "no match", not slugs
        elif expect["kind"] == "search" or expect.get("category_slugs"):
            group = "categories"
            ok = field_is_right("category_slugs", expect["category_slugs"], slugs, expect)
        else:
            continue  # clarify without categories: only the AI can ask back

        for key in ((group, style), (group, "all")):
            total[key] += 1
            right[key] += ok
        if not ok:
            misses.append(f"#{phrase['id']} [{style}] {phrase['text']!r}: got {slugs}")

        # The other settings, only when the categories were right.
        if group == "categories" and ok and found:
            for name in OTHER_FIELDS:
                if name in expect:
                    total[("fields", name)] += 1
                    good = field_is_right(name, expect[name], found[name], expect)
                    right[("fields", name)] += good
                    if not good:
                        misses.append(
                            f"#{phrase['id']} [{style}] {phrase['text']!r}: "
                            f"{name} = {found[name]!r}, expected {expect[name]!r}"
                        )

    print(f"{'':<28}{'right':>7}{'of':>6}{'score':>8}")
    for group in ("categories", "no match", "fields"):
        keys = sorted(key for key in total if key[0] == group)
        keys.sort(key=lambda key: key[1] != "all")  # "all" first
        for key in keys:
            label = f"{group} / {key[1]}"
            print(f"{label:<28}{right[key]:>7}{total[key]:>6}{right[key] / total[key]:>8.0%}")
        print()

    if args.misses:
        print("Misses:" if misses else "No misses.")
        for miss in misses:
            print("  " + miss)
    else:
        print(f"{len(misses)} misses (run with --misses to list them).")


if __name__ == "__main__":
    main()
