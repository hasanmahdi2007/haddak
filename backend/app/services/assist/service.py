"""POST /assist from start to finish. The router only calls the two public
functions at the bottom: assist_from_text() and assist_from_understood().

For a sentence, the checks run in this order (cheapest first):
  1. Exact match: the sentence is exactly a category name or a provider name
     -> search directly, no AI.
  2. Cache: the same sentence was understood before -> reuse that answer.
  3. Before asking the AI: an API key is set, the monthly budget is not used
     up, and this IP has not used up its daily allowance. If any fails, the
     answer is kind "unavailable" (HTTP 200) and the app runs a normal search.
  4. Ask the AI, check its answer, remember it, log the cost.
Then, for a search: look up the place, run the normal search (widening the
circle if nothing is found), build the summary, log the request.
"""

import logging
from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import PUBLIC_STATUSES, AssistLog, Category, Place, Provider
from app.schemas import (
    AssistIn,
    AssistOut,
    ClarifyOptionOut,
    ClarifyQuestionOut,
    PlaceOption,
    PlaceOut,
    ProviderSearchResult,
    Understood,
    UnderstoodIn,
)
from app.services import provider_views
from app.services.assist.ai_client import AIOption, AIResult, AIUnavailable, Usage, ask_model
from app.services.assist.budget import budget_reached, cost_usd, daily_limit_reached
from app.services.assist.cache import get_cached, save_cached
from app.services.assist.normalize import normalize_text, text_hash
from app.services.assist.places import find_place, place_by_slug
from app.services.assist.prompt import build_system_prompt
from app.services.assist.summary import fixed_summary, results_summary
from app.services.search import search_providers

logger = logging.getLogger("haddak.assist")

# The app's radius chips. Every radius we search with is one of these.
RADIUS_CHOICES = (500, 1000, 5000, 20000)
DEFAULT_RADIUS_M = 1000
# How many results the assistant shows (the app shows the first few big).
RESULT_LIMIT = 20
MAX_CATEGORIES = 3
MAX_OPTIONS = 4
MAX_DRAFT_CHARS = 500
MAX_QUESTION_CHARS = 200
MAX_LABEL_CHARS = 60
MAX_PLACE_NAME_CHARS = 80


# ---------- checking the AI's answer ----------


def snap_radius(radius_m: int | None) -> int | None:
    """The nearest app chip (500, 1000, 5000, 20000), or None if not given."""
    if radius_m is None:
        return None
    return min(RADIUS_CHOICES, key=lambda choice: abs(choice - radius_m))


def chip_at_least(radius_m: int) -> int:
    """The smallest chip that is at least radius_m (20000 at most)."""
    for choice in RADIUS_CHOICES:
        if choice >= radius_m:
            return choice
    return RADIUS_CHOICES[-1]


def clean_text(value: str | None, min_chars: int, max_chars: int) -> str | None:
    """Trimmed text, or None if it is too short; cut to max_chars."""
    if value is None:
        return None
    value = " ".join(value.split())
    if len(value) < min_chars:
        return None
    return value[:max_chars]


def clean_settings(option: AIOption | AIResult, known_slugs: set[str]) -> dict:
    """The search settings of an AI answer (or of one clarify option), checked.

    - unknown category slugs are dropped (at most 3 kept, no repeats);
    - q is 2 to 60 characters, else None;
    - the radius is snapped to a chip;
    - a price limit needs an amount > 0 AND a unit; otherwise all three
      price fields are dropped. The currency defaults to USD.
    """
    slugs = []
    for slug in option.category_slugs:
        if slug in known_slugs and slug not in slugs:
            slugs.append(slug)
    has_price = option.max_price is not None and option.max_price > 0 and option.price_unit
    return {
        "category_slugs": slugs[:MAX_CATEGORIES],
        "q": clean_text(option.q, 2, 60),
        "place_name": clean_text(option.place_name, 2, MAX_PLACE_NAME_CHARS),
        "radius_m": snap_radius(option.radius_m),
        "max_price": option.max_price if has_price else None,
        "price_unit": option.price_unit if has_price else None,
        "price_currency": (option.price_currency or "USD") if has_price else None,
        "open_now": option.open_now,
        "sort": option.sort,
    }


EMPTY_SETTINGS = {
    "category_slugs": [],
    "q": None,
    "place_name": None,
    "radius_m": None,
    "max_price": None,
    "price_unit": None,
    "price_currency": None,
    "open_now": False,
    "sort": "best",
}


def clean_ai_result(result: AIResult, known_slugs: set[str]) -> AIResult:
    """Check everything the AI returned and fix or drop what does not fit.

    Returns a new AIResult that the rest of the code can trust. Also used on
    cached answers, so a category deleted since is dropped there too.
    """
    if result.kind in ("emergency", "off_topic"):
        # Passed straight through: no settings, no draft.
        return AIResult(
            kind=result.kind,
            **EMPTY_SETTINGS,
            clarify_question=None,
            clarify_options=[],
            whatsapp_draft=None,
        )

    draft = clean_text(result.whatsapp_draft, 2, MAX_DRAFT_CHARS)
    main = clean_settings(result, known_slugs)

    if result.kind == "clarify":
        question = clean_text(result.clarify_question, 2, MAX_QUESTION_CHARS)
        options = []
        for option in result.clarify_options:
            label = clean_text(option.label, 1, MAX_LABEL_CHARS)
            option_settings = clean_settings(option, known_slugs)
            # An option must search for something.
            if label and (option_settings["category_slugs"] or option_settings["q"]):
                options.append(AIOption(label=label, **option_settings))
        options = options[:MAX_OPTIONS]
        if question and len(options) >= 2:
            return AIResult(
                kind="clarify",
                **EMPTY_SETTINGS,
                clarify_question=question,
                clarify_options=options,
                whatsapp_draft=draft,
            )
        # Not a usable question: search with what we have instead. One good
        # option is as good as an answer.
        if len(options) == 1:
            main = options[0].model_dump(exclude={"label"})

    return AIResult(
        kind="search", **main, clarify_question=None, clarify_options=[], whatsapp_draft=draft
    )


# ---------- turning settings into a search ----------


def to_place_out(place: Place) -> PlaceOut:
    return PlaceOut(
        slug=place.slug, name_en=place.name_en, name_ar=place.name_ar, lat=place.lat, lng=place.lng
    )


def radius_for(radius_m: int | None, place: Place | None) -> int:
    """The radius to search with. A named place is searched as a whole:
    "in Beirut" covers the city even if the AI said nothing about distance."""
    radius = radius_m or DEFAULT_RADIUS_M
    if place is not None:
        radius = max(radius, chip_at_least(place.radius_m))
    return radius


@dataclass
class PlaceLookup:
    place: Place | None = None
    options: list[Place] = field(default_factory=list)  # same name, other districts
    unknown: str | None = None  # the name we could not find


def look_up_place(db: Session, place_name: str | None) -> PlaceLookup:
    if not place_name:
        return PlaceLookup()
    matches = find_place(db, place_name)
    if len(matches) == 1:
        return PlaceLookup(place=matches[0])
    if len(matches) > 1:
        return PlaceLookup(options=matches)
    return PlaceLookup(unknown=place_name)


def understood_from(settings_: dict, place: Place | None) -> Understood:
    return Understood(
        category_slugs=settings_["category_slugs"],
        q=settings_["q"],
        place=to_place_out(place) if place is not None else None,
        radius_m=radius_for(settings_["radius_m"], place),
        max_price=settings_["max_price"],
        price_unit=settings_["price_unit"],
        price_currency=settings_["price_currency"] or "USD",
        open_now=settings_["open_now"],
        sort=settings_["sort"],
    )


@dataclass
class SearchOutcome:
    understood: Understood  # radius_m is the one finally used
    results: ProviderSearchResult
    widened: bool


def run_search(
    db: Session, understood: Understood, categories: list[Category], lat: float, lng: float
) -> SearchOutcome:
    """The normal provider search, centred on the place if there is one.

    Nothing found: the circle grows to the next chip (1 km -> 5 km -> 20 km)
    until something is found or 20 km was tried. Unverified providers are
    included (still ranked after all verified ones): a person asking the
    assistant wants an answer, and the badge stays visible on each card.
    """
    # Nothing to search for (no category fits and no name): searching
    # everything nearby would only show unrelated providers.
    if not understood.category_slugs and not understood.q:
        return SearchOutcome(understood, ProviderSearchResult(items=[], total=0), widened=False)

    if understood.place is not None:
        lat, lng = understood.place.lat, understood.place.lng
    slug_to_id = {category.slug: category.id for category in categories}
    category_ids = [slug_to_id[slug] for slug in understood.category_slugs if slug in slug_to_id]

    radius = understood.radius_m
    widened = False
    while True:
        rows, total = search_providers(
            db,
            lat=lat,
            lng=lng,
            radius_m=radius,
            today=provider_views.current_date(),
            category_ids=category_ids or None,
            name_contains=understood.q,
            include_unverified=True,
            max_price=understood.max_price,
            price_unit=understood.price_unit,
            price_currency=understood.price_currency,
            open_now=understood.open_now,
            now=provider_views.current_time(),
            sort=understood.sort,
            limit=RESULT_LIMIT,
        )
        bigger = [choice for choice in RADIUS_CHOICES if choice > radius]
        if total > 0 or not bigger:
            break
        radius = bigger[0]
        widened = True

    final = understood.model_copy(update={"radius_m": radius})
    results = ProviderSearchResult(items=provider_views.to_summaries(db, rows), total=total)
    return SearchOutcome(final, results, widened)


# ---------- building the response ----------


def load_categories(db: Session) -> list[Category]:
    return list(db.scalars(select(Category).order_by(Category.sort_order, Category.id)))


def plain_response(kind: str, lang: str) -> AssistOut:
    """emergency, off_topic or unavailable: a fixed summary and nothing else."""
    return AssistOut(
        kind=kind,
        understood=None,
        summary=fixed_summary(kind, lang),
        results=None,
        widened=False,
        question=None,
        place_options=None,
        place_unknown=None,
        whatsapp_draft=None,
    )


def results_response(
    db: Session,
    understood: Understood,
    categories: list[Category],
    body: AssistIn,
    *,
    lookup: PlaceLookup | None = None,
    whatsapp_draft: str | None = None,
) -> AssistOut:
    lookup = lookup or PlaceLookup()
    outcome = run_search(db, understood, categories, body.lat, body.lng)
    place_options = None
    if lookup.options:
        place_options = [
            PlaceOption(slug=p.slug, name_en=p.name_en, name_ar=p.name_ar, district=p.district)
            for p in lookup.options
        ]
    return AssistOut(
        kind="results",
        understood=outcome.understood,
        summary=results_summary(outcome.understood, categories, body.lang),
        results=outcome.results,
        widened=outcome.widened,
        question=None,
        place_options=place_options,
        place_unknown=lookup.unknown,
        whatsapp_draft=whatsapp_draft,
    )


def respond_to(
    db: Session, result: AIResult, categories: list[Category], body: AssistIn
) -> AssistOut:
    """Turn a checked AIResult into the response (runs the search if needed)."""
    if result.kind in ("emergency", "off_topic"):
        return plain_response(result.kind, body.lang)

    if result.kind == "clarify":
        options = []
        for option in result.clarify_options:
            option_settings = option.model_dump(exclude={"label"})
            # Each option is a complete search: its place is looked up now,
            # so tapping it needs no second AI request. A place we cannot pin
            # down to one row is left out of that option.
            lookup = look_up_place(db, option_settings["place_name"])
            understood = understood_from(option_settings, lookup.place)
            options.append(ClarifyOptionOut(label=option.label, understood=understood))
        return AssistOut(
            kind="clarify",
            understood=None,
            summary=fixed_summary("clarify", body.lang),
            results=None,
            widened=False,
            question=ClarifyQuestionOut(text=result.clarify_question, options=options),
            place_options=None,
            place_unknown=None,
            whatsapp_draft=result.whatsapp_draft,
        )

    main = result.model_dump(include=set(EMPTY_SETTINGS))
    lookup = look_up_place(db, main["place_name"])
    understood = understood_from(main, lookup.place)
    return results_response(
        db, understood, categories, body, lookup=lookup, whatsapp_draft=result.whatsapp_draft
    )


def direct_match(db: Session, text: str, categories: list[Category]) -> AIResult | None:
    """The sentence is exactly a category name or a provider name: no AI needed."""
    normalized = normalize_text(text)
    for category in categories:
        names = {
            normalize_text(category.name_en),
            normalize_text(category.name_ar),
            normalize_text(category.slug),  # "laptop-repair" -> "laptop repair"
        }
        if normalized in names:
            return search_result(category_slugs=[category.slug])

    name = " ".join(text.split())
    provider_id = db.scalar(
        select(Provider.id)
        .where(func.lower(Provider.name) == name.lower(), Provider.status.in_(PUBLIC_STATUSES))
        .limit(1)
    )
    if provider_id is not None:
        return search_result(q=name[:60])
    return None


def search_result(**settings_) -> AIResult:
    """An AIResult of kind "search" built by our own code (no AI involved)."""
    return AIResult(
        kind="search",
        **{**EMPTY_SETTINGS, **settings_},
        clarify_question=None,
        clarify_options=[],
        whatsapp_draft=None,
    )


def write_log(
    db: Session,
    *,
    source: str,
    response: AssistOut,
    hashed: str,
    normalized: str,
    model: str | None = None,
    usage: Usage | None = None,
) -> None:
    """One assist_log row. The sentence itself is stored only when the search
    found nothing (the founder's "most wanted" list)."""
    usage = usage or Usage()
    found_nothing = response.kind == "results" and response.results.total == 0
    db.add(
        AssistLog(
            source=source,
            model=model,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cache_read_tokens=usage.cache_read_tokens,
            cache_write_tokens=usage.cache_write_tokens,
            cost_usd=cost_usd(model, usage) if model else 0,
            kind=response.kind,
            text_hash=hashed,
            wanted_text=normalized if found_nothing else None,
            place_unknown=response.place_unknown,
        )
    )
    db.commit()


# ---------- the two entry points ----------


def assist_from_text(db: Session, body: AssistIn, client_ip: str) -> AssistOut:
    text = body.text
    normalized = normalize_text(text)
    hashed = text_hash(normalized)
    categories = load_categories(db)
    known_slugs = {category.slug for category in categories}

    # 1. Exact category or provider name: no AI.
    direct = direct_match(db, text, categories)
    if direct is not None:
        response = respond_to(db, direct, categories, body)
        write_log(db, source="direct", response=response, hashed=hashed, normalized=normalized)
        return response

    # 2. Seen this sentence before.
    cached = get_cached(db, hashed)
    if cached is not None:
        response = respond_to(db, clean_ai_result(cached, known_slugs), categories, body)
        write_log(db, source="cache", response=response, hashed=hashed, normalized=normalized)
        return response

    # 3. May we ask the AI? The daily allowance is checked last, so it only
    #    counts requests that really go to the AI.
    if not settings.anthropic_api_key.strip():
        return plain_response("unavailable", body.lang)
    if budget_reached(db):
        logger.warning("assistant monthly budget reached; answering unavailable")
        return plain_response("unavailable", body.lang)
    if daily_limit_reached(client_ip):
        return plain_response("unavailable", body.lang)

    # 4. Ask the AI.
    model = settings.assist_model
    try:
        reply = ask_model(build_system_prompt(categories), text)
    except AIUnavailable as error:
        # The reason never contains the key or the user's text.
        logger.warning("assistant AI request failed: %s", error)
        response = plain_response("unavailable", body.lang)
        write_log(
            db,
            source="ai",
            response=response,
            hashed=hashed,
            normalized=normalized,
            model=model,
            usage=error.usage,
        )
        return response

    result = clean_ai_result(reply.result, known_slugs)
    save_cached(db, hashed, result, reply.model)
    response = respond_to(db, result, categories, body)
    write_log(
        db,
        source="ai",
        response=response,
        hashed=hashed,
        normalized=normalized,
        model=reply.model,
        usage=reply.usage,
    )
    return response


def assist_from_understood(db: Session, body: AssistIn) -> AssistOut:
    """A clarify option or a place button was tapped: search directly, no AI."""
    sent: UnderstoodIn = body.understood
    categories = load_categories(db)
    known_slugs = {category.slug for category in categories}

    # The app sends only {"slug": ...} for a place (e.g. after tapping one of
    # place_options). A slug we do not know is reported like a place name we
    # could not find: the search runs near the phone and place_unknown says so.
    place = place_by_slug(db, sent.place.slug) if sent.place else None
    lookup = PlaceLookup(place=place)
    if sent.place and place is None:
        lookup = PlaceLookup(unknown=sent.place.slug)
    has_price = sent.max_price is not None and sent.price_unit is not None
    slugs = [slug for slug in dict.fromkeys(sent.category_slugs) if slug in known_slugs]
    understood = Understood(
        category_slugs=slugs[:MAX_CATEGORIES],
        q=clean_text(sent.q, 2, 60),
        place=to_place_out(place) if place is not None else None,
        # A place chosen from place_options widens the circle to its size.
        radius_m=radius_for(snap_radius(sent.radius_m), place),
        max_price=sent.max_price if has_price else None,
        price_unit=sent.price_unit if has_price else None,
        price_currency=sent.price_currency,
        open_now=sent.open_now,
        sort=sent.sort,
    )
    return results_response(db, understood, categories, body, lookup=lookup)
