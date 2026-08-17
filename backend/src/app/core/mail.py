import smtplib
from email.message import EmailMessage

from app.core.config import get_settings


def send_email(to: str, subject: str, body: str) -> None:
    settings = get_settings()

    if not settings.smtp_host:
        # ponytail: no SMTP configured — log instead of failing so the reminder
        # flow still works end-to-end in dev. Set SMTP_HOST/PORT/USER/PASSWORD/FROM
        # in .env to send for real.
        print(f"[email:not-configured] to={to} subject={subject!r}\n{body}")
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from or settings.smtp_user
    message["To"] = to
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)
