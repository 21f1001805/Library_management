from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from prisma.models import User

from app.api.deps import get_current_user
from app.core.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.core.rate_limit import limiter
from app.modules.auth import service
from app.modules.auth.service import InvalidRefreshToken
from app.modules.auth.schemas import (
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _apply_cookies(response: Response, token_response: TokenResponse) -> TokenResponse:
    set_auth_cookies(
        response,
        access_token=token_response.access_token,
        refresh_token=token_response.refresh_token,
        role=token_response.user.role.name,
    )
    return token_response


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, response: Response, payload: RegisterRequest) -> TokenResponse:
    return _apply_cookies(response, await service.register(payload))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, response: Response, payload: LoginRequest) -> TokenResponse:
    return _apply_cookies(response, await service.login(payload))


@router.post("/google", response_model=TokenResponse)
@limiter.limit("5/minute")
async def google(request: Request, response: Response, payload: GoogleLoginRequest) -> TokenResponse:
    return _apply_cookies(response, await service.google_login(payload))


@router.patch("/me", response_model=TokenResponse)
@limiter.limit("10/minute")
async def update_profile(
    request: Request,
    response: Response,
    payload: UpdateProfileRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> TokenResponse:
    return _apply_cookies(response, await service.update_profile(user, payload))


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh(
    request: Request, response: Response, payload: RefreshRequest | None = None
) -> TokenResponse:
    # httpOnly cookie first (the browser sends it automatically); the body is a fallback
    # for callers that don't use cookies (tools/tests, or the Vite app during coexistence).
    token = request.cookies.get(REFRESH_COOKIE) or (payload.refresh_token if payload else None)
    if not token:
        raise InvalidRefreshToken
    return _apply_cookies(response, await service.refresh(token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, user: Annotated[User, Depends(get_current_user)]) -> None:
    await service.logout(user)
    clear_auth_cookies(response)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(response: Response, user: Annotated[User, Depends(get_current_user)]) -> None:
    await service.delete_account(user)
    clear_auth_cookies(response)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/minute")
async def forgot_password(request: Request, payload: ForgotPasswordRequest) -> None:
    await service.forgot_password(payload)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def reset_password(request: Request, payload: ResetPasswordRequest) -> None:
    await service.reset_password(payload)
