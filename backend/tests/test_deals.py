def column(client, stage):
    pipeline = client.get("/api/pipeline").json()
    return [d["id"] for d in next(c for c in pipeline["columns"] if c["stage"] == stage)["deals"]]


def test_create_requires_a_contact(client, make):
    response = client.post("/api/deals", json={"name": "X", "value_cents": 100, "close_date": "2026-12-01"})
    assert response.status_code == 422
    assert response.json()["errors"]["contact_id"] == "Pick a main contact."

    response = client.post(
        "/api/deals", json={"name": "X", "contact_id": 999, "value_cents": 100, "close_date": "2026-12-01"}
    )
    assert response.status_code == 422
    assert response.json()["errors"]["contact_id"] == "Pick a main contact."


def test_the_organization_is_optional(client, make):
    contact = make.contact()
    deal = make.deal(contact_id=contact["id"])
    assert deal["organization_id"] is None
    assert deal["contact_name"] == contact["name"]


def test_a_new_deal_takes_its_stages_probability_and_goes_to_the_top(client, make):
    contact = make.contact()
    first = make.deal(contact_id=contact["id"], stage="qualified")
    second = make.deal(contact_id=contact["id"], stage="qualified")
    assert first["probability"] == 25 and second["probability"] == 25
    assert column(client, "qualified") == [second["id"], first["id"]]

    by_hand = make.deal(contact_id=contact["id"], stage="qualified", probability=40)
    assert by_hand["probability"] == 40
    assert by_hand["probability_by_hand"] is True
    assert first["probability_by_hand"] is False


def test_editing_other_fields_leaves_stage_probability_and_close_date_alone(client, make):
    deal = make.deal(stage="proposal", probability=60, close_date="2026-12-20")
    response = client.patch(f"/api/deals/{deal['id']}", json={"name": "Renamed", "value_cents": 4_200_000})
    body = response.json()
    assert body["name"] == "Renamed" and body["value_cents"] == 4_200_000
    assert (body["stage"], body["probability"], body["close_date"]) == ("proposal", 60, "2026-12-20")
    assert client.get(f"/api/deals/{deal['id']}").json()["timeline"] == []


def test_a_stage_change_through_patch_writes_a_stage_change_row(client, make):
    deal = make.deal(stage="proposal")
    body = client.patch(f"/api/deals/{deal['id']}", json={"stage": "negotiation"}).json()
    assert body["stage"] == "negotiation"
    assert body["probability"] == 75
    timeline = client.get(f"/api/deals/{deal['id']}").json()["timeline"]
    assert [(e["kind"], e["from_stage"], e["to_stage"]) for e in timeline] == [
        ("stage_change", "proposal", "negotiation")
    ]


def test_a_stage_change_through_patch_keeps_a_probability_sent_with_it(client, make):
    deal = make.deal(stage="proposal")
    body = client.patch(f"/api/deals/{deal['id']}", json={"stage": "negotiation", "probability": 90}).json()
    assert body["probability"] == 90


def test_patch_to_won_sets_today_unless_a_date_is_sent(client, make):
    deal = make.deal(stage="negotiation", close_date="2026-12-31")
    assert client.patch(f"/api/deals/{deal['id']}", json={"stage": "won"}).json()["close_date"] == "2026-11-21"
    other = make.deal(stage="negotiation", close_date="2026-12-31")
    body = client.patch(f"/api/deals/{other['id']}", json={"stage": "lost", "close_date": "2026-11-15"}).json()
    assert body["close_date"] == "2026-11-15"
    assert body["probability"] == 0


def test_a_stage_change_through_patch_moves_the_card_to_the_top_of_its_new_column(client, make):
    contact = make.contact()
    waiting = make.deal(contact_id=contact["id"], stage="negotiation")
    moving = make.deal(contact_id=contact["id"], stage="proposal")
    client.patch(f"/api/deals/{moving['id']}", json={"stage": "negotiation"})
    assert column(client, "negotiation") == [moving["id"], waiting["id"]]
    assert column(client, "proposal") == []


def test_delete_removes_the_deals_activities_and_stage_changes(client, make):
    deal = make.deal()
    activity = make.activity(deal_id=deal["id"])
    client.post(f"/api/deals/{deal['id']}/move", json={"stage": "qualified", "index": 0})
    impact = client.get(f"/api/deals/{deal['id']}/delete-impact").json()
    assert impact == {"name": deal["name"], "activity_count": 1, "stage_change_count": 1}

    assert client.delete(f"/api/deals/{deal['id']}").status_code == 204
    assert client.get(f"/api/deals/{deal['id']}").status_code == 404
    assert client.get(f"/api/activities/{activity['id']}").status_code == 404
    contact = client.get(f"/api/contacts/{deal['contact_id']}").json()
    assert contact["timeline"] == [], "the stage change went with the deal"


def test_delete_renumbers_the_column(client, make, engine):
    contact = make.contact()
    a = make.deal(contact_id=contact["id"])
    b = make.deal(contact_id=contact["id"])
    c = make.deal(contact_id=contact["id"])
    client.delete(f"/api/deals/{b['id']}")
    pipeline = client.get("/api/pipeline").json()
    cards = pipeline["columns"][0]["deals"]
    assert [(d["id"], d["position"]) for d in cards] == [(c["id"], 0), (a["id"], 1)]


def test_the_late_flag_in_the_list(client, make):
    contact = make.contact()
    late = make.deal(contact_id=contact["id"], close_date="2026-11-20")
    due_today = make.deal(contact_id=contact["id"], close_date="2026-11-21")
    won_long_ago = make.deal(contact_id=contact["id"], stage="won", close_date="2026-01-05")
    rows = {d["id"]: d for d in client.get("/api/deals").json()}
    assert rows[late["id"]]["late"] is True
    assert rows[due_today["id"]]["late"] is False
    assert rows[won_long_ago["id"]]["late"] is False


def test_list_has_names_and_expected_revenue(client, make):
    org = make.org(name="Acme Corp")
    contact = make.contact(name="Maria Lopez", organization_id=org["id"])
    make.deal(contact_id=contact["id"], organization_id=org["id"], value_cents=4_000_000, stage="qualified")
    (row,) = client.get("/api/deals").json()
    assert row["organization_name"] == "Acme Corp"
    assert row["contact_name"] == "Maria Lopez"
    assert row["expected_cents"] == 1_000_000


def test_list_is_sorted_by_close_date(client, make):
    contact = make.contact()
    later = make.deal(contact_id=contact["id"], close_date="2027-01-10")
    sooner = make.deal(contact_id=contact["id"], close_date="2026-12-01")
    assert [d["id"] for d in client.get("/api/deals").json()] == [sooner["id"], later["id"]]


def test_missing_deal_is_404(client):
    assert client.get("/api/deals/999").status_code == 404
    assert client.patch("/api/deals/999", json={"name": "X"}).status_code == 404
    assert client.post("/api/deals/999/move", json={"stage": "new", "index": 0}).status_code == 404
    assert client.delete("/api/deals/999").status_code == 404
