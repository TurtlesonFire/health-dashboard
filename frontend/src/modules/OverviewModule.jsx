import React, { useEffect, useState } from 'react'
import TrendChart from '../components/TrendChart'
import StatCard from '../components/StatCard'
import QuintileChart from '../components/QuintileChart'
import {
  getIndicatorData,
  getIndicatorQuintiles,
  getMetricInfo,
  SEX_BOTH,
  bothSexesSeries,
} from '../api'
import { formatValue, unitLabel } from '../format'

// The measure the wealth-quintile view disaggregates. Named explicitly so the
// equity cards and the chart caption state what they refer to.
const U5MR_CODE = 'MDG_0000000007'
const U5MR_NAME = 'Under-5 mortality rate'
const U5MR_UNIT = 'per_1000'

export default function OverviewModule() {
  const [lifeExpectancy, setLifeExpectancy] = useState(null)
  const [hale, setHale] = useState(null)
  const [u5mr, setU5mr] = useState(null)
  const [mmr, setMmr] = useState(null)
  const [imr, setImr] = useState(null)
  const [u5mrQuintiles, setU5mrQuintiles] = useState(null)
  const [metricInfo, setMetricInfo] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [le, hale, u5, mmrResp, imrResp, u5q, info] = await Promise.all([
          getIndicatorData('WHOSIS_000001'),
          getIndicatorData('WHOSIS_000002'),
          getIndicatorData(U5MR_CODE),
          getIndicatorData('MDG_0000000026'),
          getIndicatorData('SP.DYN.IMRT.IN'),
          // Optional: only U5MR carries a wealth-quintile dimension. A 404 here
          // must not take down the rest of the module.
          getIndicatorQuintiles(U5MR_CODE, { sex: SEX_BOTH }).catch(() => null),
          getMetricInfo(),
        ])
        // Accept both-sexes rows and null-sex rows (see api.js).
        setLifeExpectancy(bothSexesSeries(le))
        setHale(bothSexesSeries(hale))
        setU5mr(bothSexesSeries(u5))
        setMmr(bothSexesSeries(mmrResp))
        setImr(bothSexesSeries(imrResp))
        setU5mrQuintiles(u5q)
        setMetricInfo(info || {})
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-500">Loading health status data...</span>
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

  // Calculate summary stats
  const latestLE = lifeExpectancy?.[lifeExpectancy.length - 1]
  const latestHALE = hale?.[hale.length - 1]
  const latestU5MR = u5mr?.[u5mr.length - 1]
  const latestIMR = imr?.[imr.length - 1]

  // Equity figures come from the quintile endpoint's latest common year.
  const equityYear = u5mrQuintiles?.latest_year
  const quintileAt = (code) =>
    u5mrQuintiles?.series
      ?.find((s) => s.code === code)
      ?.points?.find((p) => p.year === equityYear)

  const poorest = quintileAt('Q1')
  const richest = quintileAt('Q5')

  const info = (code) => metricInfo[code]
  const u5Unit = unitLabel(U5MR_UNIT)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Health Status Overview</h2>
        <p className="text-sm text-gray-500">
          Key health outcome indicators for the Philippines, 2000–present.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {latestLE && (
          <StatCard
            label="Life Expectancy"
            value={latestLE.value}
            unit="years"
            unitKey="years"
            color="blue"
          />
        )}
        {latestHALE && (
          <StatCard
            label="Healthy Life Expectancy"
            value={latestHALE.value}
            unit="years"
            unitKey="years"
            color="green"
          />
        )}
        {latestU5MR && (
          <StatCard
            label="Under-5 Mortality"
            value={latestU5MR.value}
            unit="per 1,000"
            unitKey="per_1000"
            color="orange"
          />
        )}
        {latestIMR && (
          <StatCard
            label="Infant Mortality"
            value={latestIMR.value}
            unit="per 1,000"
            unitKey="per_1000"
            color="purple"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          title="Life Expectancy at Birth"
          subtitle="Years, both sexes"
          data={lifeExpectancy}
          unit="years"
          unitKey="years"
          color="#2563eb"
          source="who_gho"
          metricInfo={info('WHOSIS_000001')}
        />
        <TrendChart
          title="Healthy Life Expectancy (HALE)"
          subtitle="Years, both sexes"
          data={hale}
          unit="years"
          unitKey="years"
          color="#16a34a"
          source="who_gho"
          metricInfo={info('WHOSIS_000002')}
        />
        <TrendChart
          title="Under-5 Mortality Rate"
          subtitle="Per 1,000 live births — national total"
          data={u5mr}
          unit="per 1,000"
          unitKey="per_1000"
          color="#ea580c"
          source="who_gho"
          yDomain={[0, 'auto']}
          metricInfo={info(U5MR_CODE)}
        />
        <TrendChart
          title="Infant Mortality Rate"
          subtitle="Per 1,000 live births"
          data={imr}
          unit="per 1,000"
          unitKey="per_1000"
          color="#9333ea"
          source="world_bank"
          yDomain={[0, 'auto']}
          metricInfo={info('SP.DYN.IMRT.IN')}
        />
      </div>

      {poorest && richest && u5mrQuintiles?.equity_ratio != null && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Wealth inequality in {U5MR_NAME.toLowerCase()}
            <span className="font-normal text-gray-500">
              {' '}— {u5Unit}, {equityYear}
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Poorest quintile (Q1) — bottom 20% of households"
              value={poorest.value}
              unit={u5Unit}
              unitKey={U5MR_UNIT}
              color="red"
            />
            <StatCard
              label="Richest quintile (Q5) — top 20% of households"
              value={richest.value}
              unit={u5Unit}
              unitKey={U5MR_UNIT}
              color="green"
            />
            <StatCard
              label="Equity gap (Q1 ÷ Q5)"
              value={`${u5mrQuintiles.equity_ratio}×`}
              hint={
                u5mrQuintiles.absolute_gap != null
                  ? `A child in the poorest fifth is ${u5mrQuintiles.equity_ratio}× more likely to die before age 5 than one in the richest — a gap of ${formatValue(u5mrQuintiles.absolute_gap, U5MR_UNIT)} ${u5Unit}.`
                  : undefined
              }
              color="orange"
            />
          </div>
        </div>
      )}

      {u5mrQuintiles && (
        <QuintileChart
          title="Under-5 Mortality by Wealth Quintile"
          subtitle="Per 1,000 live births, both sexes — comparing the poorest and richest households"
          data={u5mrQuintiles}
          source="who_gho"
          unit="per 1,000"
          unitKey={U5MR_UNIT}
          metricName={U5MR_NAME}
          metricInfo={info(U5MR_CODE)}
        />
      )}

      {mmr && mmr.length > 0 && (
        <TrendChart
          title="Maternal Mortality Ratio"
          subtitle="Per 100,000 live births"
          data={mmr}
          unit="per 100,000"
          unitKey="per_100000"
          color="#dc2626"
          source="who_gho"
          yDomain={[0, 'auto']}
          metricInfo={info('MDG_0000000026')}
        />
      )}
    </div>
  )
}
