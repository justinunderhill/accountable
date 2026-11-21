"""The dashboard against a small hand-built dataset, with today fixed at Saturday 2026-11-21.

Deals (whole dollars):
    D1  New          10,000  close 2026-12-10
    D2  Qualified    20,000
    D3  Proposal     40,000  probability 40 set by hand, late (close 2026-11-01)
    D4  Negotiation   8,000  moved New -> Qualified -> Proposal -> Negotiation
    W1  Won          30,000  closed 2026-11-05, moved through every stage
    W2  Won          12,000  closed 2026-03-15
    W3  Won          50,000  closed 2025-11-30, outside the last 12 months
    L1  Lost         25,000  moved New -> Qualified -> Proposal -> Lost
    L2  Lost          5,000  moved New -> Lost
"""

from datetime import datetime

import pytest

from backend.app import clock

DOLLAR = 100


def move(client, deal, *stages):
    for stage in stages:
        assert client.post(f"/api/deals/{deal['id']}/move", json={"stage": stage, "index": 0}).status_code == 200


@pytest.fixture
def data(client, make):
    org = make.org()
    c1 = make.contact(organization_id=org["id"], name="Maria Lopez")
    c2 = make.contact(organization_id=org["id"])

    def deal(name, stage, dollars, **fields):
        return make.deal(name=name, contact_id=c2["id"], organization_id=org["id"], stage=stage,
                         value_cents=dollars * DOLLAR, **fields)

    d = {
        "D1": deal("D1", "new", 10_000, close_date="2026-12-10"),
        "D2": deal("D2", "qualified", 20_000),
        "D3": deal("D3", "proposal", 40_000, probability=40, close_date="2026-11-01"),
        "D4": deal("D4", "new", 8_000),
        "W1": deal("W1", "new", 30_000),
        "W2": deal("W2", "negotiation", 12_000),
        "W3": deal("W3", "negotiation", 50_000),
        "L1": deal("L1", "new", 25_000),
        "L2": deal("L2", "new", 5_000),
    }
    move(client, d["D4"], "qualified", "proposal", "negotiation")
    move(client, d["W1"], "qualified", "proposal", "negotiation", "won")
    move(client, d["W2"], "won")
    move(client, d["W3"], "won")
    move(client, d["L1"], "qualified", "proposal", "lost")
    move(client, d["L2"], "lost")
    for key, close in [("W1", "2026-11-05"), ("W2", "2026-03-15"), ("W3", "2025-11-30"), ("L1", "2026-10-10")]:
        client.patch(f"/api/deals/{d[key]['id']}", json={"close_date": close})

    f = {
        "F1": make.activity(contact_id=c1["id"], follow_up_date="2026-11-19", description="Overdue on contact"),
        "F2": make.activity(deal_id=d["D1"]["id"], follow_up_date="2026-11-14", description="Overdue on deal"),
        "F3": make.activity(contact_id=c1["id"], follow_up_date="2026-11-21", description="Due today"),
        "F4": make.activity(contact_id=c1["id"], follow_up_date="2026-11-28", description="Due in 7 days"),
        "F5": make.activity(contact_id=c1["id"], follow_up_date="2026-11-29", description="Due in 8 days"),
        "F6": make.activity(contact_id=c1["id"], follow_up_date="2026-11-10", done=True, description="Done"),
        "plain": make.activity(contact_id=c1["id"], description="No follow-up"),
    }
    return {"deals": d, "follow_ups": f, "c1": c1}


@pytest.fixture
def dash(client, data):
    return client.get("/api/dashboard").json()


def test_today(dash):
    assert dash["today"] == "2026-11-21"


def test_figures(dash):
    assert dash["figures"] == {
        "open_pipeline_cents": 78_000 * DOLLAR,
        "open_count": 4,
        "expected_cents": (1_000 + 5_000 + 16_000 + 6_000) * DOLLAR,
        "won_12m_cents": 42_000 * DOLLAR,
        "won_12m_count": 2,
        "won_this_month_cents": 30_000 * DOLLAR,
        "won_this_month_count": 1,
        "overdue_count": 2,
        "coming_up_count": 2,
    }


def test_twelve_months_including_months_with_nothing_won(dash):
    months = dash["months"]
    assert [m["month"] for m in months] == [
        "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
        "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11",
    ]
    by_month = {m["month"]: (m["revenue_cents"], m["deals"]) for m in months}
    assert by_month["2026-03"] == (12_000 * DOLLAR, 1)
    assert by_month["2026-11"] == (30_000 * DOLLAR, 1)
    assert by_month["2025-12"] == (0, 0)
    assert sum(m["deals"] for m in months) == 2


def test_months_across_a_year_boundary(client, data):
    clock.freeze(datetime(2027, 1, 15, 9, 0))
    months = client.get("/api/dashboard").json()["months"]
    assert months[0]["month"] == "2026-02" and months[-1]["month"] == "2027-01"


def test_funnel(dash):
    assert [(r["stage"], r["value_cents"] // DOLLAR, r["count"], r["percent_of_new"]) for r in dash["funnel"]] == [
        ("new", 200_000, 9, 100),
        ("qualified", 185_000, 7, 93),
        ("proposal", 165_000, 6, 83),
        ("negotiation", 100_000, 4, 50),
        ("won", 92_000, 3, 46),
    ]


def test_open_value_by_stage(dash):
    assert [(r["stage"], r["value_cents"] // DOLLAR, r["count"]) for r in dash["open_by_stage"]] == [
        ("new", 10_000, 1),
        ("qualified", 20_000, 1),
        ("proposal", 40_000, 1),
        ("negotiation", 8_000, 1),
    ]


def test_follow_up_groups_and_their_order(dash, data):
    f = data["follow_ups"]
    groups = dash["follow_ups"]
    assert [x["id"] for x in groups["overdue"]] == [f["F2"]["id"], f["F1"]["id"]]
    assert [x["id"] for x in groups["coming_up"]] == [f["F3"]["id"], f["F4"]["id"]]
    on_deal = groups["overdue"][0]
    assert on_deal["deal"] == {"id": data["deals"]["D1"]["id"], "name": "D1"} and on_deal["contact"] is None
    on_contact = groups["overdue"][1]
    assert on_contact["contact"] == {"id": data["c1"]["id"], "name": "Maria Lopez"} and on_contact["deal"] is None


def test_winning_a_deal_and_adding_a_follow_up_change_the_figures(client, make, data, dash):
    d2 = data["deals"]["D2"]
    move(client, d2, "won")
    make.activity(contact_id=data["c1"]["id"], follow_up_date="2026-11-23")
    after = client.get("/api/dashboard").json()["figures"]
    before = dash["figures"]
    assert after["won_12m_cents"] == before["won_12m_cents"] + 20_000 * DOLLAR
    assert after["won_this_month_count"] == before["won_this_month_count"] + 1
    assert after["open_pipeline_cents"] == before["open_pipeline_cents"] - 20_000 * DOLLAR
    assert after["expected_cents"] == before["expected_cents"] - 5_000 * DOLLAR
    assert after["coming_up_count"] == before["coming_up_count"] + 1


def test_marking_a_follow_up_done_takes_it_off(client, data, dash):
    f1 = data["follow_ups"]["F1"]
    client.patch(f"/api/activities/{f1['id']}", json={"done": True})
    overdue = client.get("/api/dashboard").json()["follow_ups"]["overdue"]
    assert f1["id"] not in [x["id"] for x in overdue]


def test_the_dashboard_matches_the_pipeline(client, data, dash):
    totals = client.get("/api/pipeline").json()["totals"]
    assert totals["open_cents"] == dash["figures"]["open_pipeline_cents"]
    assert totals["expected_cents"] == dash["figures"]["expected_cents"]
    assert totals["open_count"] == dash["figures"]["open_count"]


def test_recent_activity_is_the_latest_10_mixing_activities_and_stage_changes(client, make):
    org = make.org(name="Acme Corp")
    contact = make.contact(organization_id=org["id"])
    deal = make.deal(contact_id=contact["id"], organization_id=org["id"], name="Website redesign")
    for hour in range(1, 12):
        make.activity(contact_id=contact["id"], occurred_at=f"2026-11-20T{hour:02d}:00:00", description=f"At {hour}")
    clock.freeze(datetime(2026, 11, 20, 10, 30))
    move(client, deal, "qualified")
    clock.freeze(datetime(2026, 11, 20, 11, 30))
    move(client, deal, "proposal")
    clock.freeze(datetime(2026, 11, 21, 10, 0))

    recent = client.get("/api/dashboard").json()["recent"]
    assert len(recent) == 10
    assert [(e["kind"], e["at"][11:16]) for e in recent[:5]] == [
        ("stage_change", "11:30"),
        ("activity", "11:00"),
        ("stage_change", "10:30"),
        ("activity", "10:00"),
        ("activity", "09:00"),
    ]
    assert recent[0]["deal"] == {"id": deal["id"], "name": "Website redesign"}
    assert recent[0]["organization"] == {"id": org["id"], "name": "Acme Corp"}
    assert recent[1]["contact"]["id"] == contact["id"]
    assert recent[1]["organization"]["name"] == "Acme Corp"


def test_an_empty_database(client):
    dash = client.get("/api/dashboard").json()
    assert dash["figures"]["open_pipeline_cents"] == 0
    assert len(dash["months"]) == 12
    assert all(r["percent_of_new"] == 0 for r in dash["funnel"])
    assert dash["recent"] == []
