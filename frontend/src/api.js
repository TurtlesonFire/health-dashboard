const API_BASE = '/api'

// Sex dimension in the data.
//
// The two upstream APIs disagree on how they express "both sexes":
//   - WHO GHO sex-disaggregated indicators (life expectancy, U5MR, HIV, NCD,
//     suicide, tobacco, obesity) send Dim1 = 'SEX_BTSX'.
//   - Indicators with no sex dimension at all (MMR, UHC index, TB, malaria,
//     population, GDP, beds, physicians, expenditure, water, sanitation)
//     come back with sex = null.
//
// Filtering on 'SEX_BTSX' alone therefore silently drops every null-sex
// indicator and renders those charts and stat cards empty. No indicator in
// this dataset has both forms, so accepting either cannot duplicate years.
export const SEX_BOTH = 'SEX_BTSX'

export function isBothSexes(row) {
  // == null covers both null and undefined.
  return row.sex === SEX_BOTH || row.sex == null
}

/** Keep both-sexes rows only, oldest year first. */
export function bothSexesSeries(rows) {
  return (rows ?? [])
    .filter(isBothSexes)
    .sort((a, b) => a.year - b.year)
}

async function fetchJSON(path) {
  const resp = await fetch(`${API_BASE}${path}`)
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status} ${resp.statusText}`)
  }
  return resp.json()
}

export async function getIndicators(category, source) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (source) params.set('source', source)
  const qs = params.toString()
  return fetchJSON(`/indicators${qs ? `?${qs}` : ''}`)
}

export async function getIndicatorData(indicatorCode, year, region) {
  const params = new URLSearchParams()
  if (year) params.set('year', year)
  if (region) params.set('region', region)
  const qs = params.toString()
  return fetchJSON(`/data/${indicatorCode}${qs ? `?${qs}` : ''}`)
}

// Wealth-quintile breakdown (Q1 poorest .. Q5 richest + national total).
// Throws on 404 when the indicator has no quintile disaggregation.
export async function getIndicatorQuintiles(indicatorCode, { sex, yearFrom, yearTo } = {}) {
  const params = new URLSearchParams()
  if (sex) params.set('sex', sex)
  if (yearFrom) params.set('year_from', yearFrom)
  if (yearTo) params.set('year_to', yearTo)
  const qs = params.toString()
  return fetchJSON(`/data/${indicatorCode}/quintiles${qs ? `?${qs}` : ''}`)
}

export async function getCategories() {
  return fetchJSON('/categories')
}

export async function getSources() {
  return fetchJSON('/sources')
}

export async function getHealth() {
  return fetchJSON('/health')
}