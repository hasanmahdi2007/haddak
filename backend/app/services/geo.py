"""Small helpers for working with map points.

PostGIS writes points as "POINT(longitude latitude)" - longitude first.
These helpers keep that detail in one place; everywhere else we pass
(lat, lng) in the usual order.
"""

from geoalchemy2 import WKTElement
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

SRID_WGS84 = 4326  # the standard GPS coordinate system


def point_for_storage(lat: float, lng: float) -> WKTElement:
    """Value to assign to Provider.location."""
    return WKTElement(f"POINT({lng} {lat})", srid=SRID_WGS84)


def point_for_query(lat: float, lng: float) -> ColumnElement:
    """A geography point to use inside a query (ST_DWithin, ST_Distance)."""
    return func.ST_GeogFromText(f"SRID={SRID_WGS84};POINT({lng} {lat})")


def project_point(
    db: Session, lat: float, lng: float, distance_m: float, bearing_deg: float
) -> tuple[float, float]:
    """Return the (lat, lng) that is exactly `distance_m` metres from the
    given point in the compass direction `bearing_deg` (0 = north, 90 = east).

    Used by the seed script and the tests to place providers at known
    distances. PostGIS does the maths, so it agrees with the search query.
    """
    if distance_m == 0:
        return lat, lng
    row = db.execute(
        text(
            "SELECT ST_Y(p::geometry), ST_X(p::geometry) FROM ("
            "  SELECT ST_Project(ST_GeogFromText(:origin), :distance, radians(:bearing)) AS p"
            ") AS projected"
        ),
        {
            "origin": f"SRID={SRID_WGS84};POINT({lng} {lat})",
            "distance": float(distance_m),
            "bearing": float(bearing_deg),
        },
    ).one()
    return row[0], row[1]
