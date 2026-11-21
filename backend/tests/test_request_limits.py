"""Server-wide protections: the request body size limit and the API docs
being off in production."""

from app.config import Settings
from app.main import docs_urls
from app.request_limits import MAX_BODY_BYTES
from tests.conftest import CENTER_LAT, CENTER_LNG

URL = "/api/v1/assist"


def test_a_normal_body_is_accepted(client, db):
    body = {"text": "hello there", "lat": CENTER_LAT, "lng": CENTER_LNG}

    assert client.post(URL, json=body).status_code == 200


def test_a_body_over_the_limit_is_413(client):
    too_big = b'{"text": "' + b"a" * MAX_BODY_BYTES + b'"}'

    response = client.post(URL, content=too_big, headers={"Content-Type": "application/json"})

    assert response.status_code == 413
    assert response.json() == {"detail": "Request body is too large."}


def test_a_chunked_body_over_the_limit_is_413(client):
    """No Content-Length up front: the body is counted while it arrives."""

    def chunks():
        yield b'{"text": "'
        for _ in range(MAX_BODY_BYTES // 1024 + 1):
            yield b"a" * 1024
        yield b'"}'

    response = client.post(URL, content=chunks(), headers={"Content-Type": "application/json"})

    assert response.status_code == 413


def test_api_docs_are_on_while_developing(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_api_docs_are_off_in_production():
    production = Settings(_env_file=None, environment="production")

    assert docs_urls(production) == {"docs_url": None, "redoc_url": None, "openapi_url": None}
