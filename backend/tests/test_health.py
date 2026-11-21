def test_health_says_ok_and_gives_today(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "today": "2026-11-21"}
