"""A small load test: how many searches a second can one API instance serve?

    python scripts/load_test.py https://haddak-api-ub67.onrender.com
    python scripts/load_test.py http://localhost:8000 --seconds 30 --concurrency 20

Standard library only, so it runs anywhere Python does. It sends what the
app sends when someone searches, from several threads at once, for a fixed
time:
  - a list search (20 results), as on the results screen;
  - a map search (100 results), which the results screen also loads;
  - now and then a text search (q=...), the slowest kind.
Then it prints requests per second, response times (median, 95th and 99th
percentile) and the errors by kind.

Use it on purpose, not by habit: point it at the real server only when
nobody depends on it (it IS a burst of traffic), and note that the per-IP
rate limit (docs/API.md, "Rate limits") will answer 429 to one machine long
before the server is full. For a real measurement, run it against a Starter
instance with production-like data and TRUST_PROXY switched off for the test,
or from several machines. Record the result in docs/SYSTEM_DESIGN.md §7.1.
"""

import argparse
import json
import random
import statistics
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

# Points around Greater Beirut, so the database does not answer the same
# query from its cache every time.
POINTS = [
    (33.8547, 35.5097),  # Haret Hreik
    (33.8886, 35.4955),  # Hamra
    (33.8869, 35.5131),  # Achrafieh
    (33.8938, 35.5018),  # Downtown
    (33.8650, 35.5400),  # Sin el Fil
    (33.9808, 35.6178),  # Jounieh
]
WORDS = ["plumber", "سمكري", "pharmacy", "electrician", "laptop", "hamra", "ali"]
RADII = [1000, 5000, 20000]
TIMEOUT_SECONDS = 15


def one_request(base_url: str) -> tuple[str, float, str]:
    """Returns (kind, seconds, outcome) where outcome is "ok" or an error."""
    lat, lng = random.choice(POINTS)
    params = {"lat": lat, "lng": lng, "radius_m": random.choice(RADII), "limit": 20}
    roll = random.random()
    if roll < 0.4:
        kind = "map"
        params["limit"] = 100
    elif roll < 0.6:
        kind = "text"
        params["q"] = random.choice(WORDS)
    else:
        kind = "list"
    url = f"{base_url}/api/v1/providers/search?{urllib.parse.urlencode(params)}"
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as response:
            json.load(response)
            outcome = "ok"
    except urllib.error.HTTPError as error:
        outcome = f"HTTP {error.code}"
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        outcome = type(error).__name__
    return kind, time.perf_counter() - started, outcome


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(fraction * len(ordered)))]


def main() -> None:
    parser = argparse.ArgumentParser(description="Load test the search endpoint.")
    parser.add_argument("base_url", help="e.g. http://localhost:8000")
    parser.add_argument("--seconds", type=int, default=30)
    parser.add_argument("--concurrency", type=int, default=10, help="requests in flight")
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    results: list[tuple[str, float, str]] = []
    lock = threading.Lock()
    deadline = time.monotonic() + args.seconds

    def worker() -> None:
        while time.monotonic() < deadline:
            result = one_request(base_url)
            with lock:
                results.append(result)

    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        for _ in range(args.concurrency):
            pool.submit(worker)
    elapsed = time.monotonic() - started

    ok_times = [seconds for _kind, seconds, outcome in results if outcome == "ok"]
    print(f"{len(results)} requests in {elapsed:.1f} s with {args.concurrency} in flight")
    print(f"  successful: {len(ok_times)} ({len(ok_times) / elapsed:.1f} per second)")
    if ok_times:
        print(
            f"  response time: median {statistics.median(ok_times) * 1000:.0f} ms, "
            f"p95 {percentile(ok_times, 0.95) * 1000:.0f} ms, "
            f"p99 {percentile(ok_times, 0.99) * 1000:.0f} ms"
        )
    for kind in ("list", "map", "text"):
        times = [s for k, s, outcome in results if k == kind and outcome == "ok"]
        if times:
            print(f"  {kind:>4}: {len(times)} ok, median {statistics.median(times) * 1000:.0f} ms")
    errors = Counter(outcome for _kind, _seconds, outcome in results if outcome != "ok")
    for outcome, count in errors.most_common():
        print(f"  error {outcome}: {count}")


if __name__ == "__main__":
    main()
