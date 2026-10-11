/**
 * Headless verification of the QuintileChart data contract.
 *
 * The browser has no Chromium available, so instead of eyeballing the chart we
 * test the two things that can silently produce a WRONG chart:
 *   1. the [value-low, high-value] delta contract that Recharts ErrorBar expects
 *   2. the cross-section / trend row shapes the component feeds to Recharts
 *
 * Run with: node verify_quintile_logic.mjs
 */

const QUINTILE_COLORS = {
  Q1: '#b91c1c', Q2: '#ea580c', Q3: '#ca8a04',
  Q4: '#65a30d', Q5: '#15803d', TOTAL: '#2563eb',
}

function valueAt(series, year) {
  const p = series.points.find((pt) => pt.year === year)
  return p ? p.value : null
}

// --- replicate the component's compareRows memo -------------------------
function compareRows(quintiles, activeYear) {
  return quintiles.map((s) => {
    const p = s.points.find((pt) => pt.year === activeYear)
    const value = p?.value ?? null
    const hasCI = p && p.low != null && p.high != null
    return {
      code: s.code,
      name: s.label,
      value,
      err: hasCI ? [value - p.low, p.high - value] : null,
      low: p?.low ?? null,
      high: p?.high ?? null,
    }
  })
}

// --- replicate the component's commonYears memo -------------------------
function commonYears(quintiles) {
  if (quintiles.length === 0) return []
  const sets = quintiles.map((s) => new Set(s.points.map((p) => p.year)))
  const [first, ...rest] = sets
  return [...first].filter((y) => rest.every((s) => s.has(y))).sort((a, b) => a - b)
}

function trendRows(data) {
  const years = data.years || []
  return years.map((y) => {
    const row = { year: y }
    ;(data.series || []).forEach((s) => { row[s.code] = valueAt(s, y) })
    return row
  })
}

// --- test fixtures ------------------------------------------------------
const Q = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']
const mk = (code, label, vals) => ({
  code, quintile: `WEALTHQUINTILE_WQ${code.slice(1)}`, label,
  points: vals.map(([year, value, low, high]) => ({ year, value, low, high })),
})

const series = [
  mk('Q1', 'Poorest (Q1)', [[2023, 41.0, 35.0, 48.0], [2024, 39.14, 27.96, 54.93]]),
  mk('Q2', 'Second (Q2)', [[2023, 32.0, 27.0, 38.0], [2024, 30.63, 21.89, 43.18]]),
  mk('Q3', 'Middle (Q3)', [[2023, 28.0, 24.0, 32.0], [2024, 26.44, 19.17, 36.71]]),
  mk('Q4', 'Fourth (Q4)', [[2023, 23.0, 20.0, 27.0], [2024, 21.98, 15.57, 31.01]]),
  mk('Q5', 'Richest (Q5)', [[2023, 15.0, 12.0, 18.0], [2024, 14.09, 9.74, 20.56]]),
  { code: 'TOTAL', quintile: 'WEALTHQUINTILE_TOTL', label: 'National total',
    points: [[2023, 28.0, 25.0, 31.0], [2024, 26.46, 19.40, 36.49]]
      .map(([year, value, low, high]) => ({ year, value, low, high })) },
]

const data = {
  indicator_code: 'MDG_0000000007', unit: 'per_1000', source: 'who_gho',
  sex: 'SEX_BTSX', years: [2023, 2024], series, latest_year: 2024,
  equity_ratio: 2.78, absolute_gap: 25.0,
}

let failures = 0
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) failures++
}

console.log('=== 1. ErrorBar delta contract ===')
const rows = compareRows(series.filter((s) => s.code !== 'TOTAL'), 2024)
const q1 = rows.find((r) => r.code === 'Q1')
check('Q1 err is [value-low, high-value]',
  JSON.stringify(q1.err) === JSON.stringify([
    39.14 - 27.96, 54.93 - 39.14,
  ]), JSON.stringify(q1.err))
// Recharts computes scale(value - err[0]) and scale(value + err[1]); those must
// land exactly on the reported CI bounds.
const backLow = q1.value - q1.err[0]
const backHigh = q1.value + q1.err[1]
check('value - err[0] recovers low bound', Math.abs(backLow - 27.96) < 1e-9, String(backLow))
check('value + err[1] recovers high bound', Math.abs(backHigh - 54.93) < 1e-9, String(backHigh))
check('all quintiles carry err deltas', rows.every((r) => Array.isArray(r.err)))
check('err deltas are non-negative', rows.every((r) => r.err[0] >= 0 && r.err[1] >= 0))

console.log('\n=== 2. row ordering is poorest -> richest ===')
check('order is Q1..Q5', JSON.stringify(rows.map((r) => r.code)) === JSON.stringify(Q),
  rows.map((r) => r.code).join(','))
check('values are monotonically decreasing (poorest worst)',
  rows.every((r, i) => i === 0 || r.value <= rows[i - 1].value),
  rows.map((r) => r.value).join(' > '))

console.log('\n=== 3. colors resolve for every quintile ===')
check('every row has a color', rows.every((r) => QUINTILE_COLORS[r.code]),
  rows.map((r) => QUINTILE_COLORS[r.code]).join(' '))

console.log('\n=== 4. commonYears intersection ===')
const cy = commonYears(series.filter((s) => s.code !== 'TOTAL'))
check('common years = [2023, 2024]', JSON.stringify(cy) === JSON.stringify([2023, 2024]),
  JSON.stringify(cy))

// A quintile missing a year must drop that year from the cross-section.
const gapped = JSON.parse(JSON.stringify(series))
gapped[3].points = gapped[3].points.filter((p) => p.year !== 2023)
const cy2 = commonYears(gapped.filter((s) => s.code !== 'TOTAL'))
check('gap in Q4 removes 2023 from common years',
  JSON.stringify(cy2) === JSON.stringify([2024]), JSON.stringify(cy2))

console.log('\n=== 5. trend rows ===')
const tr = trendRows(data)
check('one row per year', tr.length === 2, String(tr.length))
check('rows keyed by quintile code + TOTAL',
  ['year', ...Q, 'TOTAL'].every((k) => k in tr[0]), Object.keys(tr[0]).join(','))
check('2024 row matches endpoint values',
  tr[1].Q1 === 39.14 && tr[1].Q5 === 14.09 && tr[1].TOTAL === 26.46,
  JSON.stringify(tr[1]))

console.log('\n=== 6. equity ratio math ===')
const q1v = rows.find((r) => r.code === 'Q1').value
const q5v = rows.find((r) => r.code === 'Q5').value
check('Q1/Q5 ratio matches API equity_ratio',
  Math.abs(q1v / q5v - data.equity_ratio) < 0.005,
  `${(q1v / q5v).toFixed(2)} vs ${data.equity_ratio}`)
// The API rounds absolute_gap to 1 dp from full-precision values; this fixture
// carries already-rounded inputs, so allow 0.1 of drift.
check('absolute gap matches API within rounding',
  Math.abs((q1v - q5v) - data.absolute_gap) <= 0.1,
  `${(q1v - q5v).toFixed(1)} vs ${data.absolute_gap}`)

console.log('\n=== 7. null CI handled (no crash, err=null) ===')
const noCI = compareRows(
  [{ code: 'Q1', label: 'Poorest (Q1)', points: [{ year: 2024, value: 39.14, low: null, high: null }] }],
  2024
)
check('missing CI yields err=null', noCI[0].err === null, JSON.stringify(noCI[0].err))

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
