"""Dashboard corrections: a month's income or expense set by hand.

The dashboard stores the difference between what the records add up to and
what the user typed as one movement in the "adjustment" category, negative
when the figure went down. These tests pin the three places that have to
let that sign through, and the one place (the expense chart) that must not.
"""
import datetime as dt

import pytest
from pydantic import ValidationError

from app.core.config import settings
from app.schemas.compute import ADJUSTMENT_CATEGORY, TxnIn
from app.services import agent_context
from app.services import compute_service as agg

AS_OF = dt.date(2026, 9, 24)


def txn(amount, type_="income", category="sales", day=10):
    return TxnIn(date=dt.date(2026, 9, day), amount=amount, type=type_, category=category)


# ── The input rule ────────────────────────────────────────────────────


def test_a_correction_may_be_negative():
    assert txn(-58_415, category=ADJUSTMENT_CATEGORY).amount == -58_415


def test_any_other_movement_still_may_not():
    with pytest.raises(ValidationError):
        txn(-100, category="sales")
    with pytest.raises(ValidationError):
        txn(-100, category=None)


# ── The sums ──────────────────────────────────────────────────────────


def test_a_negative_correction_lowers_the_month():
    rows = [txn(358_415), txn(-58_415, category=ADJUSTMENT_CATEGORY, day=24)]
    current = agg.monthly_series(rows, AS_OF)[-1]
    assert current["income"] == 300_000


def test_a_positive_correction_raises_it():
    rows = [txn(358_415), txn(41_585, category=ADJUSTMENT_CATEGORY, day=24)]
    assert agg.monthly_series(rows, AS_OF)[-1]["income"] == 400_000


def test_expense_chart_keeps_a_positive_correction_as_a_slice():
    rows = [
        txn(10_000, "expense", "rent"),
        txn(2_500, "expense", ADJUSTMENT_CATEGORY, day=24),
    ]
    keys = {r["key"]: r["value"] for r in agg.expense_breakdown(rows, AS_OF)}
    assert keys == {"rent": 10_000, ADJUSTMENT_CATEGORY: 2_500}


def test_expense_chart_drops_a_negative_bucket_it_cannot_draw():
    rows = [
        txn(10_000, "expense", "rent"),
        txn(-2_500, "expense", ADJUSTMENT_CATEGORY, day=24),
    ]
    breakdown = agg.expense_breakdown(rows, AS_OF)
    assert breakdown == [{"key": "rent", "value": 10_000}]
    assert all(r["value"] > 0 for r in breakdown)


# ── The agent's view ──────────────────────────────────────────────────


def workspace(*transactions):
    return agent_context.Workspace(
        company={"cashBalance": 0},
        transactions=list(transactions),
        as_of=AS_OF,
    )


def test_agent_sees_the_correction_with_its_sign():
    ws = workspace(
        {"date": "2026-09-10", "amount": 358_415, "type": "income", "category": "sales"},
        {"date": "2026-09-24", "amount": -58_415, "type": "income", "category": "adjustment"},
    )
    snapshot = agent_context.build_snapshot(ws)
    assert agg.monthly_series(snapshot.transactions, AS_OF)[-1]["income"] == 300_000
    assert agent_context.cash_balance(ws) == 300_000


def test_agent_still_makes_ordinary_movements_positive():
    # Unchanged behaviour: a stray negative on a normal movement is read as
    # its size, exactly as the web client posts it.
    ws = workspace({"date": "2026-09-10", "amount": -500, "type": "expense", "category": "rent"})
    snapshot = agent_context.build_snapshot(ws)
    assert snapshot.transactions[0].amount == 500


# ── Through the API ───────────────────────────────────────────────────


@pytest.fixture
def open_compute():
    original = settings.COMPUTE_AUTH_REQUIRED
    settings.COMPUTE_AUTH_REQUIRED = False
    yield
    settings.COMPUTE_AUTH_REQUIRED = original


def test_dashboard_answers_with_a_correction_in_the_snapshot(client, open_compute):
    body = client.post(
        "/api/compute/dashboard",
        json={
            "as_of": AS_OF.isoformat(),
            "transactions": [
                {"date": "2026-09-10", "amount": 358_415, "type": "income", "category": "sales"},
                {"date": "2026-09-24", "amount": -58_415, "type": "income", "category": "adjustment"},
                {"date": "2026-09-11", "amount": 20_000, "type": "expense", "category": "rent"},
            ],
        },
    )
    assert body.status_code == 200, body.text
    kpis = body.json()["kpis"]
    assert kpis["revenue"] == 300_000
    assert kpis["expense"] == 20_000


def test_dashboard_still_rejects_a_negative_ordinary_movement(client, open_compute):
    r = client.post(
        "/api/compute/dashboard",
        json={
            "as_of": AS_OF.isoformat(),
            "transactions": [
                {"date": "2026-09-10", "amount": -1, "type": "income", "category": "sales"},
            ],
        },
    )
    assert r.status_code == 422
