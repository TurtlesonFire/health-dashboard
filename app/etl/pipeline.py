"""
ETL Pipeline: fetch from all sources, normalize, and store in database.
"""

import logging
from typing import List, Dict, Any
from datetime import date
from sqlalchemy.orm import Session

from app.models import Indicator, DataPoint, Region, SessionLocal, create_db
from app.etl.sources import run_all_sources

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_or_create_indicator(db: Session, data: Dict[str, Any]) -> tuple[Indicator, bool]:
    """Get existing indicator or create new one.

    Returns (indicator, created). The flag is returned explicitly rather than
    inferred from ``indicator.id is None`` at the call site: ``db.flush()``
    below assigns the primary key, so an id check always reported "existing"
    and the pipeline summary printed "0 indicators" no matter what it loaded.
    """
    indicator = db.query(Indicator).filter(
        Indicator.code == data["indicator_code"]
    ).first()
    if indicator:
        return indicator, False
    indicator = Indicator(
        code=data["indicator_code"],
        name=data["indicator_name"],
        category=data["category"],
        source=data["source"],
        unit=data["unit"],
        description=data.get("description"),
    )
    db.add(indicator)
    db.flush()
    return indicator, True


def get_or_create_region(db: Session, code: str, name: str = None,
                         island_group: str = None) -> Region:
    """Get existing region or create new one.

    Subnational rows carry a display name and island group; national rows do not.
    An existing row is backfilled rather than left with the code as its name,
    which is what the earlier code-or-name fallback produced.
    """
    region = db.query(Region).filter(Region.code == code).first()
    if not region:
        region = Region(code=code, name=name or code, island_group=island_group)
        db.add(region)
        db.flush()
    else:
        if name and region.name != name:
            region.name = name
        if island_group and region.island_group != island_group:
            region.island_group = island_group
    return region


def upsert_data_point(db: Session, indicator: Indicator, data: Dict[str, Any]) -> tuple[DataPoint, bool]:
    """Insert or update a data point. Returns (data_point, created).

    The match key includes quintile: without it a WQ1 row would silently
    overwrite the national total for the same (indicator, year, sex).
    """
    existing = db.query(DataPoint).filter(
        DataPoint.indicator_id == indicator.id,
        DataPoint.region_code == data.get("region_code"),
        DataPoint.year == data["year"],
        DataPoint.sex == data.get("sex"),
        DataPoint.age_group == data.get("age_group"),
        DataPoint.quintile == data.get("quintile"),
    ).first()

    if existing:
        existing.value = data["value"]
        existing.low = data.get("low")
        existing.high = data.get("high")
        existing.data_date = data.get("data_date")
        return existing, False
    else:
        dp = DataPoint(
            indicator_id=indicator.id,
            region_code=data.get("region_code"),
            year=data["year"],
            value=data["value"],
            low=data.get("low"),
            high=data.get("high"),
            quintile=data.get("quintile"),
            sex=data.get("sex"),
            age_group=data.get("age_group"),
            data_date=data.get("data_date"),
        )
        db.add(dp)
        return dp, True


def run_pipeline():
    """Full ETL pipeline: fetch, normalize, store."""
    logger.info("Starting ETL pipeline...")

    # Create tables if they don't exist
    create_db()
    logger.info("Database tables created/verified")

    # Fetch and normalize all data
    all_data = run_all_sources()
    logger.info(f"Total normalized records: {len(all_data)}")

    # Store in database
    db = SessionLocal()
    try:
        # Ensure PHL region exists
        get_or_create_region(db, "PHL", "Philippines")

        indicators_created = 0
        data_points_created = 0
        data_points_updated = 0

        for record in all_data:
            # Get or create indicator
            indicator, indicator_created = get_or_create_indicator(db, record)
            if indicator_created:
                indicators_created += 1

            # Get or create region
            if record.get("region_code"):
                get_or_create_region(db, record["region_code"],
                                     record.get("region_name"),
                                     record.get("island_group"))

            # Upsert data point
            _dp, dp_created = upsert_data_point(db, indicator, record)
            if dp_created:
                data_points_created += 1
            else:
                data_points_updated += 1

        db.commit()

        # Report the resulting totals as well as this run's deltas: on a
        # re-run every data point is an update, so "0 created" is expected
        # and would otherwise look like a failure.
        totals = (
            db.query(Indicator).count(),
            db.query(DataPoint).count(),
        )
        logger.info(
            f"Pipeline complete: {indicators_created} indicators created, "
            f"{data_points_created} data points created, "
            f"{data_points_updated} updated"
        )
        logger.info(f"Database now holds {totals[0]} indicators, {totals[1]} data points")
    except Exception as e:
        db.rollback()
        logger.error(f"Pipeline failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_pipeline()
