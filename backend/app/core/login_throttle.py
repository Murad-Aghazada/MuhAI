"""A cap on password guesses at ``POST /api/auth/login``.

Before this, the endpoint answered every guess, as fast as bcrypt allowed.
Three counters now run side by side, each over a sliding 15-minute window:

* **account + IP, 5 attempts.** The one a person who mistyped their
  password meets. Five tries, then a wait of minutes, not hours.
* **account, 20 attempts, from anywhere.** The one that does not depend on
  the IP being true. Behind the production nginx it is not: nginx appends to
  the client's own ``X-Forwarded-For`` and uvicorn runs with
  ``--forwarded-allow-ips=*``, which takes the *first* entry, so a client can
  name any address it likes. Spoofing gets around the other two counters,
  never this one. The price is that someone who deliberately burns 20
  guesses on an address holds that account shut for the rest of the window;
  a lockout that ends by itself beats unlimited guessing.
* **IP, 50 attempts, across all accounts.** One client trying the same
  password against many addresses.

Attempts are counted *before* the password is checked, and a success takes
its own back out. Counting only failures would let a burst of parallel
requests all pass the check before the first failure landed, since the
route awaits the database in between. A success clears the account's
counters but only removes its own entry from the IP's, so logging into an
account you own cannot wipe out guesses made against someone else's.

The state is in process memory: no table, no migration, nothing to clean
up. Two consequences. A restart forgets it, and each uvicorn worker keeps
its own, so with ``API_WORKERS=2`` the real ceilings are twice the numbers
above. Still a hard limit, which is the point. If that ever matters, the
counters belong in Postgres.
"""
from __future__ import annotations

import math
import threading
import time
from collections import deque

WINDOW_SECONDS = 15 * 60
PER_ACCOUNT_AND_IP = 5
PER_ACCOUNT = 20
PER_IP = 50

# Keys are attacker-chosen (any email, any spoofed IP), so the tables are
# bounded: past this many keys, expired ones are dropped, then the stalest.
MAX_KEYS = 20_000


class SlidingWindow:
    """At most ``limit`` events per key within the last ``window`` seconds."""

    def __init__(self, limit: int, window: float, max_keys: int = MAX_KEYS) -> None:
        self.limit = limit
        self.window = window
        self.max_keys = max_keys
        self._events: dict[str, deque[float]] = {}

    def _live(self, key: str, now: float) -> deque[float] | None:
        events = self._events.get(key)
        if events is None:
            return None
        while events and events[0] <= now - self.window:
            events.popleft()
        if not events:
            del self._events[key]
            return None
        return events

    def retry_after(self, key: str, now: float) -> float:
        """Seconds until ``key`` may try again; 0 when it may now."""
        events = self._live(key, now)
        if events is None or len(events) < self.limit:
            return 0.0
        # The window has to slide past enough old attempts to make room.
        return events[len(events) - self.limit] + self.window - now

    def add(self, key: str, now: float) -> None:
        events = self._live(key, now)
        if events is None:
            if len(self._events) >= self.max_keys:
                self._shrink(now)
            events = self._events[key] = deque()
        events.append(now)

    def undo(self, key: str) -> None:
        """Take back the most recent event, e.g. an attempt that succeeded."""
        events = self._events.get(key)
        if events:
            events.pop()
            if not events:
                del self._events[key]

    def clear(self, key: str) -> None:
        self._events.pop(key, None)

    def _shrink(self, now: float) -> None:
        for key in list(self._events):
            self._live(key, now)
        overflow = len(self._events) - self.max_keys + 1
        if overflow > 0:
            stalest = sorted(self._events, key=lambda k: self._events[k][-1])
            for key in stalest[:overflow]:
                del self._events[key]


_lock = threading.Lock()
_account_ip = SlidingWindow(PER_ACCOUNT_AND_IP, WINDOW_SECONDS)
_account = SlidingWindow(PER_ACCOUNT, WINDOW_SECONDS)
_ip = SlidingWindow(PER_IP, WINDOW_SECONDS)


def _keys(email: str, ip: str) -> tuple[str, str, str]:
    account = email.strip().lower()
    return f"{account}|{ip}", account, ip


def begin_attempt(email: str, ip: str, *, now: float | None = None) -> int:
    """Count one attempt, or refuse it.

    Returns 0 when the attempt may go ahead (and it is now counted), or the
    whole seconds to wait when any counter is full (and nothing is counted,
    so waiting is never made longer by knocking).
    """
    now = time.monotonic() if now is None else now
    pair, account, address = _keys(email, ip)
    with _lock:
        wait = max(
            _account_ip.retry_after(pair, now),
            _account.retry_after(account, now),
            _ip.retry_after(address, now),
        )
        if wait > 0:
            return max(1, math.ceil(wait))
        _account_ip.add(pair, now)
        _account.add(account, now)
        _ip.add(address, now)
        return 0


def succeeded(email: str, ip: str) -> None:
    pair, account, address = _keys(email, ip)
    with _lock:
        _account_ip.clear(pair)
        _account.clear(account)
        _ip.undo(address)


def reset() -> None:
    """Forget everything. For tests."""
    with _lock:
        for table in (_account_ip, _account, _ip):
            table._events.clear()
