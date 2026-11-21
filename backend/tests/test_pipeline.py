import pytest


def columns(client) -> dict[str, list[int]]:
    pipeline = client.get("/api/pipeline").json()
    return {c["stage"]: [d["id"] for d in c["deals"]] for c in pipeline["columns"]}


def move(client, deal_id, stage, index):
    response = client.post(f"/api/deals/{deal_id}/move", json={"stage": stage, "index": index})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def board(make):
    """Three cards in New (a on top) and two in Qualified (d on top)."""
    contact = make.contact()
    c = make.deal(contact_id=contact["id"], stage="new", value_cents=300_000)
    b = make.deal(contact_id=contact["id"], stage="new", value_cents=200_000)
    a = make.deal(contact_id=contact["id"], stage="new", value_cents=100_000)
    e = make.deal(contact_id=contact["id"], stage="qualified", value_cents=500_000)
    d = make.deal(contact_id=contact["id"], stage="qualified", value_cents=400_000)
    return {k: v["id"] for k, v in dict(a=a, b=b, c=c, d=d, e=e).items()}


def test_every_stage_has_a_column_in_order(client):
    stages = [c["stage"] for c in client.get("/api/pipeline").json()["columns"]]
    assert stages == ["new", "qualified", "proposal", "negotiation", "won", "lost"]


def test_move_within_a_column(client, board):
    move(client, board["a"], "new", 2)
    assert columns(client)["new"] == [board["b"], board["c"], board["a"]]
    move(client, board["c"], "new", 0)
    assert columns(client)["new"] == [board["c"], board["b"], board["a"]]


def test_move_within_a_column_changes_nothing_else(client, board):
    deal = move(client, board["a"], "new", 1)
    assert deal["stage"] == "new" and deal["probability"] == 10
    assert client.get(f"/api/deals/{board['a']}").json()["timeline"] == []


def test_move_between_columns(client, board):
    deal = move(client, board["b"], "qualified", 1)
    assert deal["stage"] == "qualified"
    assert deal["probability"] == 25
    cols = columns(client)
    assert cols["new"] == [board["a"], board["c"]]
    assert cols["qualified"] == [board["d"], board["b"], board["e"]]
    timeline = client.get(f"/api/deals/{board['b']}").json()["timeline"]
    assert [(e["from_stage"], e["to_stage"]) for e in timeline] == [("new", "qualified")]


def test_positions_are_renumbered_from_zero(client, board):
    move(client, board["a"], "qualified", 99)
    pipeline = client.get("/api/pipeline").json()
    for column in pipeline["columns"]:
        assert [d["position"] for d in column["deals"]] == list(range(len(column["deals"])))


def test_moving_to_won_sets_todays_close_date_and_leaves_the_board_totals(client, board):
    before = client.get("/api/pipeline").json()["totals"]
    assert before == {"open_cents": 1_500_000, "expected_cents": 60_000 + 225_000, "open_count": 5}

    deal = move(client, board["e"], "won", 0)
    assert deal["close_date"] == "2026-11-21"
    assert deal["probability"] == 100

    after = client.get("/api/pipeline").json()
    assert after["totals"] == {"open_cents": 1_000_000, "expected_cents": 60_000 + 100_000, "open_count": 4}
    won = next(c for c in after["columns"] if c["stage"] == "won")
    assert won["count"] == 1 and won["total_cents"] == 500_000


def test_column_totals(client, board):
    pipeline = client.get("/api/pipeline").json()
    new = pipeline["columns"][0]
    assert (new["count"], new["total_cents"], new["expected_cents"]) == (3, 600_000, 60_000)
    qualified = pipeline["columns"][1]
    assert (qualified["count"], qualified["total_cents"], qualified["expected_cents"]) == (2, 900_000, 225_000)


def test_a_probability_set_by_hand_is_kept_until_the_stage_changes(client, make):
    deal = make.deal(stage="proposal", probability=40)
    assert move(client, deal["id"], "proposal", 0)["probability"] == 40
    assert move(client, deal["id"], "negotiation", 0)["probability"] == 75


def test_unknown_stage_is_422(client, board):
    response = client.post(f"/api/deals/{board['a']}/move", json={"stage": "closed", "index": 0})
    assert response.status_code == 422
    assert response.json()["errors"]["stage"] == "Pick a stage."
