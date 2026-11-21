"""Every record type returns 422 with a message for each field that needs fixing."""

import pytest


def errors(response) -> dict:
    assert response.status_code == 422, response.text
    body = response.json()
    assert body["detail"] == "Some fields need fixing."
    return body["errors"]


@pytest.fixture
def ids(make):
    contact = make.contact()
    return {"org": contact["organization_id"], "contact": contact["id"], "deal": make.deal(contact_id=contact["id"])["id"]}


class TestOrganizations:
    def test_blank_name(self, client):
        assert errors(client.post("/api/organizations", json={"name": "  "})) == {"name": "Enter a name."}

    def test_missing_name(self, client):
        assert errors(client.post("/api/organizations", json={}))["name"] == "Enter a name."

    def test_website_without_http(self, client):
        response = client.post("/api/organizations", json={"name": "Acme", "website": "acme.com"})
        assert errors(response) == {"website": "Start the website with http:// or https://."}

    def test_website_scheme_in_any_case(self, client):
        response = client.post("/api/organizations", json={"name": "Acme", "website": "HTTPS://acme.com"})
        assert response.status_code == 201
        assert response.json()["website"] == "HTTPS://acme.com"

    def test_name_too_long(self, client):
        response = client.post("/api/organizations", json={"name": "x" * 201})
        assert errors(response) == {"name": "Keep this to 200 characters or fewer."}

    def test_null_name_on_patch(self, client, ids):
        assert errors(client.patch(f"/api/organizations/{ids['org']}", json={"name": None})) == {
            "name": "Enter a name."
        }

    def test_several_fields_at_once(self, client):
        response = client.post("/api/organizations", json={"name": "", "website": "ftp://x"})
        assert set(errors(response)) == {"name", "website"}


class TestContacts:
    def test_blank_name_and_bad_email(self, client, ids):
        response = client.post(
            "/api/contacts", json={"name": "", "email": "maria@", "organization_id": ids["org"]}
        )
        assert errors(response) == {
            "name": "Enter a name.",
            "email": "Enter a valid email address, such as name@company.com.",
        }

    def test_unknown_status(self, client, ids):
        response = client.patch(f"/api/contacts/{ids['contact']}", json={"status": "partner"})
        assert errors(response) == {"status": "Pick a status: lead, qualified or customer."}

    def test_blank_optional_fields_are_cleared(self, client, ids):
        response = client.patch(f"/api/contacts/{ids['contact']}", json={"email": "", "phone": "  "})
        assert response.status_code == 200
        assert response.json()["email"] is None and response.json()["phone"] is None


class TestDeals:
    def valid(self, ids):
        return {"name": "Deal", "contact_id": ids["contact"], "value_cents": 100_000, "close_date": "2026-12-01"}

    def test_negative_value(self, client, ids):
        response = client.post("/api/deals", json=self.valid(ids) | {"value_cents": -100})
        assert errors(response) == {"value_cents": "Enter a value of $0 or more."}

    @pytest.mark.parametrize("probability", [-1, 101, "high"])
    def test_probability_outside_0_to_100(self, client, ids, probability):
        response = client.post("/api/deals", json=self.valid(ids) | {"probability": probability})
        assert errors(response) == {"probability": "Enter a probability from 0 to 100."}

    def test_unknown_stage(self, client, ids):
        response = client.post("/api/deals", json=self.valid(ids) | {"stage": "closed"})
        assert errors(response) == {"stage": "Pick a stage."}

    def test_bad_close_date(self, client, ids):
        response = client.post("/api/deals", json=self.valid(ids) | {"close_date": "next week"})
        assert errors(response) == {"close_date": "Enter a close date."}

    def test_everything_missing(self, client):
        assert set(errors(client.post("/api/deals", json={}))) == {"name", "contact_id", "value_cents", "close_date"}

    def test_unknown_organization(self, client, ids):
        response = client.post("/api/deals", json=self.valid(ids) | {"organization_id": 999})
        assert errors(response) == {"organization_id": "Pick an organization, or leave it blank."}


class TestActivities:
    def test_blank_description_unknown_type_and_bad_time(self, client, ids):
        response = client.post(
            "/api/activities",
            json={"type": "meeting", "description": " ", "occurred_at": "yesterday", "contact_id": ids["contact"]},
        )
        assert errors(response) == {
            "type": "Pick note, call or email.",
            "description": "Enter a description.",
            "occurred_at": "Enter the date and time it happened.",
        }

    def test_bad_follow_up_date(self, client, ids):
        response = client.post(
            "/api/activities",
            json={
                "type": "note",
                "description": "Hi",
                "occurred_at": "2026-11-20T09:00",
                "follow_up_date": "31/12/2026",
                "contact_id": ids["contact"],
            },
        )
        assert errors(response) == {"follow_up_date": "Enter a date, or leave it blank."}


def test_a_body_that_isnt_json_is_422(client):
    response = client.post("/api/organizations", content=b"{not json", headers={"content-type": "application/json"})
    assert response.status_code == 422
