from collections import Counter
from datetime import date, datetime

import pytest
import sqlalchemy as sa

from backend.app import db, rules
from backend.app.seed import build, reset_database
from backend.tests.conftest import FIXED_NOW


def dump(path) -> dict[str, list[tuple]]:
    engine = db.make_engine(path)
    with engine.connect() as conn:
        result = {
            table.name: [tuple(row) for row in conn.execute(sa.select(table).order_by(table.c.id))]
            for table in db.metadata.sorted_tables
        }
    engine.dispose()
    return result


@pytest.fixture(scope="module")
def rows():
    return build(FIXED_NOW)


def test_the_seed_runs_twice_with_identical_results(tmp_path):
    path = tmp_path / "seed.db"
    reset_database(path, FIXED_NOW)
    first = dump(path)
    reset_database(path, FIXED_NOW)
    assert dump(path) == first
    assert len(first["deals"]) > 0


def test_sizes(rows):
    assert 20 <= len(rows["organizations"]) <= 30
    assert 70 <= len(rows["contacts"]) <= 90
    assert 60 <= len(rows["deals"]) <= 80
    assert len(rows["activities"]) >= 240


def test_every_stage_status_and_activity_type_is_present(rows):
    assert {d["stage"] for d in rows["deals"]} == set(rules.STAGES)
    assert {c["status"] for c in rows["contacts"]} == set(rules.STATUSES)
    assert {a["type"] for a in rows["activities"]} == set(rules.ACTIVITY_TYPES)


def test_statuses_are_roughly_40_25_35(rows):
    counts = Counter(c["status"] for c in rows["contacts"])
    total = len(rows["contacts"])
    assert abs(counts["lead"] / total - 0.40) < 0.05
    assert abs(counts["qualified"] / total - 0.25) < 0.05
    assert abs(counts["customer"] / total - 0.35) < 0.05


def test_there_are_late_deals_overdue_follow_ups_and_follow_ups_coming_up(rows):
    today = FIXED_NOW.date()
    late = [d for d in rows["deals"] if rules.is_late(d["stage"], d["close_date"], today)]
    assert 4 <= len(late) <= 5
    states = Counter(rules.follow_up_state(a["follow_up_date"], a["done"], today) for a in rows["activities"])
    assert states["overdue"] == 6
    assert states["coming_up"] == 15
    assert states["done"] == 10


def test_every_month_of_the_last_12_has_a_win(rows):
    today = FIXED_NOW.date()
    months = {d["close_date"][:7] for d in rows["deals"] if d["stage"] == "won"}
    for back in range(12):
        year, month = today.year, today.month - back
        if month < 1:
            year, month = year - 1, month + 12
        assert f"{year}-{month:02d}" in months
    assert all(d["close_date"] <= today.isoformat() for d in rows["deals"] if d["stage"] == "won")


def test_every_deal_has_a_stage_history_that_fits_its_stage(rows):
    history: dict[int, list[dict]] = {}
    for change in sorted(rows["stage_changes"], key=lambda c: (c["changed_at"], c["id"])):
        history.setdefault(change["deal_id"], []).append(change)
    for deal in rows["deals"]:
        steps = history.get(deal["id"], [])
        if deal["stage"] == "new":
            assert steps == []
            continue
        assert steps, f"{deal['name']} has no stage history"
        assert steps[0]["from_stage"] == "new"
        assert steps[-1]["to_stage"] == deal["stage"]
        for earlier, later in zip(steps, steps[1:]):
            assert earlier["to_stage"] == later["from_stage"]


def test_closed_deals_closed_when_they_moved_to_won_or_lost(rows):
    last_change = {}
    for change in rows["stage_changes"]:
        last_change[change["deal_id"]] = max(last_change.get(change["deal_id"], ""), change["changed_at"])
    for deal in rows["deals"]:
        if deal["stage"] in rules.CLOSED_STAGES:
            assert last_change[deal["id"]][:10] == deal["close_date"]


def test_deal_values_are_between_5000_and_150000_dollars(rows):
    assert all(500_000 <= d["value_cents"] <= 15_000_000 for d in rows["deals"])
    assert all(d["value_cents"] % 50_000 == 0 for d in rows["deals"]), "values are round-ish"


def test_a_handful_of_probabilities_are_set_by_hand(rows):
    by_hand = [d for d in rows["deals"] if d["probability"] != rules.DEFAULT_PROBABILITY[d["stage"]]]
    assert 3 <= len(by_hand) <= 6


def test_two_organizations_have_no_deals(rows):
    with_deals = {d["organization_id"] for d in rows["deals"]}
    assert len([o for o in rows["organizations"] if o["id"] not in with_deals]) == 2


def test_nothing_happens_after_now(rows):
    now = FIXED_NOW.isoformat()
    assert all(a["occurred_at"] <= now for a in rows["activities"])
    assert all(c["changed_at"] <= now for c in rows["stage_changes"])


def test_positions_number_each_column_from_zero(rows):
    for stage in rules.STAGES:
        positions = sorted(d["position"] for d in rows["deals"] if d["stage"] == stage)
        assert positions == list(range(len(positions)))


def test_the_seed_follows_the_day_it_runs():
    later = build(datetime(2027, 3, 2, 9, 30))
    today = date(2027, 3, 2)
    late = [d for d in later["deals"] if rules.is_late(d["stage"], d["close_date"], today)]
    assert late
    assert max(d["close_date"] for d in later["deals"] if d["stage"] == "won") <= "2027-03-02"
