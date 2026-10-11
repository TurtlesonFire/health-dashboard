/**
 * Number formatting shared by stat cards, chart axes and tooltips.
 *
 * Units in the DB are coarse ('count', 'php', 'usd', 'percent', ...), so the
 * formatter picks a readable scale from the unit and the magnitude. Large
 * counts become millions (a population of 115,843,670 reads better as 115.8M),
 * currency gets thousands separators, and everything else keeps one decimal —
 * matching the dashboard's one-decimal convention.
 */

/** 115843670 -> "115.8M". Keeps small values exact. */
export function compactNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (abs >= 1e4) return `${(v / 1e3).toFixed(1)}K`
  return v.toLocaleString('en-PH')
}

/** 228320.14 -> "228,320" */
export function withCommas(n, decimals = 0) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

const PESO = '\u20B1' // ₱
const DOLLAR = '$'

/** Format a value for its indicator's unit. */
export function formatValue(value, unit, { decimals = 1 } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const v = Number(value)

  switch (unit) {
    case 'count':
      return compactNumber(v)
    case 'php':
      return `${PESO}${withCommas(v, 0)}`
    case 'usd':
      return `${DOLLAR}${withCommas(v, 0)}`
    case 'percent':
      return `${v.toFixed(decimals)}%`
    case 'years':
      return `${v.toFixed(decimals)}`
    case 'per_1000':
    case 'per_100000':
    case 'index':
    case 'births_per_woman':
    case 'litres':
    default:
      return v.toFixed(decimals)
  }
}

/** Axis ticks: shorter than tooltips, no currency word, still scaled. */
export function formatAxisTick(value, unit) {
  if (value == null || !Number.isFinite(Number(value))) return ''
  const v = Number(value)
  switch (unit) {
    case 'count':
      return compactNumber(v)
    case 'php':
      return `${PESO}${compactNumber(v)}`
    case 'usd':
      return `${DOLLAR}${compactNumber(v)}`
    case 'percent':
      return `${v}%`
    default:
      return compactNumber(v)
  }
}

/** Human-readable unit label for tooltips and axis titles. */
export function unitLabel(unit) {
  switch (unit) {
    case 'count':
      return 'people'
    case 'php':
      return 'PHP'
    case 'usd':
      return 'US$'
    case 'percent':
      return '%'
    case 'per_1000':
      return 'per 1,000'
    case 'per_100000':
      return 'per 100,000'
    case 'years':
      return 'years'
    case 'births_per_woman':
      return 'births per woman'
    case 'litres':
      return 'litres'
    case 'index':
      return 'index'
    default:
      return unit || ''
  }
}
