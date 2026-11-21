"""Privacy policy, terms and account-deletion pages; crash-report scrubbing;
headers every response carries."""

import pytest

from app import legal_pages
from app.config import settings
from app.error_tracking import scrub


@pytest.fixture(autouse=True)
def fresh_pages():
    legal_pages.render_page.cache_clear()
    yield
    legal_pages.render_page.cache_clear()


@pytest.mark.parametrize("path", ["/privacy", "/terms", "/delete-account"])
def test_the_pages_google_play_links_to_are_served(client, path):
    response = client.get(path)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    # No script may run on them.
    assert "script-src" not in response.headers["content-security-policy"]
    body = response.text
    assert "{{" not in body  # every placeholder was filled
    assert 'lang="ar"' in body and 'lang="en"' in body


def test_the_contact_email_appears_when_set(client, monkeypatch):
    monkeypatch.setattr(settings, "contact_email", "hello@haddak.example")
    body = client.get("/delete-account").text
    assert 'href="mailto:hello@haddak.example"' in body


def test_the_contact_email_is_escaped(client, monkeypatch):
    monkeypatch.setattr(settings, "contact_email", '"><script>x</script>')
    assert "<script>" not in client.get("/privacy").text


def test_every_response_says_nosniff(client):
    response = client.get("/api/v1/health")
    assert response.headers["x-content-type-options"] == "nosniff"


def test_hsts_only_in_production(client, monkeypatch):
    assert "strict-transport-security" not in client.get("/api/v1/health").headers
    monkeypatch.setattr(settings, "environment", "production")
    assert client.get("/api/v1/health").headers["strict-transport-security"].startswith("max-age=")


def test_crash_reports_carry_no_location_body_or_keys():
    event = {
        "request": {
            "url": "https://api/x?lat=33.8&lng=35.5",
            "query_string": "lat=33.8&lng=35.5",
            "data": {"comment": "private"},
            "cookies": {"a": "b"},
            "headers": {
                "Authorization": "Bearer t",
                "X-Admin-Key": "k",
                "X-Haddak-Device": "d",
                "Accept": "*/*",
            },
        }
    }
    request = scrub(event, {})["request"]
    assert request == {"url": "https://api/x", "headers": {"Accept": "*/*"}}
