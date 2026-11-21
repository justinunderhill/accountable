def test_create_requires_an_organization(client):
    response = client.post("/api/contacts", json={"name": "Maria Lopez"})
    assert response.status_code == 422
    assert response.json()["errors"]["organization_id"] == "Pick an organization."

    response = client.post("/api/contacts", json={"name": "Maria Lopez", "organization_id": 999})
    assert response.status_code == 422
    assert response.json()["errors"]["organization_id"] == "Pick an organization."


def test_create_read_update(client, make):
    org = make.org(name="Acme Corp")
    contact = make.contact(
        name="Maria Lopez", organization_id=org["id"], email="maria@acme.com", phone="555 0101", job_title="CFO"
    )
    assert contact["status"] == "lead", "status defaults to lead"
    assert contact["organization_name"] == "Acme Corp"

    response = client.patch(f"/api/contacts/{contact['id']}", json={"status": "customer"})
    assert response.json()["status"] == "customer"
    assert response.json()["email"] == "maria@acme.com"

    detail = client.get(f"/api/contacts/{contact['id']}").json()
    assert detail["organization"] == {"id": org["id"], "name": "Acme Corp"}
    assert detail["deals"] == [] and detail["timeline"] == []


def test_update_cannot_clear_the_organization(client, make):
    contact = make.contact()
    response = client.patch(f"/api/contacts/{contact['id']}", json={"organization_id": None})
    assert response.status_code == 422
    assert response.json()["errors"]["organization_id"] == "Pick an organization."


def test_status_values(client, make):
    org = make.org()
    for status in ["lead", "qualified", "customer"]:
        assert make.contact(organization_id=org["id"], status=status)["status"] == status
    response = client.post("/api/contacts", json={"name": "X", "organization_id": org["id"], "status": "vip"})
    assert response.status_code == 422
    assert response.json()["errors"]["status"] == "Pick a status: lead, qualified or customer."


def test_list_includes_organization_name(client, make):
    org = make.org(name="Acme Corp")
    make.contact(name="Maria Lopez", organization_id=org["id"])
    rows = client.get("/api/contacts").json()
    assert [(r["name"], r["organization_name"]) for r in rows] == [("Maria Lopez", "Acme Corp")]


def test_delete_is_blocked_while_the_contact_is_on_deals(client, make):
    contact = make.contact(name="Maria Lopez")
    first = make.deal(contact_id=contact["id"], name="Website redesign")
    second = make.deal(contact_id=contact["id"], name="Annual support")

    impact = client.get(f"/api/contacts/{contact['id']}/delete-impact").json()
    assert impact["deals"] == [
        {"id": second["id"], "name": "Annual support"},
        {"id": first["id"], "name": "Website redesign"},
    ]

    response = client.delete(f"/api/contacts/{contact['id']}")
    assert response.status_code == 409
    body = response.json()
    assert body["detail"] == (
        "Maria Lopez is the main contact on 2 deals. Give each deal another contact before deleting Maria Lopez."
    )
    assert len(body["deals"]) == 2
    assert client.get(f"/api/contacts/{contact['id']}").status_code == 200


def test_delete_goes_ahead_once_the_deals_have_another_contact(client, make, engine):
    contact = make.contact()
    other = make.contact()
    deal = make.deal(contact_id=contact["id"])
    note = make.activity(contact_id=contact["id"])
    make.activity(contact_id=contact["id"])
    assert client.get(f"/api/contacts/{contact['id']}/delete-impact").json()["activity_count"] == 2

    client.patch(f"/api/deals/{deal['id']}", json={"contact_id": other["id"]})
    impact = client.get(f"/api/contacts/{contact['id']}/delete-impact").json()
    assert impact["deals"] == []

    assert client.delete(f"/api/contacts/{contact['id']}").status_code == 204
    assert client.get(f"/api/contacts/{contact['id']}").status_code == 404
    assert client.get(f"/api/activities/{note['id']}").status_code == 404, "their activities go too"


def test_timeline_includes_the_contacts_deals_labelled_and_newest_first(client, make):
    contact = make.contact()
    deal = make.deal(contact_id=contact["id"], name="Website redesign")
    own = make.activity(contact_id=contact["id"], occurred_at="2026-11-18T09:00:00", description="Intro call")
    on_deal = make.activity(deal_id=deal["id"], occurred_at="2026-11-19T15:30:00", description="Sent proposal")
    # The stage change is stamped with the fixed now, 2026-11-21 10:00.
    client.post(f"/api/deals/{deal['id']}/move", json={"stage": "proposal", "index": 0})
    # Activity on a deal with another contact doesn't show.
    make.activity(deal_id=make.deal()["id"], occurred_at="2026-11-20T09:00:00")

    timeline = client.get(f"/api/contacts/{contact['id']}").json()["timeline"]
    assert [(e["kind"], e["id"]) for e in timeline] == [
        ("stage_change", timeline[0]["id"]),
        ("activity", on_deal["id"]),
        ("activity", own["id"]),
    ]
    assert timeline[0]["from_stage"] == "new" and timeline[0]["to_stage"] == "proposal"
    assert timeline[0]["deal"] == {"id": deal["id"], "name": "Website redesign"}
    assert timeline[1]["deal"] == {"id": deal["id"], "name": "Website redesign"}
    assert timeline[2]["deal"] is None


def test_missing_contact_is_404(client):
    assert client.get("/api/contacts/999").status_code == 404
    assert client.delete("/api/contacts/999").status_code == 404
    assert client.get("/api/contacts/999/delete-impact").status_code == 404
