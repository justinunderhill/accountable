"""Shared test setup: a temporary database per test, a fixed today, and record builders."""

from datetime import datetime
from itertools import count

import pytest
from fastapi.testclient import TestClient

from backend.app import clock, db
from backend.app.main import create_app

FIXED_NOW = datetime(2026, 11, 21, 10, 0, 0)
# The test client calls the API as localhost, like the browser does, so the host check applies.
LOCAL = "http://localhost"
TODAY = "2026-11-21"


@pytest.fixture(autouse=True)
def fixed_clock():
    clock.freeze(FIXED_NOW)
    yield
    clock.freeze(None)


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "test.db"
    monkeypatch.setenv("ACCOUNTABLE_DB_PATH", str(path))
    return path


@pytest.fixture
def empty_db(db_path):
    """An existing database file with tables but no rows, so the app doesn't seed it."""
    engine = db.make_engine(db_path)
    db.create_tables(engine)
    engine.dispose()
    return db_path


@pytest.fixture
def client(empty_db):
    with TestClient(create_app(empty_db), base_url=LOCAL) as test_client:
        yield test_client


@pytest.fixture
def engine(client):
    return client.app.state.engine


_names = count(1)


class Builders:
    """Small helpers that create records through the API and return their JSON."""

    def __init__(self, client: TestClient):
        self.client = client

    def _post(self, path: str, body: dict) -> dict:
        response = self.client.post(path, json=body)
        assert response.status_code == 201, response.text
        return response.json()

    def org(self, **fields) -> dict:
        body = {"name": f"Org {next(_names)}"} | fields
        return self._post("/api/organizations", body)

    def contact(self, **fields) -> dict:
        if "organization_id" not in fields:
            fields["organization_id"] = self.org()["id"]
        body = {"name": f"Contact {next(_names)}"} | fields
        return self._post("/api/contacts", body)

    def deal(self, **fields) -> dict:
        if "contact_id" not in fields:
            fields["contact_id"] = self.contact()["id"]
        body = {
            "name": f"Deal {next(_names)}",
            "value_cents": 1_000_000,
            "close_date": "2026-12-15",
        } | fields
        return self._post("/api/deals", body)

    def activity(self, **fields) -> dict:
        body = {
            "type": "note",
            "description": f"Activity {next(_names)}",
            "occurred_at": "2026-11-20T09:00:00",
        } | fields
        return self._post("/api/activities", body)


@pytest.fixture
def make(client) -> Builders:
    return Builders(client)
