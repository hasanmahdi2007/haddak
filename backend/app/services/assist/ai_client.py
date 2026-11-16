"""The one call to the Claude API, and the fixed shape the answer must have.

We use "structured output": we hand the API a JSON schema (generated from the
Pydantic classes below) and the model can only answer with JSON that fits it.
So the AI never chats; it fills in a form. The backend still checks every
value afterwards (service.py), because "fits the schema" does not mean
"makes sense" (an unknown category slug, a radius of 7 metres...).

Tests never reach the network: they replace get_client() with a fake.
"""

import logging
from dataclasses import dataclass
from typing import Literal

import anthropic
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger("haddak.assist")

# A small extraction: the answer is a few hundred tokens of JSON at most.
# If the model runs out of room the JSON is cut off and we answer
# "unavailable" rather than guess.
MAX_TOKENS = 1024
# Seconds to wait for the API. The user is waiting too; a slow answer is
# worse than falling back to a normal search.
TIMEOUT_SECONDS = 8.0
# The SDK retries a failed request (network error, 429, 5xx) this many times.
MAX_RETRIES = 1


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

    Prices from the Claude API pricing table (November 2026). Cache reads
    cost 0.1x the input price and 5-minute cache writes 1.25x. Haiku 5.5
    costs more above 100K prompt tokens; our prompt is far below that.
    """

    input_usd: float
    output_usd: float
    cache_read_usd: float
    cache_write_usd: float
    # Haiku 5.5 accepts thinking "disabled" at low effort; the 5.5 Sonnet
    # and Opus models refuse it (HTTP 400) and are sent low effort only.
    can_disable_thinking: bool


MODELS = {
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


def get_client() -> anthropic.Anthropic:
    """The Claude API client. The key comes from settings (environment / .env).

    A separate function so tests can replace it with a fake.
    """
    return anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=TIMEOUT_SECONDS,
        max_retries=MAX_RETRIES,
    )


def usage_from(response) -> Usage:
    usage = getattr(response, "usage", None)
    if usage is None:
        return Usage()
    return Usage(
        input_tokens=usage.input_tokens or 0,
        output_tokens=usage.output_tokens or 0,
        cache_read_tokens=getattr(usage, "cache_read_input_tokens", None) or 0,
        cache_write_tokens=getattr(usage, "cache_creation_input_tokens", None) or 0,
    )


def ask_model(system_prompt: str, user_text: str) -> AIReply:
    """Send one sentence; return the parsed answer or raise AIUnavailable.

    The system prompt carries a cache marker: it is the same on every request
    (rules + category list, no timestamps), so after the first request the
    API reads it from its prompt cache at a tenth of the price.
    """
    model = settings.assist_model
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
    # Most specific first. None of these messages contain the API key.
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
