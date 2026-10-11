"""
FastAPI backend for Health Systems Data Dashboard.
"""

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date

from app.models import create_db, get_db, Indicator, DataPoint, Region
from app.metric_info import METRIC_INFO

app = FastAPI(
    title="PH Health Systems Data Dashboard API",
    description="API for Philippine health indicators from WHO GHO and World Bank",
    version="0.1.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
@app.on_event("startup")
def startup_event():
    create_db()


# Pydantic schemas
class IndicatorResponse(BaseModel):
    id: int
    code: str
    name: str
    category: str
    source: str
    unit: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class DataPointResponse(BaseModel):
    id: int
    indicator_id: int
    region_code: Optional[str]
    year: int
    value: Optional[float]
    low: Optional[float] = None
    high: Optional[float] = None
    quintile: Optional[str] = None
    sex: Optional[str]
    age_group: Optional[str]
    data_date: Optional[date]

    class Config:
        from_attributes = True


class IndicatorWithData(IndicatorResponse):
    data_points: List[DataPointResponse]


class CategoryResponse(BaseModel):
    category: str
    count: int


class QuintilePoint(BaseModel):
    year: int
    value: Optional[float]
    low: Optional[float] = None
    high: Optional[float] = None


class QuintileSeries(BaseModel):
    code: str        # "Q1" .. "Q5", or "TOTAL"
    quintile: str    # raw WHO code, e.g. WEALTHQUINTILE_WQ1
    label: str       # "Poorest (Q1)"
    points: List[QuintilePoint]


class QuintileComparison(BaseModel):
    indicator_code: str
    indicator_name: str
    unit: Optional[str] = None
    source: str
    sex: str
    years: List[int]
    series: List[QuintileSeries]
    latest_year: Optional[int] = None
    # Health-equity framing: how many times higher the poorest quintile's value
    # is than the richest. >1 means the burden falls on the poorest.
    equity_ratio: Optional[float] = None
    absolute_gap: Optional[float] = None


# WHO GHO WEALTHQUINTILE dimension codes -> display metadata.
QUINTILE_META = {
    "WEALTHQUINTILE_WQ1": ("Q1", "Poorest (Q1)", "#b91c1c"),
    "WEALTHQUINTILE_WQ2": ("Q2", "Second (Q2)", "#ea580c"),
    "WEALTHQUINTILE_WQ3": ("Q3", "Middle (Q3)", "#ca8a04"),
    "WEALTHQUINTILE_WQ4": ("Q4", "Fourth (Q4)", "#65a30d"),
    "WEALTHQUINTILE_WQ5": ("Q5", "Richest (Q5)", "#15803d"),
}


# API Endpoints

@app.get("/")
def root():
    return {
        "message": "PH Health Systems Data Dashboard API",
        "version": "0.1.0",
        "endpoints": [
            "/indicators",
            "/indicators/{code}",
            "/data/{indicator_code}",
            "/data/{indicator_code}/quintiles",
            "/categories",
            "/health",
        ],
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/indicators", response_model=List[IndicatorResponse])
def list_indicators(
    category: Optional[str] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all indicators, optionally filtered by category or source."""
    query = db.query(Indicator)
    if category:
        query = query.filter(Indicator.category == category)
    if source:
        query = query.filter(Indicator.source == source)
    return query.all()


@app.get("/indicators/{code}", response_model=IndicatorWithData)
def get_indicator(
    code: str,
    include_quintiles: bool = False,
    db: Session = Depends(get_db),
):
    """Get a single indicator with its data points.

    Quintile-disaggregated rows are excluded unless include_quintiles=true, so
    this keeps returning one national row per year.
    """
    indicator = db.query(Indicator).filter(Indicator.code == code).first()
    if not indicator:
        raise HTTPException(status_code=404, detail=f"Indicator {code} not found")

    # Build the response rather than filtering indicator.data_points in place:
    # assigning to a loaded relationship marks it dirty and can cascade-delete
    # the very rows we are excluding.
    points = indicator.data_points
    if not include_quintiles:
        points = [dp for dp in points if dp.quintile is None]

    return IndicatorWithData(
        id=indicator.id,
        code=indicator.code,
        name=indicator.name,
        category=indicator.category,
        source=indicator.source,
        unit=indicator.unit,
        description=indicator.description,
        data_points=points,
    )


@app.get("/metric-info")
def get_all_metric_info():
    """Plain-language description of every metric, keyed by indicator code.

    Editorial content (what the metric means, how to use it) that no upstream
    API provides. Static per deploy, so the frontend fetches it once and caches.
    """
    return METRIC_INFO


@app.get("/data/{indicator_code}", response_model=List[DataPointResponse])
def get_indicator_data(
    indicator_code: str,
    year: Optional[int] = None,
    region: Optional[str] = None,
    include_quintiles: bool = False,
    db: Session = Depends(get_db),
):
    """Get data points for a specific indicator.

    Quintile-disaggregated rows are excluded by default — they would otherwise
    return several values per year and make a plain trend line oscillate.
    Use /data/{indicator_code}/quintiles for the wealth-quintile breakdown.
    """
    indicator = db.query(Indicator).filter(Indicator.code == indicator_code).first()
    if not indicator:
        raise HTTPException(status_code=404, detail=f"Indicator {indicator_code} not found")

    query = db.query(DataPoint).filter(DataPoint.indicator_id == indicator.id)
    if not include_quintiles:
        query = query.filter(DataPoint.quintile.is_(None))
    if year:
        query = query.filter(DataPoint.year == year)
    if region:
        query = query.filter(DataPoint.region_code == region)
    return query.order_by(DataPoint.year).all()


@app.get("/data/{indicator_code}/quintiles", response_model=QuintileComparison)
def get_indicator_quintiles(
    indicator_code: str,
    sex: str = "SEX_BTSX",
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Wealth-quintile breakdown for an indicator (WHO GHO WEALTHQUINTILE dim).

    Returns one series per quintile (Q1 poorest .. Q5 richest) plus the national
    total, so the frontend can compare quintiles over time or as a single-year
    cross-section. Only indicators that actually carry the dimension have data.
    """
    indicator = db.query(Indicator).filter(Indicator.code == indicator_code).first()
    if not indicator:
        raise HTTPException(status_code=404, detail=f"Indicator {indicator_code} not found")

    rows = db.query(DataPoint).filter(
        DataPoint.indicator_id == indicator.id,
        DataPoint.sex == sex,
    ).order_by(DataPoint.year).all()

    if not any(r.quintile for r in rows):
        raise HTTPException(
            status_code=404,
            detail=(
                f"Indicator {indicator_code} has no wealth-quintile disaggregation "
                f"for sex={sex}"
            ),
        )

    def in_range(r) -> bool:
        if year_from is not None and r.year < year_from:
            return False
        if year_to is not None and r.year > year_to:
            return False
        return True

    # Build one series per quintile, plus the undisaggregated total.
    buckets: dict = {code: [] for code in QUINTILE_META}
    total_points: List[QuintilePoint] = []
    for r in rows:
        if not in_range(r):
            continue
        point = QuintilePoint(
            year=r.year,
            value=float(r.value) if r.value is not None else None,
            low=float(r.low) if r.low is not None else None,
            high=float(r.high) if r.high is not None else None,
        )
        if r.quintile is None:
            total_points.append(point)
        elif r.quintile in buckets:
            buckets[r.quintile].append(point)

    series = [
        QuintileSeries(code=code, quintile=qcode, label=label, points=buckets[qcode])
        for qcode, (code, label, _color) in QUINTILE_META.items()
        if buckets[qcode]
    ]

    # Latest year in which all five quintiles are present — the cross-section
    # the comparison view defaults to.
    def years_of(qcode: str) -> set:
        return {p.year for p in buckets[qcode]}

    present = [s.quintile for s in series if s.code != "TOTAL"]
    common = set.intersection(*(years_of(q) for q in present)) if present else set()
    latest_year = max(common) if common else None

    equity_ratio = None
    absolute_gap = None
    if latest_year is not None:
        poorest = next(
            (p.value for p in buckets["WEALTHQUINTILE_WQ1"] if p.year == latest_year), None
        )
        richest = next(
            (p.value for p in buckets["WEALTHQUINTILE_WQ5"] if p.year == latest_year), None
        )
        if poorest is not None and richest not in (None, 0):
            equity_ratio = round(poorest / richest, 2)
            absolute_gap = round(poorest - richest, 1)

    if total_points:
        series.append(
            QuintileSeries(
                code="TOTAL",
                quintile="WEALTHQUINTILE_TOTL",
                label="National total",
                points=total_points,
            )
        )

    return QuintileComparison(
        indicator_code=indicator.code,
        indicator_name=indicator.name,
        unit=indicator.unit,
        source=indicator.source,
        sex=sex,
        years=sorted({p.year for s in series for p in s.points}),
        series=series,
        latest_year=latest_year,
        equity_ratio=equity_ratio,
        absolute_gap=absolute_gap,
    )


@app.get("/categories", response_model=List[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """List all indicator categories with counts."""
    from sqlalchemy import func
    results = db.query(
        Indicator.category,
        func.count(Indicator.id).label("count")
    ).group_by(Indicator.category).all()
    return [CategoryResponse(category=r[0], count=r[1]) for r in results]


@app.get("/sources")
def list_sources():
    """List all data sources."""
    return {
        "sources": [
            {"code": "who_gho", "name": "WHO Global Health Observatory", "status": "active"},
            {"code": "world_bank", "name": "World Bank", "status": "active"},
            {"code": "psa", "name": "Philippine Statistics Authority", "status": "planned"},
            {"code": "doh", "name": "Department of Health", "status": "planned"},
        ]
    }
