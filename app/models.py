from sqlalchemy import create_engine, Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///C:/Users/Asus/health-dashboard/data/health3.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Region(Base):
    __tablename__ = "regions"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    island_group = Column(String(20))
    geometry = Column(Text)  # GeoJSON string

    data_points = relationship("DataPoint", back_populates="region")


class Indicator(Base):
    __tablename__ = "indicators"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100))
    source = Column(String(50), nullable=False)  # 'who_gho', 'world_bank', 'psa', 'doh'
    unit = Column(String(50))
    description = Column(Text)
    who_code = Column(String(50))
    wb_code = Column(String(50))

    data_points = relationship("DataPoint", back_populates="indicator")


class DataPoint(Base):
    __tablename__ = "data_points"
    id = Column(Integer, primary_key=True, index=True)
    indicator_id = Column(Integer, ForeignKey("indicators.id"), nullable=False)
    region_code = Column(String(20), ForeignKey("regions.code"), nullable=True)
    year = Column(Integer, nullable=False, index=True)
    value = Column(Numeric)
    low = Column(Numeric)   # CI lower bound (WHO GHO); NULL where the source has none
    high = Column(Numeric)  # CI upper bound
    sex = Column(String(10))
    age_group = Column(String(50))
    # Wealth-quintile disaggregation (WHO GHO Dim3). NULL = national/undisaggregated
    # total, which keeps every pre-existing query backward compatible.
    quintile = Column(String(30), index=True)
    data_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)

    indicator = relationship("Indicator", back_populates="data_points")
    region = relationship("Region", back_populates="data_points")


def create_db():
    Base.metadata.create_all(bind=engine)
    ensure_columns()


# Columns added after the initial schema shipped. create_all() only creates
# missing *tables*, so an existing SQLite file needs an explicit ALTER TABLE.
_ADDED_COLUMNS = {
    "low": "NUMERIC",
    "high": "NUMERIC",
    "quintile": "VARCHAR(30)",
}


def ensure_columns():
    """Idempotently add post-initial columns to an existing database."""
    from sqlalchemy import text, inspect

    existing = {c["name"] for c in inspect(engine).get_columns("data_points")}
    missing = {n: t for n, t in _ADDED_COLUMNS.items() if n not in existing}
    if not missing:
        return []
    with engine.begin() as conn:
        for name, sqltype in missing.items():
            conn.execute(text(f"ALTER TABLE data_points ADD COLUMN {name} {sqltype}"))
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_data_points_quintile "
                 "ON data_points (quintile)")
        )
    return list(missing)



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
