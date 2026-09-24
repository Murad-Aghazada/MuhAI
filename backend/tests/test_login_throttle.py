"""The login guess limit (app/core/login_throttle.py).

Pure tests on a fake clock, plus one through the route: a refused attempt is
answered before the database is touched, so it runs without one.
"""
import pytest

from app.core import login_throttle as lt


@pytest.fixture(autouse=True)
def clean():
    lt.reset()
    yield
    lt.reset()


def attempts(email, ip, n, start=0.0):
    return [lt.begin_attempt(email, ip, now=start + i) for i in range(n)]


def test_five_tries_then_a_wait():
    assert attempts("a@x.com", "1.1.1.1", 5) == [0, 0, 0, 0, 0]
    wait = lt.begin_attempt("a@x.com", "1.1.1.1", now=5)
    # The first attempt (t=0) leaves the window at t=900.
    assert wait == 900 - 5


def test_the_window_slides_open_again():
    attempts("a@x.com", "1.1.1.1", 5)
    assert lt.begin_attempt("a@x.com", "1.1.1.1", now=899) > 0
    assert lt.begin_attempt("a@x.com", "1.1.1.1", now=900) == 0


def test_a_refused_attempt_does_not_extend_the_wait():
    attempts("a@x.com", "1.1.1.1", 5)
    for t in range(10, 100):
        lt.begin_attempt("a@x.com", "1.1.1.1", now=t)
    assert lt.begin_attempt("a@x.com", "1.1.1.1", now=900) == 0


def test_email_case_and_spaces_are_one_account():
    attempts("A@X.com ", "1.1.1.1", 5)
    assert lt.begin_attempt("a@x.com", "1.1.1.1", now=6) > 0


def test_success_clears_the_account():
    attempts("a@x.com", "1.1.1.1", 4)
    lt.succeeded("a@x.com", "1.1.1.1")
    assert attempts("a@x.com", "1.1.1.1", 5, start=10) == [0] * 5


def test_changing_ip_does_not_escape_the_account_cap():
    # A spoofed X-Forwarded-For gives every guess a new address.
    for i in range(lt.PER_ACCOUNT):
        assert lt.begin_attempt("a@x.com", f"10.0.0.{i}", now=i) == 0
    assert lt.begin_attempt("a@x.com", "10.0.1.1", now=30) > 0
    # Other accounts are unaffected.
    assert lt.begin_attempt("b@x.com", "10.0.1.1", now=30) == 0


def test_one_ip_spraying_many_accounts_is_capped():
    for i in range(lt.PER_IP):
        assert lt.begin_attempt(f"user{i}@x.com", "2.2.2.2", now=i) == 0
    assert lt.begin_attempt("fresh@x.com", "2.2.2.2", now=60) > 0
    assert lt.begin_attempt("fresh@x.com", "3.3.3.3", now=60) == 0


def test_own_login_cannot_wipe_guesses_against_others():
    for i in range(lt.PER_IP - 1):
        lt.begin_attempt(f"victim{i}@x.com", "2.2.2.2", now=i)
    # The guesser logs into their own account from the same address...
    lt.begin_attempt("mine@x.com", "2.2.2.2", now=60)
    lt.succeeded("mine@x.com", "2.2.2.2")
    # ...which only takes back its own attempt: one slot left, not fifty.
    assert lt.begin_attempt("victim99@x.com", "2.2.2.2", now=61) == 0
    assert lt.begin_attempt("victim100@x.com", "2.2.2.2", now=62) > 0


def test_the_tables_stay_bounded():
    table = lt.SlidingWindow(limit=5, window=100, max_keys=50)
    for i in range(500):
        table.add(f"k{i}", now=i)
    assert len(table._events) <= 50
    # The newest keys survive.
    assert "k499" in table._events


def test_route_answers_429_with_retry_after(client):
    # Filled through the account-wide counter, which blocks whatever address
    # the request arrives from (TestClient reports none at all). The route
    # reads the real clock, so the counter is filled with it too.
    for i in range(lt.PER_ACCOUNT):
        assert lt.begin_attempt("locked@x.com", f"10.9.0.{i}") == 0

    r = client.post(
        "/api/auth/login", json={"email": "locked@x.com", "password": "whatever1"}
    )
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) > 0
    assert "dakika" in r.json()["detail"]
