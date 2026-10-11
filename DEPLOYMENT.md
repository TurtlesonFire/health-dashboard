# Deployment

The dashboard deploys as a **fully static site**. The FastAPI backend is not
deployed at runtime — it is used at *build time* to pre-render the API into
JSON, and the static files are what visitors download.

## Why static

| Fact | Value |
|---|---|
| API writes at runtime | never — read-only |
| Database size | 0.27 MB |
| All API data as JSON | 346 KB raw / ~62 KB gzipped |
| Frontend bundle | ~161 KB gzipped |
| **Total deployed** | **~223 KB gzipped** |

Because the API never writes and the whole dataset is smaller than one photo,
there is nothing that needs a running server. Static hosting gives no cold
starts, no CORS configuration, and no database to keep alive — which matters
for the mobile-first use case, where a server round-trip is the main thing
standing between a tap and a chart.

## How it works

```
  WHO GHO + World Bank APIs
            │
            ▼
   app/etl/pipeline.py          refresh the SQLite database
            │
            ▼
   scripts/export_static.py     run the real FastAPI endpoints via TestClient
            │                   and write JSON to frontend/public/api/
            ▼
   vite build (VITE_DATA_MODE=static)
            │
            ▼
   frontend/dist/               the entire deployable site
```

The export goes through FastAPI's `TestClient` rather than querying SQLite
directly, so the static files are byte-identical to what the live API returns.
The build cannot silently drift from the API contract.

## Build

```powershell
./build-static.ps1              # full: refresh data, export, build
./build-static.ps1 -SkipEtl     # reuse the existing database
```

Output lands in `frontend/dist/`. Preview it locally:

```powershell
cd frontend
npx vite preview --outDir dist
```

> `vite preview` applies `server.proxy` from `vite.config.js`. The config
> disables the proxy when `VITE_DATA_MODE=static`, so previews serve the JSON
> files rather than trying to reach a backend that is not there.

## Data modes

Set by `VITE_DATA_MODE` (see `frontend/.env`):

| Mode | Behaviour | Use |
|---|---|---|
| `api` (default) | Calls the FastAPI backend through the Vite dev proxy | Local development |
| `static` | Reads pre-rendered `/api/*.json` | Deployment |

Both modes expose the same functions and response shapes, so no component
knows which is active. A static build has one file per path, so requesting a
slice the exporter did not pre-render (e.g. `?year=2015`) raises a clear error
instead of silently returning the wrong variant.

## Refreshing the data

WHO and the World Bank revise these series roughly annually. To pick up new
figures, re-run the build — the ETL refetches everything and the export
regenerates the JSON. There is no database to migrate and no server to restart.

## Deploying

`frontend/dist/` is a plain static directory; any static host will serve it.

**Requirements:** none beyond static file serving. No build step on the host if
you deploy the built output, no environment variables, no secrets.

**One setting to check:** the site is served from `/` and fetches `/api/*.json`,
so it must be hosted at a domain **root**. A subpath deployment (e.g.
`example.com/dashboard/`) would need Vite's `base` option set to match, and the
`/api` fetch prefix updated.

## Migrating to a backend later

The static build is not a dead end. If the dataset grows past what is
reasonable to pre-render — regional drill-down across 17 regions × 32
indicators would be roughly 5,000 series — then:

1. Deploy `app/main.py` (it is unchanged and already read-only).
2. Set `VITE_DATA_MODE=api` and point the frontend at the backend URL.
3. Add the frontend origin to the CORS list in `app/main.py`.

The ETL, API, and frontend all survive either architecture.
