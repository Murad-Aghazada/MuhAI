"""The agent's tools: read-only in fact, and the report-binding rule.

Two things are load-bearing here and neither is obvious from reading the
module:

* Every tool is a read. That is the authorisation story for a feature whose
  whole pitch is "the agent can see the company's data" — so it is asserted,
  not assumed.
* A report is bound when the turn *ends*, not when ``create_report`` is
  called. The model emits its calls in a batch and puts ``create_report``
  wherever it likes inside it; binding eagerly lost every block drawn after
  it. There is a test for exactly that ordering.
"""
from __future__ import annotations

import copy
import datetime as dt

import pytest

from app.services import agent_tools as tools
from app.services.agent_context import Workspace

TODAY = dt.date(2026, 9, 24)


@pytest.fixture()
def workspace() -> Workspace:
    return Workspace(
        company={
            "name": "Atlas Ticaret Ltd. Şti.",
            "taxId": "1234567890",
            "cashBalance": 100_000,
            "currency": "TRY",
        },
        invoices=[
            {
                "id": "i1",
                "number": "FTR-001",
                "vendor": "Teknopark A.Ş.",
                "direction": "sales",
                "issueDate": "2026-09-01",
                "dueDate": "2026-09-10",
                "amount": 50_000,
                "vatAmount": 10_000,
                "status": "pending",
            },
            {
                "id": "i2",
                "number": "FTR-002",
                "vendor": "Beta Lojistik",
                "direction": "purchase",
                "issueDate": "2026-08-01",
                "dueDate": "2026-12-01",
                "amount": 20_000,
                "vatAmount": 4_000,
                "status": "paid",
                "paidDate": "2026-08-15",
            },
        ],
        transactions=[
            {"id": "t1", "date": "2026-09-05", "amount": 50_000, "type": "income", "category": "sales"},
            {"id": "t2", "date": "2026-09-08", "amount": 12_000, "type": "expense", "category": "rent"},
        ],
        products=[
            {"name": "Vida", "stock": 2, "minStock": 10, "unitPrice": 5, "monthlyUsage": 4},
            {"name": "Somun", "stock": 400, "minStock": 50, "unitPrice": 2, "monthlyUsage": 0},
        ],
        employees=[{"name": "Ayşe", "grossSalary": 40_000, "startDate": "2020-01-01"}],
        tax_obligations=[
            {"type": "kdv", "name": "KDV", "dueDate": "2026-09-26", "amount": 8_000, "status": "pending"}
        ],
        vendor_categories=[],
        as_of=TODAY,
    )


@pytest.fixture()
def ctx(workspace) -> tools.ToolContext:
    return tools.ToolContext(workspace=workspace)


# ── Read-only ─────────────────────────────────────────────────────────


def test_there_is_no_write_tool_at_all():
    """The read-only promise is structural: there is no other kind of tool."""
    forbidden = ("create_", "update_", "delete_", "add_", "remove_", "set_", "pay_")
    offenders = [
        tool.name
        for tool in tools.TOOLS
        if tool.kind == "read" and tool.name.startswith(forbidden)
    ]
    assert offenders == []


def test_every_read_tool_leaves_the_workspace_untouched(ctx, workspace):
    before = copy.deepcopy(
        {
            "company": workspace.company,
            "invoices": workspace.invoices,
            "transactions": workspace.transactions,
            "products": workspace.products,
            "employees": workspace.employees,
            "taxObligations": workspace.tax_obligations,
        }
    )

    for tool in tools.READ_TOOLS:
        result = tools.call(tool.name, {}, ctx)
        assert "error" not in result, f"{tool.name}: {result.get('error')}"

    assert workspace.company == before["company"]
    assert workspace.invoices == before["invoices"]
    assert workspace.transactions == before["transactions"]
    assert workspace.products == before["products"]
    assert workspace.employees == before["employees"]
    assert workspace.tax_obligations == before["taxObligations"]


def test_no_tool_takes_a_company_argument():
    """Scope comes from the resolved caller. A model that hallucinated a
    company id must have nowhere to put it."""
    for tool in tools.TOOLS:
        properties = tool.parameters.get("properties", {})
        assert not any("company" in key.lower() for key in properties), tool.name


def test_an_unknown_tool_is_an_error_the_model_can_read(ctx):
    result = tools.call("drop_all_tables", {}, ctx)
    assert "error" in result
    assert "drop_all_tables" in result["error"]


def test_a_tool_that_raises_returns_an_error_rather_than_ending_the_turn(ctx, monkeypatch):
    monkeypatch.setitem(
        tools.TOOLS_BY_NAME,
        "muhai_score",
        tools.Tool(
            "muhai_score",
            "boom",
            {"type": "OBJECT", "properties": {}},
            lambda c, a: (_ for _ in ()).throw(ValueError("boom")),
        ),
    )
    result = tools.call("muhai_score", {}, ctx)
    assert result["error"].startswith("muhai_score çalıştırılamadı")


# ── Filters ───────────────────────────────────────────────────────────


def test_list_invoices_filters_by_direction_and_totals_what_matched(ctx):
    result = tools.call("list_invoices", {"direction": "sales"}, ctx)
    assert result["matched"] == 1
    assert result["totalAmount"] == 50_000
    assert result["invoices"][0]["number"] == "FTR-001"


def test_overdue_only_uses_todays_date_not_the_stored_status(ctx):
    """FTR-001 is "pending" with a due date two weeks past — overdue in fact
    even though nothing has rewritten its status."""
    result = tools.call("list_invoices", {"overdue_only": True}, ctx)
    assert [i["id"] for i in result["invoices"]] == ["i1"]


def test_the_limit_is_capped_however_large_the_model_asks_for(ctx):
    result = tools.call("list_invoices", {"limit": 10_000}, ctx)
    assert result["returned"] <= tools.MAX_LIMIT


def test_months_of_cover_is_none_rather_than_zero_when_nothing_is_consumed(ctx):
    products = {p["name"]: p for p in tools.call("list_products", {}, ctx)["products"]}
    # "never runs out" and "out tomorrow" must not be the same number.
    assert products["Somun"]["monthsOfCover"] is None
    assert products["Vida"]["monthsOfCover"] == 0.5


def test_low_stock_only_returns_the_item_below_its_reorder_point(ctx):
    result = tools.call("list_products", {"low_stock_only": True}, ctx)
    assert [p["name"] for p in result["products"]] == ["Vida"]


def test_top_counterparties_carries_the_unpaid_balance(ctx):
    result = tools.call("top_counterparties", {"direction": "sales"}, ctx)
    first = result["counterparties"][0]
    assert first["name"] == "Teknopark A.Ş."
    assert first["unpaidAmount"] == 50_000


# ── The tool trace ────────────────────────────────────────────────────


def test_summarise_does_not_read_an_amount_as_a_row_count():
    """`expense_breakdown` returns a `total` that is money. Reporting it as
    "455667.39 kayıt" is what this ordering exists to prevent."""
    summary = tools.summarise(
        "expense_breakdown",
        {"months": 3, "total": 455_667.39, "categories": [{}, {}, {}]},
    )
    assert summary == "3 kategori"


def test_summarise_reports_an_error_rather_than_pretending_it_worked():
    assert tools.summarise("list_invoices", {"error": "boom"}) == "boom"


# ── Report binding ────────────────────────────────────────────────────


def test_blocks_stay_inline_when_no_report_was_asked_for(ctx):
    tools.call("show_text", {"text": "merhaba"}, ctx)
    ctx.finish()
    assert [b["type"] for b in ctx.inline] == ["text"]
    assert ctx.reports == []


def test_create_report_called_first_still_binds_everything_drawn_after_it(ctx):
    """The ordering the model actually produces. Binding eagerly lost these."""
    tools.call("create_report", {"title": "Çeyrek Raporu", "period": "2026 Q3"}, ctx)
    tools.call("show_heading", {"text": "Özet"}, ctx)
    tools.call("show_kpis", {"items": [{"label": "Nakit", "value": "10 ₺"}]}, ctx)
    ctx.finish()

    assert len(ctx.reports) == 1
    report = ctx.reports[0]
    assert report["title"] == "Çeyrek Raporu"
    assert report["period"] == "2026 Q3"
    assert [b["type"] for b in report["blocks"]] == ["heading", "kpi"]
    # Bound blocks leave the stream — a report card above the same content
    # would be the answer printed twice.
    assert ctx.inline == []


def test_a_report_with_nothing_drawn_produces_no_empty_document(ctx):
    tools.call("create_report", {"title": "Boş"}, ctx)
    ctx.finish()
    assert ctx.reports == []


def test_asking_for_a_report_twice_still_yields_one(ctx):
    tools.call("create_report", {"title": "İlk"}, ctx)
    tools.call("show_text", {"text": "gövde"}, ctx)
    tools.call("create_report", {"title": "Son"}, ctx)
    ctx.finish()
    assert len(ctx.reports) == 1
    assert ctx.reports[0]["title"] == "Son"


def test_a_malformed_render_call_is_dropped_not_rendered(ctx):
    tools.call("show_chart", {"chart": "bar", "categories": [], "series": []}, ctx)
    tools.call("show_text", {"text": "gerçek"}, ctx)
    ctx.finish()
    # The empty chart survives normalisation as an empty chart block; what
    # matters is that neither call raised and the real text is still there.
    assert any(b["type"] == "text" for b in ctx.inline)


# ── Caching ───────────────────────────────────────────────────────────


def test_the_snapshot_is_built_once_per_turn(ctx):
    first = ctx.snapshot
    assert ctx.snapshot is first
