import React, { useEffect, useState } from 'react'
import TrendChart from '../components/TrendChart'
import StatCard from '../components/StatCard'
import MetricNote from '../components/MetricNote'
import {
  getIndicators,
  getIndicatorRegions,
  getRegionCauses,
  getMetricInfo,
} from '../api'
import { formatValue } from '../format'

const ALL_CAUSES = 'PSA_DEATHS_ALL_CAUSES'

// Axis labels for the ranking. Region names carry their full official wording
// and number, which a map legend needs but a chart row cannot fit —
// "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)" does not fit in a
// 96px label column, so the row uses this and the title keeps the full name.
const SHORT_LABEL = {
  '1300000000': 'NCR',
  '1400000000': 'CAR',
  '0100000000': 'Ilocos',
  '0200000000': 'Cagayan Valley',
  '0300000000': 'Central Luzon',
  '0400000000': 'CALABARZON',
  '1700000000': 'MIMAROPA',
  '0500000000': 'Bicol',
  '0600000000': 'Western Visayas',
  '1800000000': 'Negros Island',
  '0700000000': 'Central Visayas',
  '0800000000': 'Eastern Visayas',
  '0900000000': 'Zamboanga',
  '1000000000': 'N. Mindanao',
  '1100000000': 'Davao',
  '1200000000': 'SOCCSKSARGEN',
  '1600000000': 'Caraga',
  '1900000000': 'BARMM',
}

function metricLabel(indicator) {
  if (indicator.code === ALL_CAUSES) return 'All causes'
  return (indicator.name || '').replace(/^Registered deaths:\s*/, '')
}

export default function RegionalModule() {
  const [metrics, setMetrics] = useState([])
  const [code, setCode] = useState(ALL_CAUSES)
  const [year, setYear] = useState(null)
  const [ranking, setRanking] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [metricInfo, setMetricInfo] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // The regional metric list comes from the category, not a hard-coded list:
  // a new PSA indicator (maternal deaths, for instance) is picked up on the next
  // ETL run with no frontend change.
  useEffect(() => {
    let cancelled = false
    async function loadMetrics() {
      try {
        const inds = await getIndicators('regional')
        if (cancelled) return
        const regional = (inds || []).filter((i) => i.category === 'regional')
        setMetrics(regional)
        setCode((cur) =>
          regional.some((i) => i.code === cur) ? cur : regional[0]?.code,
        )
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    loadMetrics()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!code) return undefined
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [regions, info] = await Promise.all([
          getIndicatorRegions(code),
          getMetricInfo(),
        ])
        if (cancelled) return
        setRanking(regions)
        setMetricInfo(info || {})
        // Back to the latest year whenever the metric changes.
        setYear(null)
        // Default the detail panel to the largest region so the module is
        // never empty on first paint.
        setSelected((cur) =>
          cur && regions.regions?.some((r) => r.region_code === cur)
            ? cur
            : regions.regions?.[0]?.region_code ?? null,
        )
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [code])

  useEffect(() => {
    if (!selected || !ranking) return undefined
    let cancelled = false
    async function loadDetail() {
      try {
        const [causes, regions] = await Promise.all([
          getRegionCauses(selected),
          getIndicatorRegions(ALL_CAUSES),
        ])
        if (cancelled) return
        const me = (regions.regions || []).find((r) => r.region_code === selected)
        setDetail({ trend: me?.points || [], causes })
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    loadDetail()
    return () => {
      cancelled = true
    }
    // `ranking` is read for its regions list but the detail only needs the
    // selected code; depending on [selected] alone is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  if (loading && !ranking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-500">Loading regional data…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <p className="text-red-600">Error loading data: {error}</p>
      </div>
    )
  }

  const activeYear = year ?? ranking?.latest_year

  // Re-ranking on the selected year is a client-side re-sort: the endpoint
  // already returns every year, so this is exact and costs no round trip.
  const rankingRows = (ranking?.regions || []).map((r) => {
    const point = (r.points || []).find((p) => p.year === activeYear)
    return {
      code: r.region_code,
      name: r.region_name,
      short: SHORT_LABEL[r.region_code] || r.region_name,
      island_group: r.island_group,
      value: point?.value ?? null,
    }
  })
  rankingRows.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const top = rankingRows[0]
  const national = ranking?.national
  // The national total must follow the year selector too — reading
  // latest_value directly would pin the card to the latest year forever.
  const nationalPoint = (national?.points || []).find((p) => p.year === activeYear)
  const nationalValue = nationalPoint?.value ?? null
  const selectedMetric = metrics.find((m) => m.code === code)

  // Longest bar sets the scale, so the ranking reads as a share of the worst
  // region rather than an absolute pixel count.
  const maxValue = top?.value || 1

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Regional Comparison</h2>
        <p className="text-sm text-gray-500">
          Where the burden sits. Registered deaths by region of usual residence,
          from the Philippine Statistics Authority.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Registered deaths, Philippines"
          value={nationalValue}
          unitKey="count"
          color="blue"
          hint={activeYear != null ? `${activeYear}` : undefined}
        />
        <StatCard
          label={top ? `${top.short} deaths` : 'Largest region'}
          value={top?.value}
          unitKey="count"
          color="orange"
          hint={top?.name}
        />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Metric</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            >
              {metrics.map((m) => (
                <option key={m.code} value={m.code}>
                  {metricLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={activeYear}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {(ranking?.years || []).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="card-title">
              {selectedMetric?.name || 'Registered deaths'} by region
            </h3>
            <p className="card-subtitle">
              Registered deaths, {activeYear} — largest first
            </p>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-1">
            PSA
          </span>
        </div>

        {/* CSS bar ranking. A plain div chart rather than Recharts: region names
            are long, the ordering must be exact, and there is no axis to
            mis-render — the bar length is a direct percentage of the worst
            region, so the visual ranking cannot drift from the data. */}
        <div className="space-y-1.5">
          {rankingRows.map((r) => {
            const pct = r.value != null ? (r.value / maxValue) * 100 : 0
            return (
              <div key={r.code} className="flex items-center gap-3">
                <div
                  className="w-24 shrink-0 text-xs text-gray-600 text-right truncate"
                  title={r.name}
                >
                  {r.short}
                </div>
                <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-16 shrink-0 text-xs font-semibold text-gray-900 text-right tabular-nums">
                  {formatValue(r.value, 'count')}
                </div>
              </div>
            )
          })}
        </div>

        <MetricNote info={metricInfo[code]} />
      </div>

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Region</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[260px]"
            value={selected ?? ''}
            onChange={(e) => setSelected(e.target.value)}
          >
            {rankingRows.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {detail && detail.trend.length > 0 ? (
          <TrendChart
            title={`${detail.causes?.region_name || 'Region'} — registered deaths`}
            subtitle="All causes, by region of usual residence"
            data={detail.trend}
            unitKey="count"
            color="#0891b2"
            source="psa"
            yDomain={[0, 'auto']}
            metricInfo={metricInfo[ALL_CAUSES]}
          />
        ) : (
          <div className="card">
            <p className="text-gray-400">Select a region to see its trend.</p>
          </div>
        )}
        <div className="card">
          <h3 className="card-title">
            Leading causes in {detail?.causes?.region_name || 'this region'}
          </h3>
          <p className="card-subtitle">
            {detail?.causes?.year} — shares of that region's all-cause total
          </p>
          {!detail?.causes?.causes?.length ? (
            <p className="text-gray-400">No cause data for this region.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {detail.causes.causes.map((c, i) => (
                <div key={c.indicator_code}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-gray-700">
                      <span className="text-gray-400 mr-1.5">{i + 1}.</span>
                      {c.cause}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                      {formatValue(c.value, 'count')}
                      <span className="ml-1.5 font-normal text-gray-500">
                        {c.share != null ? `${c.share}%` : ''}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.min(100, c.share ?? 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
