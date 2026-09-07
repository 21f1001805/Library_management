from fastapi import Response

from app.core.config import get_settings

# httpOnly — the actual bearer credentials. Never readable by client JS.
ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
# Non-httpOnly — carry no secret, just enough for client JS (AuthProvider) and the
# Next.js proxy to know a session exists / which role it is, without touching the real
# token. is_logged_in is a plain presence flag; session_role backs Next's role-gated routes.
SESSION_COOKIE = "is_logged_in"
ROLE_COOKIE = "session_role"

REFRESH_COOKIE_PATH = "/api/v1/auth"


def set_auth_cookies(response: Response, *, access_token: str, refresh_token: str, role: str) -> None:
    settings = get_settings()
    secure = settings.app_env == "production"
    max_age = settings.refresh_token_expire_days * 24 * 3600

    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=max_age,
        path=REFRESH_COOKIE_PATH,
    )
    response.set_cookie(
        SESSION_COOKIE, "1", httponly=False, secure=secure, samesite="lax", max_age=max_age, path="/"
    )
    response.set_cookie(
        ROLE_COOKIE, role, httponly=False, secure=secure, samesite="lax", max_age=max_age, path="/"
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(ROLE_COOKIE, path="/")
