"""Stories grouped by provider: used by "stories nearby" and "my feed"."""

from sqlalchemy import func, null, select
from sqlalchemy.orm import Session

from app.models import Provider, Story
from app.schemas import StoryGroup, StoryOut
from app.services.geo import point_for_query
from app.services.posts import active_stories
from app.services.provider_views import current_time, to_summaries

MAX_PROVIDERS = 30


def load_story_groups(
    db: Session,
    provider_filters: list,
    *,
    lat: float | None = None,
    lng: float | None = None,
) -> list[StoryGroup]:
    """Verified providers that match `provider_filters` and have an active
    story, each with its stories. The provider with the newest story is first.

    Pass lat and lng to also get each provider's distance from that point.
    The number of queries is fixed (four), however many providers match.
    """
    now = current_time()

    # A small table built inside the query: one line per provider that has an
    # active story, with the time of its newest one.
    newest = (
        select(Story.provider_id, func.max(Story.created_at).label("newest_at"))
        .where(Story.expires_at > now)
        .group_by(Story.provider_id)
        .subquery()
    )

    if lat is not None and lng is not None:
        distance_m = func.ST_Distance(Provider.location, point_for_query(lat, lng))
    else:
        distance_m = null()  # the feed has no "distance from me"

    # 1. Which providers, in which order.
    query = (
        select(Provider, distance_m)
        .join(newest, newest.c.provider_id == Provider.id)
        .where(Provider.status == "verified", *provider_filters)
        .order_by(newest.c.newest_at.desc(), Provider.id)
        .limit(MAX_PROVIDERS)
    )
    rows = [(provider, distance) for provider, distance in db.execute(query)]

    # 2. All their active stories in one query, then sorted into a dict
    #    provider id -> stories (still newest first).
    stories_by_provider: dict = {provider.id: [] for provider, _ in rows}
    for story in active_stories(db, list(stories_by_provider), now):
        stories_by_provider[story.provider_id].append(StoryOut.model_validate(story))

    # 3. The provider summaries (two more queries, see to_summaries).
    summaries = to_summaries(db, rows)
    return [
        StoryGroup(provider=summary, stories=stories_by_provider[summary.id])
        for summary in summaries
    ]
