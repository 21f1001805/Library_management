from typing import Annotated

from fastapi import APIRouter, Depends, status
from prisma.models import User

from app.api.deps import get_current_user
from app.modules.auth import service
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


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> TokenResponse:
    return await service.register(payload)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    return await service.login(payload)


@router.post("/google", response_model=TokenResponse)
async def google(payload: GoogleLoginRequest) -> TokenResponse:
    return await service.google_login(payload)


@router.patch("/me", response_model=TokenResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> TokenResponse:
    return await service.update_profile(user, payload)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest) -> TokenResponse:
    return await service.refresh(payload)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: Annotated[User, Depends(get_current_user)]) -> None:
    await service.logout(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(user: Annotated[User, Depends(get_current_user)]) -> None:
    await service.delete_account(user)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(payload: ForgotPasswordRequest) -> None:
    await service.forgot_password(payload)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(payload: ResetPasswordRequest) -> None:
    await service.reset_password(payload)
