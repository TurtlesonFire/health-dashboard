import React, { useEffect, useState } from 'react'
import TrendChart from '../components/TrendChart'
import StatCard from '../components/StatCard'
import { getIndicatorData, getMetricInfo, bothSexesSeries } from '../api'

export default function DiseaseBurdenModule() {
  const [tb, setTb] = useState(null)
  const [malaria, setMalaria] = useState(null)
  const [hiv, setHiv] = useState(null)
  const [ncd, setNcd] = useState(null)
  const [suicide, setSuicide] = useState(null)
  const [metricInfo, setMetricInfo] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [tbData, malData, hivData, ncdData, suiData, info] = await Promise.all([
          getIndicatorData('MDG_0000000020'),
          getIndicatorData('MALARIA_CONF_CASES'),
          getIndicatorData('SDGHIV'),
          getIndicatorData('WHS2_131'),
          getIndicatorData('MH_12'),
          getMetricInfo(),
        ])
        setTb(bothSexesSeries(tbData))
        setMalaria(bothSexesSeries(malData))
        setHiv(bothSexesSeries(hivData))
        setNcd(bothSexesSeries(ncdData))
        setSuicide(bothSexesSeries(suiData))
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
        <span className="ml-3 text-gray-500">Loading disease burden data...</span>
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

  const latestTB = tb?.[tb.length - 1]
  const latestHIV = hiv?.[hiv.length - 1]
  const latestNCD = ncd?.[ncd.length - 1]
  const latestSuicide = suicide?.[suicide.length - 1]

  const info = (code) => metricInfo[code]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Disease Burden</h2>
        <p className="text-sm text-gray-500">
          Infectious diseases, NCDs, and suicide indicators.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {latestTB && (
          <StatCard
            label="TB Incidence"
            value={latestTB.value}
            unit="per 100,000"
            unitKey="per_100000"
            color="blue"
          />
        )}
        {latestHIV && (
          <StatCard
            label="New HIV Infections"
            value={latestHIV.value}
            unit="per 1,000"
            unitKey="per_1000"
            color="red"
          />
        )}
        {latestNCD && (
          <StatCard
            label="NCD Mortality"
            value={latestNCD.value}
            unit="per 100,000"
            unitKey="per_100000"
            color="purple"
          />
        )}
        {latestSuicide && (
          <StatCard
            label="Suicide Rate"
            value={latestSuicide.value}
            unit="per 100,000"
            unitKey="per_100000"
            color="orange"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          title="Tuberculosis Incidence"
          subtitle="Per 100,000 population per year"
          data={tb}
          unit="per 100,000"
          unitKey="per_100000"
          color="#2563eb"
          source="who_gho"
          yDomain={[0, 'auto']}
          metricInfo={info('MDG_0000000020')}
        />
        <TrendChart
          title="Confirmed Malaria Cases"
          subtitle="Total reported cases"
          data={malaria}
          unitKey="count"
          color="#16a34a"
          source="who_gho"
          yDomain={[0, 'auto']}
          metricInfo={info('MALARIA_CONF_CASES')}
        />
        <TrendChart
          title="New HIV Infections"
          subtitle="Per 1,000 uninfected population"
          data={hiv}
          unit="per 1,000"
          unitKey="per_1000"
          color="#dc2626"
          source="who_gho"
          yDomain={[0, 'auto']}
          metricInfo={info('SDGHIV')}
        />
        <TrendChart
          title="NCD Mortality Rate"
          subtitle="Age-standardized, per 100,000 population"
          data={ncd}
          unit="per 100,000"
          unitKey="per_100000"
          color="#9333ea"
          source="who_gho"
          yDomain={[0, 'auto']}
          metricInfo={info('WHS2_131')}
        />
      </div>

      {suicide && suicide.length > 0 && (
        <TrendChart
          title="Suicide Mortality Rate"
          subtitle="Age-standardized, per 100,000 population"
          data={suicide}
          unit="per 100,000"
          unitKey="per_100000"
          color="#ea580c"
          source="who_gho"
          yDomain={[0, 'auto']}
          metricInfo={info('MH_12')}
        />
      )}
    </div>
  )
}
