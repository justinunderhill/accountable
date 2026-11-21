import pytest


def test_on_a_contact_or_on_a_deal(make):
    contact = make.contact()
    deal = make.deal()
    on_contact = make.activity(contact_id=contact["id"], type="call")
    on_deal = make.activity(deal_id=deal["id"], type="email")
    assert (on_contact["contact_id"], on_contact["deal_id"]) == (contact["id"], None)
    assert (on_deal["contact_id"], on_deal["deal_id"]) == (None, deal["id"])
    assert on_contact["done"] is False and on_contact["follow_up_date"] is None


def test_neither_or_both_is_422(client, make):
    contact = make.contact()
    deal = make.deal()
    base = {"type": "note", "description": "Hello", "occurred_at": "2026-11-20T09:00:00"}

    response = client.post("/api/activities", json=base)
    assert response.status_code == 422
    assert response.json()["errors"]["contact_id"] == "Link the activity to a contact or a deal."

    response = client.post("/api/activities", json=base | {"contact_id": contact["id"], "deal_id": deal["id"]})
    assert response.status_code == 422
    assert response.json()["errors"]["contact_id"] == "Link the activity to a contact or a deal, not both."


def test_edit_including_done(client, make):
    activity = make.activity(contact_id=make.contact()["id"], follow_up_date="2026-11-24")
    response = client.patch(
        f"/api/activities/{activity['id']}",
        json={"description": "Call back about pricing", "type": "call", "done": True},
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["description"], body["type"], body["done"]) == ("Call back about pricing", "call", True)
    assert body["follow_up_date"] == "2026-11-24"

    body = client.patch(f"/api/activities/{activity['id']}", json={"done": False}).json()
    assert body["done"] is False

    body = client.patch(f"/api/activities/{activity['id']}", json={"follow_up_date": None}).json()
    assert body["follow_up_date"] is None


def test_occurred_at_accepts_minutes_and_is_stored_to_the_second(make):
    activity = make.activity(contact_id=make.contact()["id"], occurred_at="2026-11-19T14:30")
    assert activity["occurred_at"] == "2026-11-19T14:30:00"


def test_delete(client, make):
    activity = make.activity(contact_id=make.contact()["id"])
    assert client.delete(f"/api/activities/{activity['id']}").status_code == 204
    assert client.get(f"/api/activities/{activity['id']}").status_code == 404
    assert client.delete(f"/api/activities/{activity['id']}").status_code == 404


@pytest.mark.parametrize(
    ("follow_up", "done", "group"),
    [
        ("2026-11-20", False, "overdue"),
        ("2026-11-21", False, "coming_up"),
        ("2026-11-28", False, "coming_up"),
        ("2026-11-29", False, None),
        ("2026-11-18", True, None),
    ],
)
def test_follow_up_states_on_the_dashboard(client, make, follow_up, done, group):
    activity = make.activity(contact_id=make.contact()["id"], follow_up_date=follow_up, done=done)
    follow_ups = client.get("/api/dashboard").json()["follow_ups"]
    found = {g: [f["id"] for f in follow_ups[g]] for g in ("overdue", "coming_up")}
    for name, ids in found.items():
        assert (activity["id"] in ids) is (name == group)
