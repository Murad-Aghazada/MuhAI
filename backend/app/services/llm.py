"""The model seam — OpenAI or Gemini, chosen by configuration, never by code.

Everything that talks to a language model goes through here: the assistant
(``chat_service``), the agent loop (``agent_service``) and the expense
classifier. Those three used to each hold a Gemini URL, a Gemini payload shape
and a Gemini key header, so adding a second vendor meant editing three files
and getting the third one wrong.

Two things this module owns:

* **Which provider is live.** ``AI_PROVIDER`` picks one explicitly
  (``openai`` / ``gemini`` / ``offline``); empty auto-selects whichever key is
  present, OpenAI first. No key anywhere means no provider, and every caller
  already has an offline answer for that — a missing key is a supported
  configuration, not an error.
* **The wire format.** Gemini's ``contents``/``parts``/``functionCall`` and
  OpenAI's ``messages``/``tool_calls`` are not similar enough to paper over
  with a dict, so each gets a ``ToolSession`` that owns its own transcript and
  hands back the same provider-neutral ``Step``.

Transport is the standard library on both sides — no ``openai`` package, no
``google-generativeai`` package. That is deliberate and was learned the hard
way: the old classifier imported an SDK that was never in requirements.txt, so
its "AI" path raised ImportError on every single call and silently degraded.
Stdlib urllib cannot go missing.

Tool schemas are written once, in ``agent_tools``, in Gemini's uppercase
OpenAPI dialect; ``_openai_tools`` lower-cases them into plain JSON Schema.
Keeping one source avoids the failure where a tool gains an argument on one
vendor only.
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.config import settings

logger = logging.getLogger(__name__)

PROVIDER_OPENAI = "openai"
PROVIDER_GEMINI = "gemini"

# Stable, generally-available small models on both sides. Overridable per
# provider so a model change is an .env edit, not a deploy. The previously
# hardcoded "gemini-1.5-flash" has been retired and 404s on v1beta.
OPENAI_MODEL_DEFAULT = "gpt-4o-mini"
GEMINI_MODEL_DEFAULT = "gemini-2.5-flash"

OPENAI_BASE_URL_DEFAULT = "https://api.openai.com/v1"
_GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

DEFAULT_TIMEOUT = 20
TOOL_TIMEOUT = 45


# ── Which provider is live ────────────────────────────────────────────


def _openai_base_url() -> str:
    return (settings.OPENAI_BASE_URL or OPENAI_BASE_URL_DEFAULT).rstrip("/")


def active_provider() -> str:
    """``"openai"``, ``"gemini"`` or ``""`` for fully offline."""
    choice = (getattr(settings, "AI_PROVIDER", "") or "").strip().lower()

    if choice in {"offline", "none", "off"}:
        return ""
    if choice == PROVIDER_OPENAI:
        # A custom base URL counts as configured on its own: an OpenAI-compatible
        # gateway on the same network (Ollama, vLLM, LiteLLM) needs no key.
        configured = bool(settings.OPENAI_API_KEY) or bool(settings.OPENAI_BASE_URL)
        return PROVIDER_OPENAI if configured else ""
    if choice == PROVIDER_GEMINI:
        return PROVIDER_GEMINI if settings.GEMINI_API_KEY else ""

    # Auto. OpenAI first only because it is the one you can point somewhere
    # else; with both keys set, name the one you want.
    if settings.OPENAI_API_KEY:
        return PROVIDER_OPENAI
    if settings.GEMINI_API_KEY:
        return PROVIDER_GEMINI
    return ""


def is_online() -> bool:
    return bool(active_provider())


def active_model() -> str:
    """The model a call would use right now — reported by /agent/capabilities."""
    provider = active_provider()
    if provider == PROVIDER_OPENAI:
        return settings.OPENAI_MODEL or OPENAI_MODEL_DEFAULT
    if provider == PROVIDER_GEMINI:
        return settings.GEMINI_MODEL or GEMINI_MODEL_DEFAULT
    return "offline"


# ── Transport ─────────────────────────────────────────────────────────


def _post(url: str, payload: dict, headers: dict[str, str], timeout: int) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def _repair_openai_payload(payload: dict, detail: str) -> dict | None:
    """One model-specific fix for a 400, or None if the body names none we know.

    Reasoning models reject knobs that every other model accepts, and they only
    say so at request time — there is no capability flag to read first. Both
    repairs below are real 400s from real models, not defensive guesses:

    * ``temperature`` — refused outright by the reasoning line, which runs at a
      fixed temperature. Dropping it costs nothing: 0.3 was a preference.
    * ``reasoning_effort`` — "Function tools with reasoning_effort are not
      supported ... set reasoning_effort to 'none'". Tool use and thinking are
      exclusive on ``/v1/chat/completions``, and this agent's reasoning *is*
      the tool loop, so the answer is to turn the internal one off rather than
      to give up the tools.
    """
    if "temperature" in detail and "temperature" in payload:
        logger.info("llm: model refused temperature; retrying without it")
        return {k: v for k, v in payload.items() if k != "temperature"}
    if "reasoning_effort" in detail and payload.get("reasoning_effort") != "none":
        logger.info("llm: model refused tools with reasoning; retrying with none")
        return {**payload, "reasoning_effort": "none"}
    return None


def _openai_post(payload: dict, timeout: int) -> dict:
    url = f"{_openai_base_url()}/chat/completions"
    headers = {}
    if settings.OPENAI_API_KEY:
        headers["Authorization"] = f"Bearer {settings.OPENAI_API_KEY}"
    if settings.OPENAI_REASONING_EFFORT:
        payload = {**payload, "reasoning_effort": settings.OPENAI_REASONING_EFFORT}

    # Two attempts at most: a payload can be wrong about temperature *and*
    # about reasoning, and each 400 names only the first thing it tripped over.
    for _attempt in range(3):
        try:
            return _post(url, payload, headers, timeout)
        except urllib.error.HTTPError as exc:
            if exc.code != 400:
                raise
            detail = exc.read().decode("utf-8", "replace")
            repaired = _repair_openai_payload(payload, detail)
            if repaired is None:
                # The default HTTPError message is "Bad Request" and nothing
                # else; the body is the only place the reason exists.
                raise urllib.error.HTTPError(
                    url, exc.code, detail, exc.headers, None
                ) from exc
            payload = repaired
    raise RuntimeError("openai: could not build an acceptable request")


def _gemini_post(payload: dict, model: str, timeout: int) -> dict:
    return _post(
        _GEMINI_ENDPOINT.format(model=model),
        payload,
        # The key travels in a header, not the query string, so it stays out of
        # proxy and access logs.
        {"x-goog-api-key": settings.GEMINI_API_KEY},
        timeout,
    )


# ── One-shot completion ───────────────────────────────────────────────


def complete(
    system: str, user: str, *, temperature: float = 0.3, timeout: int = DEFAULT_TIMEOUT
) -> str:
    """One system prompt, one question, one string back.

    Raises on anything — no key, no network, empty answer. Every caller has a
    fallback and picking between "it failed" and "it said nothing useful" is
    theirs to make, not this module's.
    """
    provider = active_provider()
    if provider == PROVIDER_OPENAI:
        body = _openai_post(
            {
                "model": active_model(),
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": temperature,
            },
            timeout,
        )
        text = ((body["choices"][0]["message"].get("content")) or "").strip()
    elif provider == PROVIDER_GEMINI:
        body = _gemini_post(
            {
                "system_instruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": {"temperature": temperature},
            },
            active_model(),
            timeout,
        )
        parts = body["candidates"][0]["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts).strip()
    else:
        raise RuntimeError("no AI provider configured")

    if not text:
        raise ValueError("empty response")
    return text


# ── Tool-calling sessions ─────────────────────────────────────────────


@dataclass
class ToolCall:
    """One request from the model to run one tool."""

    name: str
    args: dict
    # OpenAI correlates results by id; Gemini correlates by name. Carried for
    # both so the result-posting code does not branch on provider again.
    id: str = ""


@dataclass
class Step:
    """What one round produced: prose, tool calls, or both."""

    text: str = ""
    calls: list[ToolCall] = field(default_factory=list)


class ToolSpec(Protocol):
    """What a session needs from ``agent_tools.Tool`` — nothing else."""

    name: str
    description: str
    parameters: dict[str, Any]


class ToolSession(ABC):
    """A live transcript. ``step`` advances it; ``add_results`` feeds it back."""

    @abstractmethod
    def step(self) -> Step:  # pragma: no cover - interface
        ...

    @abstractmethod
    def add_results(self, results: list[tuple[ToolCall, dict]]) -> None:  # pragma: no cover
        ...


_JSON_TYPES = {
    "OBJECT": "object",
    "STRING": "string",
    "NUMBER": "number",
    "INTEGER": "integer",
    "BOOLEAN": "boolean",
    "ARRAY": "array",
}


def _json_schema(node: Any) -> Any:
    """Gemini's uppercase OpenAPI dialect → the JSON Schema OpenAI expects."""
    if isinstance(node, list):
        return [_json_schema(item) for item in node]
    if not isinstance(node, dict):
        return node
    out: dict[str, Any] = {}
    for key, value in node.items():
        if key == "type" and isinstance(value, str):
            out[key] = _JSON_TYPES.get(value.upper(), value)
        elif key == "properties" and isinstance(value, dict):
            out[key] = {k: _json_schema(v) for k, v in value.items()}
        elif key in {"items", "additionalProperties"}:
            out[key] = _json_schema(value)
        else:
            out[key] = value
    return out


def _openai_tools(tools: list[ToolSpec]) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": _json_schema(tool.parameters),
            },
        }
        for tool in tools
    ]


def _gemini_declarations(tools: list[ToolSpec]) -> list[dict]:
    return [
        {
            "name": tool.name,
            "description": tool.description,
            # A no-argument tool must omit `parameters` entirely: an OBJECT
            # schema with empty `properties` is rejected by the v1beta endpoint
            # with a 400 that names no field.
            **(
                {"parameters": tool.parameters}
                if tool.parameters.get("properties")
                else {}
            ),
        }
        for tool in tools
    ]


class OpenAIToolSession(ToolSession):
    def __init__(
        self,
        system: list[str],
        history: list[dict],
        question: str,
        tools: list[ToolSpec],
        *,
        temperature: float,
        timeout: int,
    ) -> None:
        self._model = active_model()
        self._tools = _openai_tools(tools)
        self._temperature = temperature
        self._timeout = timeout
        self._messages: list[dict] = [
            {"role": "system", "content": "\n".join(system)},
            *history,
            {"role": "user", "content": question},
        ]

    def step(self) -> Step:
        body = _openai_post(
            {
                "model": self._model,
                "messages": self._messages,
                "tools": self._tools,
                "tool_choice": "auto",
                "temperature": self._temperature,
            },
            self._timeout,
        )
        try:
            choice = body["choices"][0]
        except (KeyError, IndexError, TypeError):
            logger.warning("llm: no choice in response (%s)", list(body)[:5])
            return Step()

        message = choice.get("message") or {}
        raw_calls = message.get("tool_calls") or []
        text = (message.get("content") or "").strip()
        if not text and not raw_calls:
            logger.warning(
                "llm: empty message, finish_reason=%s usage=%s",
                choice.get("finish_reason"),
                body.get("usage"),
            )
            return Step()

        calls = []
        for raw in raw_calls:
            function = raw.get("function") or {}
            try:
                args = json.loads(function.get("arguments") or "{}")
            except json.JSONDecodeError:
                # A malformed argument string is recoverable: the tool layer
                # turns an empty call into an error the model can read and fix.
                logger.warning("llm: unparseable arguments for %s", function.get("name"))
                args = {}
            calls.append(
                ToolCall(
                    name=function.get("name", ""),
                    args=args if isinstance(args, dict) else {},
                    id=raw.get("id", ""),
                )
            )

        if calls:
            # Echo the assistant turn verbatim before any result, or the next
            # round has tool messages answering calls it cannot see it made.
            self._messages.append(message)
        return Step(text=text, calls=calls)

    def add_results(self, results: list[tuple[ToolCall, dict]]) -> None:
        for call, result in results:
            self._messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result, ensure_ascii=False, default=str),
                }
            )


class GeminiToolSession(ToolSession):
    def __init__(
        self,
        system: list[str],
        history: list[dict],
        question: str,
        tools: list[ToolSpec],
        *,
        temperature: float,
        timeout: int,
    ) -> None:
        self._model = active_model()
        self._timeout = timeout
        self._base = {
            "system_instruction": {"parts": [{"text": text} for text in system]},
            "tools": [{"function_declarations": _gemini_declarations(tools)}],
            "generationConfig": {"temperature": temperature},
        }
        self._contents: list[dict] = [
            {
                "role": "model" if m.get("role") == "assistant" else "user",
                "parts": [{"text": m.get("content") or ""}],
            }
            for m in history
        ]
        self._contents.append({"role": "user", "parts": [{"text": question}]})

    def step(self) -> Step:
        body = _gemini_post(
            {**self._base, "contents": self._contents}, self._model, self._timeout
        )
        parts = self._parts_of(body)
        if not parts:
            return Step()

        calls = [
            ToolCall(name=p["functionCall"].get("name", ""), args=p["functionCall"].get("args") or {})
            for p in parts
            if "functionCall" in p
        ]
        text = "".join(p.get("text", "") for p in parts if "text" in p).strip()
        if calls:
            self._contents.append({"role": "model", "parts": parts})
        return Step(text=text, calls=calls)

    def add_results(self, results: list[tuple[ToolCall, dict]]) -> None:
        self._contents.append(
            {
                "role": "user",
                "parts": [
                    {"functionResponse": {"name": call.name, "response": result}}
                    for call, result in results
                ],
            }
        )

    @staticmethod
    def _parts_of(body: dict) -> list[dict]:
        """The candidate's parts, or [] — logging *why* when there are none.

        An empty parts list is not rare and it is never obvious from the
        outside: a MAX_TOKENS cutoff, a safety block and a plain refusal all
        look identical from here. Without ``finishReason`` in the log, all
        three present as "the agent said nothing".
        """
        try:
            candidate = body["candidates"][0]
        except (KeyError, IndexError, TypeError):
            logger.warning("llm: no candidate in response (%s)", list(body)[:5])
            return []

        parts = (candidate.get("content") or {}).get("parts") or []
        if not parts:
            logger.warning(
                "llm: empty parts, finishReason=%s usage=%s",
                candidate.get("finishReason"),
                body.get("usageMetadata"),
            )
        return parts


def tool_session(
    system: list[str],
    history: list[dict],
    question: str,
    tools: list[ToolSpec],
    *,
    temperature: float = 0.3,
    timeout: int = TOOL_TIMEOUT,
) -> ToolSession:
    """A tool-calling transcript against whichever provider is configured.

    ``history`` is ``{"role": "user"|"assistant", "content": str}``, oldest
    first — the provider-neutral shape, translated per vendor inside.
    """
    provider = active_provider()
    if provider == PROVIDER_OPENAI:
        return OpenAIToolSession(
            system, history, question, tools, temperature=temperature, timeout=timeout
        )
    if provider == PROVIDER_GEMINI:
        return GeminiToolSession(
            system, history, question, tools, temperature=temperature, timeout=timeout
        )
    raise RuntimeError("no AI provider configured")
