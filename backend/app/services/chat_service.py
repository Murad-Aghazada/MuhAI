"""AI Business Advisor chatbot service (Module 9).

A Turkish-language CFO assistant. When a Gemini API key is configured it answers
with the live business context injected into the prompt; otherwise it falls back
to a deterministic keyword matcher (also context-aware) so the app works fully
offline and in tests.

The ``ChatBackend`` interface keeps the API contract stable across backends.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass

from app.schemas.chat import ChatResponse

SYSTEM_PROMPT = (
    "Sen Muhai'sin. Türk KOBİ'ler için yapay zeka destekli bir CFO asistanısın. "
    "Kullanıcının işletme verilerine erişimin var. Sorulara kısa, net, Türkçe "
    "cevaplar ver. Finansal tavsiyeler için her zaman hesaplamaları göster."
)

# Quick-question chips shown in the UI.
QUICK_QUESTIONS: list[str] = [
    "Bu ay ne kadar KDV ödeyeceğim?",
    "Bu ay SGK ne kadar?",
    "Kim bana borçlu?",
    "Bu çeyrekte kâr ne kadar?",
    "Yeni çalışan alabilir miyim?",
    "Hangi giderler en yüksek?",
]


@dataclass
class BusinessContext:
    monthly_revenue: float = 0.0
    monthly_expenses: float = 0.0
    cash_balance: float = 0.0
    unpaid_invoices: int = 0
    unpaid_amount: float = 0.0
    next_tax_type: str | None = None
    next_tax_amount: float = 0.0
    next_tax_date: str | None = None
    low_stock_items: list[str] | None = None
    muhai_score: int = 0

    def as_prompt_block(self) -> str:
        import json

        data = asdict(self)
        data["low_stock_items"] = self.low_stock_items or []
        return json.dumps(data, ensure_ascii=False)


# ── Deterministic fallback ─────────────────────────────────────────────
def _context_rules(ctx: BusinessContext) -> list[tuple[tuple[str, ...], str]]:
    profit = ctx.monthly_revenue - ctx.monthly_expenses
    return [
        (
            ("kdv", "vat", "katma değer"),
            f"Tahmini bu ay KDV'niz yaklaşık {ctx.next_tax_amount:,.0f} ₺. "
            "Standart KDV oranı %20'dir (gıda %10, temel mallar %1)."
            if ctx.next_tax_type == "KDV"
            else "Standart KDV oranı %20'dir. Net tutar × %20 ile hesaplanır.",
        ),
        (
            ("borçlu", "alacak", "kim bana", "tahsilat"),
            f"Şu an {ctx.unpaid_invoices} ödenmemiş faturanız var, toplam "
            f"{ctx.unpaid_amount:,.0f} ₺ alacağınız bulunuyor.",
        ),
        (
            ("kâr", "kar ", "profit", "çeyrek"),
            f"Bu ay tahmini kârınız {profit:,.0f} ₺ "
            f"(gelir {ctx.monthly_revenue:,.0f} ₺ − gider {ctx.monthly_expenses:,.0f} ₺).",
        ),
        (
            ("çalışan al", "işe al", "yeni eleman", "eleman al"),
            "Yeni çalışan kararı için nakit rezervinize ve aylık kârınıza bakın. "
            f"Mevcut nakdiniz {ctx.cash_balance:,.0f} ₺, aylık kârınız "
            f"{profit:,.0f} ₺. Bir çalışanın işverene toplam maliyeti brüt maaşın "
            "yaklaşık %22 fazlasıdır.",
        ),
        (
            ("gider", "harcama", "masraf"),
            f"Bu ay toplam gideriniz {ctx.monthly_expenses:,.0f} ₺. En yüksek gider "
            "kalemlerinizi 'Nakit Akışı' sekmesindeki kategori dağılımından görebilirsiniz.",
        ),
        (
            ("sgk", "bordro", "maaş", "prim"),
            "Net maaş = Brüt − SGK işçi payı (%14) − işsizlik (%1) − gelir vergisi − "
            "damga (%0,759). İşveren SGK payı %19,5'tir.",
        ),
        (
            ("stok", "envanter", "ürün"),
            (
                f"Düşük stoktaki ürünler: {', '.join(ctx.low_stock_items)}."
                if ctx.low_stock_items
                else "Şu an düşük stokta ürününüz yok."
            ),
        ),
        (
            ("skor", "muhai", "sağlık", "puan"),
            f"Muhai Skorunuz şu an {ctx.muhai_score}/100. Detaylı kırılımı panelde "
            "görebilirsiniz.",
        ),
    ]


_DEFAULT_REPLY = (
    "Size yardımcı olayım. KDV, SGK, kâr, gider, tahsilat, stok veya işe alım "
    "hakkında soru sorabilirsiniz."
)


class ChatBackend(ABC):
    @abstractmethod
    def reply(self, message: str, ctx: BusinessContext) -> ChatResponse:  # pragma: no cover
        ...


class RuleChatBackend(ChatBackend):
    """Context-aware keyword matcher; deterministic and offline-safe."""

    def reply(self, message: str, ctx: BusinessContext) -> ChatResponse:
        text = message.lower()
        for keywords, answer in _context_rules(ctx):
            if any(k in text for k in keywords):
                return ChatResponse(reply=answer, source="placeholder")
        return ChatResponse(reply=_DEFAULT_REPLY, source="placeholder")


class GeminiChatBackend(ChatBackend):
    """Calls Gemini with the system prompt + business context injected.

    Falls back to the rule backend on any error (missing SDK, network, quota).
    """

    def __init__(self) -> None:
        self._fallback = RuleChatBackend()

    def reply(self, message: str, ctx: BusinessContext) -> ChatResponse:
        try:
            import google.generativeai as genai

            from app.core.config import settings

            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(
                "gemini-1.5-flash",
                system_instruction=f"{SYSTEM_PROMPT}\nMevcut veriler: {ctx.as_prompt_block()}",
            )
            resp = model.generate_content(message)
            text = (getattr(resp, "text", "") or "").strip()
            if not text:
                raise ValueError("empty response")
            return ChatResponse(reply=text, source="ai")
        except Exception:
            return self._fallback.reply(message, ctx)


def _select_backend() -> ChatBackend:
    try:
        from app.core.config import settings

        if getattr(settings, "GEMINI_API_KEY", ""):
            return GeminiChatBackend()
    except Exception:
        pass
    return RuleChatBackend()


_backend: ChatBackend = _select_backend()


def get_chat_reply(message: str, ctx: BusinessContext | None = None) -> ChatResponse:
    return _backend.reply(message, ctx or BusinessContext())
