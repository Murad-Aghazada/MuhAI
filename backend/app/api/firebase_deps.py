"""FastAPI dependency that resolves the caller from a Firebase ID token.

Used by the stateless ``/api/compute`` router. The legacy JWT + Postgres
dependency in :mod:`app.api.deps` is untouched — the two auth schemes coexist
so the older DB-backed routes keep working.
"""
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.config import settings
from app.core.firebase_auth import FirebaseAuthError, FirebaseUser, verify_id_token

ANONYMOUS = FirebaseUser(uid="anonymous", email=None, name=None)


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization") or ""
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


async def get_firebase_user(request: Request) -> FirebaseUser:
    """Verify the bearer ID token and return the caller.

    When ``FIREBASE_AUTH_REQUIRED`` is false the endpoint stays open and an
    anonymous principal is returned — an escape hatch for an offline demo,
    documented as such in the settings.
    """
    token = _bearer_token(request)

    if token is None:
        if not settings.FIREBASE_AUTH_REQUIRED:
            return ANONYMOUS
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum tokenı gerekli.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return verify_id_token(token, settings.FIREBASE_PROJECT_ID)
    except FirebaseAuthError as exc:
        if not settings.FIREBASE_AUTH_REQUIRED:
            return ANONYMOUS
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


CurrentFirebaseUser = Annotated[FirebaseUser, Depends(get_firebase_user)]
