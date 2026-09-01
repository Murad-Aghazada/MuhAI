"""API-level smoke tests.

These assert the app wiring: routers mounted, prefixes correct, auth enforced.
They do not require a live database — the lifespan tolerates a failed migration.
"""


def test_root_reports_service_name(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_endpoint(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "healthy"}


def test_openapi_schema_is_served(client):
    assert client.get("/openapi.json").status_code == 200


def test_all_expected_routers_are_mounted(client):
    paths = client.get("/openapi.json").json()["paths"]
    for expected in (
        "/api/auth/login",
        "/api/invoices",
        "/api/transactions",
        "/api/employees",
        "/api/tax/kdv",
        "/api/products",
        "/api/muhai-score",
        "/api/dashboard",
        "/api/compliance/alerts",
        "/api/cashflow/forecast",
        "/api/bank-transactions",
        "/api/reminders",
        "/api/predictions/summary",
        "/api/expenses/classify",
        "/api/chat",
    ):
        assert expected in paths, f"missing route: {expected}"


def test_protected_endpoint_rejects_anonymous_request(client):
    assert client.get("/api/dashboard").status_code in (401, 403)


def test_quick_questions_are_available(client):
    r = client.get("/api/chat/quick-questions")
    # Either public, or auth-gated — both are valid wiring, but not a 404.
    assert r.status_code != 404


def test_unknown_route_is_404(client):
    assert client.get("/api/does-not-exist").status_code == 404
