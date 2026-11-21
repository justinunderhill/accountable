"""A fresh app pointed at the same file stands in for a restart."""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.tests.conftest import LOCAL


def test_data_written_by_one_app_is_read_by_a_fresh_one(empty_db):
    with TestClient(create_app(empty_db), base_url=LOCAL) as first:
        org = first.post("/api/organizations", json={"name": "Acme Corp"}).json()
        contact = first.post("/api/contacts", json={"name": "Maria Lopez", "organization_id": org["id"]}).json()
        deal = first.post(
            "/api/deals",
            json={
                "name": "Website redesign",
                "contact_id": contact["id"],
                "organization_id": org["id"],
                "value_cents": 100,
                "close_date": "2026-12-01",
            },
        ).json()
        first.post(f"/api/deals/{deal['id']}/move", json={"stage": "won", "index": 0})

    with TestClient(create_app(empty_db), base_url=LOCAL) as second:
        kept = second.get(f"/api/deals/{deal['id']}").json()
        assert kept["stage"] == "won"
        assert kept["organization_name"] == "Acme Corp"
        assert [e["to_stage"] for e in kept["timeline"]] == ["won"]


def test_the_app_seeds_a_missing_database(tmp_path):
    path = tmp_path / "new" / "accountable.db"
    assert not path.exists()
    with TestClient(create_app(path), base_url=LOCAL) as client:
        assert path.exists()
        assert len(client.get("/api/organizations").json()) == 25
        assert len(client.get("/api/deals").json()) > 50


def test_a_failed_first_seed_is_tried_again_on_the_next_start(tmp_path, monkeypatch):
    from backend.app import main

    path = tmp_path / "accountable.db"

    def broken_seed(conn, now):
        raise RuntimeError("disk full")

    monkeypatch.setattr(main, "seed", broken_seed)
    with pytest.raises(RuntimeError):
        with TestClient(create_app(path), base_url=LOCAL):
            pass
    assert not path.exists(), "the half-made file is removed"

    monkeypatch.undo()
    with TestClient(create_app(path), base_url=LOCAL) as client:
        assert len(client.get("/api/organizations").json()) == 25


def test_the_app_leaves_an_existing_database_alone(empty_db):
    with TestClient(create_app(empty_db), base_url=LOCAL) as first:
        first.post("/api/organizations", json={"name": "Only one"})
    with TestClient(create_app(empty_db), base_url=LOCAL) as second:
        assert [o["name"] for o in second.get("/api/organizations").json()] == ["Only one"]
