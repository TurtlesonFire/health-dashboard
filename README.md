# PH Health Systems Dashboard

An interactive dashboard for Philippine health systems data from the WHO Global Health Observatory and World Bank Open Data. National indicators with trend analysis, plus a wealth-quintile equity view of under-5 mortality.

**Live site:** [turtlesonfire.github.io/health-dashboard](https://turtlesonfire.github.io/health-dashboard/)

[![Verify](https://github.com/TurtlesonFire/health-dashboard/actions/workflows/verify.yml/badge.svg)](https://github.com/TurtlesonFire/health-dashboard/actions/workflows/verify.yml)

**Data sources:** [WHO GHO](https://www.who.int/data/gho) · [World Bank Open Data](https://data.worldbank.org/)

---

## What's Inside

1. **Health Status Overview** — Life expectancy, healthy life expectancy, under-5 mortality, infant mortality, maternal mortality, and a wealth-quintile equity breakdown.
2. **Health System Capacity** — Hospital beds, physicians, health expenditure, out-of-pocket share, UHC Service Coverage Index.
3. **Disease Burden** — Tuberculosis, malaria, HIV, NCD mortality, suicide rate.
4. **Risk Factors** — Tobacco use, alcohol consumption, obesity.
5. **Context & Demographics** — Population, GDP per capita, water and sanitation access, ageing.

Every chart includes a plain-language explanation of what the metric means and how to interpret it.

---

## The Equity View

Under-5 mortality is the only indicator in the current dataset that carries a wealth-quintile dimension for the Philippines — 35 years (1990–2024) with 95% confidence intervals.

In 2024:

| | Under-5 mortality (per 1,000) |
|---|---|
| **Poorest quintile (Q1)** | 39.1 |
| **Richest quintile (Q5)** | 14.1 |
| **National total** | 26.5 |
| **Equity gap (Q1 ÷ Q5)** | 2.78× |

A child born into the poorest fifth of Filipino households is nearly three times more likely to die before age 5 than one born into the richest fifth.

The dashboard presents this as a single-year cross-section with confidence intervals and a multi-year trend per quintile, so you can see whether the gap is narrowing or widening over time.

---

## Data Notes

- All figures are pulled directly from WHO GHO and World Bank Open Data APIs — no manual entry or adjustment.
- The most recent year with quintile data is 2024.
- Sex-disaggregated indicators show both-sexes values. Indicators without a sex dimension (e.g., MMR, UHC, TB) are shown as national totals.
- Confidence intervals are shown as error bars where WHO publishes them.

---

## Project Repository

This repository contains the source code for the dashboard, including the ETL pipeline that fetches and normalises data from the upstream APIs, and the GitHub Actions workflows that verify and deploy the static site.

Changes land on the `testing` branch first: every pull request into `main` runs the full pipeline and all four verification suites, and the deploy job publishes the exact artifact those suites passed. See [DEPLOYMENT.md](DEPLOYMENT.md) for the release flow.

The deployed site is fully static — no backend server runs at runtime.
