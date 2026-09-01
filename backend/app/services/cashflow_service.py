"""AI Cash Flow Forecasting (Module 5).

Pure projection engine. The route aggregates a business's known future money
movements — recurring expenses, payroll, tax deadlines, expected receivables —
into a list of dated :class:`CashFlowEvent`s; this module rolls them into a
daily balance timeline, flags days below a threshold, and emits Turkish
warnings + suggested actions.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta


@dataclass
class CashFlowEvent:
    date: date
    amount: float  # positive = inflow, negative = outflow
    label: str
    category: str


@dataclass
class ProjectionPoint:
    date: date
    inflow: float
    outflow: float
    balance: float
    below_threshold: bool


@dataclass
class CashFlowForecast:
    starting_balance: float
    threshold: float
    horizon_days: int
    points: list[ProjectionPoint] = field(default_factory=list)
    min_balance: float = 0.0
    min_balance_date: date | None = None
    runs_out: bool = False
    runs_out_date: date | None = None
    warnings: list[str] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)


def build_forecast(
    starting_balance: float,
    events: list[CashFlowEvent],
    today: date | None = None,
    horizon_days: int = 90,
    threshold: float = 0.0,
) -> CashFlowForecast:
    """Roll events into a daily balance projection over the horizon."""
    today = today or date.today()
    end = today + timedelta(days=horizon_days)

    # Bucket events by day (ignore anything outside the window).
    inflow_by_day: dict[date, float] = {}
    outflow_by_day: dict[date, float] = {}
    for ev in events:
        if ev.date < today or ev.date > end:
            continue
        if ev.amount >= 0:
            inflow_by_day[ev.date] = round(inflow_by_day.get(ev.date, 0.0) + ev.amount, 2)
        else:
            outflow_by_day[ev.date] = round(
                outflow_by_day.get(ev.date, 0.0) + (-ev.amount), 2
            )

    forecast = CashFlowForecast(
        starting_balance=round(starting_balance, 2),
        threshold=threshold,
        horizon_days=horizon_days,
    )

    balance = starting_balance
    min_balance = balance
    min_date = today
    for i in range(horizon_days + 1):
        day = today + timedelta(days=i)
        inflow = inflow_by_day.get(day, 0.0)
        outflow = outflow_by_day.get(day, 0.0)
        balance = round(balance + inflow - outflow, 2)
        below = balance < threshold
        forecast.points.append(
            ProjectionPoint(
                date=day,
                inflow=inflow,
                outflow=outflow,
                balance=balance,
                below_threshold=below,
            )
        )
        if balance < min_balance:
            min_balance = balance
            min_date = day
        if below and not forecast.runs_out:
            forecast.runs_out = True
            forecast.runs_out_date = day

    forecast.min_balance = min_balance
    forecast.min_balance_date = min_date
    _build_narrative(forecast, events, today)
    return forecast


def _build_narrative(
    forecast: CashFlowForecast, events: list[CashFlowEvent], today: date
) -> None:
    if forecast.runs_out and forecast.runs_out_date is not None:
        days = (forecast.runs_out_date - today).days
        forecast.warnings.append(
            f"{days} gün içinde nakit eşiğin altına düşebilirsiniz "
            f"({forecast.runs_out_date.isoformat()})."
        )
        # Largest upcoming outflow → suggest deferring it.
        outflows = sorted(
            (e for e in events if e.amount < 0 and today <= e.date <= (forecast.runs_out_date)),
            key=lambda e: e.amount,
        )
        if outflows:
            biggest = outflows[0]
            forecast.actions.append(
                f"'{biggest.label}' ({abs(biggest.amount):.0f} ₺) ödemesini "
                f"mümkünse erteleyin."
            )
        # Largest expected inflow → suggest accelerating collection.
        inflows = sorted(
            (e for e in events if e.amount > 0 and e.date >= today),
            key=lambda e: e.amount,
            reverse=True,
        )
        if inflows:
            top = inflows[0]
            forecast.actions.append(
                f"'{top.label}' ({top.amount:.0f} ₺) tahsilatını hızlandırın."
            )
        forecast.actions.append("Zorunlu olmayan harcamaları ve stok alımını azaltın.")
    else:
        forecast.warnings.append(
            f"Önümüzdeki {forecast.horizon_days} gün için nakit akışınız sağlıklı görünüyor."
        )
