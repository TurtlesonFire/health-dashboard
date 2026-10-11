# PH Health Systems Data Dashboard

An interactive dashboard for Philippine health systems data, built from public
APIs. National indicators with trend analysis, plus a wealth-quintile equity
view of under-5 mortality.

**Live data sources:** WHO Global Health Observatory, World Bank Open Data.
Both are free and keyless.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + Recharts (port 3000) |
| Backend | FastAPI + SQLAlchemy + SQLite (port 8000) |
| ETL | Python, pluggable `DataSource` architecture |
| Database | `data/health3.db` — 32 indicators, ~2,020 data points |

The backend is used at **build time** to pre-render the API into static JSON;
the deployed site is fully static and runs no server. See
[DEPLOYMENT.md](DEPLOYMENT.md).

## Quick start

```bash
# 1. Backend — build the database, then serve the API
python -m app.etl.pipeline          # fetch + normalize + load (needs network)
python -m uvicorn app.main:app --reload --port 8000

# 2. Frontend — in a second terminal
cd frontend
npm install
npm run dev
```

Then open **http://localhost:3000**.
API docs are at **http://localhost:8000/docs**.

On Windows, `run-backend.bat` and `run-frontend.bat` wrap the above.

> The database is **not** committed (see `.gitignore`) — it is regenerated from
> the public APIs by the ETL step above.

## Dashboard modules

1. **Health Status Overview** — life expectancy, HALE, under-5 and infant
   mortality, maternal mortality, plus the wealth-quintile equity view.
2. **Health System Capacity** — beds, physicians, health expenditure,
   out-of-pocket share, UHC coverage index.
3. **Disease Burden** — TB, malaria, HIV, NCD and suicide mortality.
4. **Risk Factors** — tobacco, alcohol, obesity.
5. **Context & Demographics** — population, GDP per capita, water, sanitation,
   population ageing.

## The equity view

Under-5 mortality (WHO GHO `MDG_0000000007`) is the only indicator in the MVP
carrying a `WEALTHQUINTILE` dimension for the Philippines — 35 years
(1990–2024) with 95% confidence intervals.

In 2024 the poorest quintile's under-5 mortality was **39.1 per 1,000** against
**14.1** for the richest: a **2.78× equity gap**. The national total was 26.5.

The dashboard shows this two ways — a single-year cross-section with confidence
intervals, and a multi-year trend per quintile.

## API

| Endpoint | Purpose |
|---|---|
| `GET /indicators` | List indicators (filter by `category`, `source`) |
| `GET /indicators/{code}` | One indicator with its data points |
| `GET /data/{indicator_code}` | Data points (filter by `year`, `region`) |
| `GET /data/{indicator_code}/quintiles` | Wealth-quintile breakdown (Q1–Q5 + total) |
| `GET /metric-info` | Plain-language explanation of every metric |
| `GET /categories` | Indicator categories with counts |
| `GET /sources` | Data sources and their status |

**Note on quintiles:** `/data/{code}` and `/indicators/{code}` exclude
wealth-quintile rows by default, so a plain trend returns one value per year.
Pass `?include_quintiles=true` to include them, or use the dedicated
`/quintiles` endpoint.

## Deployment

```powershell
./build-static.ps1        # refresh data -> export API to JSON -> build site
```

Produces a fully static site in `frontend/dist/` (~223 KB gzipped, no server).
See [DEPLOYMENT.md](DEPLOYMENT.md) for the architecture and hosting notes.

## Design principles

1. Every chart shows its source.
2. No cherry-picking time ranges — show the full series.
3. Regional equity lens wherever the data supports it.
4. Health systems framing, not just numbers.
5. Mobile-first.
6. Pre-computed aggregations; no chart slower than 1s.

## Tests

```bash
node tests/verify_quintile_logic.mjs       # wealth-quintile data contract
node tests/verify_fix_and_split.mjs        # sex filter + code-splitting
node tests/verify_ux_improvements.mjs      # formatting, peso series, blurbs
node tests/verify_static_deploy.mjs        # static build serves with no backend
```

`verify_quintile_logic` asserts the wealth-quintile data contract: that Recharts
error-bar deltas round-trip to the exact confidence-interval bounds, that series
ordering is poorest→richest, that the cross-section year intersection drops years
with gaps, and that derived equity metrics match the API.

`verify_static_deploy` requires the built site to be served (see
[DEPLOYMENT.md](DEPLOYMENT.md)) and confirms every request the app makes
resolves to a real file with no backend running.
