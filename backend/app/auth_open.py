"""The sign-in email bridge page, GET /auth/open?app=<app link>.

The link in the sign-in email opens in a browser. A browser cannot show an
app link (haddak://) directly, so the email points here and this page hands
the sign-in code on to the app. See docs/API.md, "Authentication".

Two rules keep the page from being misused:
  - Which app link it opens is checked HERE, on the server, and written into
    the page. In production only haddak://auth-callback is accepted. exp://
    (Expo Go, development only) is refused there: an exp:// link can point to
    ANY server, so a sign-in link could otherwise hand the code to a stranger's
    Expo project.
  - The page passes on only `code`, `error`, `error_code` and
    `error_description`. Never the rest of the address and never the
    #fragment, which could carry login tokens someone else put there.
"""

import html
import re
from pathlib import Path

from fastapi import Request
from fastapi.responses import HTMLResponse

from app.config import settings

PAGE = Path(__file__).parent / "static" / "auth-open.html"
# The page has this text where the checked app link goes (an HTML attribute).
PLACEHOLDER = "__APP_LINK__"

PRODUCTION_APP_LINK = "haddak://auth-callback"
# Development: the real app, or Expo Go on the developer's network
# (exp://192.168.1.20:8081/--/auth-callback). No spaces, quotes or brackets.
DEVELOPMENT_APP_LINK = re.compile(r"^(haddak|exp)://[^\s\"'<>\\]{1,200}$")

HEADERS = {
    "Content-Security-Policy": (
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
        "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    ),
    "X-Frame-Options": "DENY",
    # The address holds a one-time sign-in code: never send it to other sites.
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
}


def is_allowed_app_link(link: str) -> bool:
    if settings.is_production():
        return link == PRODUCTION_APP_LINK
    return DEVELOPMENT_APP_LINK.match(link) is not None


def auth_open_response(request: Request) -> HTMLResponse:
    """The page with the checked app link in it, or the same page without a
    link (status 400) when `app` is missing, repeated or not allowed."""
    links = request.query_params.getlist("app")
    link = links[0] if len(links) == 1 and is_allowed_app_link(links[0]) else ""
    page = PAGE.read_text(encoding="utf-8").replace(PLACEHOLDER, html.escape(link, quote=True))
    return HTMLResponse(page, status_code=200 if link else 400, headers=HEADERS)
