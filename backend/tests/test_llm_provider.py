"""The provider seam: which vendor gets picked, and what it is handed.

No network anywhere here. The transport is stubbed at ``urlopen`` so the two
payload shapes — Gemini's ``contents``/``parts`` and OpenAI's ``messages``/
``tool_calls`` — are asserted as built, which is the half that cannot be caught
by running one vendor.
"""
from __future__ import annotations

import io
import json
import urllib.error

import pytest

from app.core.config import settings
from app.services import agent_tools, llm


@pytest.fixture(autouse=True)
def _no_keys(monkeypatch):
    """Start every test fully offline; each one sets only what it needs."""
    for name in ("AI_PROVIDER", "OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_BASE_URL",
                 "OPENAI_REASONING_EFFORT", "GEMINI_API_KEY", "GEMINI_MODEL"):
        monkeypatch.setattr(settings, name, "")


def _http_400(url: str, body: str) -> urllib.error.HTTPError:
    """A 400 whose reason is in the body, which is where the API puts it."""
    return urllib.error.HTTPError(
        url, 400, "Bad Request", {}, io.BytesIO(body.encode("utf-8"))
    )


def _capture(monkeypatch) -> list[dict]:
    """Record every request instead of sending it. Returns the calls made."""
    sent: list[dict] = []

    def fake_urlopen(request, timeout=None):
        sent.append(
            {
                "url": request.full_url,
                "headers": dict(request.headers),
                "payload": json.loads(request.data.decode("utf-8")),
            }
        )
        return io.BytesIO(
            json.dumps(
                {
                    "candidates": [{"content": {"parts": [{"text": "gemini cevabı"}]}}],
                    "choices": [{"message": {"content": "openai cevabı"}}],
                }
            ).encode("utf-8")
        )

    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda request, timeout=None: _as_context(fake_urlopen(request, timeout)),
    )
    return sent


def _as_context(buffer):
    class _Wrapped:
        def __enter__(self):
            return buffer

        def __exit__(self, *exc):
            return False

    return _Wrapped()


# ── Selection ─────────────────────────────────────────────────────────


def test_no_key_is_offline():
    assert llm.active_provider() == ""
    assert not llm.is_online()
    assert llm.active_model() == "offline"


def test_a_lone_key_selects_its_own_vendor(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "g")
    assert llm.active_provider() == llm.PROVIDER_GEMINI
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "o")
    assert llm.active_provider() == llm.PROVIDER_OPENAI


def test_ai_provider_wins_over_both_keys(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "o")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "g")
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    assert llm.active_provider() == llm.PROVIDER_GEMINI
    assert llm.active_model() == llm.GEMINI_MODEL_DEFAULT

    monkeypatch.setattr(settings, "AI_PROVIDER", "openai")
    assert llm.active_provider() == llm.PROVIDER_OPENAI
    assert llm.active_model() == llm.OPENAI_MODEL_DEFAULT


def test_offline_is_selectable_with_a_key_present(monkeypatch):
    """A venue with a dead network is a configuration, not an accident."""
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "o")
    monkeypatch.setattr(settings, "AI_PROVIDER", "offline")
    assert not llm.is_online()


def test_a_gateway_url_is_enough_without_a_key(monkeypatch):
    """A local OpenAI-compatible server (Ollama, vLLM) authenticates nothing."""
    monkeypatch.setattr(settings, "AI_PROVIDER", "openai")
    monkeypatch.setattr(settings, "OPENAI_BASE_URL", "http://localhost:11434/v1")
    assert llm.active_provider() == llm.PROVIDER_OPENAI


def test_named_provider_without_its_key_stays_offline(monkeypatch):
    """Naming a vendor you have no key for must not error mid-answer."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "g")
    monkeypatch.setattr(settings, "AI_PROVIDER", "openai")
    assert not llm.is_online()


def test_model_override(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "o")
    monkeypatch.setattr(settings, "OPENAI_MODEL", "gpt-4.1-mini")
    assert llm.active_model() == "gpt-4.1-mini"


# ── Wire format ───────────────────────────────────────────────────────


def test_openai_completion_shape(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    sent = _capture(monkeypatch)

    assert llm.complete("sistem", "soru") == "openai cevabı"

    call = sent[0]
    assert call["url"] == "https://api.openai.com/v1/chat/completions"
    # Key in the Authorization header, never the query string.
    assert call["headers"]["Authorization"] == "Bearer sk-test"
    assert "sk-test" not in call["url"]
    assert call["payload"]["messages"] == [
        {"role": "system", "content": "sistem"},
        {"role": "user", "content": "soru"},
    ]


def test_gemini_completion_shape(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "g-test")
    sent = _capture(monkeypatch)

    assert llm.complete("sistem", "soru") == "gemini cevabı"

    call = sent[0]
    assert llm.GEMINI_MODEL_DEFAULT in call["url"]
    assert call["headers"]["X-goog-api-key"] == "g-test"
    assert "g-test" not in call["url"]
    assert call["payload"]["contents"][0]["parts"][0]["text"] == "soru"


def test_a_custom_base_url_is_used(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "openai")
    monkeypatch.setattr(settings, "OPENAI_BASE_URL", "http://gateway:4000/v1/")
    sent = _capture(monkeypatch)

    llm.complete("sistem", "soru")

    assert sent[0]["url"] == "http://gateway:4000/v1/chat/completions"
    # No key configured, so no Authorization header to send.
    assert "Authorization" not in sent[0]["headers"]


# ── Model-specific 400s ───────────────────────────────────────────────
# Reasoning models reject knobs the rest accept, and only at request time.
# Measured against gpt-6-luna on 2026-09-24: plain completion answered, and the
# identical request with tools attached came back 400 "Function tools with
# reasoning_effort are not supported ... set reasoning_effort to 'none'".


def test_a_refused_temperature_is_retried_without_it(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    seen: list[dict] = []

    def fake_post(url, payload, headers, timeout):
        seen.append(payload)
        if "temperature" in payload:
            raise _http_400(url, "Unsupported value: 'temperature'")
        return _openai_response({"content": "ok"})

    monkeypatch.setattr(llm, "_post", fake_post)
    assert llm.complete("sistem", "soru") == "ok"
    assert len(seen) == 2
    assert "temperature" not in seen[1]


def test_tools_refused_over_reasoning_are_retried_with_none(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    seen: list[dict] = []

    def fake_post(url, payload, headers, timeout):
        seen.append(payload)
        if payload.get("reasoning_effort") != "none":
            raise _http_400(
                url, "Function tools with reasoning_effort are not supported"
            )
        return _openai_response({"content": "ok"})

    monkeypatch.setattr(llm, "_post", fake_post)
    session = llm.tool_session(["sistem"], [], "soru", list(agent_tools.TOOLS))
    assert session.step().text == "ok"
    assert seen[-1]["reasoning_effort"] == "none"


def test_both_refusals_are_repaired_in_turn(monkeypatch):
    """Each 400 names only the first thing it tripped over."""
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")

    def fake_post(url, payload, headers, timeout):
        if "temperature" in payload:
            raise _http_400(url, "temperature")
        if payload.get("reasoning_effort") != "none":
            raise _http_400(url, "reasoning_effort")
        return _openai_response({"content": "ok"})

    monkeypatch.setattr(llm, "_post", fake_post)
    session = llm.tool_session(["sistem"], [], "soru", list(agent_tools.TOOLS))
    assert session.step().text == "ok"


def test_an_unrecognised_400_keeps_its_body(monkeypatch):
    """HTTPError's own message is "Bad Request" — the body is the only reason."""
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")

    def fake_post(url, payload, headers, timeout):
        raise _http_400(url, "model_not_found: gpt-nope")

    monkeypatch.setattr(llm, "_post", fake_post)
    with pytest.raises(urllib.error.HTTPError) as caught:
        llm.complete("sistem", "soru")
    assert "model_not_found" in str(caught.value)


def test_a_configured_reasoning_effort_is_sent(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "OPENAI_REASONING_EFFORT", "low")
    sent = _capture(monkeypatch)
    llm.complete("sistem", "soru")
    assert sent[0]["payload"]["reasoning_effort"] == "low"


def test_complete_refuses_when_nothing_is_configured():
    with pytest.raises(RuntimeError):
        llm.complete("sistem", "soru")


# ── Tool schemas ──────────────────────────────────────────────────────


def test_openai_tools_are_lowercase_json_schema():
    tools = llm._openai_tools(list(agent_tools.TOOLS))
    assert len(tools) == len(agent_tools.TOOLS)

    def walk(node):
        if isinstance(node, dict):
            kind = node.get("type")
            if isinstance(kind, str):
                assert kind.islower(), f"{kind} is still Gemini's dialect"
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    for tool in tools:
        assert tool["type"] == "function"
        assert tool["function"]["name"]
        # Unlike Gemini, an argument-less tool keeps its empty OBJECT schema.
        assert tool["function"]["parameters"]["type"] == "object"
        walk(tool["function"]["parameters"])


def test_gemini_declarations_omit_empty_parameters():
    """An OBJECT schema with no properties is a 400 on the v1beta endpoint."""
    declarations = llm._gemini_declarations(list(agent_tools.TOOLS))
    by_name = {d["name"]: d for d in declarations}
    assert "parameters" not in by_name["get_company_profile"]
    assert by_name["list_invoices"]["parameters"]["type"] == "OBJECT"


# ── Tool sessions ─────────────────────────────────────────────────────


def _openai_response(message: dict) -> dict:
    return {"choices": [{"message": message, "finish_reason": "stop"}]}


def test_openai_session_round_trips_a_tool_call(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    payloads: list[dict] = []
    replies = [
        _openai_response(
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call_1",
                        "type": "function",
                        "function": {
                            "name": "list_invoices",
                            "arguments": '{"status": "overdue"}',
                        },
                    }
                ],
            }
        ),
        _openai_response({"role": "assistant", "content": "İki fatura gecikmiş."}),
    ]

    def fake_post(payload, timeout):
        payloads.append(payload)
        return replies[len(payloads) - 1]

    monkeypatch.setattr(llm, "_openai_post", fake_post)

    session = llm.tool_session(
        ["sistem", "tarih"], [{"role": "user", "content": "önceki"}], "soru",
        list(agent_tools.TOOLS),
    )
    step = session.step()
    assert [c.name for c in step.calls] == ["list_invoices"]
    assert step.calls[0].args == {"status": "overdue"}

    session.add_results([(step.calls[0], {"count": 2})])
    final = session.step()
    assert final.text == "İki fatura gecikmiş."
    assert not final.calls

    messages = payloads[1]["messages"]
    assert messages[0] == {"role": "system", "content": "sistem\ntarih"}
    assert messages[1] == {"role": "user", "content": "önceki"}
    assert messages[2] == {"role": "user", "content": "soru"}
    # The assistant's own turn is echoed before its result, or the model gets a
    # tool message answering a call it cannot see it made.
    assert messages[3]["tool_calls"][0]["id"] == "call_1"
    assert messages[4] == {
        "role": "tool",
        "tool_call_id": "call_1",
        "content": '{"count": 2}',
    }


def test_gemini_session_round_trips_a_tool_call(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "g-test")
    payloads: list[dict] = []
    replies = [
        {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "functionCall": {
                                    "name": "list_invoices",
                                    "args": {"status": "overdue"},
                                }
                            }
                        ]
                    }
                }
            ]
        },
        {"candidates": [{"content": {"parts": [{"text": "İki fatura gecikmiş."}]}}]},
    ]

    def fake_post(payload, model, timeout):
        payloads.append(payload)
        return replies[len(payloads) - 1]

    monkeypatch.setattr(llm, "_gemini_post", fake_post)

    session = llm.tool_session(
        ["sistem", "tarih"], [{"role": "assistant", "content": "önceki"}], "soru",
        list(agent_tools.TOOLS),
    )
    step = session.step()
    assert step.calls[0].args == {"status": "overdue"}

    session.add_results([(step.calls[0], {"count": 2})])
    assert session.step().text == "İki fatura gecikmiş."

    contents = payloads[1]["contents"]
    # "assistant" is Gemini's "model"; the history shape is vendor-neutral.
    assert contents[0]["role"] == "model"
    assert contents[-1]["parts"][0]["functionResponse"]["response"] == {"count": 2}


def test_an_empty_answer_ends_the_loop_rather_than_raising(monkeypatch):
    """A safety block, a token cutoff and a refusal all look like this."""
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(
        llm,
        "_openai_post",
        lambda payload, timeout: _openai_response({"role": "assistant", "content": ""}),
    )
    session = llm.tool_session(["sistem"], [], "soru", list(agent_tools.TOOLS))
    step = session.step()
    assert step.text == ""
    assert step.calls == []


def test_unparseable_arguments_do_not_end_the_turn(monkeypatch):
    """A malformed argument string becomes an empty call the tool layer can
    reject with a message the model reads and recovers from."""
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(
        llm,
        "_openai_post",
        lambda payload, timeout: _openai_response(
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call_1",
                        "function": {"name": "list_invoices", "arguments": "{oops"},
                    }
                ],
            }
        ),
    )
    session = llm.tool_session(["sistem"], [], "soru", list(agent_tools.TOOLS))
    step = session.step()
    assert step.calls[0].name == "list_invoices"
    assert step.calls[0].args == {}
