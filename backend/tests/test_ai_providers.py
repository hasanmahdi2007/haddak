"""The OpenAI (GPT) and Google (Gemini) paths of the assistant's AI call.

Like test_assist.py, nothing reaches the network: the fixtures below replace
get_openai_client / get_gemini_client with fakes that return whatever the
test prepared, shaped like the real SDK responses.
"""

from decimal import Decimal
from types import SimpleNamespace

import httpx2
import openai
import pytest
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from sqlalchemy import select

from app.config import settings
from app.models import AssistLog
from app.services.assist import ai_client
from app.services.assist.ai_client import AIResult, AIUnavailable, Usage, ask_model
from app.services.assist.budget import cost_usd
from tests.conftest import make_category
from tests.test_assist import URL, ai_answer

SYSTEM = "rules and categories"


# ---------- fakes ----------


class FakeOpenAIResponses:
    def __init__(self):
        self.answer: AIResult | None = ai_answer(category_slugs=["plumber"])
        self.status = "completed"
        self.incomplete_reason: str | None = None
        self.error: Exception | None = None
        self.calls: list[dict] = []

    def parse(self, **request):
        self.calls.append(request)
        if self.error is not None:
            raise self.error
        usage = SimpleNamespace(
            input_tokens=4000,  # includes the 3000 cached ones
            input_tokens_details=SimpleNamespace(cached_tokens=3000, cache_write_tokens=0),
            output_tokens=200,
        )
        incomplete = None
        if self.incomplete_reason:
            incomplete = SimpleNamespace(reason=self.incomplete_reason)
        return SimpleNamespace(
            output_parsed=self.answer,
            status=self.status,
            incomplete_details=incomplete,
            usage=usage,
        )


class FakeGeminiModels:
    def __init__(self):
        self.text: str | None = ai_answer(category_slugs=["plumber"]).model_dump_json()
        self.finish = genai_types.FinishReason.STOP
        self.blocked = False
        self.error: Exception | None = None
        self.calls: list[dict] = []

    def generate_content(self, **request):
        self.calls.append(request)
        if self.error is not None:
            raise self.error
        usage = SimpleNamespace(
            prompt_token_count=4000,  # includes the 3000 cached ones
            cached_content_token_count=3000,
            candidates_token_count=150,
            thoughts_token_count=50,
        )
        candidates = [] if self.blocked else [SimpleNamespace(finish_reason=self.finish)]
        return SimpleNamespace(text=self.text, candidates=candidates, usage_metadata=usage)


@pytest.fixture
def fake_openai(monkeypatch) -> FakeOpenAIResponses:
    responses = FakeOpenAIResponses()
    client = SimpleNamespace(responses=responses)
    monkeypatch.setattr(settings, "openai_api_key", "test-key-not-real")
    monkeypatch.setattr("app.services.assist.ai_client.get_openai_client", lambda: client)
    return responses


@pytest.fixture
def fake_gemini(monkeypatch) -> FakeGeminiModels:
    models = FakeGeminiModels()
    client = SimpleNamespace(models=models)
    monkeypatch.setattr(settings, "gemini_api_key", "test-key-not-real")
    monkeypatch.setattr("app.services.assist.ai_client.get_gemini_client", lambda: client)
    return models


@pytest.fixture
def default_models(monkeypatch):
    """The production choice: Luna for most sentences, Gemini for Arabizi."""
    monkeypatch.setattr(settings, "assist_model", "gpt-6-luna")
    monkeypatch.setattr(settings, "assist_model_arabizi", "gemini-3.8-flash")
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")


# ---------- which provider ----------


def test_the_model_name_picks_the_provider():
    assert ai_client.provider_of("gpt-6-luna") == "openai"
    assert ai_client.provider_of("gemini-3.8-flash") == "google"
    assert ai_client.provider_of("claude-haiku-5-5") == "anthropic"


def test_defaults_are_luna_and_gemini_for_arabizi():
    # The values in config.py, not changed by any fixture here.
    assert type(settings).model_fields["assist_model"].default == "gpt-6-luna"
    assert type(settings).model_fields["assist_model_arabizi"].default == "gemini-3.8-flash"


def test_a_model_needs_its_own_providers_key(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "set")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    assert ai_client.ai_configured("gpt-6-luna")
    assert not ai_client.ai_configured("gemini-3.8-flash")


# ---------- OpenAI ----------


def test_openai_request_is_small_strict_and_not_stored(fake_openai):
    reply = ask_model(SYSTEM, "baddé sankari", "gpt-6-luna")

    request = fake_openai.calls[0]
    assert request["model"] == "gpt-6-luna"
    assert request["instructions"] == SYSTEM
    assert request["input"] == "baddé sankari"
    assert request["text_format"] is AIResult
    assert request["reasoning"] == {"effort": "none"}
    assert request["max_output_tokens"] <= 1024
    assert request["store"] is False
    assert request["prompt_cache_key"] == "haddak-assist"
    assert reply.result.category_slugs == ["plumber"]
    assert reply.model == "gpt-6-luna"
    # Cached tokens are split out of input_tokens so each is priced once.
    assert reply.usage == Usage(input_tokens=1000, output_tokens=200, cache_read_tokens=3000)


def test_openai_refusal_is_an_ai_failure_with_its_cost(fake_openai):
    fake_openai.answer = None  # a refusal: completed, but nothing parsed

    with pytest.raises(AIUnavailable) as caught:
        ask_model(SYSTEM, "x", "gpt-6-luna")

    assert "refusal" in str(caught.value)
    assert caught.value.usage.output_tokens == 200  # still billed, still logged


def test_openai_cut_off_answer_is_an_ai_failure(fake_openai):
    fake_openai.status = "incomplete"
    fake_openai.incomplete_reason = "max_output_tokens"

    with pytest.raises(AIUnavailable, match="max_output_tokens"):
        ask_model(SYSTEM, "x", "gpt-6-luna")


def test_openai_network_error_is_an_ai_failure(fake_openai):
    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    fake_openai.error = openai.APIConnectionError(request=request)

    with pytest.raises(AIUnavailable, match="could not reach"):
        ask_model(SYSTEM, "x", "gpt-6-luna")


def test_openai_bad_json_is_an_ai_failure(fake_openai):
    fake_openai.error = ValueError("did not fit")

    with pytest.raises(AIUnavailable, match="schema"):
        ask_model(SYSTEM, "x", "gpt-6-luna")


# ---------- Gemini ----------


def test_gemini_request_asks_for_json_with_low_thinking(fake_gemini):
    reply = ask_model(SYSTEM, "baddé sankari", "gemini-3.8-flash")

    request = fake_gemini.calls[0]
    config = request["config"]
    assert request["model"] == "gemini-3.8-flash"
    assert request["contents"] == "baddé sankari"
    assert config.system_instruction == SYSTEM
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema == AIResult.model_json_schema()
    assert config.thinking_config.thinking_level == genai_types.ThinkingLevel.LOW
    assert config.max_output_tokens <= 1024
    assert reply.result.category_slugs == ["plumber"]
    # Thinking tokens are billed as output; cached tokens are split out.
    assert reply.usage == Usage(input_tokens=1000, output_tokens=200, cache_read_tokens=3000)


def test_gemini_safety_stop_is_an_ai_failure_with_its_cost(fake_gemini):
    fake_gemini.finish = genai_types.FinishReason.SAFETY

    with pytest.raises(AIUnavailable, match="SAFETY") as caught:
        ask_model(SYSTEM, "x", "gemini-3.8-flash")

    assert caught.value.usage.output_tokens == 200


def test_gemini_blocked_sentence_is_an_ai_failure(fake_gemini):
    fake_gemini.blocked = True

    with pytest.raises(AIUnavailable, match="blocked"):
        ask_model(SYSTEM, "x", "gemini-3.8-flash")


def test_gemini_answer_that_is_not_our_shape_is_an_ai_failure(fake_gemini):
    fake_gemini.text = '{"kind": "search"}'

    with pytest.raises(AIUnavailable, match="schema"):
        ask_model(SYSTEM, "x", "gemini-3.8-flash")


def test_gemini_rate_limit_and_network_errors_are_ai_failures(fake_gemini):
    fake_gemini.error = genai_errors.ClientError(429, {"error": {"message": "slow down"}})
    with pytest.raises(AIUnavailable, match="rate limited"):
        ask_model(SYSTEM, "x", "gemini-3.8-flash")

    fake_gemini.error = httpx2.ConnectTimeout("too slow")
    with pytest.raises(AIUnavailable, match="could not reach"):
        ask_model(SYSTEM, "x", "gemini-3.8-flash")


# ---------- prices ----------


def test_new_models_are_priced_not_costed_as_unknown():
    usage = Usage(input_tokens=1_000_000, output_tokens=1_000_000)
    assert cost_usd("gpt-6-luna", usage) == Decimal("0.6")
    # Gemini at its 2027 price, so the caps err on the safe side.
    assert cost_usd("gemini-3.8-flash", usage) == Decimal("9")


# ---------- through POST /assist ----------


def logs(db) -> list[AssistLog]:
    return list(db.scalars(select(AssistLog).order_by(AssistLog.created_at)))


def ask(client, text: str) -> dict:
    response = client.post(URL, json={"text": text, "lat": 33.86, "lng": 35.51, "lang": "en"})
    assert response.status_code == 200, response.text
    return response.json()


def test_english_goes_to_luna_and_arabizi_to_gemini(
    client, db, default_models, fake_openai, fake_gemini
):
    make_category(db, "plumber")

    ask(client, "I need someone to fix a leaking pipe")
    ask(client, "baddé sankari 2arib")

    assert len(fake_openai.calls) == 1 and len(fake_gemini.calls) == 1
    assert [log.model for log in logs(db)] == ["gpt-6-luna", "gemini-3.8-flash"]
    assert all(log.cost_usd > 0 for log in logs(db))


def test_pure_arabic_goes_to_luna_and_mixed_arabic_and_latin_to_gemini(
    client, db, default_models, fake_openai, fake_gemini
):
    make_category(db, "plumber")

    ask(client, "بدي سنكري قريب")
    ask(client, "بدي plumber قريب")

    assert [log.model for log in logs(db)] == ["gpt-6-luna", "gemini-3.8-flash"]


def test_without_the_gemini_key_arabizi_uses_the_free_keywords(
    client, db, default_models, fake_openai, monkeypatch
):
    make_category(db, "plumber")
    # The Gemini client must not even be created.
    monkeypatch.setattr(
        "app.services.assist.ai_client.get_gemini_client",
        lambda: pytest.fail("Gemini was asked without a key"),
    )

    body = ask(client, "baddé sankari 2arib")

    assert body["kind"] == "results"
    assert fake_openai.calls == []
    assert [log.source for log in logs(db)] == ["direct"]
