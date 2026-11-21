"""The public web pages Google Play asks for: privacy policy, terms of use,
and how to delete an account without the app.

They live at /privacy, /terms and /delete-account (outside /api/v1: they are
web pages, not API). Each page is a body file in app/static/legal/ put inside
layout.html. The contact email comes from CONTACT_EMAIL, so the founder can
change it in Render without a code change.
"""

from functools import lru_cache
from html import escape
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.config import settings

router = APIRouter(include_in_schema=False)

LEGAL_DIR = Path(__file__).parent / "static" / "legal"

PAGES = {
    "privacy": "سياسة الخصوصية · Privacy policy · Haddak",
    "terms": "شروط الاستعمال · Terms of use · Haddak",
    "delete-account": "حذف الحساب · Delete account · Haddak",
}

# Static pages: no script at all, only their own inline style.
HEADERS = {
    "Content-Security-Policy": (
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; "
        "form-action 'none'; frame-ancestors 'none'"
    ),
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    # Browsers may keep them for an hour; a policy change shows up soon enough.
    "Cache-Control": "public, max-age=3600",
}


def contact_texts(email: str) -> dict[str, str]:
    """The sentences that carry the contact address, in both languages."""
    if not email:
        # Not configured yet: still a working page, with the in-app route.
        return {
            "CONTACT_AR": 'راسلنا من التطبيق: زر "بلّغ" على أي صفحة.',
            "CONTACT_EN": 'Write to us from the app: the "Report" button on any page.',
            "DELETE_AR": "سجّل دخول على التطبيق من أي تلفون وامحِ الحساب من هونيك.",
            "DELETE_EN": "Sign in to the app on any phone and delete the account there.",
        }
    link = f'<a href="mailto:{escape(email)}">{escape(email)}</a>'
    return {
        "CONTACT_AR": f"للأسئلة أو الطلبات: {link}",
        "CONTACT_EN": f"Questions or requests: {link}",
        "DELETE_AR": (
            f"ابعت إيميل على {link} من نفس البريد اللي بتسجّل فيه، واكتب "
            '"امحوا حسابي". منمحيه خلال 7 أيام ومنردّ عليك.'
        ),
        "DELETE_EN": (
            f'Email {link} from the address you sign in with and write "Delete my account". '
            "We delete it within 7 days and reply to confirm."
        ),
    }


@lru_cache
def render_page(name: str, email: str) -> str:
    """Built once per page and email, then served from memory."""
    html = (LEGAL_DIR / "layout.html").read_text(encoding="utf-8")
    html = html.replace("{{TITLE}}", PAGES[name])
    html = html.replace("{{BODY}}", (LEGAL_DIR / f"{name}.html").read_text(encoding="utf-8"))
    for key, value in contact_texts(email).items():
        html = html.replace("{{" + key + "}}", value)
    return html


def page_response(name: str) -> HTMLResponse:
    return HTMLResponse(render_page(name, settings.contact_email.strip()), headers=HEADERS)


@router.get("/privacy")
def privacy() -> HTMLResponse:
    return page_response("privacy")


@router.get("/terms")
def terms() -> HTMLResponse:
    return page_response("terms")


@router.get("/delete-account")
def delete_account_page() -> HTMLResponse:
    return page_response("delete-account")
