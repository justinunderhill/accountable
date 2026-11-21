def test_create_read_update(client, make):
    org = make.org(name="Acme Corp", website="https://acme.example.com", industry="Retail", notes="Met at a fair")
    assert org["name"] == "Acme Corp"
    assert org["contact_count"] == 0 and org["open_deal_count"] == 0

    detail = client.get(f"/api/organizations/{org['id']}").json()
    assert detail["website"] == "https://acme.example.com"
    assert detail["contacts"] == [] and detail["deals"] == []

    response = client.patch(f"/api/organizations/{org['id']}", json={"industry": "Logistics"})
    assert response.status_code == 200
    assert response.json()["industry"] == "Logistics"
    assert response.json()["name"] == "Acme Corp", "fields not sent stay as they were"

    response = client.patch(f"/api/organizations/{org['id']}", json={"website": None})
    assert response.json()["website"] is None


def test_list_counts_contacts_and_open_deals(client, make):
    org = make.org(name="Counted")
    contact = make.contact(organization_id=org["id"])
    make.contact(organization_id=org["id"])
    make.deal(contact_id=contact["id"], organization_id=org["id"], stage="proposal")
    make.deal(contact_id=contact["id"], organization_id=org["id"], stage="won")
    rows = {o["name"]: o for o in client.get("/api/organizations").json()}
    assert rows["Counted"]["contact_count"] == 2
    assert rows["Counted"]["open_deal_count"] == 1


def test_detail_includes_contacts_deals_and_figures(client, make):
    org = make.org()
    contact = make.contact(organization_id=org["id"])
    make.deal(contact_id=contact["id"], organization_id=org["id"], stage="proposal", value_cents=2_000_000)
    make.deal(contact_id=contact["id"], organization_id=org["id"], stage="won", value_cents=500_000)
    detail = client.get(f"/api/organizations/{org['id']}").json()
    assert [c["id"] for c in detail["contacts"]] == [contact["id"]]
    assert len(detail["deals"]) == 2
    assert detail["open_pipeline_cents"] == 2_000_000
    assert detail["won_cents"] == 500_000


def test_missing_organization_is_404(client):
    for method, path in [
        ("get", "/api/organizations/999"),
        ("patch", "/api/organizations/999"),
        ("delete", "/api/organizations/999"),
        ("get", "/api/organizations/999/delete-impact"),
    ]:
        response = client.request(method.upper(), path, json={} if method == "patch" else None)
        assert response.status_code == 404, path
        assert response.json()["detail"] == "Organization not found."


def test_delete_keeps_contacts_and_deals_with_no_organization(client, make):
    org = make.org()
    contact = make.contact(organization_id=org["id"])
    deal = make.deal(contact_id=contact["id"], organization_id=org["id"])

    assert client.delete(f"/api/organizations/{org['id']}").status_code == 204

    assert client.get(f"/api/organizations/{org['id']}").status_code == 404
    kept_contact = client.get(f"/api/contacts/{contact['id']}").json()
    assert kept_contact["organization_id"] is None
    assert kept_contact["organization"] is None
    kept_deal = client.get(f"/api/deals/{deal['id']}").json()
    assert kept_deal["organization_id"] is None
    assert kept_deal["organization_name"] is None


def test_delete_impact_counts(client, make):
    org = make.org(name="Acme Corp")
    first = make.contact(organization_id=org["id"])
    make.contact(organization_id=org["id"])
    make.deal(contact_id=first["id"], organization_id=org["id"])
    make.deal(contact_id=first["id"], organization_id=org["id"], stage="won")
    impact = client.get(f"/api/organizations/{org['id']}/delete-impact").json()
    assert impact == {"name": "Acme Corp", "contact_count": 2, "deal_count": 2}


def test_industries_in_use(client, make):
    make.org(industry="Retail")
    make.org(industry="Finance")
    make.org(industry="Retail")
    make.org()
    assert client.get("/api/organizations/industries").json() == ["Finance", "Retail"]
