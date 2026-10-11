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


def get_or_create_indicator(db: Session, data: Dict[str, Any]) -> Indicator:
    """Get existing indicator or create new one."""
    indicator = db.query(Indicator).filter(
        Indicator.code == data["indicator_code"]
    ).first()
    if not indicator:
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
    return indicator


def get_or_create_region(db: Session, code: str, name: str = None) -> Region:
    """Get existing region or create new one."""
    region = db.query(Region).filter(Region.code == code).first()
    if not region:
        region = Region(code=code, name=name or code)
        db.add(region)
        db.flush()
    return region


def upsert_data_point(db: Session, indicator: Indicator, data: Dict[str, Any]) -> DataPoint:
    """Insert or update a data point.

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
        return existing
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
        return dp


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

        for record in all_data:
            # Get or create indicator
            indicator = get_or_create_indicator(db, record)
            if indicator.id is None:
                indicators_created += 1

            # Get or create region
            if record.get("region_code"):
                get_or_create_region(db, record["region_code"])

            # Upsert data point
            dp = upsert_data_point(db, indicator, record)
            if dp.id is None:
                data_points_created += 1

        db.commit()
        logger.info(f"Pipeline complete: {indicators_created} indicators, {data_points_created} data points")
    except Exception as e:
        db.rollback()
        logger.error(f"Pipeline failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_pipeline()
