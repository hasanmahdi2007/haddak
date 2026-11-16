"""The one-line summary above the results, built from templates.

Never written by the AI: what the user reads about their search must match
what was really searched. Example results:
    en: "Plumber · near you · 1 km"
    en: "Math tutoring · in Hamra · 1 km · up to $20/hour · open now"
    ar: "سنكري · قريب منك · 1 كم"
"""

from app.models import Category
from app.schemas import Understood

SEPARATOR = " · "

UNIT_NAMES = {
    "en": {"hour": "hour", "visit": "visit", "job": "job", "item": "item", "month": "month"},
    "ar": {"hour": "ساعة", "visit": "زيارة", "job": "شغلة", "item": "قطعة", "month": "شهر"},
}

# Fixed texts for the answers that are not a list of results.
FIXED = {
    "clarify": {"en": "One quick question", "ar": "سؤال سريع"},
    "emergency": {"en": "Emergency: call for help now", "ar": "طوارئ: اتصل بالمساعدة الآن"},
    "off_topic": {
        "en": "I can only help you find people and shops near you.",
        "ar": "بقدر ساعدك بس تلاقي ناس ومحلات قريبة منك.",
    },
    "unavailable": {
        "en": "The assistant is not available right now. Showing a normal search.",
        "ar": "المساعد مش متوفر هلق. عم نعرض بحث عادي.",
    },
}


def fixed_summary(kind: str, lang: str) -> str:
    return FIXED[kind][lang]


def radius_text(radius_m: int, lang: str) -> str:
    if radius_m < 1000:
        return f"{radius_m} م" if lang == "ar" else f"{radius_m} m"
    km = radius_m // 1000
    return f"{km} كم" if lang == "ar" else f"{km} km"


def price_text(understood: Understood, lang: str) -> str:
    amount = understood.max_price
    # 20.0 -> "20", 12.5 -> "12.5", 500000 -> "500,000"
    number = f"{amount:,.0f}" if amount == int(amount) else f"{amount:,.2f}"
    unit = UNIT_NAMES[lang][understood.price_unit]
    if understood.price_currency == "USD":
        money = f"{number}$" if lang == "ar" else f"${number}"
    else:
        money = f"{number} ل.ل." if lang == "ar" else f"{number} LBP"
    return f"حتى {money} لل{unit}" if lang == "ar" else f"up to {money}/{unit}"


def results_summary(understood: Understood, categories: list[Category], lang: str) -> str:
    by_slug = {category.slug: category for category in categories}
    parts = []

    # What: the category names, or the name keyword.
    names = [
        by_slug[slug].name_ar if lang == "ar" else by_slug[slug].name_en
        for slug in understood.category_slugs
        if slug in by_slug
    ]
    if names:
        parts.append(" / ".join(names))
    elif understood.q:
        parts.append(f"«{understood.q}»" if lang == "ar" else f'"{understood.q}"')

    # Where.
    if understood.place is not None:
        place_name = understood.place.name_ar if lang == "ar" else understood.place.name_en
        parts.append(f"في {place_name}" if lang == "ar" else f"in {place_name}")
    else:
        parts.append("قريب منك" if lang == "ar" else "near you")
    parts.append(radius_text(understood.radius_m, lang))

    # Filters and order.
    if understood.max_price is not None and understood.price_unit is not None:
        parts.append(price_text(understood, lang))
    if understood.open_now:
        parts.append("مفتوح هلق" if lang == "ar" else "open now")
    if understood.sort == "distance":
        parts.append("الأقرب أولاً" if lang == "ar" else "nearest first")
    elif understood.sort == "price":
        parts.append("الأرخص أولاً" if lang == "ar" else "cheapest first")

    return SEPARATOR.join(parts)
