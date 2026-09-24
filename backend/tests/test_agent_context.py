"""Workspace documents → BusinessSnapshot, server-side.

``analytics.js``'s ``buildSnapshot`` does this in the browser for
``/api/compute``, which reads no table. The agent is company-scoped and reads
the tables itself, so it needs the same mapping on this side — and the two
have to agree, because the same engines run underneath both.
"""
from __future__ import annotations

import datetime as dt

from app.services.agent_context import (
    SNAPSHOT_HORIZON_DAYS,
    Workspace,
    build_snapshot,
    cash_balance,
)

TODAY = dt.date(2026, 9, 24)


def _workspace(**overrides) -> Workspace:
    base = dict(
        company={"name": "Atlas", "cashBalance": 100_000},
        invoices=[],
        transactions=[],
        products=[],
        employees=[],
        tax_obligations=[],
        vendor_categories=[],
        as_of=TODAY,
    )
    base.update(overrides)
    return Workspace(**base)


def test_cash_balance_is_the_opening_figure_plus_every_movement():
    ws = _workspace(
        transactions=[
            {"date": "2026-09-01", "amount": 50_000, "type": "income"},
            {"date": "2026-09-02", "amount": 12_000, "type": "expense"},
        ]
    )
    assert cash_balance(ws) == 138_000


def test_a_negative_amount_is_read_by_its_type_not_its_sign():
    """The ledger records direction in `type`; a client that also signed the
    amount would otherwise double-count the minus."""
    ws = _workspace(transactions=[{"date": "2026-09-01", "amount": -5_000, "type": "expense"}])
    assert cash_balance(ws) == 95_000


def test_movements_outside_the_horizon_are_dropped():
    old = (TODAY - dt.timedelta(days=SNAPSHOT_HORIZON_DAYS + 30)).isoformat()
    ws = _workspace(
        transactions=[
            {"date": old, "amount": 1_000, "type": "income"},
            {"date": "2026-09-01", "amount": 2_000, "type": "income"},
        ]
    )
    snapshot = build_snapshot(ws)
    assert len(snapshot.transactions) == 1
    # …but the opening balance still counts them: the money did move.
    assert snapshot.cash_balance == 103_000


def test_a_future_dated_movement_is_not_treated_as_history():
    ws = _workspace(transactions=[{"date": "2027-01-01", "amount": 9_000, "type": "income"}])
    assert build_snapshot(ws).transactions == []


def test_an_unparseable_date_drops_the_row_rather_than_raising():
    ws = _workspace(transactions=[{"date": "yakında", "amount": 1_000, "type": "income"}])
    assert build_snapshot(ws).transactions == []


def test_invoice_documents_become_snapshot_records():
    ws = _workspace(
        invoices=[
            {
                "id": "i1",
                "number": "FTR-1",
                "issueDate": "2026-09-01",
                "dueDate": "2026-09-30",
                "amount": "1500.50",
                "vatAmount": "300.10",
                "vendor": "Beta",
                "status": "pending",
                "direction": "sales",
            }
        ]
    )
    invoice = build_snapshot(ws).invoices[0]
    assert invoice.id == "i1"
    assert invoice.date == dt.date(2026, 9, 1)
    assert invoice.amount == 1500.50
    assert invoice.direction == "sales"


def test_an_unrecognised_status_falls_back_to_pending():
    """The compute schema only knows three; an unknown one must not 422 the
    whole snapshot."""
    ws = _workspace(invoices=[{"id": "i", "amount": 1, "status": "iptal"}])
    assert build_snapshot(ws).invoices[0].status == "pending"


def test_an_obligation_still_inside_its_window_is_not_counted_against_the_company():
    """Neither a success nor a failure yet. Counting it as a miss would mark a
    company down for a deadline that has not arrived."""
    ws = _workspace(
        tax_obligations=[
            {"type": "kdv", "dueDate": "2026-12-26", "status": "pending"},
        ]
    )
    snapshot = build_snapshot(ws)
    assert snapshot.tax_deadlines_total == 0


def test_a_missed_deadline_counts_against_the_filing_record():
    ws = _workspace(
        tax_obligations=[{"type": "kdv", "dueDate": "2026-08-26", "status": "pending"}]
    )
    snapshot = build_snapshot(ws)
    assert (snapshot.tax_deadlines_total, snapshot.tax_deadlines_on_time) == (1, 0)


def test_sgk_is_scored_separately_from_the_rest():
    ws = _workspace(
        tax_obligations=[
            {"type": "sgk", "dueDate": "2026-08-26", "paidDate": "2026-08-20", "status": "paid"},
            {"type": "kdv", "dueDate": "2026-08-26", "paidDate": "2026-09-02", "status": "paid"},
        ]
    )
    snapshot = build_snapshot(ws)
    assert (snapshot.sgk_payments_total, snapshot.sgk_payments_on_time) == (1, 1)
    # Paid, but late.
    assert (snapshot.tax_deadlines_total, snapshot.tax_deadlines_on_time) == (1, 0)


def test_counts_report_what_the_agent_can_see():
    ws = _workspace(
        invoices=[{"id": "a"}],
        products=[{"name": "x"}, {"name": "y"}],
    )
    assert ws.counts == {
        "invoices": 1,
        "transactions": 0,
        "products": 2,
        "employees": 0,
        "taxObligations": 0,
    }
