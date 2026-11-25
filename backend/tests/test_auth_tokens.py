"""Which login tokens the backend accepts (app/auth.py).

Real Supabase tokens are ES256, checked with the public keys from
SUPABASE_JWKS_URL. Here we make our own EC key pair and hand the verifier its
public half instead of downloading Supabase's, so no network is needed.
Development tokens are HS256 and only count with ALLOW_DEV_TOKENS=true.
"""

import base64
import json
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app import auth
from app.config import settings
from tests.conftest import TEST_JWT_SECRET, make_token

JWKS_URL = "https://example.supabase.co/auth/v1/.well-known/jwks.json"
PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())


class FakeJwksClient:
    """Stands in for jwt.PyJWKClient: always returns our test public key."""

    def get_signing_key_from_jwt(self, token):
        public_jwk = jwt.algorithms.ECAlgorithm.to_jwk(PRIVATE_KEY.public_key())
        return jwt.PyJWK.from_dict(json.loads(public_jwk), algorithm="ES256")


@pytest.fixture
def jwks(monkeypatch):
    """Turns on JWKS checking with the fake key client."""
    monkeypatch.setattr(settings, "supabase_jwks_url", JWKS_URL)
    monkeypatch.setattr(auth, "get_jwks_client", lambda: FakeJwksClient())


ISSUER = "https://example.supabase.co/auth/v1"


def claims(user_id: uuid.UUID, **extra) -> dict:
    expires = datetime.now(UTC) + timedelta(hours=1)
    return {"sub": str(user_id), "aud": "authenticated", "exp": expires, "iss": ISSUER, **extra}


def es256_token(user_id: uuid.UUID, **extra) -> str:
    headers = {"kid": "test"}
    return jwt.encode(claims(user_id, **extra), PRIVATE_KEY, algorithm="ES256", headers=headers)


def unsigned_token(user_id: uuid.UUID) -> str:
    """A token with alg "none" and no signature, built by hand."""

    def part(data: dict) -> str:
        raw = json.dumps(data, default=lambda value: int(value.timestamp())).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    return f"{part({'alg': 'none', 'typ': 'JWT'})}.{part(claims(user_id))}."


def test_supabase_es256_token_is_accepted(jwks):
    user_id = uuid.uuid4()
    assert auth.decode_user_id(es256_token(user_id)) == user_id


def test_es256_token_signed_with_another_key_is_refused(jwks):
    other = ec.generate_private_key(ec.SECP256R1())
    forged = jwt.encode(claims(uuid.uuid4()), other, algorithm="ES256")
    with pytest.raises(jwt.InvalidSignatureError):
        auth.decode_user_id(forged)


def test_es256_token_with_wrong_audience_is_refused(jwks):
    token = es256_token(uuid.uuid4(), aud="anon")
    with pytest.raises(jwt.InvalidAudienceError):
        auth.decode_user_id(token)


def test_es256_token_without_jwks_url_is_refused(monkeypatch):
    monkeypatch.setattr(settings, "supabase_jwks_url", "")
    with pytest.raises(ValueError):
        auth.decode_user_id(es256_token(uuid.uuid4()))


def test_dev_token_accepted_next_to_jwks_when_allowed(jwks, monkeypatch):
    monkeypatch.setattr(settings, "allow_dev_tokens", True)
    user_id = uuid.uuid4()
    assert auth.decode_user_id(make_token(user_id)) == user_id


@pytest.mark.parametrize("with_jwks", [True, False])
def test_dev_token_refused_without_allow_dev_tokens(with_jwks, monkeypatch):
    monkeypatch.setattr(settings, "supabase_jwks_url", JWKS_URL if with_jwks else "")
    monkeypatch.setattr(settings, "allow_dev_tokens", False)
    with pytest.raises(ValueError):
        auth.decode_user_id(make_token(uuid.uuid4()))


def test_dev_token_refused_without_secret(monkeypatch):
    monkeypatch.setattr(settings, "allow_dev_tokens", True)
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")
    token = jwt.encode(claims(uuid.uuid4()), TEST_JWT_SECRET, algorithm="HS256")
    with pytest.raises(ValueError):
        auth.decode_user_id(token)


def test_unsigned_token_is_refused(jwks, monkeypatch):
    monkeypatch.setattr(settings, "allow_dev_tokens", True)
    with pytest.raises(ValueError):
        auth.decode_user_id(unsigned_token(uuid.uuid4()))


def test_unsigned_token_gets_401_from_the_api(client, jwks):
    response = client.get(
        "/api/v1/me/provider", headers={"Authorization": f"Bearer {unsigned_token(uuid.uuid4())}"}
    )
    assert response.status_code == 401


def test_supabase_token_works_on_the_api(client, jwks):
    response = client.get(
        "/api/v1/me/provider", headers={"Authorization": f"Bearer {es256_token(uuid.uuid4())}"}
    )
    # Signed in, but this new user has no business yet.
    assert response.status_code != 401


# ---------- checks added after the security audit ----------


def test_token_issued_one_second_in_future_is_accepted(jwks):
    # Our clock may be a little behind Supabase's: 30 seconds of leeway.
    user_id = uuid.uuid4()
    soon = datetime.now(UTC) + timedelta(seconds=1)
    assert auth.decode_user_id(es256_token(user_id, iat=soon, nbf=soon)) == user_id


def test_token_expired_long_ago_is_still_refused(jwks):
    token = es256_token(uuid.uuid4(), exp=datetime.now(UTC) - timedelta(minutes=5))
    with pytest.raises(jwt.ExpiredSignatureError):
        auth.decode_user_id(token)


def test_wrong_issuer_is_refused(jwks):
    token = es256_token(uuid.uuid4(), iss="https://other-project.supabase.co/auth/v1")
    with pytest.raises(jwt.InvalidIssuerError):
        auth.decode_user_id(token)


def test_token_without_issuer_is_refused(jwks):
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "aud": "authenticated",
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        PRIVATE_KEY,
        algorithm="ES256",
        headers={"kid": "test"},
    )
    with pytest.raises(jwt.MissingRequiredClaimError):
        auth.decode_user_id(token)


def test_anonymous_supabase_user_is_refused(jwks, client):
    token = es256_token(uuid.uuid4(), is_anonymous=True)
    with pytest.raises(jwt.InvalidTokenError):
        auth.decode_user_id(token)
    response = client.get("/api/v1/me/provider", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_rejected_token_is_logged_without_the_token(client, jwks, caplog):
    token = es256_token(uuid.uuid4(), aud="anon")
    with caplog.at_level("WARNING", logger="haddak.auth"):
        response = client.get("/api/v1/me/provider", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    messages = [record.getMessage() for record in caplog.records if record.name == "haddak.auth"]
    assert messages == ["token rejected: InvalidAudienceError"]
    assert token not in caplog.text


# ---------- the key store (auth.SigningKeys) ----------


def public_jwks(key_id: str = "test") -> dict:
    public_jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(PRIVATE_KEY.public_key()))
    return {"keys": [{**public_jwk, "kid": key_id, "use": "sig", "alg": "ES256"}]}


class FakeFetch:
    """Stands in for the download: answers with our key, or fails."""

    def __init__(self):
        self.calls = 0
        self.failing = False

    def __call__(self) -> dict:
        self.calls += 1
        if self.failing:
            raise jwt.PyJWKClientConnectionError("Fail to fetch data from the url")
        return public_jwks()


@pytest.fixture
def key_store(clock, monkeypatch):
    """A real SigningKeys with a fake download and the test clock."""
    monkeypatch.setattr(settings, "supabase_jwks_url", JWKS_URL)
    fetch = FakeFetch()
    store = auth.SigningKeys(fetch, clock=clock)
    monkeypatch.setattr(auth, "get_jwks_client", lambda: store)
    return fetch


def test_keys_are_downloaded_once_and_kept_for_an_hour(key_store, clock):
    for _ in range(3):
        auth.decode_user_id(es256_token(uuid.uuid4()))
    assert key_store.calls == 1

    clock.advance(auth.SigningKeys.KEYS_LIFESPAN_SECONDS + 1)
    auth.decode_user_id(es256_token(uuid.uuid4()))
    assert key_store.calls == 2


def test_jwks_outage_keeps_using_cached_keys(key_store, clock, client, caplog):
    auth.decode_user_id(es256_token(uuid.uuid4()))  # keys downloaded once

    key_store.failing = True
    clock.advance(auth.SigningKeys.KEYS_LIFESPAN_SECONDS + 1)
    with caplog.at_level("ERROR", logger="haddak.auth"):
        response = client.get(
            "/api/v1/me/provider", headers={"Authorization": f"Bearer {es256_token(uuid.uuid4())}"}
        )

    # Signed in as usual (404: this new user has no business yet).
    assert response.status_code == 404
    assert "could not download Supabase signing keys" in caplog.text


def test_jwks_unreachable_without_cache_is_503_not_401(key_store, client, caplog):
    key_store.failing = True
    headers = {"Authorization": f"Bearer {es256_token(uuid.uuid4())}"}

    with caplog.at_level("ERROR", logger="haddak.auth"):
        response = client.get("/api/v1/me/provider", headers=headers)

    # 503, not 401: the app signs the user out on 401, and this is our problem.
    assert response.status_code == 503
    assert response.json() == {"detail": "Sign-in check unavailable, try again"}
    assert any(record.levelname == "ERROR" for record in caplog.records)
    # Public pages keep working, as for someone not signed in.
    assert client.get("/api/v1/categories", headers=headers).status_code == 200


def test_failed_download_is_not_retried_on_every_request(key_store, clock):
    key_store.failing = True
    for _ in range(5):
        with pytest.raises(auth.SignInCheckUnavailable):
            auth.decode_user_id(es256_token(uuid.uuid4()))
    assert key_store.calls == 1

    key_store.failing = False
    clock.advance(auth.SigningKeys.RETRY_AFTER_FAILURE_SECONDS + 1)
    auth.decode_user_id(es256_token(uuid.uuid4()))
    assert key_store.calls == 2


def test_unknown_key_id_downloads_again_at_most_every_30_seconds(key_store, clock):
    auth.decode_user_id(es256_token(uuid.uuid4()))
    other = ec.generate_private_key(ec.SECP256R1())
    unknown = jwt.encode(claims(uuid.uuid4()), other, algorithm="ES256", headers={"kid": "new"})

    with pytest.raises(jwt.InvalidTokenError):
        auth.decode_user_id(unknown)
    assert key_store.calls == 1  # just downloaded: no second download yet

    clock.advance(auth.SigningKeys.UNKNOWN_KEY_COOLDOWN_SECONDS + 1)
    for _ in range(3):
        with pytest.raises(jwt.InvalidTokenError):
            auth.decode_user_id(unknown)
    assert key_store.calls == 2
