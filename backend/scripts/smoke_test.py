"""Checks a running Haddak API from the outside, the way the app uses it.

    python scripts/smoke_test.py https://haddak-api-ub67.onrender.com
    python scripts/smoke_test.py http://localhost:8000 --dev

Run it after every deploy; .github/workflows/uptime.yml also runs it every
30 minutes. Exit code 0 means every check passed; otherwise it prints what
failed and exits with 1 (so GitHub marks the run red and emails you).

Only the Python standard library, so it runs anywhere without installing
anything. It reads public data only and writes nothing.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

# A point in central Beirut (Hamra), where the OpenStreetMap import put many listings.
BEIRUT = {"lat": 33.8959, "lng": 35.4828}
# A free Render service sleeps after 15 minutes; waking it takes up to a minute.
TIMEOUT_SECONDS = 90


def fetch(url: str) -> tuple[int, dict[str, str], bytes, float]:
    """GET a URL. Returns status, headers, body and seconds taken."""
    request = urllib.request.Request(url, headers={"User-Agent": "haddak-smoke-test"})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            body = response.read()
            status, headers = response.status, dict(response.headers)
    except urllib.error.HTTPError as error:
        body = error.read()
        status, headers = error.code, dict(error.headers)
    return status, {k.lower(): v for k, v in headers.items()}, body, time.monotonic() - started


def run_checks(base: str, production: bool) -> list[str]:
    """Returns the failures (empty = all good) and prints each result."""
    failures: list[str] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        print(f"{'ok  ' if ok else 'FAIL'} {name}{f'  ({detail})' if detail else ''}")
        if not ok:
            failures.append(name)

    status, headers, body, seconds = fetch(f"{base}/api/v1/health")
    check(
        "health answers ok",
        status == 200 and json.loads(body or b"{}").get("status") == "ok",
        f"{status} in {seconds:.1f}s",
    )

    status, _, body, seconds = fetch(f"{base}/api/v1/categories")
    categories = json.loads(body) if status == 200 else []
    check("categories are there", len(categories) >= 58, f"{len(categories)}, {seconds:.1f}s")

    # The pharmacy category exists in every database (migration 0014).
    pharmacy_id = next((c["id"] for c in categories if c.get("slug") == "pharmacy"), None)
    query = f"lat={BEIRUT['lat']}&lng={BEIRUT['lng']}&radius_m=3000&include_unverified=true"
    if pharmacy_id is not None:
        query += f"&category_id={pharmacy_id}"
    status, _, body, seconds = fetch(f"{base}/api/v1/providers/search?{query}")
    found = len(json.loads(body).get("items", [])) if status == 200 else 0
    check("search near Beirut finds listings", found > 0, f"{found} found, {seconds:.1f}s")
    check("search is fast enough", seconds < 2.0, f"{seconds:.2f}s, should be under 2s")

    for path in ("/privacy", "/terms", "/delete-account"):
        status, _, _, _ = fetch(f"{base}{path}")
        check(f"{path} page is online", status == 200, str(status))

    status, _, _, _ = fetch(f"{base}/api/v1/admin/suggestions")
    check("admin needs the key", status == 401, str(status))

    if production:
        status, _, _, _ = fetch(f"{base}/docs")
        check("API docs are hidden", status == 404, str(status))
        check("HTTPS is enforced (HSTS)", "strict-transport-security" in headers)

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("base_url", help="for example https://haddak-api-ub67.onrender.com")
    parser.add_argument(
        "--dev", action="store_true", help="a development server: skip production-only checks"
    )
    args = parser.parse_args()

    failures = run_checks(args.base_url.rstrip("/"), production=not args.dev)
    if failures:
        print(f"\n{len(failures)} check(s) failed: {', '.join(failures)}")
        return 1
    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
