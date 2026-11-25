"""The one AI call per sentence, and the fixed shape the answer must have.

Three providers, picked by the model name (provider_of): OpenAI ("gpt-..."),
Google ("gemini-...") and Anthropic ("claude-..."). Each has its own small
function below; they all send the same system prompt and return the same
AIResult, so the rest of the assistant does not know which one answered.

We use "structured output": we hand the API a JSON schema (generated from the
Pydantic classes below) and the model can only answer with JSON that fits it.
So the AI never chats; it fills in a form. The backend still checks every
value afterwards (service.py), because "fits the schema" does not mean
"makes sense" (an unknown category slug, a radius of 7 metres...).

Tests never reach the network: they replace the get_*_client() functions
with fakes.
"""

import functools
import logging
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Literal

import anthropic
import httpx2
import openai
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.services.assist.normalize import detect_script

logger = logging.getLogger("haddak.assist")

# A small extraction: the answer is a few hundred tokens of JSON at most.
# If the model runs out of room the JSON is cut off and we answer
# "unavailable" rather than guess.
MAX_TOKENS = 1024
# Seconds to wait for the API. The user is waiting too; a slow answer is
# worse than falling back to a normal search. The whole chain (AI call, then
# the keyword fallback and the search) must finish well inside the app's own
# timeout for /assist, or the user sees "offline" instead of the fallback.
TIMEOUT_SECONDS = 6.0
# Opening the connection to the API; normally well under a second.
CONNECT_TIMEOUT_SECONDS = 2.0
# No automatic retry: one retry could double the wait (2 x 6 s), longer
# than the user waits. A failed request falls back to keywords at once.
MAX_RETRIES = 0
# At most this many AI requests at the same moment. Each one holds a server
# thread while it waits; on a slow-API day, more would leave no threads for
# searches. When all slots are busy, the keyword fallback answers at once.
MAX_CONCURRENT_AI_CALLS = 8
_ai_slots = threading.BoundedSemaphore(MAX_CONCURRENT_AI_CALLS)


# ---------- the shape the AI must return ----------
# Every field is required in the JSON (null when it does not apply), which
# is what structured output needs. Field order is the order the model
# writes them, so `kind` comes first.

PriceUnitAI = Literal["hour", "visit", "job", "item", "month"]
CurrencyAI = Literal["USD", "LBP"]
SortAI = Literal["best", "distance", "price"]


class AIOption(BaseModel):
    """One clarify option: a short label plus a full set of search settings."""

    label: str
    category_slugs: list[str]
    q: str | None
    place_name: str | None
    radius_m: int | None
    max_price: float | None
    price_unit: PriceUnitAI | None
    price_currency: CurrencyAI | None
    open_now: bool
    sort: SortAI


class AIResult(BaseModel):
    """What the AI returns for one sentence."""

    kind: Literal["search", "clarify", "emergency", "off_topic"]
    category_slugs: list[str]
    q: str | None
    place_name: str | None
    radius_m: int | None
    max_price: float | None
    price_unit: PriceUnitAI | None
    price_currency: CurrencyAI | None
    open_now: bool
    sort: SortAI
    clarify_question: str | None
    clarify_options: list[AIOption]
    whatsapp_draft: str | None


# ---------- models we know ----------


@dataclass(frozen=True)
class ModelInfo:
    """Prices in US dollars per million tokens, and one setting.

    From each provider's official pricing page (November 2026):
    - GPT-6 Luna: cached input 0.1x, cache writes 1.25x the input price.
    - Gemini 3.8 Flash: $0.75 / $3.75 until 2026-12-31, then $1.50 / $7.50.
      We use the 2027 price now, and cached tokens at the full input price
      (Google's cached-token discount is not confirmed): the spending caps
      then err on the safe side.
    - Claude: cache reads 0.1x the input price, 5-minute cache writes 1.25x.
      Haiku 5.5 costs more above 100K prompt tokens; our prompt is far below.
    """

    input_usd: float
    output_usd: float
    cache_read_usd: float
    cache_write_usd: float
    # Claude only: Haiku 5.5 accepts thinking "disabled" at low effort; the
    # 5.5 Sonnet and Opus models refuse it (HTTP 400) and get low effort only.
    can_disable_thinking: bool


MODELS = {
    "gpt-6-luna": ModelInfo(0.10, 0.50, 0.01, 0.125, can_disable_thinking=False),
    "gemini-3.8-flash": ModelInfo(1.50, 7.50, 1.50, 0.00, can_disable_thinking=False),
    "claude-haiku-5-5": ModelInfo(0.10, 0.50, 0.01, 0.125, can_disable_thinking=True),
    "claude-sonnet-5-5": ModelInfo(2.00, 10.00, 0.10, 2.50, can_disable_thinking=False),
    "claude-opus-5-5": ModelInfo(4.00, 20.00, 0.20, 5.00, can_disable_thinking=False),
}
# A model we have no row for is costed at a deliberately high price, so the
# monthly cap errs on the safe side. Add a row when switching models.
UNKNOWN_MODEL = ModelInfo(10.00, 50.00, 1.00, 12.50, can_disable_thinking=False)


def model_info(model: str) -> ModelInfo:
    return MODELS.get(model, UNKNOWN_MODEL)


@dataclass
class Usage:
    """Token counts of one request (copied from the API's `usage`)."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0


@dataclass
class AIReply:
    result: AIResult
    usage: Usage
    model: str


class AIUnavailable(Exception):
    """The AI could not give a usable answer (network, API error, refusal,
    cut-off output). `usage` holds whatever tokens were still billed."""

    def __init__(self, reason: str, usage: Usage | None = None):
        super().__init__(reason)
        self.usage = usage or Usage()


# ---------- which provider, which key ----------


def provider_of(model: str) -> str:
    """'openai', 'google' or 'anthropic', from the model name."""
    if model.startswith("gpt-"):
        return "openai"
    if model.startswith("gemini-"):
        return "google"
    return "anthropic"


def api_key_for(model: str) -> str:
    """The configured key of the model's provider ("" when not set)."""
    keys = {
        "openai": settings.openai_api_key,
        "google": settings.gemini_api_key,
        "anthropic": settings.anthropic_api_key,
    }
    return keys[provider_of(model)].strip()


def ai_configured(model: str) -> bool:
    """True when `model` can be asked: its provider's key is set."""
    return bool(api_key_for(model))


# ---------- the clients ----------
# Each is made once per process and shared (@functools.cache): a client keeps
# its connections open, so later requests skip the connection and TLS set-up,
# and it is safe to use from several threads at once. A changed key needs a
# restart, which a change of environment variables on Render does anyway.
# Separate functions so tests can replace them with fakes.


@functools.cache
def get_client() -> anthropic.Anthropic:
    """The Claude API client."""
    return anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=anthropic.Timeout(TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS),
        max_retries=MAX_RETRIES,
    )


@functools.cache
def get_openai_client() -> openai.OpenAI:
    """The OpenAI API client."""
    return openai.OpenAI(
        api_key=settings.openai_api_key,
        timeout=httpx2.Timeout(TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS),
        max_retries=MAX_RETRIES,
    )


@functools.cache
def get_gemini_client() -> genai.Client:
    """The Gemini API client. Its timeout is in milliseconds; attempts=1
    means the first try only, no retry."""
    return genai.Client(
        api_key=settings.gemini_api_key,
        http_options=genai_types.HttpOptions(
            timeout=int(TIMEOUT_SECONDS * 1000),
            retry_options=genai_types.HttpRetryOptions(attempts=1),
        ),
    )


@contextmanager
def ai_slot() -> Iterator[bool]:
    """Yields True when this request may call the AI now, False when
    MAX_CONCURRENT_AI_CALLS requests are already waiting for it. Never waits.

        with ai_slot() as allowed:
            if not allowed:
                ...answer with the keyword fallback...
    """
    allowed = _ai_slots.acquire(blocking=False)
    try:
        yield allowed
    finally:
        if allowed:
            _ai_slots.release()


# Scripts that go to ASSIST_MODEL_ARABIZI (see normalize.detect_script).
ROUTED_SCRIPTS = ("arabizi", "mixed")


def choose_model(text: str) -> str:
    """Model routing by script, decided from the characters (no AI): pure
    English/French or pure Arabic letters go to ASSIST_MODEL; Arabizi and
    sentences mixing Arabic and Latin letters go to ASSIST_MODEL_ARABIZI
    (when it is empty, everything goes to ASSIST_MODEL)."""
    if settings.assist_model_arabizi.strip() and detect_script(text) in ROUTED_SCRIPTS:
        return settings.assist_model_arabizi.strip()
    return settings.assist_model


def ask_model(system_prompt: str, user_text: str, model: str | None = None) -> AIReply:
    """Send one sentence to the model's provider; return the parsed answer
    or raise AIUnavailable. The error messages never contain a key or the
    sentence."""
    model = model or settings.assist_model
    provider = provider_of(model)
    if provider == "openai":
        return ask_openai(system_prompt, user_text, model)
    if provider == "google":
        return ask_gemini(system_prompt, user_text, model)
    return ask_claude(system_prompt, user_text, model)


# ---------- Anthropic (Claude) ----------


def usage_from(response) -> Usage:
    """Token counts from a Claude response."""
    usage = getattr(response, "usage", None)
    if usage is None:
        return Usage()
    return Usage(
        input_tokens=usage.input_tokens or 0,
        output_tokens=usage.output_tokens or 0,
        cache_read_tokens=getattr(usage, "cache_read_input_tokens", None) or 0,
        cache_write_tokens=getattr(usage, "cache_creation_input_tokens", None) or 0,
    )


def ask_claude(system_prompt: str, user_text: str, model: str) -> AIReply:
    """The system prompt carries a cache marker: it is the same on every
    request (rules + category list, no timestamps), so after the first
    request the API reads it from its prompt cache at a tenth of the price.
    """
    request = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": user_text}],
        # Low effort: this is a small extraction, not a hard problem.
        "output_config": {"effort": "low"},
        # parse() turns the Pydantic class into a JSON schema for the API and
        # turns the JSON answer back into an AIResult.
        "output_format": AIResult,
    }
    if model_info(model).can_disable_thinking:
        request["thinking"] = {"type": "disabled"}

    try:
        response = get_client().messages.parse(**request)
    # Most specific first.
    except anthropic.RateLimitError as error:
        raise AIUnavailable("rate limited by the API") from error
    except anthropic.APIStatusError as error:
        raise AIUnavailable(f"API error {error.status_code}") from error
    except anthropic.APIConnectionError as error:  # includes timeouts
        raise AIUnavailable("could not reach the API") from error
    except ValueError as error:  # the JSON did not fit the schema
        raise AIUnavailable("answer did not match the schema") from error

    usage = usage_from(response)
    # "refusal": a safety classifier declined; "max_tokens": the JSON was cut off.
    if response.stop_reason != "end_turn" or response.parsed_output is None:
        raise AIUnavailable(f"no usable answer (stop_reason={response.stop_reason})", usage)
    return AIReply(result=response.parsed_output, usage=usage, model=model)


# ---------- OpenAI (GPT) ----------


def openai_usage(response) -> Usage:
    """Token counts from an OpenAI response. OpenAI's input_tokens already
    include the cached and cache-write tokens; we split them out so each is
    priced once. Reasoning tokens are part of output_tokens."""
    usage = getattr(response, "usage", None)
    if usage is None:
        return Usage()
    details = getattr(usage, "input_tokens_details", None)
    cached = getattr(details, "cached_tokens", None) or 0
    written = getattr(details, "cache_write_tokens", None) or 0
    return Usage(
        input_tokens=max((usage.input_tokens or 0) - cached - written, 0),
        output_tokens=usage.output_tokens or 0,
        cache_read_tokens=cached,
        cache_write_tokens=written,
    )


def ask_openai(system_prompt: str, user_text: str, model: str) -> AIReply:
    """OpenAI caches a repeated prompt start by itself; the fixed
    prompt_cache_key keeps all our requests on the same cache."""
    try:
        response = get_openai_client().responses.parse(
            model=model,
            instructions=system_prompt,
            input=user_text,
            # Strict structured output: the SDK turns AIResult into a JSON
            # schema and the answer back into an AIResult (output_parsed).
            text_format=AIResult,
            # No reasoning: a small extraction, and the fastest setting.
            reasoning={"effort": "none"},
            max_output_tokens=MAX_TOKENS,
            # OpenAI keeps no copy of the request for later use.
            store=False,
            prompt_cache_key="haddak-assist",
        )
    # Most specific first. RateLimitError is a kind of APIStatusError, and a
    # timeout is a kind of APIConnectionError.
    except openai.RateLimitError as error:
        raise AIUnavailable("rate limited by the API") from error
    except openai.APIStatusError as error:
        raise AIUnavailable(f"API error {error.status_code}") from error
    except openai.APIConnectionError as error:
        raise AIUnavailable("could not reach the API") from error
    except ValueError as error:  # the JSON did not fit the schema
        raise AIUnavailable("answer did not match the schema") from error

    usage = openai_usage(response)
    # "incomplete": cut off (max_output_tokens) or filtered. A refusal gives
    # status "completed" but no parsed answer.
    if response.status != "completed" or response.output_parsed is None:
        reason = getattr(response.incomplete_details, "reason", None) or "refusal"
        raise AIUnavailable(f"no usable answer (status={response.status}, {reason})", usage)
    return AIReply(result=response.output_parsed, usage=usage, model=model)


# ---------- Google (Gemini) ----------


def gemini_usage(response) -> Usage:
    """Token counts from a Gemini response. prompt_token_count includes the
    cached tokens; thinking ("thoughts") tokens are billed as output."""
    usage = getattr(response, "usage_metadata", None)
    if usage is None:
        return Usage()
    cached = usage.cached_content_token_count or 0
    return Usage(
        input_tokens=max((usage.prompt_token_count or 0) - cached, 0),
        output_tokens=(usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0),
        cache_read_tokens=cached,
    )


def ask_gemini(system_prompt: str, user_text: str, model: str) -> AIReply:
    """Gemini caches a repeated prompt start by itself (implicit caching)."""
    config = genai_types.GenerateContentConfig(
        system_instruction=system_prompt,
        # JSON that fits AIResult's schema; checked again below.
        response_mime_type="application/json",
        response_json_schema=AIResult.model_json_schema(),
        # The lowest level Gemini 3.8 Flash accepts; it cannot be switched off.
        thinking_config=genai_types.ThinkingConfig(thinking_level=genai_types.ThinkingLevel.LOW),
        max_output_tokens=MAX_TOKENS,
    )
    try:
        response = get_gemini_client().models.generate_content(
            model=model, contents=user_text, config=config
        )
    # ClientError (4xx) and ServerError (5xx) are both APIError.
    except genai_errors.APIError as error:
        if error.code == 429:
            raise AIUnavailable("rate limited by the API") from error
        raise AIUnavailable(f"API error {error.code}") from error
    except httpx2.HTTPError as error:  # includes timeouts
        raise AIUnavailable("could not reach the API") from error

    usage = gemini_usage(response)
    candidates = response.candidates or []
    finish = candidates[0].finish_reason if candidates else None
    # No candidate: the sentence itself was blocked. MAX_TOKENS: cut off.
    # SAFETY and the other reasons: the answer was stopped.
    if finish != genai_types.FinishReason.STOP:
        name = finish.value if finish is not None else "blocked"
        raise AIUnavailable(f"no usable answer (finish_reason={name})", usage)
    try:
        result = AIResult.model_validate_json(response.text or "")
    except ValidationError as error:
        raise AIUnavailable("answer did not match the schema", usage) from error
    return AIReply(result=result, usage=usage, model=model)
