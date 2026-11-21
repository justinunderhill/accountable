"""The API only answers requests addressed to this computer, which stops DNS rebinding."""

import pytest


@pytest.mark.parametrize("host", ["localhost", "localhost:5173", "127.0.0.1", "127.0.0.1:8000"])
def test_requests_to_this_computer_are_answered(client, host):
    assert client.get("/api/contacts", headers={"host": host}).status_code == 200


@pytest.mark.parametrize("host", ["evil.example.com", "evil.example.com:8000", "192.168.1.20:8000", "testserver"])
def test_requests_addressed_to_another_host_are_refused(client, make, host):
    make.contact(name="Maria Lopez")
    response = client.get("/api/contacts", headers={"host": host})
    assert response.status_code == 400
    assert "Maria Lopez" not in response.text
    assert client.post("/api/organizations", json={"name": "Sneaky"}, headers={"host": host}).status_code == 400


def test_a_website_must_be_http_or_https(client):
    for website in ["javascript:alert(1)", "JAVASCRIPT://x", "ftp://acme.com", "data:text/html,hi"]:
        response = client.post("/api/organizations", json={"name": "Acme", "website": website})
        assert response.status_code == 422, website
