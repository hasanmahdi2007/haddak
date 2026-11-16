"""Phrase test for the assistant: how well does the model understand people?

    python scripts/eval_assist.py            # runs every phrase against the REAL model
    python scripts/eval_assist.py --limit 10 # only the first 10
    python scripts/eval_assist.py --model claude-sonnet-5-5
    python scripts/eval_assist.py --check    # only checks the phrases file (free, no API)

THIS SPENDS REAL MONEY (well under $1 a run with Haiku 5.5). It refuses to
run without ANTHROPIC_API_KEY, and should only be run when the founder agrees.

Each line of evals/assist_phrases.jsonl is one phrase with the settings we
expect. Only the fields listed in "expect" are scored, after the backend's
own checks (exactly what the app would get). It prints the accuracy per
field, the phrases that missed, and the total tokens and cost.

Scoring rules:
  kind            equal, or one of "also_ok_kinds"
  category_slugs  the answer shares at least one slug with the expected list
                  and has no slug outside expected + "also_ok". An expected
                  empty list needs an empty answer. "also_ok_empty": an empty
                  answer is fine too (e.g. when q holds the name).
  place_name      null must be null; otherwise one of the listed spellings
                  (compared after normalising: case, accents, hamza)
  q               the answer contains the expected text (normalised)
  other fields    equal
The settings are only scored when both the expected and the actual kind are
"search"; a phrase whose kind is wrong counts as wrong for every field.
"""

import argparse
import json
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "scripts"))

from seed import CATEGORIES  # noqa: E402  (the same categories as the dev database)

from app.config import settings  # noqa: E402
from app.models import Category  # noqa: E402
from app.services.assist.ai_client import AIUnavailable, Usage, ask_model  # noqa: E402
from app.services.assist.budget import cost_usd  # noqa: E402
from app.services.assist.normalize import normalize_text  # noqa: E402
from app.services.assist.prompt import build_system_prompt  # noqa: E402
from app.services.assist.service import clean_ai_result  # noqa: E402

PHRASES_FILE = BACKEND_DIR / "evals" / "assist_phrases.jsonl"
SETTING_FIELDS = [
    "category_slugs",
    "q",
    "place_name",
    "radius_m",
    "max_price",
    "price_unit",
    "price_currency",
    "open_now",
    "sort",
]


def seed_categories() -> list[Category]:
    """Category objects built from scripts/seed.py, without a database.

    Ids are invented but stable, so the prompt is identical on every run.
    """
    categories = []
    next_id = 1
    for position, (slug, name_en, name_ar, icon, children) in enumerate(CATEGORIES, start=1):
        parent = Category(
            id=next_id, slug=slug, name_en=name_en, name_ar=name_ar, icon=icon,
            parent_id=None, sort_order=position,
        )  # fmt: skip
        categories.append(parent)
        next_id += 1
        for child_position, (c_slug, c_en, c_ar, c_icon) in enumerate(children, start=1):
            categories.append(
                Category(
                    id=next_id,
                    slug=c_slug,
                    name_en=c_en,
                    name_ar=c_ar,
                    icon=c_icon,
                    parent_id=parent.id,
                    sort_order=child_position,
                )  # fmt: skip
            )
            next_id += 1
    return categories


def load_phrases() -> list[dict]:
    with PHRASES_FILE.open(encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]


def check_file(phrases: list[dict], known_slugs: set[str]) -> list[str]:
    """Problems in the phrases file (unknown slugs, unknown fields)."""
    problems = []
    allowed = {"kind", "also_ok_kinds", "also_ok", "also_ok_empty", *SETTING_FIELDS}
    for phrase in phrases:
        expect = phrase["expect"]
        for key in expect:
            if key not in allowed:
                problems.append(f"#{phrase['id']}: unknown field {key!r}")
        for slug in expect.get("category_slugs", []) + expect.get("also_ok", []):
            if slug not in known_slugs:
                problems.append(f"#{phrase['id']}: unknown category slug {slug!r}")
    return problems


def field_is_right(name: str, expected, actual, expect: dict) -> bool:
    if name == "category_slugs":
        actual_set, expected_set = set(actual), set(expected)
        if not expected_set:
            return not actual_set
        if not actual_set:
            return bool(expect.get("also_ok_empty"))
        allowed = expected_set | set(expect.get("also_ok", []))
        return bool(actual_set & expected_set) and actual_set <= allowed
    if name == "place_name":
        if expected is None:
            return actual is None
        spellings = {normalize_text(s) for s in expected}
        return actual is not None and normalize_text(actual) in spellings
    if name == "q":
        return actual is not None and normalize_text(expected) in normalize_text(actual)
    if name == "max_price":
        return actual is not None and float(actual) == float(expected)
    return actual == expected


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--limit", type=int, help="only the first N phrases")
    parser.add_argument("--model", help="override ASSIST_MODEL for this run")
    parser.add_argument("--check", action="store_true", help="check the file only, no API")
    args = parser.parse_args()

    categories = seed_categories()
    known_slugs = {category.slug for category in categories}
    phrases = load_phrases()[: args.limit] if args.limit else load_phrases()

    problems = check_file(phrases, known_slugs)
    if problems or args.check:
        print("\n".join(problems) or f"{len(phrases)} phrases, file looks fine.")
        sys.exit(1 if problems else 0)

    if not settings.anthropic_api_key.strip():
        print("Refusing to run: ANTHROPIC_API_KEY is not set. This test calls the real")
        print("Claude API and costs money; set the key only when the founder agrees.")
        sys.exit(1)
    if args.model:
        settings.assist_model = args.model

    system_prompt = build_system_prompt(categories)
    right = defaultdict(int)
    total = defaultdict(int)
    misses = []
    usage_sum = Usage()
    cost = Decimal(0)

    for phrase in phrases:
        expect = phrase["expect"]
        try:
            reply = ask_model(system_prompt, phrase["text"])
            result = clean_ai_result(reply.result, known_slugs)
            usage = reply.usage
        except AIUnavailable as error:
            result, usage = None, error.usage
            misses.append(f"#{phrase['id']} {phrase['text']!r}: no answer ({error})")
        usage_sum.input_tokens += usage.input_tokens
        usage_sum.output_tokens += usage.output_tokens
        usage_sum.cache_read_tokens += usage.cache_read_tokens
        usage_sum.cache_write_tokens += usage.cache_write_tokens
        cost += cost_usd(settings.assist_model, usage)

        kind_ok = result is not None and (
            result.kind == expect["kind"] or result.kind in expect.get("also_ok_kinds", [])
        )
        total["kind"] += 1
        right["kind"] += kind_ok
        if result is not None and not kind_ok:
            misses.append(f"#{phrase['id']} {phrase['text']!r}: kind {result.kind}")

        for name in SETTING_FIELDS:
            if name not in expect:
                continue
            # A clarify (or other) answer that is allowed: nothing to score.
            if kind_ok and result.kind != "search":
                continue
            total[name] += 1
            actual = getattr(result, name) if result is not None else None
            ok = kind_ok and field_is_right(name, expect[name], actual, expect)
            right[name] += ok
            if kind_ok and not ok:
                misses.append(
                    f"#{phrase['id']} {phrase['text']!r}: {name} = {actual!r}, "
                    f"expected {expect[name]!r}"
                )

    print(f"\nModel: {settings.assist_model}, {len(phrases)} phrases\n")
    print(f"{'field':<16}{'right':>8}{'of':>6}{'score':>9}")
    for name in ["kind", *SETTING_FIELDS]:
        if total[name]:
            print(f"{name:<16}{right[name]:>8}{total[name]:>6}{right[name] / total[name]:>9.0%}")
    print("\nMisses:" if misses else "\nNo misses.")
    for miss in misses:
        print("  " + miss)
    print(
        f"\nTokens: {usage_sum.input_tokens} input, {usage_sum.output_tokens} output, "
        f"{usage_sum.cache_read_tokens} cache read, {usage_sum.cache_write_tokens} cache write"
    )
    print(f"Cost: ${cost:.4f}")


if __name__ == "__main__":
    main()
