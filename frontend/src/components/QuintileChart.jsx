import React, { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ErrorBar,
  ReferenceLine,
} from 'recharts'
import SourceBadge from './SourceBadge'
import MetricNote from './MetricNote'
import { formatValue, formatAxisTick, unitLabel } from '../format'

// Matches QUINTILE_META in the backend.
export const QUINTILE_COLORS = {
  Q1: '#b91c1c',
  Q2: '#ea580c',
  Q3: '#ca8a04',
  Q4: '#65a30d',
  Q5: '#15803d',
  TOTAL: '#2563eb',
}

function valueAt(series, year) {
  const p = series.points.find((pt) => pt.year === year)
  return p ? p.value : null
}

/**
 * Wealth-quintile comparison view for a single indicator.
 *
 * Two modes:
 *  - "compare": grouped bars for one survey year, with 95% CI whiskers.
 *  - "trend":   one line per quintile across every available year.
 *
 * `data` is the payload of GET /data/{code}/quintiles.
 */
export default function QuintileChart({
  title,
  subtitle,
  data,
  source,
  unit = '',
  unitKey,
  metricInfo,       // { what, how } from GET /metric-info
  metricName,       // the measure the quintiles refer to, e.g. "Under-5 mortality"
  height = 320,
}) {
  const [mode, setMode] = useState('compare')
  const [year, setYear] = useState(null)
  const u = unitKey || unit
  const unitName = unitLabel(u)

  const quintiles = useMemo(
    () => (data?.series || []).filter((s) => s.code !== 'TOTAL'),
    [data]
  )
  const totalSeries = useMemo(
    () => (data?.series || []).find((s) => s.code === 'TOTAL'),
    [data]
  )

  // Years where every quintile is present — the only years a like-for-like
  // cross-section is valid.
  const commonYears = useMemo(() => {
    if (quintiles.length === 0) return []
    const sets = quintiles.map((s) => new Set(s.points.map((p) => p.year)))
    const [first, ...rest] = sets
    return [...first].filter((y) => rest.every((s) => s.has(y))).sort((a, b) => a - b)
  }, [quintiles])

  const activeYear = year ?? data?.latest_year ?? commonYears[commonYears.length - 1]

  const compareRows = useMemo(() => {
    if (activeYear == null) return []
    return quintiles.map((s) => {
      const p = s.points.find((pt) => pt.year === activeYear)
      const value = p?.value ?? null
      const hasCI = p && p.low != null && p.high != null
      return {
        code: s.code,
        name: s.label,
        value,
        // Recharts' ErrorBar consumes DELTAS (value-low, high-value), not bounds.
        err: hasCI ? [value - p.low, p.high - value] : null,
        low: p?.low ?? null,
        high: p?.high ?? null,
      }
    })
  }, [quintiles, activeYear])

  const trendRows = useMemo(() => {
    const years = data?.years || []
    return years.map((y) => {
      const row = { year: y }
      ;(data?.series || []).forEach((s) => {
        row[s.code] = valueAt(s, y)
      })
      return row
    })
  }, [data])

  if (!data || quintiles.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">{title}</h3>
        <p className="card-subtitle">{subtitle}</p>
        <div className="flex items-center justify-center h-64 text-gray-400">
          No wealth-quintile data available
        </div>
      </div>
    )
  }

  const totalValue = totalSeries ? valueAt(totalSeries, activeYear) : null
  const yearIdx = commonYears.indexOf(activeYear)

  const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="card-title">{title}</h3>
          <p className="card-subtitle mb-0">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setMode('compare')}
              className={`px-3 py-1 text-xs font-medium ${
                mode === 'compare'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Compare year
            </button>
            <button
              onClick={() => setMode('trend')}
              className={`px-3 py-1 text-xs font-medium border-l border-gray-200 ${
                mode === 'trend'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Trend
            </button>
          </div>
          {source && <SourceBadge source={source} />}
        </div>
      </div>

      {mode === 'compare' && commonYears.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
            Survey year
          </label>
          <input
            type="range"
            min={0}
            max={commonYears.length - 1}
            value={yearIdx < 0 ? 0 : yearIdx}
            onChange={(e) => setYear(commonYears[Number(e.target.value)])}
            className="flex-1 accent-primary-600"
          />
          <span className="text-sm font-semibold text-gray-900 tabular-nums w-12 text-right">
            {activeYear}
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        {mode === 'compare' ? (
          <BarChart
            data={compareRows}
            margin={{ top: 16, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickLine={{ stroke: '#e5e7eb' }}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#e5e7eb' }}
              domain={[0, 'auto']}
              tickFormatter={(v) => formatAxisTick(v, u)}
              label={
                unitName
                  ? {
                      value: unitName,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11 },
                    }
                  : undefined
              }
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name, props) => {
                const { low, high } = props.payload
                const ci =
                  low != null && high != null
                    ? ` (95% CI ${formatValue(low, u)}–${formatValue(high, u)})`
                    : ''
                return [`${formatValue(value, u)}${ci}`, metricName || 'Value']
              }}
              labelFormatter={(label) => `${label} — ${activeYear}`}
            />
            {totalValue != null && (
              <ReferenceLine
                y={totalValue}
                stroke="#2563eb"
                strokeDasharray="5 5"
                label={{
                  value: `National ${totalValue.toFixed(1)}`,
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: '#2563eb',
                }}
              />
            )}
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {compareRows.map((row) => (
                <Cell
                  key={row.code}
                  fill={QUINTILE_COLORS[row.code] || '#6b7280'}
                />
              ))}
              <ErrorBar dataKey="err" stroke="#374151" strokeWidth={1.5} width={4} />
            </Bar>
          </BarChart>
        ) : (
          <LineChart
            data={trendRows}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#e5e7eb' }}
              domain={[0, 'auto']}
              tickFormatter={(v) => formatAxisTick(v, u)}
              label={
                unitName
                  ? {
                      value: unitName,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11 },
                    }
                  : undefined
              }
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [formatValue(value, u), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {quintiles.map((s) => (
              <Line
                key={s.code}
                type="monotone"
                dataKey={s.code}
                name={s.label}
                stroke={QUINTILE_COLORS[s.code]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
            {totalSeries && (
              <Line
                type="monotone"
                dataKey="TOTAL"
                name="National total"
                stroke={QUINTILE_COLORS.TOTAL}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        )}
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 mt-3">
        {metricName ? (
          <span className="text-gray-500">
            Quintiles of <span className="font-medium text-gray-600">{metricName}</span>
            {unitName ? ` (${unitName})` : ''}.{' '}
          </span>
        ) : null}
        Q1 = poorest quintile, Q5 = richest. Shaded whiskers show the WHO 95%
        confidence interval. Dashed line marks the national total for the same year.
      </p>
      <MetricNote info={metricInfo} />
    </div>
  )
}
