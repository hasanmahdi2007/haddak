"""Works out "open now" from a provider's opening hours.

The hours look like this (see docs/API.md, "Opening hours"):

    {"mon": [["09:00", "13:00"], ["15:00", "19:00"]], "sat": [["10:00", "14:00"]]}

A missing day means closed that day. No hours at all (None) means the
provider did not tell us, and the answer is None ("unknown").
"""

from datetime import datetime
from zoneinfo import ZoneInfo

# Opening hours are Lebanon local time. ZoneInfo knows the daylight-saving
# rules, so 09:00 means 09:00 on the shop's clock in summer and in winter.
BEIRUT = ZoneInfo("Asia/Beirut")

# Same order as datetime.weekday(): Monday is 0, Sunday is 6.
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def beirut_day_and_time(now: datetime) -> tuple[str, str]:
    """("mon", "09:30"): the day key and the "HH:MM" clock time in Beirut.

    Shared by is_open_now below and by the open_now search filter, so both
    always agree on what "open now" means.
    """
    local = now.astimezone(BEIRUT)
    return DAY_KEYS[local.weekday()], local.strftime("%H:%M")


def is_open_now(opening_hours: dict | None, now: datetime) -> bool | None:
    """True if `now` falls inside one of today's ranges, in Beirut time.

    `now` must carry a timezone (e.g. datetime.now(UTC)); it is converted to
    Beirut time here. A pure function: it reads no clock and no database, so
    tests can pass any moment they like.

    Open from the opening minute up to, but not including, the closing
    minute: with ["09:00", "13:00"], 09:00 is open and 13:00 is closed.
    """
    if opening_hours is None:
        return None

    today, time_text = beirut_day_and_time(now)
    # "HH:MM" texts compare correctly as plain strings ("09:05" < "13:00").

    for open_time, close_time in opening_hours.get(today, []):
        if open_time <= time_text < close_time:
            return True
    return False
