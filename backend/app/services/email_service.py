import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


async def send_reset_email(to_email: str, reset_url: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Password Reset - Face Attendance"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email

    text = (
        f"You requested a password reset.\n\n"
        f"Click the link below to reset your password:\n{reset_url}\n\n"
        f"This link expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.\n"
        f"If you did not request this, ignore this email."
    )

    html = f"""\
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #6366f1;">Password Reset</h2>
      <p>You requested a password reset for your Face Attendance account.</p>
      <p>Click the button below to set a new password:</p>
      <a href="{reset_url}"
         style="display: inline-block; padding: 12px 32px; background: #6366f1;
                color: #fff; text-decoration: none; border-radius: 8px;
                font-weight: 600; margin: 16px 0;">
        Reset Password
      </a>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        This link expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.<br>
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
    """

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    def _send() -> None:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())

    try:
        await asyncio.to_thread(_send)
    except Exception:
        logger.exception("Failed to send reset email to %s", to_email)
        raise
