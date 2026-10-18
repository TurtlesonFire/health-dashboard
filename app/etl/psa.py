"""
PSA OpenSTAT source — subnational registered deaths.

PSA publishes registered deaths through OpenSTAT, a PxWeb instance (the same
server family as Statistics Sweden's and Eurostat's). The mechanics below are
PxWeb mechanics, not PSA quirks, but several fail *silently* or with a bare HTTP
403, so they are spelled out.

WHY THIS IS NOT A PDF SCRAPER
-----------------------------
PSA's press releases are PDFs; the underlying tables are not. The regional
cause-of-death cube is queryable, so it needs no text extraction. DOH FHSIS is
the opposite case — DOH states it cannot supply FHSIS in Excel/CSV — so that
source genuinely does need PDF work.

VERIFIED TRAPS
--------------
1. Metadata via GET, data via POST. A GET cannot return a single cell.
2. Every dimension needs an explicit value list. PxWeb expands an unselected
   dimension to all of its values and PSA answers the full-cube request with
   HTTP 403 — which looks like an auth failure and is not.
3. ``format: json-stat2`` IS BROKEN here: a 2,320-cell cube comes back with a
   ``value`` array of length 1. A json-stat2 parser yields one number and no
   error. Use CSV.
4. CSV is a PIVOT: the last two dimensions in metadata order become columns, the
   rest stay on rows. With Year varying, the header becomes "2013 Both Sexes",
   "2014 Both Sexes", ... So a multi-valued dimension must either be pinned to a
   single value per request or parsed out of the column names.
5. The CSV carries dimension *labels*, not codes, and the measure column is named
   after the selected values ("Total Both Sexes"). Codes are recovered by mapping
   labels back through the metadata.
6. Missing cells are ``".."``, never 0. Coercing them to 0 would invent deaths.
7. Region identity must key on the PSGC code pattern, NOT the label's dot depth.
   In the 2013-2023 table PSA flattens REGION III and MIMAROPA to depth 0 while
   every other region sits at depth 2.
8. Cause identity must key on the ``1-0NN`` number, NOT on dot depth or casing.
   The 2024 table puts ICD-10 chapters at depth 0 with no ICD ranges and writes
   "Total"; the 2023 table puts them at depth 2, appends ranges ("A00-B99") and
   writes "TOTAL". The ``1-0NN`` numbers are identical in both (104 distinct,
   zero differences), so they are the only stable handle.
9. Coverage shifts: NIR (1800000000) exists only from 2024, so a regional series
   legitimately has a gap for it earlier.
10. PSA's metadata contains U+0085 control characters where an ellipsis belongs.
    Matching on the numeric code avoids depending on that text.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import csv
import io
import logging
import re
import time
from typing import Any, Dict, List, Optional

import requests

from app.etl.base import DataSource

logger = logging.getLogger(__name__)

# PSGC region codes are two significant digits followed by eight zeros
# (1300000000 = NCR). Provinces and cities do not match: Abra is 1400100000,
# Caloocan is 1380100000.
_REGION_CODE_RE = re.compile(r"^\d{2}0{8}$")

# Cause codes look like "1-064" inside a label that may be dot-prefixed, may be
# upper-cased, and may carry an ICD-10 range suffix.
_CAUSE_NUM_RE = re.compile(r"1-(\d{3})")
_CAUSE_PREFIX_RE = re.compile(r"^[.\s\u0085…]*1-\d{3}[a-z]?\s*")
_ICD_RANGE_RE = re.compile(r"\s+[A-Z]\d{2}(?:\.\d+)?(?:-[A-Z]?\d{2}(?:\.\d+)?)?\s*$")

NATIONAL_CODE = "608"          # label "PHILIPPINES" / "Philippines"
FOREIGN_CODE = "9999999999"    # not a Philippine region; excluded from rankings
TOTAL_LABEL = "TOTAL"          # upper-cased before comparison; 2023 writes "TOTAL"

PH_REGIONS: Dict[str, tuple[str, str]] = {
    "1300000000": ("National Capital Region (NCR)", "Luzon"),
    "1400000000": ("Cordillera Administrative Region (CAR)", "Luzon"),
    "0100000000": ("Region I (Ilocos Region)", "Luzon"),
    "0200000000": ("Region II (Cagayan Valley)", "Luzon"),
    "0300000000": ("Region III (Central Luzon)", "Luzon"),
    "0400000000": ("Region IV-A (CALABARZON)", "Luzon"),
    "1700000000": ("MIMAROPA Region", "Luzon"),
    "0500000000": ("Region V (Bicol Region)", "Luzon"),
    "0600000000": ("Region VI (Western Visayas)", "Visayas"),
    "1800000000": ("Negros Island Region (NIR)", "Visayas"),
    "0700000000": ("Region VII (Central Visayas)", "Visayas"),
    "0800000000": ("Region VIII (Eastern Visayas)", "Visayas"),
    "0900000000": ("Region IX (Zamboanga Peninsula)", "Mindanao"),
    "1000000000": ("Region X (Northern Mindanao)", "Mindanao"),
    "1100000000": ("Region XI (Davao Region)", "Mindanao"),
    "1200000000": ("Region XII (SOCCSKSARGEN)", "Mindanao"),
    "1600000000": ("Region XIII (Caraga)", "Mindanao"),
    "1900000000": ("Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)", "Mindanao"),
}

# The 19 ICD-10 mortality chapters, keyed by the number PSA embeds in the label.
# Names are curated so the two years' differing wording and the U+0085 control
# characters never reach the UI. These chapters are mutually exclusive and sum to
# the all-cause total, which is what makes a share-of-total view honest.
#
# Note: PSA's press releases headline *specific* causes (ischaemic heart disease,
# cerebrovascular disease, pneumonia), which are sub-causes of these chapters and
# therefore NOT additive with them. Those belong in a separate, clearly-labelled
# view rather than mixed into this one.
ICD10_CHAPTERS: Dict[str, str] = {
    "001": "Certain infectious and parasitic diseases",
    "026": "Neoplasms",
    "048": "Diseases of the blood and blood-forming organs",
    "051": "Endocrine, nutritional and metabolic diseases",
    "055": "Mental and behavioural disorders",
    "058": "Diseases of the nervous system",
    "062": "Diseases of the eye and adnexa",
    "063": "Diseases of the ear and mastoid process",
    "064": "Diseases of the circulatory system",
    "072": "Diseases of the respiratory system",
    "078": "Diseases of the digestive system",
    "082": "Diseases of the skin and subcutaneous tissue",
    "083": "Diseases of the musculoskeletal system and connective tissue",
    "084": "Diseases of the genitourinary system",
    "087": "Pregnancy, childbirth and the puerperium",
    "092": "Certain conditions originating in the perinatal period",
    "093": "Congenital malformations and chromosomal abnormalities",
    "094": "Symptoms, signs and abnormal findings, not elsewhere classified",
    "095": "External causes of morbidity and mortality",
}

ALL_CAUSES_CODE = "PSA_DEATHS_ALL_CAUSES"

TABLES: List[Dict[str, Any]] = [
    {
        # 12-year regional series of all-cause deaths by region of usual
        # residence. Year is pinned per request (see trap 4).
        "path": "1A/VS/DE/0361A1ADEA0.px",
        "role": "all_causes_series",
        "dims": {"Geolocation": "regions", "Year": "all", "Sex": ["0"]},
    },
    {
        "path": "1A/VS/DE/0131A1BDEE7.px",
        "role": "cause_by_region",
        "year": 2024,
        "dims": {"Geolocation": "regions", "Cause of Death": "chapters",
                 "Age Group": ["0"], "Sex": ["0"]},
    },
    {
        "path": "1A/VS/DE/0481A1ADEB2.px",
        "role": "cause_by_region",
        "year": 2023,
        "dims": {"Geolocation": "regions", "Cause of Death": "chapters",
                 "Age Group": ["0"], "Sex": ["0"]},
    },
]


def cause_number(label: str) -> Optional[str]:
    """'....1-067 Ischaemic heart diseases' -> '067'. None when absent."""
    m = _CAUSE_NUM_RE.search(label or "")
    return m.group(1) if m else None


def is_total(label: str) -> bool:
    return (label or "").strip().lstrip(".").upper() == TOTAL_LABEL


def slugify_cause(name: str) -> str:
    return re.sub(r"[^0-9A-Za-z]+", "_", name).strip("_").upper()


def chapter_label(name: str) -> str:
    """'1-064 Diseases of the circulatory system' -> 'Diseases of the circulatory system'."""
    text = _CAUSE_PREFIX_RE.sub("", name or "").strip()
    text = _ICD_RANGE_RE.sub("", text).strip()
    return text or (name or "").strip()


class PSAOpenStatSource(DataSource):
    """Subnational registered deaths from PSA OpenSTAT (PxWeb)."""

    BASE_URL = "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB"
    HEADERS = {"User-Agent": "ph-health-dashboard/1.0 (+open data research)"}

    def __init__(self, tables: Optional[List[Dict[str, Any]]] = None):
        self.tables = tables if tables is not None else TABLES

    # ---------------------------------------------------------------- transport

    def _metadata(self, path: str) -> Dict[str, Any]:
        r = requests.get(f"{self.BASE_URL}/{path}", headers=self.HEADERS, timeout=60)
        r.raise_for_status()
        return r.json()

    def _build_selection(self, meta: Dict[str, Any], spec: Dict[str, Any],
                         overrides: Optional[Dict[str, List[str]]] = None):
        """One explicit value list per dimension — an unselected dimension is a 403."""
        dims = dict(spec.get("dims", {}))
        dims.update(overrides or {})
        selection: List[Dict[str, Any]] = []

        for var in meta.get("variables", []):
            name = var["code"]
            values = var.get("values")
            texts = var.get("valueTexts", [])
            if not values:
                raise RuntimeError(
                    f"{spec['path']}: dimension {name!r} exposes no values, so it "
                    f"cannot be selected explicitly and PxWeb would reject the query"
                )

            rule = dims.get(name)
            if rule == "all":
                chosen = list(values)
            elif rule == "regions":
                chosen = [c for c in values
                          if _REGION_CODE_RE.match(c) or c == NATIONAL_CODE]
            elif rule == "chapters":
                chosen = [c for c, t in zip(values, texts)
                          if is_total(t) or cause_number(t) in ICD10_CHAPTERS]
            elif isinstance(rule, list):
                chosen = rule
            else:
                chosen = [values[0]]   # first member is "Total" / "Both Sexes"

            if not chosen:
                raise RuntimeError(f"{spec['path']}: selection for {name!r} is empty")
            selection.append({"code": name,
                              "selection": {"filter": "item", "values": chosen}})
        return selection

    def _query(self, path: str, selection) -> List[Dict[str, str]]:
        body = {"query": selection, "response": {"format": "csv"}}
        r = requests.post(f"{self.BASE_URL}/{path}", headers=self.HEADERS,
                          json=body, timeout=180)
        if r.status_code == 403:
            raise RuntimeError(
                f"{path}: HTTP 403 — PxWeb rejects a request that leaves a "
                f"dimension unselected (it would expand to the full cube)"
            )
        r.raise_for_status()
        # PSA serves the CSV as Windows-1252, not UTF-8.
        return list(csv.DictReader(io.StringIO(r.text)))

    # ------------------------------------------------------------------ fetch

    def fetch(self) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for spec in self.tables:
            try:
                meta = self._metadata(spec["path"])

                if spec["role"] == "all_causes_series":
                    # Pin Year per request: leaving it multi-valued pivots it into
                    # the column headers (trap 4). These requests are independent,
                    # so run them concurrently — serially they dominate ETL time.
                    year_var = next(v for v in meta["variables"] if v["code"] == "Year")
                    years = list(zip(year_var["values"], year_var["valueTexts"]))

                    def one(item):
                        ycode, ylabel = item
                        return {
                            "spec": {**spec, "year": int(ylabel)},
                            "meta": meta,
                            "rows": self._query(
                                spec["path"],
                                self._build_selection(meta, spec, {"Year": [ycode]}),
                            ),
                        }

                    with ThreadPoolExecutor(max_workers=4) as pool:
                        out.extend(pool.map(one, years))
                    logger.info(
                        f"[PSAOpenStatSource] {spec['path']}: "
                        f"{len(years)} yearly queries"
                    )
                else:
                    rows = self._query(spec["path"], self._build_selection(meta, spec))
                    out.append({"spec": spec, "meta": meta, "rows": rows})
                    logger.info(f"[PSAOpenStatSource] {spec['path']}: {len(rows)} rows")
            except Exception as e:
                # One unreachable table must not take down the other sources.
                logger.error(f"[PSAOpenStatSource] {spec['path']} failed: {e}")
        return out

    # -------------------------------------------------------------- normalize

    @staticmethod
    def _to_code(meta: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
        """dimension -> {label: code}, for recovering codes from CSV labels."""
        out = {}
        for var in meta.get("variables", []):
            out[var["code"]] = {t: c for c, t in zip(var.get("values", []),
                                                     var.get("valueTexts", []))}
        return out

    @staticmethod
    def _parse_value(raw: Any) -> Optional[float]:
        """PxWeb writes a missing cell as '..' — never coerce that to 0."""
        if raw is None:
            return None
        text = str(raw).strip().replace(",", "")
        if text in ("", "..", ".", "-", ":"):
            return None
        try:
            return float(text)
        except ValueError:
            return None

    def normalize(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []

        for result in raw_data:
            spec, meta, rows = result["spec"], result["meta"], result["rows"]
            if not rows:
                continue

            to_code = self._to_code(meta)
            dim_names = [v["code"] for v in meta.get("variables", [])]
            # The measure column is named after the selected values, so it is
            # whatever field is not a row dimension.
            measure_cols = [c for c in rows[0] if c not in dim_names]
            if len(measure_cols) != 1:
                raise RuntimeError(
                    f"{spec['path']}: expected exactly one measure column, got "
                    f"{len(measure_cols)} ({measure_cols[:3]}...). A multi-valued "
                    f"dimension was pivoted into the headers — pin it per request."
                )
            measure = measure_cols[0]

            unresolved: set[str] = set()

            for row in rows:
                geo_label = row.get("Geolocation", "")
                geo_code = to_code.get("Geolocation", {}).get(geo_label)
                if geo_code is None:
                    unresolved.add(f"Geolocation={geo_label!r}")
                    continue

                if geo_code == FOREIGN_CODE:
                    continue
                if geo_code == NATIONAL_CODE:
                    region_code, region_name, island = "PHL", "Philippines", None
                elif _REGION_CODE_RE.match(geo_code):
                    region_code = geo_code
                    region_name, island = PH_REGIONS.get(
                        geo_code, (geo_label.lstrip("."), None)
                    )
                else:
                    continue   # province/city rows are not requested

                value = self._parse_value(row.get(measure))
                if value is None:
                    continue

                base = {
                    "source": "psa",
                    "category": "regional",
                    "unit": "count",
                    "region_code": region_code,
                    "region_name": region_name,
                    "island_group": island,
                    "low": None,
                    "high": None,
                    "quintile": None,
                    # SEX_BTSX rather than null so the frontend's
                    # bothSexesSeries() predicate keeps these rows.
                    "sex": "SEX_BTSX",
                    "age_group": None,
                    "data_date": None,
                    "year": spec["year"],
                    "value": value,
                }

                if spec["role"] == "all_causes_series":
                    normalized.append({
                        **base,
                        "indicator_code": ALL_CAUSES_CODE,
                        "indicator_name": "Registered deaths, all causes",
                    })
                    continue

                cause_label = row.get("Cause of Death", "")
                if is_total(cause_label):
                    normalized.append({
                        **base,
                        "indicator_code": ALL_CAUSES_CODE,
                        "indicator_name": "Registered deaths, all causes",
                    })
                    continue

                num = cause_number(cause_label)
                if num in ICD10_CHAPTERS:
                    name = ICD10_CHAPTERS[num]
                    normalized.append({
                        **base,
                        "indicator_code": f"PSA_DEATHS_CAUSE_{slugify_cause(name)}",
                        "indicator_name": f"Registered deaths: {name}",
                    })

            if unresolved:
                raise RuntimeError(
                    f"{spec['path']}: {len(unresolved)} labels did not map back to "
                    f"codes, e.g. {sorted(unresolved)[:3]}"
                )

        # The 2013-2023 series and the 2024/2023 cause cubes both yield all-cause
        # deaths; later tables win, so 2023/2024 come from the cause cubes.
        dedup: Dict[tuple, Dict[str, Any]] = {}
        for rec in normalized:
            dedup[(rec["indicator_code"], rec["region_code"], rec["year"])] = rec
        recs = list(dedup.values())

        # The 19 ICD-10 chapters do not quite exhaust the total: PSA also codes
        # deaths outside them (COVID-19, SARS, vaping-related disorder, and the
        # other special codes visible as depth-0 non-chapter rows). Nationally
        # that residual is ~0.3% in 2024 and ~0.5% in 2023, and larger in
        # COVID-heavy regions. Emitting it as its own bucket keeps the cause set
        # additive, so a share-of-total chart cannot imply the chapters are 100%
        # — and it surfaces those deaths instead of silently dropping them.
        groups: Dict[tuple, Dict[str, float]] = {}
        for rec in recs:
            key = (rec["region_code"], rec["year"])
            g = groups.setdefault(key, {"total": None, "chapters": 0.0})
            if rec["indicator_code"] == ALL_CAUSES_CODE:
                g["total"] = rec["value"]
            elif rec["indicator_code"].startswith("PSA_DEATHS_CAUSE_"):
                g["chapters"] += rec["value"]

        template = next((r for r in recs if r["indicator_code"] == ALL_CAUSES_CODE), None)
        if template is None:
            return recs

        residual_recs = []
        for (region_code, year), g in groups.items():
            if g["total"] is None:
                continue
            residual = g["total"] - g["chapters"]
            # Tolerance covers float noise only; a materially negative residual
            # would mean the chapters overlap, which would be a modelling bug.
            if residual > 0.5:
                # `template` is the NATIONAL row, so region_code/name/island must
                # all be restated here. Overriding only the code left every
                # region's residual row claiming the name "Philippines", and the
                # region table then backfilled that wrong name over the good one.
                if region_code == "PHL":
                    rname, risland = "Philippines", None
                else:
                    rname, risland = PH_REGIONS.get(region_code, (None, None))
                residual_recs.append({
                    **template,
                    "indicator_code": "PSA_DEATHS_CAUSE_OTHER",
                    "indicator_name": "Registered deaths: Other causes "
                                       "(coded outside ICD-10 chapters)",
                    "region_code": region_code,
                    "region_name": rname,
                    "island_group": risland,
                    "year": year,
                    "value": round(residual, 2),
                })
            elif residual < -0.5:
                logger.warning(
                    f"[PSAOpenStatSource] {region_code} {year}: chapters exceed the "
                    f"total by {-residual:.0f} — chapter definitions may overlap"
                )

        # Invariant: a region code must never carry a name belonging to another
        # region. Cheap, and it catches exactly the class of bug above.
        for rec in recs + residual_recs:
            code = rec["region_code"]
            expected = "Philippines" if code == "PHL" else PH_REGIONS.get(code, (None,))[0]
            if expected and rec.get("region_name") != expected:
                raise RuntimeError(
                    f"{code} carries region_name {rec.get('region_name')!r}, "
                    f"expected {expected!r} ({rec['indicator_code']} {rec['year']})"
                )

        return recs + residual_recs
