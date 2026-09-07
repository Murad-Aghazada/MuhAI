"""Firebase ID-token verification.

Firestore is the system of record; the browser authenticates against Firebase
Auth and sends the resulting ID token to this API as ``Authorization: Bearer
<token>``. This module validates that token so compute endpoints know which
Firebase user (and therefore which company) is calling.

No service-account key is needed — ID tokens are RS256-signed by Google and
verified against the public X.509 certificates published at
:data:`CERT_URL`. Only the standard library is used for the fetch so the
runtime image gains no new dependency.
"""
from __future__ import annotations

import json
import logging
import threading
import time
import urllib.request
from dataclasses import dataclass

from cryptography.hazmat.primitives import serialization
from cryptography.x509 import load_pem_x509_certificate
from jose import jwt
from jose.exceptions import JWTError

logger = logging.getLogger(__name__)

CERT_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)
ISSUER_PREFIX = "https://securetoken.google.com/"
ALGORITHM = "RS256"

# Google rotates these roughly daily and sends a max-age; a fixed TTL well
# under that is simpler and safe — a stale key just triggers one refetch.
_CACHE_TTL_SECONDS = 3600
_FETCH_TIMEOUT_SECONDS = 10


class FirebaseAuthError(Exception):
    """Raised when an ID token is missing, malformed, or fails verification."""


@dataclass(frozen=True)
class FirebaseUser:
    """The verified caller. ``uid`` is the Firestore document owner key."""

    uid: str
    email: str | None = None
    name: str | None = None


# ── Public-key cache ───────────────────────────────────────────────────
_keys: dict[str, str] = {}
_keys_fetched_at: float = 0.0
_lock = threading.Lock()


def _fetch_public_keys() -> dict[str, str]:
    """Download Google's signing certificates and convert them to PEM keys."""
    with urllib.request.urlopen(CERT_URL, timeout=_FETCH_TIMEOUT_SECONDS) as resp:
        certs = json.loads(resp.read().decode("utf-8"))

    keys: dict[str, str] = {}
    for kid, cert_pem in certs.items():
        cert = load_pem_x509_certificate(cert_pem.encode("utf-8"))
        keys[kid] = (
            cert.public_key()
            .public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
            .decode("utf-8")
        )
    return keys


def _public_key_for(kid: str, *, allow_refresh: bool = True) -> str:
    """Return the PEM public key for ``kid``, refetching once on a miss."""
    global _keys, _keys_fetched_at

    with _lock:
        expired = time.time() - _keys_fetched_at > _CACHE_TTL_SECONDS
        if _keys and not expired and kid in _keys:
            return _keys[kid]

    try:
        fresh = _fetch_public_keys()
    except Exception as exc:  # network failure, bad payload
        with _lock:
            # A cached key still beats a hard failure while Google is unreachable.
            if kid in _keys:
                logger.warning("Firebase key refresh failed, using cached key: %s", exc)
                return _keys[kid]
        raise FirebaseAuthError("Firebase imza anahtarları alınamadı.") from exc

    with _lock:
        _keys = fresh
        _keys_fetched_at = time.time()
        if kid in _keys:
            return _keys[kid]

    if allow_refresh:
        # Key genuinely absent from a freshly fetched set — the token is not ours.
        raise FirebaseAuthError("Token imza anahtarı tanınmıyor.")
    raise FirebaseAuthError("Token imza anahtarı tanınmıyor.")


def verify_id_token(token: str, project_id: str) -> FirebaseUser:
    """Verify a Firebase ID token and return the caller it identifies.

    Raises:
        FirebaseAuthError: on any signature, audience, issuer or expiry problem.
    """
    if not token:
        raise FirebaseAuthError("Oturum tokenı eksik.")
    if not project_id:
        raise FirebaseAuthError("FIREBASE_PROJECT_ID yapılandırılmamış.")

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise FirebaseAuthError("Token çözümlenemedi.") from exc

    if header.get("alg") != ALGORITHM:
        raise FirebaseAuthError("Beklenmeyen imza algoritması.")
    kid = header.get("kid")
    if not kid:
        raise FirebaseAuthError("Token 'kid' başlığı taşımıyor.")

    key = _public_key_for(kid)

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=[ALGORITHM],
            audience=project_id,
            issuer=f"{ISSUER_PREFIX}{project_id}",
            options={"verify_at_hash": False},
        )
    except JWTError as exc:
        raise FirebaseAuthError(f"Token doğrulanamadı: {exc}") from exc

    uid = claims.get("user_id") or claims.get("sub")
    if not uid:
        raise FirebaseAuthError("Token bir kullanıcı taşımıyor.")

    return FirebaseUser(
        uid=uid,
        email=claims.get("email"),
        name=claims.get("name"),
    )


def reset_key_cache() -> None:
    """Drop the cached signing keys. Used by tests."""
    global _keys, _keys_fetched_at
    with _lock:
        _keys = {}
        _keys_fetched_at = 0.0
