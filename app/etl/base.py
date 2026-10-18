"""
The source interface every ETL data source implements.

Lives in its own module so `sources.py` can import concrete sources (which
implement this interface) without a cycle: sources.py -> psa.py -> sources.py
would otherwise be circular.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List

import logging

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
            'region_code': str,         # 'PHL' for national rows
            'region_name': str or None, # display name for subnational rows
            'island_group': str or None,
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
