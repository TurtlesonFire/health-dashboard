"""
Export the read-only API to static JSON for a serverless deployment.

The API never writes at runtime, so every endpoint the frontend calls can be
pre-rendered. This runs the real FastAPI app in-process via TestClient rather
than re-querying the database, which guarantees the exported files are exactly
what the live API returns — the static build cannot drift from the API contract.

Output mirrors the API paths under frontend/public/api/, so the frontend only
needs to map a request path to "<path>.json" (see frontend/src/api.js):

    GET /indicators                  -> frontend/public/api/indicators.json
    GET /data/{code}                 -> frontend/public/api/data/{code}.json
    GET /data/{code}/quintiles       -> frontend/public/api/data/{code}/quintiles.json
    GET /metric-info                 -> frontend/public/api/metric-info.json
    GET /categories                  -> frontend/public/api/categories.json
    GET /sources                     -> frontend/public/api/sources.json

Vite copies public/ verbatim into dist/, so no further wiring is needed.

Usage:
    python scripts/export_static.py [--out DIR]
"""

import argparse
import json
import sys
from pathlib import Path

# Allow running as a script from the repo root.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

DEFAULT_OUT = ROOT / "frontend" / "public" / "api"


def write_json(path: Path, payload) -> int:
    """Write compact JSON and return the byte size."""
    path.parent.mkdir(parents=True, exist_ok=True)
    # Compact separators: the wire format is what matters, not readability.
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT,
                    help=f"output directory (default: {DEFAULT_OUT})")
    args = ap.parse_args()

    out: Path = args.out
    if out.exists():
        # Stale files from a removed indicator would otherwise linger and be
        # served forever by the static host.
        for f in sorted(out.rglob("*"), reverse=True):
            if f.is_file():
                f.unlink()
            elif f.is_dir():
                f.rmdir()

    written: list[tuple[str, int]] = []
    skipped: list[str] = []

    # TestClient exercises the real endpoints, including response models and
    # the quintile 404 logic.
    with TestClient(app) as client:
        # --- collection endpoints -------------------------------------------
        for route in ("/indicators", "/metric-info", "/categories", "/sources"):
            resp = client.get(route)
            resp.raise_for_status()
            written.append((route, write_json(out / f"{route.lstrip('/')}.json",
                                              resp.json())))

        # --- per-indicator series -------------------------------------------
        indicators = client.get("/indicators").json()
        for ind in indicators:
            code = ind["code"]
            resp = client.get(f"/data/{code}")
            if resp.status_code != 200:
                skipped.append(f"/data/{code} ({resp.status_code})")
                continue
            written.append(
                (f"/data/{code}", write_json(out / "data" / f"{code}.json", resp.json()))
            )

        # --- wealth-quintile series -----------------------------------------
        # Only U5MR carries the dimension today, but probe every indicator so a
        # future one is picked up automatically. A 404 is expected, not an error.
        for ind in indicators:
            code = ind["code"]
            resp = client.get(f"/data/{code}/quintiles", params={"sex": "SEX_BTSX"})
            if resp.status_code == 404:
                continue
            if resp.status_code != 200:
                skipped.append(f"/data/{code}/quintiles ({resp.status_code})")
                continue
            written.append((
                f"/data/{code}/quintiles",
                write_json(out / "data" / code / "quintiles.json", resp.json()),
            ))

    total = sum(n for _p, n in written)
    print(f"Exported {len(written)} files to {out}")
    print(f"  total size: {total / 1024:.1f} KB raw")

    quintiles = [p for p, _ in written if p.endswith("/quintiles")]
    print(f"  indicators: {sum(1 for p, _ in written if p.startswith('/data/') and not p.endswith('/quintiles'))}")
    print(f"  quintile series: {len(quintiles)} ({', '.join(quintiles) or 'none'})")

    if skipped:
        print(f"  skipped: {', '.join(skipped)}")

    if not quintiles:
        # The equity view is the dashboard's most distinctive feature; a silent
        # absence here would break it without any error.
        print("ERROR: no quintile series exported — the equity view would be empty.",
              file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
