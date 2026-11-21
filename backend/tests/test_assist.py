"""POST /assist and GET /admin/assist/wanted.

The Claude API is never called: the `fake_ai` fixture replaces the client
with FakeClient, which returns whatever answer the test prepared. Without
that fixture, creating the client fails the test (see conftest.py).
"""

import uuid
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import anthropic
import httpx2
import pytest
from sqlalchemy import select

from app.config import settings
from app.models import AssistLog, AssistQuota
from app.rate_limit import limiter
from app.services.assist.ai_client import AIOption, AIResult
from app.services.assist.quota import subject_hash, today
from tests.conftest import (
    ADMIN_HEADERS,
    CENTER_LAT,
    CENTER_LNG,
    auth_headers,
    make_category,
    make_provider,
)

URL = "/api/v1/assist"

# Jounieh's centre in the places table (migration 0006).
JOUNIEH = (33.9808, 35.6178)


# ---------- the fake Claude client ----------


def ai_answer(kind: str = "search", **fields) -> AIResult:
    """An AIResult with empty settings, plus whatever the test sets."""
    values = {
        "kind": kind,
        "category_slugs": [],
        "q": None,
        "place_name": None,
        "radius_m": None,
        "max_price": None,
        "price_unit": None,
        "price_currency": None,
        "open_now": False,
        "sort": "best",
        "clarify_question": None,
        "clarify_options": [],
        "whatsapp_draft": None,
    }
    values.update(fields)
    return AIResult(**values)


def option(label: str, **fields) -> AIOption:
    values = {
        "label": label,
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
    values.update(fields)
    return AIOption(**values)


class FakeMessages:
    def __init__(self):
        self.answer: AIResult | None = ai_answer()
        self.error: Exception | None = None
        self.stop_reason = "end_turn"
        self.calls: list[dict] = []

    def parse(self, **request):
        self.calls.append(request)
        if self.error is not None:
            raise self.error
        usage = SimpleNamespace(
            input_tokens=1000,
            output_tokens=200,
            cache_read_input_tokens=3000,
            cache_creation_input_tokens=0,
        )
        return SimpleNamespace(parsed_output=self.answer, stop_reason=self.stop_reason, usage=usage)


class FakeClient:
    def __init__(self):
        self.messages = FakeMessages()


@pytest.fixture
def fake_ai(monkeypatch) -> FakeMessages:
    """A key is "set" and the client is the fake. Returns fake.messages:
    set .answer / .error / .stop_reason, read .calls."""
    fake = FakeClient()
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key-not-real")
    monkeypatch.setattr(settings, "assist_model", "claude-haiku-5-5")
    # No routing unless a test turns it on.
    monkeypatch.setattr(settings, "assist_model_arabizi", "")
    monkeypatch.setattr("app.services.assist.ai_client.get_client", lambda: fake)
    return fake.messages


def ask(client, text: str, *, lang: str = "en", lat=CENTER_LAT, lng=CENTER_LNG) -> dict:
    response = client.post(URL, json={"text": text, "lat": lat, "lng": lng, "lang": lang})
    assert response.status_code == 200, response.text
    return response.json()


def names(body: dict) -> list[str]:
    return [item["name"] for item in body["results"]["items"]]


def logs(db) -> list[AssistLog]:
    db.expire_all()
    return list(db.scalars(select(AssistLog).order_by(AssistLog.id)))


# ---------- requests that skip the AI ----------


def test_exact_category_name_skips_the_ai(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "Abu Hassan Plumbing", distance_m=200)

    body = ask(client, "  PLUMBER ")

    assert fake_ai.calls == []
    assert body["kind"] == "results"
    assert body["understood"]["category_slugs"] == ["plumber"]
    assert body["understood"]["radius_m"] == 1000
    assert names(body) == ["Abu Hassan Plumbing"]
    assert [row.source for row in logs(db)] == ["direct"]
    assert logs(db)[0].cost_usd == 0


def test_exact_category_name_in_arabic_skips_the_ai(client, db, fake_ai):
    make_category(db, "plumber")  # name_ar is "plumber بالعربية" in the test helper

    body = ask(client, "plumber بالعربية")

    assert fake_ai.calls == []
    assert body["understood"]["category_slugs"] == ["plumber"]


def test_exact_provider_name_skips_the_ai_and_searches_by_name(client, db, fake_ai):
    laptops = make_category(db, "laptop-repair")
    make_provider(db, laptops, "Ali Tech", distance_m=100)
    make_provider(db, laptops, "Other Shop", distance_m=150)

    body = ask(client, "ali tech")

    assert fake_ai.calls == []
    assert body["understood"]["q"] == "ali tech"
    assert body["understood"]["category_slugs"] == []
    assert names(body) == ["Ali Tech"]


def test_same_sentence_again_comes_from_the_cache(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "Abu Hassan Plumbing", distance_m=200)
    fake_ai.answer = ai_answer(category_slugs=["plumber"], radius_m=1000)

    first = ask(client, "baddé sankari 2arib")
    second = ask(client, "Badde   SANKARI 2arib!")  # same sentence once normalised

    assert len(fake_ai.calls) == 1
    assert first["understood"] == second["understood"]
    assert names(second) == ["Abu Hassan Plumbing"]
    assert [row.source for row in logs(db)] == ["ai", "cache"]
    assert logs(db)[1].cost_usd == 0


def test_cache_works_even_without_a_key(client, db, fake_ai, monkeypatch):
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])
    ask(client, "baddé sankari")

    monkeypatch.setattr(settings, "anthropic_api_key", "")
    body = ask(client, "baddé sankari")

    assert body["kind"] == "results"
    assert len(fake_ai.calls) == 1


# ---------- what is sent to the AI ----------


def test_the_ai_gets_the_sentence_and_the_categories_but_not_the_location(client, db, fake_ai):
    make_category(db, "plumber")
    make_category(db, "electrician")

    ask(client, "baddé sankari", lat=33.123456, lng=35.654321)
    ask(client, "someone for the lights")

    request = fake_ai.calls[0]
    system_text = request["system"][0]["text"]
    assert request["model"] == "claude-haiku-5-5"
    assert request["messages"] == [{"role": "user", "content": "baddé sankari"}]
    assert "plumber | Plumber" in system_text
    assert "electrician | Electrician" in system_text
    assert "33.12" not in str(request) and "35.65" not in str(request)
    # Small, cheap and cacheable.
    assert request["max_tokens"] <= 1024
    assert request["output_config"] == {"effort": "low"}
    assert request["thinking"] == {"type": "disabled"}
    assert request["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert request["output_format"] is AIResult
    # The same instructions every time, so the API's prompt cache works.
    assert fake_ai.calls[1]["system"] == request["system"]


def test_models_that_refuse_disabled_thinking_get_only_low_effort(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_model", "claude-sonnet-5-5")
    make_category(db, "plumber")

    ask(client, "baddé sankari")

    assert "thinking" not in fake_ai.calls[0]
    assert fake_ai.calls[0]["output_config"] == {"effort": "low"}


def test_arabizi_goes_to_the_arabizi_model_and_is_logged(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_model_arabizi", "claude-sonnet-5-5")
    make_category(db, "plumber")

    ask(client, "baddé sankari 2arib")
    ask(client, "I need a plumber near me")

    assert [call["model"] for call in fake_ai.calls] == ["claude-sonnet-5-5", "claude-haiku-5-5"]
    assert [log.model for log in logs(db)] == ["claude-sonnet-5-5", "claude-haiku-5-5"]
    # Sonnet costs more than Haiku for the same tokens.
    first, second = logs(db)
    assert first.cost_usd > second.cost_usd


def test_empty_arabizi_model_means_no_routing(client, db, fake_ai):
    make_category(db, "plumber")
    ask(client, "baddé sankari 2arib")
    assert fake_ai.calls[0]["model"] == "claude-haiku-5-5"


def test_cache_key_does_not_depend_on_the_model(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_model_arabizi", "claude-sonnet-5-5")
    make_category(db, "plumber")
    ask(client, "baddé sankari 2arib")
    monkeypatch.setattr(settings, "assist_model_arabizi", "")
    ask(client, "baddé sankari 2arib")
    assert len(fake_ai.calls) == 1  # the second came from the cache


# ---------- checking the AI's answer ----------


def test_unknown_category_slugs_are_dropped(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "Abu Hassan Plumbing", distance_m=200)
    fake_ai.answer = ai_answer(category_slugs=["space-plumber", "plumber", "plumber"])

    body = ask(client, "sankari")

    assert body["understood"]["category_slugs"] == ["plumber"]
    assert names(body) == ["Abu Hassan Plumbing"]


def test_nothing_to_search_for_gives_no_results_and_is_wanted(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "Abu Hassan Plumbing", distance_m=200)
    fake_ai.answer = ai_answer(category_slugs=["veterinarian"])  # not one of ours

    body = ask(client, "baddé 7akim la 2etti")

    assert body["kind"] == "results"
    assert body["results"] == {"items": [], "total": 0}
    assert body["widened"] is False
    assert logs(db)[0].wanted_text == "badde 7akim la 2etti"


@pytest.mark.parametrize("ai_radius, expected", [(None, 1000), (700, 500), (7000, 5000),
                                                 (100000, 20000), (-3, 500)])  # fmt: skip
def test_radius_is_snapped_to_an_app_chip(client, db, fake_ai, ai_radius, expected):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "near", distance_m=100)
    fake_ai.answer = ai_answer(category_slugs=["plumber"], radius_m=ai_radius)

    body = ask(client, "sankari please")

    assert body["understood"]["radius_m"] == expected


def test_a_price_limit_without_a_unit_is_dropped(client, db, fake_ai):
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"], max_price=20, price_currency="USD")

    understood = ask(client, "cheap sankari")["understood"]

    assert understood["max_price"] is None
    assert understood["price_unit"] is None
    assert understood["price_currency"] == "USD"


def test_price_filter_from_the_sentence(client, db, fake_ai):
    tutoring = make_category(db, "math-tutoring")
    make_provider(db, tutoring, "Maya", distance_m=300, price_amount=15, price_unit="hour")
    make_provider(db, tutoring, "Georges", distance_m=200, price_amount=30, price_unit="hour")
    make_provider(db, tutoring, "No price", distance_m=100)
    fake_ai.answer = ai_answer(
        category_slugs=["math-tutoring"], max_price=20, price_unit="hour", radius_m=500
    )

    body = ask(client, "2ostez riyadiyat a2al men 20$ bel se3a")

    assert names(body) == ["Maya"]
    assert body["understood"]["max_price"] == 20
    assert body["understood"]["price_unit"] == "hour"
    assert body["understood"]["price_currency"] == "USD"  # filled in when the AI left it out
    assert body["summary"] == "Math Tutoring · near you · 500 m · up to $20/hour"


def test_open_now_from_the_sentence(client, db, fake_ai, monkeypatch):
    dentist = make_category(db, "dentist")
    make_provider(db, dentist, "open", distance_m=100, opening_hours={"mon": [["09:00", "13:00"]]})
    make_provider(
        db, dentist, "closed", distance_m=200, opening_hours={"mon": [["15:00", "19:00"]]}
    )
    # Monday 10:30 in Beirut.
    monkeypatch.setattr(
        "app.services.provider_views.current_time",
        lambda: datetime(2026, 11, 16, 8, 30, tzinfo=UTC),
    )
    fake_ai.answer = ai_answer(category_slugs=["dentist"], open_now=True)

    body = ask(client, "dentist hala2")

    assert names(body) == ["open"]
    assert body["summary"].endswith("open now")


def test_sort_from_the_sentence(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "far but great", distance_m=800, avg_rating=5, review_count=40)
    make_provider(db, plumber, "near", distance_m=100)
    fake_ai.answer = ai_answer(category_slugs=["plumber"], sort="distance")

    body = ask(client, "a2rab sankari")

    assert names(body) == ["near", "far but great"]
    assert body["understood"]["sort"] == "distance"


def test_whatsapp_draft_is_passed_on(client, db, fake_ai):
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(
        category_slugs=["plumber"], whatsapp_draft="  مرحبا، عندي تسريب مي. فيك تجي اليوم؟ "
    )

    body = ask(client, "3andi tasrib mayy")

    assert body["whatsapp_draft"] == "مرحبا، عندي تسريب مي. فيك تجي اليوم؟"


# ---------- clarify, emergency, off topic ----------


def test_clarify_returns_a_question_with_ready_to_search_options(client, db, fake_ai):
    for slug in ("phone-repair", "laptop-repair", "tv-repair"):
        make_category(db, slug)
    fake_ai.answer = ai_answer(
        "clarify",
        clarify_question="Which screen?",
        clarify_options=[
            option("Phone", category_slugs=["phone-repair"]),
            option("Laptop", category_slugs=["laptop-repair"], place_name="Jounieh"),
            option("Fridge", category_slugs=["fridge-repair"]),  # unknown: dropped
            option("TV", category_slugs=["tv-repair"], radius_m=5000),
        ],
        whatsapp_draft="Hello, my screen is broken.",
    )

    body = ask(client, "baddé ysalli7li el shashe")

    assert body["kind"] == "clarify"
    assert body["results"] is None
    assert body["understood"] is None
    assert body["question"]["text"] == "Which screen?"
    labels = [o["label"] for o in body["question"]["options"]]
    assert labels == ["Phone", "Laptop", "TV"]
    laptop = body["question"]["options"][1]["understood"]
    assert laptop["category_slugs"] == ["laptop-repair"]
    assert laptop["place"]["slug"] == "jounieh"  # looked up already
    assert body["question"]["options"][2]["understood"]["radius_m"] == 5000
    assert body["whatsapp_draft"] == "Hello, my screen is broken."
    assert body["summary"] == "One quick question"


def test_clarify_with_one_usable_option_becomes_a_search(client, db, fake_ai):
    phone = make_category(db, "phone-repair")
    make_provider(db, phone, "FixPhone", distance_m=100)
    fake_ai.answer = ai_answer(
        "clarify",
        clarify_question="Which?",
        clarify_options=[option("Phone", category_slugs=["phone-repair"]), option("Nothing")],
    )

    body = ask(client, "fix my screen")

    assert body["kind"] == "results"
    assert names(body) == ["FixPhone"]


def test_tapping_an_option_searches_without_the_ai(client, db, fake_ai):
    laptops = make_category(db, "laptop-repair")
    make_provider(db, laptops, "Jounieh Laptops", lat_lng=JOUNIEH)
    make_provider(db, laptops, "Ali Tech", distance_m=100)

    response = client.post(
        URL,
        json={
            "understood": {
                "category_slugs": ["laptop-repair", "not-a-category"],
                "q": None,
                "place": {"slug": "jounieh", "name_en": "ignored", "lat": 0, "lng": 0},
                "radius_m": 1000,
                "max_price": None,
                "price_unit": None,
                "price_currency": "USD",
                "open_now": False,
                "sort": "best",
            },
            "lat": CENTER_LAT,
            "lng": CENTER_LNG,
            "lang": "ar",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert fake_ai.calls == []
    assert body["kind"] == "results"
    assert body["understood"]["category_slugs"] == ["laptop-repair"]
    assert body["understood"]["place"]["lat"] == pytest.approx(JOUNIEH[0])
    assert names(body) == ["Jounieh Laptops"]
    assert body["summary"].startswith("laptop-repair بالعربية · في جونية")


def tap(client, understood: dict) -> dict:
    """Send the `understood` form, as the app does after a tap."""
    response = client.post(
        URL, json={"understood": understood, "lat": CENTER_LAT, "lng": CENTER_LNG, "lang": "en"}
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_tapping_a_place_option_with_only_a_slug_centres_the_search(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "Metn plumber", lat_lng=(33.8930, 35.5610))
    make_provider(db, plumber, "near the phone", distance_m=100)
    # The first answer offered two Jdeidehs; the user tapped the Metn one.
    body = tap(client, {"category_slugs": ["plumber"], "place": {"slug": "jdeideh-metn"}})

    assert fake_ai.calls == []
    assert body["understood"]["place"]["slug"] == "jdeideh-metn"
    assert body["understood"]["place"]["name_en"] == "Jdeideh"
    assert body["understood"]["radius_m"] == 5000  # Jdeideh is 1.5 km wide -> 5 km chip
    assert body["place_unknown"] is None
    assert names(body) == ["Metn plumber"]
    assert body["summary"] == "Plumber · in Jdeideh · 5 km"


def test_tapping_an_unknown_place_slug_searches_near_the_phone(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "near the phone", distance_m=100)

    body = tap(client, {"category_slugs": ["plumber"], "place": {"slug": "atlantis"}})

    assert body["kind"] == "results"
    assert body["understood"]["place"] is None
    assert body["place_unknown"] == "atlantis"
    assert names(body) == ["near the phone"]


def test_emergency_passes_straight_through(client, db, fake_ai):
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(
        "emergency", category_slugs=["plumber"], whatsapp_draft="should be dropped"
    )

    body = ask(client, "my father fell and is not breathing", lang="ar")

    assert body["kind"] == "emergency"
    assert body["results"] is None
    assert body["understood"] is None
    assert body["whatsapp_draft"] is None
    assert body["summary"] == "طوارئ: اتصل بالمساعدة الآن"
    assert logs(db)[0].kind == "emergency"


def test_off_topic_passes_straight_through(client, db, fake_ai):
    fake_ai.answer = ai_answer("off_topic")

    body = ask(client, "who won the match yesterday")

    assert body["kind"] == "off_topic"
    assert body["results"] is None
    assert body["summary"] == "I can only help you find people and shops near you."


# ---------- unavailable ----------


def test_unavailable_without_a_key_when_no_word_is_known(client, db):
    # No fake_ai: creating the client would fail the test, so this also
    # proves the AI is not even tried.
    make_category(db, "plumber")

    body = ask(client, "qwzx blorptan vexulim")

    assert body["kind"] == "unavailable"
    assert body["results"] is None
    assert body["summary"].startswith("The assistant is not available")
    assert logs(db) == []


def test_unavailable_when_the_monthly_budget_is_used_up(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_monthly_budget_usd", 1.0)
    db.add(AssistLog(source="ai", model="claude-haiku-5-5", cost_usd=1.0, kind="results",
                     text_hash="x"))  # fmt: skip
    db.commit()

    body = ask(client, "baddé sankari")

    assert body["kind"] == "unavailable"
    assert fake_ai.calls == []


def test_last_months_spending_does_not_count(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_monthly_budget_usd", 1.0)
    make_category(db, "plumber")
    db.add(AssistLog(source="ai", model="claude-haiku-5-5", cost_usd=5.0, kind="results",
                     text_hash="x", created_at=datetime(2020, 1, 15, tzinfo=UTC)))  # fmt: skip
    db.commit()
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    assert ask(client, "baddé sankari")["kind"] == "results"


# ---------- the free daily AI allowance (quota.py) ----------


def ask_as(client, text: str, *, device: str | None = None, headers: dict | None = None) -> dict:
    """ask() with an install id and/or other headers."""
    sent = dict(headers or {})
    if device is not None:
        sent["X-Haddak-Device"] = device
    body = {"text": text, "lat": CENTER_LAT, "lng": CENTER_LNG, "lang": "en"}
    response = client.post(URL, json=body, headers=sent)
    assert response.status_code == 200, response.text
    return response.json()


def move_to(monkeypatch, day: date) -> None:
    monkeypatch.setattr("app.services.assist.quota.today", lambda: day)


PHONE_A = str(uuid.uuid4())
PHONE_B = str(uuid.uuid4())
# What TestClient reports as the caller's IP.
TEST_CLIENT_IP = "testclient"


def test_phone_allowance_counts_only_ai_requests(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_daily_limit_anonymous", 2)
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    assert ask_as(client, "first sentence", device=PHONE_A)["kind"] == "results"
    assert ask_as(client, "first sentence", device=PHONE_A)["kind"] == "results"  # cache
    assert ask_as(client, "Plumber", device=PHONE_A)["kind"] == "results"  # exact name
    assert ask_as(client, "second sentence", device=PHONE_A)["kind"] == "results"
    # Allowance used: the keyword fallback answers (it knows no word here).
    assert ask_as(client, "third sentence", device=PHONE_A)["kind"] == "unavailable"
    assert len(fake_ai.calls) == 2


def test_the_allowance_starts_again_the_next_day(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_daily_limit_anonymous", 1)
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])
    move_to(monkeypatch, date(2026, 11, 21))
    ask_as(client, "first sentence", device=PHONE_A)
    assert ask_as(client, "second sentence", device=PHONE_A)["kind"] == "unavailable"

    move_to(monkeypatch, date(2026, 11, 22))

    assert ask_as(client, "second sentence", device=PHONE_A)["kind"] == "results"


def test_each_phone_has_its_own_allowance(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_daily_limit_anonymous", 1)
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    assert ask_as(client, "first sentence", device=PHONE_A)["kind"] == "results"
    assert ask_as(client, "second sentence", device=PHONE_B)["kind"] == "results"
    assert len(fake_ai.calls) == 2


def test_a_signed_in_account_gets_its_own_larger_allowance(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_daily_limit_anonymous", 1)
    monkeypatch.setattr(settings, "assist_daily_limit_signed_in", 2)
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])
    signed_in = auth_headers(uuid.uuid4())

    # Counted on the account, not on the phone.
    assert ask_as(client, "one", device=PHONE_A, headers=signed_in)["kind"] == "results"
    assert ask_as(client, "two", device=PHONE_A, headers=signed_in)["kind"] == "results"
    assert ask_as(client, "three", device=PHONE_A, headers=signed_in)["kind"] == "unavailable"
    assert len(fake_ai.calls) == 2


def test_inventing_a_new_install_id_each_time_is_stopped_by_the_ip(
    client, db, fake_ai, monkeypatch
):
    monkeypatch.setattr(settings, "assist_daily_limit_anonymous", 10)
    monkeypatch.setattr(settings, "assist_daily_limit_per_ip", 2)
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    answers = [ask_as(client, f"sentence {n}", device=str(uuid.uuid4())) for n in range(3)]

    assert [answer["kind"] for answer in answers] == ["results", "results", "unavailable"]
    assert len(fake_ai.calls) == 2


@pytest.mark.parametrize("device", [None, "not-an-install-id", "1234"])
def test_without_a_valid_install_id_only_the_ip_is_counted(
    client, db, fake_ai, monkeypatch, device
):
    monkeypatch.setattr(settings, "assist_daily_limit_anonymous", 1)
    monkeypatch.setattr(settings, "assist_daily_limit_per_ip", 2)
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    kinds = [ask_as(client, f"sentence {n}", device=device)["kind"] for n in range(3)]

    assert kinds == ["results", "results", "unavailable"]


def test_a_refused_request_uses_up_nobodys_allowance(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_daily_limit_anonymous", 1)
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    ask_as(client, "first sentence", device=PHONE_A)
    ask_as(client, "second sentence", device=PHONE_A)  # refused: phone A is out
    ask_as(client, "third sentence", device=PHONE_B)

    ip_row = db.get(AssistQuota, (subject_hash(f"ip:{TEST_CLIENT_IP}", today()), today()))
    assert ip_row.used == 2  # the refused request was not counted on the IP


def test_the_allowance_table_holds_no_ip_account_or_install_id(client, db, fake_ai):
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])
    user_id = uuid.uuid4()

    ask_as(client, "first sentence", device=PHONE_A)
    ask_as(client, "second sentence", device=PHONE_B, headers=auth_headers(user_id))

    subjects = list(db.scalars(select(AssistQuota.subject)))
    assert len(subjects) == 3  # phone A, the account, the IP
    for subject in subjects:
        assert len(subject) == 64 and all(char in "0123456789abcdef" for char in subject)
        for value in (PHONE_A, PHONE_B, str(user_id), TEST_CLIENT_IP):
            assert value not in subject


def test_the_same_phone_gets_an_unrelated_hash_each_day():
    who = f"device:{PHONE_A}"

    assert subject_hash(who, date(2026, 11, 21)) != subject_hash(who, date(2026, 11, 22))


def test_counts_survive_a_server_restart(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_daily_limit_anonymous", 1)
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])
    ask_as(client, "first sentence", device=PHONE_A)

    limiter.reset()  # every count kept in memory is gone, as after a restart

    assert ask_as(client, "second sentence", device=PHONE_A)["kind"] == "unavailable"


def test_old_days_are_deleted(client, db, fake_ai):
    db.add(AssistQuota(subject="old", day=today() - timedelta(days=5), used=3))
    db.add(AssistQuota(subject="yesterday", day=today() - timedelta(days=1), used=3))
    db.commit()
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    ask_as(client, "first sentence", device=PHONE_A)

    db.expire_all()
    left = set(db.scalars(select(AssistQuota.subject)))
    assert "old" not in left
    assert "yesterday" in left


def test_daily_budget_rests_the_ai_until_tomorrow(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_daily_budget_usd", 0.5)
    db.add(AssistLog(source="ai", model="claude-haiku-5-5", cost_usd=0.5, kind="results",
                     text_hash="x"))  # fmt: skip
    db.commit()

    assert ask(client, "baddé sankari")["kind"] == "unavailable"
    assert fake_ai.calls == []


def test_spending_before_today_does_not_count_for_today(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_daily_budget_usd", 0.5)
    make_category(db, "plumber")
    two_days_ago = datetime.now(UTC) - timedelta(days=2)
    db.add(AssistLog(source="ai", model="claude-haiku-5-5", cost_usd=0.5, kind="results",
                     text_hash="x", created_at=two_days_ago))  # fmt: skip
    db.commit()
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    assert ask(client, "baddé sankari")["kind"] == "results"


def test_more_than_20_requests_a_minute_from_one_ip_is_429(client, db, clock):
    body = {"text": "hello there", "lat": CENTER_LAT, "lng": CENTER_LNG}

    statuses = [client.post(URL, json=body).status_code for _ in range(21)]

    assert statuses[:20] == [200] * 20
    assert statuses[20] == 429
    clock.advance(61)
    assert client.post(URL, json=body).status_code == 200


# ---------- the free keyword fallback (no AI) ----------


def test_no_key_fridge_sentence_finds_results_with_keywords(client, db):
    # No fake_ai: the AI is never tried.
    cooling = make_category(db, "appliance-repair")
    make_provider(db, cooling, "Cool Tech", distance_m=300)

    body = ask(client, "my fridge stopped working")

    assert body["kind"] == "results"
    assert body["understood"]["category_slugs"] == ["appliance-repair"]
    assert names(body) == ["Cool Tech"]
    assert body["summary"] == "Appliance Repair · near you · 1 km"
    assert body["whatsapp_draft"] is None
    [row] = logs(db)
    assert (row.source, row.kind, row.cost_usd) == ("direct", "results", 0)


def test_no_key_arabizi_plumber_near_me_is_500_m(client, db):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "Abu Ali", distance_m=200)
    make_provider(db, plumber, "Far Plumber", distance_m=3000)

    body = ask(client, "baddé sankari 2arib")

    assert body["kind"] == "results"
    assert body["understood"]["category_slugs"] == ["plumber"]
    assert body["understood"]["radius_m"] == 500
    assert names(body) == ["Abu Ali"]


@pytest.mark.parametrize(
    "text, expected",
    [
        ("بدي سنكري قريب", {"category_slugs": ["plumber"], "radius_m": 500}),
        ("plombier", {"category_slugs": ["plumber"]}),
        ("البراد خربان", {"category_slugs": ["appliance-repair"]}),
        ("laptob msakkar", {"category_slugs": ["laptop-repair"]}),
        ("2ostez riyadiyat a2al men 20$", {"category_slugs": ["math-tutoring"],
         "max_price": 20, "price_unit": "hour", "price_currency": "USD"}),
        ("tutor under $20", {"category_slugs": ["tutoring"], "max_price": 20,
         "price_unit": "hour"}),
        ("sankari fete7 hala2", {"category_slugs": ["plumber"], "open_now": True}),
        ("بدي سنكري ضروري", {"category_slugs": ["plumber"], "open_now": True}),
        ("sankari urgent", {"category_slugs": ["plumber"], "open_now": True}),
        ("plumbr", {"category_slugs": ["plumber"]}),
    ],
)  # fmt: skip
def test_keyword_fallback_understands(client, db, text, expected):
    tutoring = make_category(db, "tutoring")
    make_category(db, "math-tutoring", parent=tutoring)
    for slug in ("plumber", "appliance-repair", "laptop-repair"):
        category = make_category(db, slug)
        # Something close by, so the circle is not widened.
        make_provider(db, category, f"Near {slug}", distance_m=100)

    body = ask(client, text)

    assert body["kind"] == "results"
    for field, value in expected.items():
        assert body["understood"][field] == value, field


def test_keyword_fallback_finds_a_named_place(client, db):
    make_category(db, "plumber")

    body = ask(client, "plombier à Jounieh")

    assert body["understood"]["place"]["slug"] == "jounieh"
    assert "in Jounieh" in body["summary"]


def test_keyword_fallback_when_the_budget_is_used_up(client, db, fake_ai, monkeypatch):
    monkeypatch.setattr(settings, "assist_monthly_budget_usd", 1.0)
    make_category(db, "plumber")
    db.add(AssistLog(source="ai", model="claude-haiku-5-5", cost_usd=1.0, kind="results",
                     text_hash="x"))  # fmt: skip
    db.commit()

    body = ask(client, "baddé sankari")

    assert body["kind"] == "results"
    assert body["understood"]["category_slugs"] == ["plumber"]
    assert fake_ai.calls == []


def test_keyword_fallback_when_the_ai_fails(client, db, fake_ai):
    make_category(db, "plumber")
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    fake_ai.error = anthropic.APIConnectionError(request=request)

    body = ask(client, "baddé sankari")

    assert body["kind"] == "results"
    assert body["understood"]["category_slugs"] == ["plumber"]
    [row] = logs(db)  # one row: the AI's cost and the fallback's answer
    assert (row.source, row.kind) == ("ai", "results")


def test_api_error_is_unavailable_and_logged(client, db, fake_ai):
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    fake_ai.error = anthropic.APIConnectionError(request=request)

    body = ask(client, "baddé sankari")

    assert body["kind"] == "unavailable"
    [row] = logs(db)
    assert (row.source, row.kind, row.model) == ("ai", "unavailable", "claude-haiku-5-5")


def test_refusal_or_cut_off_answer_is_unavailable(client, db, fake_ai):
    fake_ai.stop_reason = "refusal"
    fake_ai.answer = None

    body = ask(client, "baddé sankari")

    assert body["kind"] == "unavailable"
    # Tokens are still billed, so the cost is still logged.
    assert logs(db)[0].input_tokens == 1000


def test_cost_is_logged_from_the_token_counts(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "Abu Hassan Plumbing", distance_m=200)
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    ask(client, "baddé sankari")

    [row] = logs(db)
    # Haiku 5.5: 1000 input x $0.10 + 200 output x $0.50 + 3000 cache reads x $0.01, per million.
    assert float(row.cost_usd) == pytest.approx(0.00023)
    assert (row.input_tokens, row.output_tokens, row.cache_read_tokens) == (1000, 200, 3000)
    assert row.wanted_text is None  # nothing stored about the sentence when it was found...
    assert len(row.text_hash) == 64  # ...only its hash


# ---------- places ----------


def test_a_named_place_recentres_the_search(client, db, fake_ai):
    piano = make_category(db, "piano-lessons")
    make_provider(db, piano, "Jounieh Piano Academy", lat_lng=(33.9810, 35.6170))
    make_provider(db, piano, "Piano with Nour", distance_m=600)
    fake_ai.answer = ai_answer(category_slugs=["piano-lessons"], place_name="jouneih")

    body = ask(client, "piano teacher b jouneih")

    assert names(body) == ["Jounieh Piano Academy"]
    place = body["understood"]["place"]
    assert place["slug"] == "jounieh"
    assert place["name_ar"] == "جونية"
    # A city is searched as a whole: Jounieh's radius is 4 km -> the 5 km chip.
    assert body["understood"]["radius_m"] == 5000
    assert body["summary"] == "Piano Lessons · in Jounieh · 5 km"


def test_a_place_with_two_districts_gives_place_options(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "near the phone", distance_m=100)
    fake_ai.answer = ai_answer(category_slugs=["plumber"], place_name="Jdeideh")

    body = ask(client, "sankari bel jdeideh")

    assert body["kind"] == "results"
    assert body["understood"]["place"] is None
    assert {o["district"] for o in body["place_options"]} == {"Matn", "Marjayoun"}
    assert {o["slug"] for o in body["place_options"]} == {"jdeideh-metn", "jdeideh-marjayoun"}
    assert names(body) == ["near the phone"]  # meanwhile: near the phone


def test_an_unknown_place_searches_near_the_phone_and_is_logged(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "near the phone", distance_m=100)
    fake_ai.answer = ai_answer(category_slugs=["plumber"], place_name="Atlantis")

    body = ask(client, "sankari in Atlantis")

    assert body["place_unknown"] == "Atlantis"
    assert body["understood"]["place"] is None
    assert names(body) == ["near the phone"]
    assert logs(db)[0].place_unknown == "Atlantis"


def test_arabic_place_names_are_found(client, db, fake_ai):
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(category_slugs=["plumber"], place_name="الحمراء")

    body = ask(client, "بدي سنكري بالحمرا")

    assert body["understood"]["place"]["slug"] == "hamra"


# ---------- widening ----------


def test_nothing_found_widens_the_circle_once(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "3 km away", distance_m=3000)
    fake_ai.answer = ai_answer(category_slugs=["plumber"], radius_m=1000)

    body = ask(client, "sankari 2arib")

    assert body["widened"] is True
    assert body["understood"]["radius_m"] == 5000
    assert names(body) == ["3 km away"]
    assert logs(db)[0].wanted_text is None


def test_widening_stops_at_20_km_and_the_request_is_wanted(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "30 km away", distance_m=30000)
    fake_ai.answer = ai_answer(category_slugs=["plumber"], radius_m=500)

    body = ask(client, "Sankari 2arib!")

    assert body["widened"] is True
    assert body["understood"]["radius_m"] == 20000
    assert body["results"]["total"] == 0
    assert logs(db)[0].wanted_text == "sankari 2arib"


def test_no_widening_when_something_is_found(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "near", distance_m=300)
    make_provider(db, plumber, "3 km away", distance_m=3000)
    fake_ai.answer = ai_answer(category_slugs=["plumber"], radius_m=1000)

    body = ask(client, "sankari 2arib")

    assert body["widened"] is False
    assert names(body) == ["near"]


def test_unverified_providers_are_included_after_verified_ones(client, db, fake_ai):
    plumber = make_category(db, "plumber")
    make_provider(db, plumber, "unverified near", distance_m=50, status="unverified")
    make_provider(db, plumber, "verified", distance_m=300)
    make_provider(db, plumber, "rejected", distance_m=60, status="rejected")
    fake_ai.answer = ai_answer(category_slugs=["plumber"])

    assert names(ask(client, "sankari")) == ["verified", "unverified near"]


# ---------- request validation ----------


@pytest.mark.parametrize(
    "body",
    [
        {"lat": 33.8, "lng": 35.5},  # neither text nor understood
        {"text": "plumber", "understood": {}, "lat": 33.8, "lng": 35.5},  # both
        {"text": "a", "lat": 33.8, "lng": 35.5},  # too short
        {"text": "x" * 301, "lat": 33.8, "lng": 35.5},  # too long
        {"text": "plumber", "lat": 33.8, "lng": 35.5, "lang": "fr"},
        {"text": "plumber", "lat": 133.8, "lng": 35.5},
    ],
)
def test_bad_requests_are_422(client, body):
    response = client.post(URL, json=body)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


# ---------- the founder's "most wanted" list ----------


def test_wanted_lists_unmatched_requests_and_the_months_spending(client, db, fake_ai):
    make_category(db, "plumber")
    fake_ai.answer = ai_answer(q="vet")
    ask(client, "baddé 7akim 7ayawanet")
    ask(client, "Baddé 7akim 7ayawanet!")  # cache, counted again
    fake_ai.answer = ai_answer(category_slugs=["plumber"], place_name="Atlantis")
    ask(client, "sankari in atlantis")

    response = client.get("/api/v1/admin/assist/wanted", headers=ADMIN_HEADERS)

    assert response.status_code == 200
    data = response.json()
    assert data["month"] == datetime.now(UTC).strftime("%Y-%m")
    assert data["month_ai_requests"] == 2
    assert data["month_spend_usd"] == pytest.approx(0.00046)
    assert data["month_budget_usd"] == settings.assist_monthly_budget_usd
    # Most asked first; the plumber search in "Atlantis" found nothing too.
    assert [(i["text"], i["count"]) for i in data["items"]] == [
        ("badde 7akim 7ayawanet", 2),
        ("sankari in atlantis", 1),
    ]
    assert data["unknown_places"] == [{"name": "Atlantis", "count": 1}]


def test_wanted_needs_the_admin_key(client):
    assert client.get("/api/v1/admin/assist/wanted").status_code == 401
