"""
ETL Pipeline for Health Systems Data Dashboard

Pluggable source architecture: each data source implements the DataSource interface.
Adding a new source (e.g., PSA scraping) = create a new class + register it here.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import date
import requests
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataSource(ABC):
    """Base interface for all data sources."""

    @abstractmethod
    def fetch(self) -> List[Dict[str, Any]]:
        """Fetch raw data from the source API."""
        pass

    @abstractmethod
    def normalize(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize raw data to common schema:
        {
            'indicator_code': str,
            'indicator_name': str,
            'category': str,
            'source': str,
            'unit': str,
            'region_code': str,
            'year': int,
            'value': float,
            'low': float or None,       # CI lower bound, where the source provides one
            'high': float or None,      # CI upper bound
            'quintile': str or None,    # wealth quintile; None = undisaggregated total
            'sex': str or None,
            'age_group': str or None,
            'data_date': date or None,
        }
        """
        pass

    def run(self) -> List[Dict[str, Any]]:
        """Full ETL: fetch + normalize."""
        logger.info(f"[{self.__class__.__name__}] Fetching data...")
        raw = self.fetch()
        logger.info(f"[{self.__class__.__name__}] Fetched {len(raw)} records")
        normalized = self.normalize(raw)
        logger.info(f"[{self.__class__.__name__}] Normalized to {len(normalized)} records")
        return normalized


class WHOGHOSource(DataSource):
    """WHO Global Health Observatory API source."""

    BASE_URL = "https://ghoapi.azureedge.net/api"

    # Indicators we want from WHO GHO
    INDICATORS = {
        "WHOSIS_000001": {
            "name": "Life expectancy at birth (years)",
            "category": "health_status",
            "unit": "years",
        },
        "WHOSIS_000002": {
            "name": "Healthy life expectancy (HALE) at birth (years)",
            "category": "health_status",
            "unit": "years",
        },
        "WHOSIS_000015": {
            "name": "Life expectancy at age 60 (years)",
            "category": "health_status",
            "unit": "years",
        },
        "MDG_0000000007": {
            "name": "Under-five mortality rate (probability of dying by age 5 per 1000 live births)",
            "category": "health_status",
            "unit": "per_1000",
        },
        "MDG_0000000026": {
            "name": "Maternal mortality ratio (per 100,000 live births)",
            "category": "health_status",
            "unit": "per_100000",
        },
        "UHC_INDEX_REPORTED": {
            "name": "UHC service coverage index",
            "category": "health_system",
            "unit": "index",
        },
        "MDG_0000000020": {
            "name": "Tuberculosis incidence (per 100,000 population per year)",
            "category": "disease_burden",
            "unit": "per_100000",
        },
        "MALARIA_CONF_CASES": {
            "name": "Confirmed malaria cases",
            "category": "disease_burden",
            "unit": "count",
        },
        "SDGHIV": {
            "name": "New HIV infections (per 1,000 uninfected population)",
            "category": "disease_burden",
            "unit": "per_1000",
        },
        "WHS2_131": {
            "name": "Age-standardized NCD mortality rate (per 100,000 population)",
            "category": "disease_burden",
            "unit": "per_100000",
        },
        "MH_12": {
            "name": "Age-standardized suicide rates (per 100,000 population)",
            "category": "disease_burden",
            "unit": "per_100000",
        },
        "M_Est_tob_curr": {
            "name": "Current tobacco use prevalence (%)",
            "category": "risk_factors",
            "unit": "percent",
        },
        "SA_0000001688_ARCHIVED": {
            "name": "Total alcohol per capita consumption (15+) in litres",
            "category": "risk_factors",
            "unit": "litres",
        },
        "NCD_BMI_30A": {
            "name": "Obesity among adults, BMI ≥ 30 (age-standardized estimate) (%)",
            "category": "risk_factors",
            "unit": "percent",
        },
    }

    def fetch(self) -> List[Dict[str, Any]]:
        """Fetch data from WHO GHO API for all configured indicators."""
        all_data = []
        for code in self.INDICATORS:
            url = f"{self.BASE_URL}/{code}?$filter=SpatialDim eq 'PHL'"
            try:
                resp = requests.get(url, timeout=30)
                resp.raise_for_status()
                data = resp.json()
                for item in data.get("value", []):
                    item["_indicator_code"] = code
                all_data.extend(data.get("value", []))
                time.sleep(0.5)  # Be polite to the API
            except Exception as e:
                logger.error(f"WHO GHO fetch failed for {code}: {e}")
        return all_data

    def normalize(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize WHO GHO response to common schema.

        Keeps national totals *and* wealth-quintile breakdowns. Totals are stored
        with quintile=None so every pre-existing (quintile-unaware) query keeps
        returning exactly one row per year; disaggregated rows carry their
        WEALTHQUINTILE_* code and are only returned by the quintile endpoints.
        """
        normalized = []
        for item in raw_data:
            code = item.get("_indicator_code")
            if code not in self.INDICATORS:
                continue

            # Dim3 is a generic disaggregation slot. Only treat it as a wealth
            # quintile when the dimension type says so, otherwise another
            # indicator's unrelated Dim3 breakdown would be mislabelled.
            dim3 = item.get("Dim3")
            if item.get("Dim3Type") == "WEALTHQUINTILE":
                quintile = None if dim3 == "WEALTHQUINTILE_TOTL" else dim3
            else:
                quintile = None

            meta = self.INDICATORS[code]
            normalized.append({
                "indicator_code": code,
                "indicator_name": meta["name"],
                "category": meta["category"],
                "source": "who_gho",
                "unit": meta["unit"],
                "region_code": "PHL",
                "year": item.get("TimeDim"),
                "value": item.get("NumericValue"),
                "low": item.get("Low"),
                "high": item.get("High"),
                "quintile": quintile,
                "sex": item.get("Dim1"),
                "age_group": item.get("Dim2"),
                "data_date": None,
            })
        return normalized


class WorldBankSource(DataSource):
    """World Bank API source."""

    BASE_URL = "https://api.worldbank.org/v2"

    # Indicators we want from World Bank
    INDICATORS = {
        "SH.XPD.CHEX.GD.ZS": {
            "name": "Current health expenditure (% of GDP)",
            "category": "health_system",
            "unit": "percent",
        },
        "SH.XPD.CHEX.PC.CD": {
            "name": "Current health expenditure per capita (current US$)",
            "category": "health_system",
            "unit": "usd",
        },
        "SH.XPD.OOPC.CH.ZS": {
            "name": "Out-of-pocket expenditure (% of current health expenditure)",
            "category": "health_system",
            "unit": "percent",
        },
        "SH.MED.BEDS.ZS": {
            "name": "Hospital beds (per 1,000 people)",
            "category": "health_system",
            "unit": "per_1000",
        },
        "SH.MED.PHYS.ZS": {
            "name": "Physicians (per 1,000 people)",
            "category": "health_system",
            "unit": "per_1000",
        },
        "SH.DYN.MORT": {
            "name": "Mortality rate, under-5 (per 1,000 live births)",
            "category": "health_status",
            "unit": "per_1000",
        },
        "SP.DYN.IMRT.IN": {
            "name": "Mortality rate, infant (per 1,000 live births)",
            "category": "health_status",
            "unit": "per_1000",
        },
        "SH.H2O.SMDW.ZS": {
            "name": "People using safely managed drinking water services (% of population)",
            "category": "context",
            "unit": "percent",
        },
        "SH.STA.SMSS.ZS": {
            "name": "People using safely managed sanitation services (% of population)",
            "category": "context",
            "unit": "percent",
        },
        "SP.POP.TOTL": {
            "name": "Population, total",
            "category": "context",
            "unit": "count",
        },
        "NY.GDP.PCAP.CD": {
            "name": "GDP per capita (current US$)",
            "category": "context",
            "unit": "usd",
        },
        "SP.POP.65UP.TO.ZS": {
            "name": "Population ages 65 and above (% of total population)",
            "category": "context",
            "unit": "percent",
        },
        "SH.MED.NURS.ZS": {
            "name": "Nurses and midwives (per 1,000 people)",
            "category": "health_system",
            "unit": "per_1000",
        },
        "SH.IMM.IDPT": {
            "name": "Immunization, DPT (% of children ages 12-23 months)",
            "category": "health_system",
            "unit": "percent",
        },
        "SH.IMM.MEAS": {
            "name": "Immunization, measles (% of children ages 12-23 months)",
            "category": "health_system",
            "unit": "percent",
        },
        "SH.STA.ACSN": {
            "name": "Access to clean fuels and technologies for cooking (% of population)",
            "category": "context",
            "unit": "percent",
        },
        "SH.DYN.MORT.MA": {
            "name": "Under-5 mortality rate, male (per 1,000 live births)",
            "category": "health_status",
            "unit": "per_1000",
        },
        "SH.DYN.MORT.FE": {
            "name": "Under-5 mortality rate, female (per 1,000 live births)",
            "category": "health_status",
            "unit": "per_1000",
        },
        "SP.DYN.TFRT.IN": {
            "name": "Fertility rate, total (births per woman)",
            "category": "context",
            "unit": "births_per_woman",
        },
        "SH.STA.MMRT": {
            "name": "Maternal mortality ratio (per 100,000 live births)",
            "category": "health_status",
            "unit": "per_100000",
        },
    }

    def fetch(self) -> List[Dict[str, Any]]:
        """Fetch data from World Bank API for all configured indicators."""
        all_data = []
        for code in self.INDICATORS:
            url = f"{self.BASE_URL}/country/PHL/indicator/{code}?format=json&per_page=100"
            try:
                resp = requests.get(url, timeout=30)
                resp.raise_for_status()
                data = resp.json()
                # World Bank returns [metadata, data] or just [metadata] if no data
                if len(data) > 1 and data[1]:
                    for item in data[1]:
                        item["_indicator_code"] = code
                    all_data.extend(data[1])
                time.sleep(0.5)
            except Exception as e:
                logger.error(f"World Bank fetch failed for {code}: {e}")
        return all_data

    def normalize(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize World Bank response to common schema."""
        normalized = []
        for item in raw_data:
            code = item.get("_indicator_code")
            if code not in self.INDICATORS:
                continue
            meta = self.INDICATORS[code]
            value = item.get("value")
            # Skip null values (future years)
            if value is None:
                continue
            normalized.append({
                "indicator_code": code,
                "indicator_name": meta["name"],
                "category": meta["category"],
                "source": "world_bank",
                "unit": meta["unit"],
                "region_code": "PHL",
                "year": int(item.get("date")) if item.get("date") else None,
                "value": float(value) if value is not None else None,
                "low": None,
                "high": None,
                "quintile": None,
                "sex": None,
                "age_group": None,
                "data_date": None,
            })
        return normalized


# Registry of all sources — add new sources here
SOURCES = [
    WHOGHOSource(),
    WorldBankSource(),
    # PSASource(),  # TODO: Add when we tackle scraping
    # DOHFHSISSource(),  # TODO: Add when we tackle scraping
]


def run_all_sources() -> List[Dict[str, Any]]:
    """Run all registered sources and return combined normalized data."""
    all_data = []
    for source in SOURCES:
        try:
            data = source.run()
            all_data.extend(data)
        except Exception as e:
            logger.error(f"Source {source.__class__.__name__} failed: {e}")
    return all_data
