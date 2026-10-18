import React, { useEffect, useState } from 'react'
import BarChartCard from '../components/BarChartCard'
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

// Axis labels for the ranking chart. Region names carry their full official
// wording and number, which a map legend needs but a chart axis cannot fit —
// "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)" does not fit in
// 150px, so the axis uses this and the tooltip keeps the full name.
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
        // Back to the latest year whenever the metric or its years change.
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
  const islandGroups = [
    ...new Set(rankingRows.map((r) => r.island_group).filter(Boolean)),
  ]
  const selectedMetric = metrics.find((m) => m.code === code)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Regional Comparison</h2>
        <p className="text-sm text-gray-500">
          Where the burden sits. Registered deaths by region of usual residence,
          from the Philippine Statistics Authority.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Registered deaths, Philippines"
          value={national?.latest_value}
          unitKey="count"
          color="blue"
          hint={national ? `${national.latest_year}` : undefined}
        />
        <StatCard
          label="Regions covered"
          value={ranking?.region_count}
          color="purple"
          hint={islandGroups.length ? islandGroups.join(', ') : undefined}
        />
        <StatCard
          label={top ? `${top.short} deaths` : 'Largest region'}
          value={top?.value}
          unitKey="count"
          color="orange"
          hint={top?.name}
        />
        <StatCard
          label="Latest year"
          value={ranking?.latest_year}
          color="green"
          hint={ranking ? `${ranking.years[0]}–${ranking.latest_year}` : undefined}
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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Region</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-xs"
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

        <BarChartCard
          title={`${selectedMetric?.name || 'Registered deaths'} by region`}
          subtitle={
            activeYear !== ranking?.latest_year
              ? `Registered deaths, ${activeYear} — largest first`
              : `Registered deaths, ${ranking?.latest_year} — largest first`
          }
          data={rankingRows}
          dataKey="value"
          xKey="short"
          unitKey="count"
          color="#7c3aed"
          source="psa"
          layout="horizontal"
          height={Math.max(320, rankingRows.length * 30)}
        />
        <MetricNote info={metricInfo[code]} />
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
