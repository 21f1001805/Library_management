from collections.abc import Callable, Coroutine
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from prisma.models import User

from app.core.cookies import ACCESS_COOKIE
from app.core.security import decode_token
from app.db.prisma import prisma

bearer_scheme = HTTPBearer(auto_error=False)

CredentialsError = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def _bearer_token(
    request: Request, credentials: HTTPAuthorizationCredentials | None
) -> str | None:
    # Authorization header first (tools/tests/Postman), the httpOnly access_token cookie
    # otherwise (the browser sends it automatically — see core/cookies.py).
    if credentials is not None:
        return credentials.credentials
    return request.cookies.get(ACCESS_COOKIE)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    token = _bearer_token(request, credentials)
    if token is None:
        raise CredentialsError

    try:
        payload = decode_token(token)
    except jwt.InvalidTokenError as exc:
        raise CredentialsError from exc

    if payload.get("type") != "access":
        raise CredentialsError

    user_id = payload.get("sub")
    if not user_id:
        raise CredentialsError

    user = await prisma.user.find_unique(where={"id": user_id}, include={"role": True})
    if user is None or user.deletedAt is not None or not user.isActive:
        raise CredentialsError

    return user


async def get_optional_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User | None:
    token = _bearer_token(request, credentials)
    if token is None:
        return None
    try:
        payload = decode_token(token)
    except jwt.InvalidTokenError:
        return None
    if payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = await prisma.user.find_unique(where={"id": user_id}, include={"role": True})
    if user is None or user.deletedAt is not None or not user.isActive:
        return None
    return user


def require_role(*allowed_roles: str) -> Callable[..., Coroutine[Any, Any, User]]:
    async def dependency(
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return dependency
