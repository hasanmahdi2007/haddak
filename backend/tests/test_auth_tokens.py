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


def claims(user_id: uuid.UUID, **extra) -> dict:
    expires = datetime.now(UTC) + timedelta(hours=1)
    return {"sub": str(user_id), "aud": "authenticated", "exp": expires, **extra}


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
