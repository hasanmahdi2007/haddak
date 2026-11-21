"""The sign-in email bridge page (/auth/open)."""


def test_auth_open_page_is_served_with_strict_headers(client):
    app_link = "exp%3A%2F%2F192.168.1.20%3A8081%2F--%2Fauth-callback"
    response = client.get(f"/auth/open?app={app_link}&code=abc")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    # The address carries a one-time code: it must not leak to other sites or caches.
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["cache-control"] == "no-store"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_auth_open_page_only_forwards_to_app_links(client):
    page = client.get("/auth/open").text
    # Only exp:// (Expo Go) and haddak:// (real app) are followed; no open redirect.
    assert r"/^(exp|haddak):\/\//" in page
