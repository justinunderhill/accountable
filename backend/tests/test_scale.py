"""With a few thousand rows in each table, the busiest endpoints still answer in under a second."""

import random
import time
from datetime import date, timedelta

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from backend.app import db, rules
from backend.app.main import create_app
from backend.tests.conftest import LOCAL

CONTACTS = 3_000
DEALS = 3_000
ACTIVITIES = 5_000
LIMIT_SECONDS = 1.0


def build_big_database(path) -> None:
    """A database with a few thousand rows in each table."""
    engine = db.make_engine(path)
    db.create_tables(engine)
    rng = random.Random(7)
    stamp = "2026-11-01T09:00:00"
    today = date(2026, 11, 21)
    orgs = [
        {"id": i, "name": f"Org {i}", "industry": "Technology", "created_at": stamp, "updated_at": stamp}
        for i in range(1, 301)
    ]
    contacts = [
        {
            "id": i,
            "name": f"Contact {i}",
            "email": f"c{i}@example.com",
            "organization_id": rng.randint(1, 300),
            "status": rng.choice(rules.STATUSES),
            "created_at": stamp,
            "updated_at": stamp,
        }
        for i in range(1, CONTACTS + 1)
    ]
    deals = []
    changes = []
    positions = {stage: 0 for stage in rules.STAGES}
    for i in range(1, DEALS + 1):
        stage = rng.choice(rules.STAGES)
        deals.append(
            {
                "id": i,
                "name": f"Deal {i}",
                "organization_id": rng.randint(1, 300),
                "contact_id": rng.randint(1, CONTACTS),
                "stage": stage,
                "value_cents": rng.randint(5, 150) * 100_000,
                "probability": rules.DEFAULT_PROBABILITY[stage],
                "close_date": (today + timedelta(days=rng.randint(-330, 120))).isoformat(),
                "position": positions[stage],
                "created_at": stamp,
                "updated_at": stamp,
            }
        )
        positions[stage] += 1
        if stage != "new":
            changes.append({"deal_id": i, "from_stage": "new", "to_stage": stage, "changed_at": stamp})
    activities = []
    for i in range(1, ACTIVITIES + 1):
        on_deal = i % 2 == 0
        activities.append(
            {
                "id": i,
                "type": rng.choice(rules.ACTIVITY_TYPES),
                "description": f"Activity {i}",
                "occurred_at": (today - timedelta(days=rng.randint(0, 200))).isoformat() + "T10:00:00",
                "follow_up_date": (today + timedelta(days=rng.randint(-20, 20))).isoformat() if i % 5 == 0 else None,
                "done": i % 15 == 0,
                "contact_id": None if on_deal else rng.randint(1, CONTACTS),
                "deal_id": rng.randint(1, DEALS) if on_deal else None,
                "created_at": stamp,
                "updated_at": stamp,
            }
        )
    with engine.begin() as conn:
        conn.execute(sa.insert(db.organizations), orgs)
        conn.execute(sa.insert(db.contacts), contacts)
        conn.execute(sa.insert(db.deals), deals)
        conn.execute(sa.insert(db.stage_changes), changes)
        conn.execute(sa.insert(db.activities), activities)
    engine.dispose()


@pytest.fixture(scope="module")
def big_client(tmp_path_factory):
    path = tmp_path_factory.mktemp("scale") / "big.db"
    build_big_database(path)
    with TestClient(create_app(path), base_url=LOCAL) as client:
        yield client


@pytest.mark.parametrize(
    "path",
    [
        "/api/organizations",
        "/api/contacts",
        "/api/deals",
        "/api/pipeline",
        "/api/dashboard",
        "/api/contacts/1",
        "/api/deals/1",
        "/api/organizations/1",
    ],
)
def test_answers_in_under_a_second(big_client, path):
    big_client.get(path)  # warm up
    started = time.perf_counter()
    response = big_client.get(path)
    elapsed = time.perf_counter() - started
    assert response.status_code == 200
    assert elapsed < LIMIT_SECONDS, f"{path} took {elapsed:.2f}s"


def test_a_move_in_a_big_column_is_quick(big_client):
    pipeline = big_client.get("/api/pipeline").json()
    won = next(c for c in pipeline["columns"] if c["stage"] == "won")
    assert won["count"] > 300
    deal_id = won["deals"][-1]["id"]
    started = time.perf_counter()
    response = big_client.post(f"/api/deals/{deal_id}/move", json={"stage": "won", "index": 0})
    elapsed = time.perf_counter() - started
    assert response.status_code == 200
    assert elapsed < LIMIT_SECONDS, f"the move took {elapsed:.2f}s"


def test_the_lists_hold_every_row(big_client):
    assert len(big_client.get("/api/contacts").json()) == CONTACTS
    assert len(big_client.get("/api/deals").json()) == DEALS
