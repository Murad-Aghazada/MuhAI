"""The agent loop — a model with tools, and a truthful answer when it is not there.

``/api/compute/chat`` sends one message and gets one string back. That is a
question box. This is an agent: it decides what to read, reads it, and decides
again, up to ``MAX_ROUNDS`` times, then answers from what it found.

Which vendor answers is ``services/llm``'s business, not this file's: the loop
below sees ``Step`` and ``ToolCall`` and never a ``functionCall`` or a
``tool_calls``. Transport there is the standard library — no SDK dependency, no
image rebuild for a model change, and the key never leaves the server.

The offline path is not a stub. With no key, no network or no quota, the same
question goes to ``chat_service``'s BM25 backend, which answers from the local
knowledge base and the company's live figures and returns ``source="offline"``.
What it cannot do is call tools, so an offline answer carries prose and no
charts. The UI badges it rather than pretending otherwise — a venue with a dead
network still gets a real answer, just not a reasoned one.

Three things worth knowing before changing this file:

* **Tool results are the expensive part.** Each one goes back up as prompt
  context on every subsequent round, so the caps in ``agent_tools`` matter more
  than the round limit does.
* **The loop must terminate on its own budget.** A model that keeps calling
  tools is not an error state, it is a Tuesday. ``MAX_ROUNDS`` is the backstop,
  and hitting it answers with what has been gathered rather than erroring.
* **A failed tool returns an error to the model, not an exception to the user.**
  A mistyped argument is recoverable — the model reads the message and calls
  again.
"""
from __future__ import annotations

import datetime as dt
import logging
import time
import urllib.error
from dataclasses import dataclass, field

from app.services import agent_tools, llm
from app.services.agent_context import Workspace, cash_balance
from app.services.chat_service import BusinessContext, get_chat_reply
from app.services import compute_service as agg
from app.services.muhai_score_service import compute_muhai_score
from app.services.tax_calendar import upcoming_deadlines
from app.services.tax_service import VAT_STANDARD, calc_kdv

logger = logging.getLogger(__name__)

# Measured, not guessed. Six was the first number here and a full quarterly
# report blew straight through it: the model does *not* batch its render calls
# the way it batches reads — it writes a heading, looks at the data, draws a
# chart, writes the next heading, one round each. That report took 14. Twelve
# rounds of a five-section report is roughly 12 seconds, which is the ceiling
# anyone will sit through anyway, and the budget is a backstop rather than a
# target: a one-figure question still answers in two.
MAX_ROUNDS = 16
# How many earlier turns ride along. Ten turns of an accounting conversation is
# well inside the context window and is more history than anyone refers back to.
MAX_HISTORY_TURNS = 10

SYSTEM_PROMPT = """\
Sen Muhai'sin — Türk KOBİ'leri için çalışan bir finans ve muhasebe asistanısın.
Kullanıcı bu işletmenin sahibi ya da mali işler sorumlusu. Türkçe konuş.

VERİ
- İşletmenin tüm verisine araçlarla erişebilirsin: faturalar, kasa hareketleri,
  stok, çalışanlar, vergi yükümlülükleri, hesaplanmış analizler.
- Erişimin SALT OKUNURDUR. Hiçbir kaydı değiştiremez, silemez, ekleyemezsin.
  Kullanıcı bir şeyin değiştirilmesini isterse, hangi ekrandan yapacağını söyle.
- Rakam uydurma. Bir sayıyı söylemeden önce onu bir araçtan al. Veri yoksa
  "bu konuda kayıt yok" de — tahmin etme.
- Bugünün tarihi araçlardan gelir; kendi tarih varsayımını kullanma.

NASIL CEVAP VERİRSİN
- Önce soruyu cevapla, sonra gerekiyorsa gerekçesini açıkla. Uzun giriş yapma.
- Parayı Türk biçiminde yaz: 1.240.500 ₺.
- Bir iddia bir hesaba dayanıyorsa hesabı göster (ör. "412.000 − townsend
  318.000 = 94.000 ₺").
- Kısa soruya kısa cevap. Grafik ve tabloyu sadece gerçekten okunacaksa çiz.

GÖRSELLEŞTİRME
Metin tek başına yeterli değilse çiz. Üç kural, sırayla uygula:
- Cevapta üç veya daha fazla rakam varsa show_kpis çağır ve o rakamları
  şeride koy. Aynı rakamları metinde bir daha saymana gerek yok.
- Cevapta aylara/günlere yayılan bir seri varsa show_chart çağır
  (zaman serisi line veya area, karşılaştırma bar, pay dağılımı donut).
- Üçten fazla satırlık bir döküm varsa show_table çağır — fatura listesi,
  bordro, kategori kırılımı, cari listesi.
- show_callout: tek bir uyarı. Bir cevapta en fazla bir tane.
Tek bir rakam soran kısa soruda ("kasada ne kadar var?") hiçbir şey çizme.
Eksen etiketlerini insan gibi yaz: "2026-04" değil "Nis 2026"; "raw_material"
değil "Hammadde".

RAPOR
Kullanıcı rapor, PDF veya özet dokümanı isterse:
  1. Gerekli veriyi baştan oku (financial_summary, expense_breakdown,
     tax_summary, muhai_score…). Hepsini tek seferde çağır.
  2. Raporu bölüm bölüm çiz: her bölüm için show_heading, sonra o bölümün
     show_text / show_kpis / show_chart / show_table çağrıları.
  3. create_report'u bir kez çağır ve rapora bir ad ver. Sırası önemli
     değil; o turda çizilen her blok rapora girer.
- Aynı turda birden fazla aracı aynı anda çağırabilirsin; bunu kullan.
- Sonunda tek bir cümle yaz ("Rapor hazır, sağ panelde."). Raporun içeriğini
  sohbet metnine tekrar yazma.
"""


@dataclass
class AgentTurn:
    """What one question produced."""

    reply: str
    source: str = "ai"
    blocks: list[dict] = field(default_factory=list)
    tool_calls: list[dict] = field(default_factory=list)
    reports: list[dict] = field(default_factory=list)


# ── Offline context ───────────────────────────────────────────────────


def offline_context(workspace: Workspace) -> BusinessContext:
    """The live-figures block the offline backend answers from.

    Built here rather than in the route because the offline path has to stay
    exactly as useful as it is on ``/api/compute/chat`` — the difference
    between the two paths must be the reasoning, never the data.
    """
    from app.services.agent_context import build_snapshot

    snapshot = build_snapshot(workspace)
    as_of = workspace.as_of
    series = agg.monthly_series(snapshot.transactions, as_of)
    current = series[-1] if series else {"income": 0.0, "expense": 0.0}
    rollup = agg.invoice_rollup(snapshot.invoices, as_of)
    deadlines = upcoming_deadlines(as_of, count=1)
    deadline = deadlines[0] if deadlines else None

    collected = calc_kdv(current["income"], VAT_STANDARD, inclusive=True).kdv
    paid = calc_kdv(current["expense"], VAT_STANDARD, inclusive=True).kdv

    return BusinessContext(
        monthly_revenue=current["income"],
        monthly_expenses=current["expense"],
        cash_balance=cash_balance(workspace),
        unpaid_invoices=rollup["overdue_count"],
        unpaid_amount=rollup["receivables"],
        next_tax_type=deadline.name if deadline else None,
        next_tax_amount=round(max(collected - paid, 0.0), 2),
        next_tax_date=deadline.due_date.isoformat() if deadline else None,
        low_stock_items=[
            p.name for p in snapshot.products if p.stock <= p.min_stock
        ],
        muhai_score=compute_muhai_score(agg.score_inputs(snapshot, as_of)).total_score,
    )


def _offline_turn(question: str, workspace: Workspace) -> AgentTurn:
    reply = get_chat_reply(question, offline_context(workspace))
    return AgentTurn(reply=reply.reply, source="offline")


# ── The loop ──────────────────────────────────────────────────────────


def _replayed_history(history: list[dict]) -> list[dict]:
    """Prior turns, trimmed.

    Only the prose is replayed. Tool calls and their results are deliberately
    left out: they were answered in their own turn, they are the bulkiest thing
    in a transcript, and replaying them invites the model to cite a figure that
    has since changed. If it needs the number again it can call the tool again —
    and then it is current.
    """
    return [
        {"role": message.get("role", "user"), "content": text}
        for message in history[-MAX_HISTORY_TURNS * 2 :]
        if (text := (message.get("content") or "").strip())
    ]


def _run_model(
    question: str, history: list[dict], ctx: agent_tools.ToolContext
) -> AgentTurn:
    session = llm.tool_session(
        [SYSTEM_PROMPT, f"Bugünün tarihi: {ctx.as_of.isoformat()}."],
        _replayed_history(history),
        question,
        list(agent_tools.TOOLS),
    )

    trace: list[dict] = []
    reply_parts: list[str] = []

    for _round in range(MAX_ROUNDS):
        step = session.step()
        if step.text:
            reply_parts.append(step.text)
        if not step.calls:
            break

        results = []
        for call in step.calls:
            started = time.monotonic()
            result = agent_tools.call(call.name, call.args, ctx)
            trace.append(
                {
                    "name": call.name,
                    "args": call.args,
                    "summary": agent_tools.summarise(call.name, result),
                    "ms": int((time.monotonic() - started) * 1000),
                    "ok": "error" not in result,
                }
            )
            results.append((call, result))

        session.add_results(results)
    else:
        logger.warning("agent: hit the %s-round tool budget", MAX_ROUNDS)

    ctx.finish()

    reply = "\n\n".join(reply_parts).strip()
    if not reply:
        # The model drew something and said nothing — which happens when the
        # whole answer was a report. Leaving the bubble empty looks broken.
        reply = (
            "Rapor hazır — sağdaki panelde açabilirsiniz."
            if ctx.reports
            else "İstediğiniz sonuçlar aşağıda."
            if ctx.inline
            else "Bu soruya bir cevap üretemedim. Başka türlü sorabilir misiniz?"
        )

    return AgentTurn(
        reply=reply,
        source="ai",
        blocks=ctx.inline,
        tool_calls=trace,
        reports=ctx.reports,
    )


# ── Entry point ───────────────────────────────────────────────────────


def run_turn(question: str, history: list[dict], workspace: Workspace) -> AgentTurn:
    """Answer one question against one company's data.

    ``history`` is the conversation so far, oldest first, as
    ``{"role": "user"|"assistant", "content": str}``.
    """
    if not llm.is_online():
        return _offline_turn(question, workspace)

    provider = llm.active_provider()
    ctx = agent_tools.ToolContext(workspace=workspace)
    try:
        return _run_model(question, history, ctx)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        logger.warning("agent: %s unreachable (%s); answering offline", provider, exc)
    except Exception as exc:  # bad key, quota, schema rejection
        logger.warning("agent: %s call failed (%s); answering offline", provider, exc)

    # Anything the model managed to draw before it failed is thrown away on
    # purpose: half a report with no prose around it is worse than a plain
    # offline answer that is complete.
    return _offline_turn(question, workspace)


def title_for(question: str, limit: int = 60) -> str:
    """A thread title from its first question — no second model call for it.

    Asking the model to name the conversation would double the latency of the very
    first message, which is the one that decides whether the thing feels fast.
    """
    text = " ".join((question or "").split())
    if not text:
        return "Yeni sohbet"
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0] + "…"


def today() -> dt.date:
    return dt.date.today()
