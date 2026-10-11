import React, { useEffect, useState } from 'react'
import TrendChart from '../components/TrendChart'
import StatCard from '../components/StatCard'
import { getIndicatorData } from '../api'

const SEX_BTSX = "SEX_BTSX"

export default function DiseaseBurdenModule() {
  const [tb, setTb] = useState(null)
  const [malaria, setMalaria] = useState(null)
  const [hiv, setHiv] = useState(null)
  const [ncd, setNcd] = useState(null)
  const [suicide, setSuicide] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [tbData, malData, hivData, ncdData, suiData] = await Promise.all([
          getIndicatorData('MDG_0000000020'),
          getIndicatorData('MALARIA_CONF_CASES'),
          getIndicatorData('SDGHIV'),
          getIndicatorData('WHS2_131'),
          getIndicatorData('MH_12'),
        ])
        setTb(tbData.filter(d => d.sex === SEX_BTSX || d.sex === null).sort((a, b) => a.year - b.year))
        setMalaria(malData.filter(d => d.sex === SEX_BTSX || d.sex === null).sort((a, b) => a.year - b.year))
        setHiv(hivData.filter(d => d.sex === SEX_BTSX || d.sex === null).sort((a, b) => a.year - b.year))
        setNcd(ncdData.filter(d => d.sex === SEX_BTSX || d.sex === null).sort((a, b) => a.year - b.year))
        setSuicide(suiData.filter(d => d.sex === SEX_BTSX || d.sex === null).sort((a, b) => a.year - b.year))
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
            value={latestTB.value?.toFixed(1)}
            unit="per 100,000"
            color="blue"
          />
        )}
        {latestHIV && (
          <StatCard
            label="New HIV Infections"
            value={latestHIV.value?.toFixed(1)}
            unit="per 1,000"
            color="red"
          />
        )}
        {latestNCD && (
          <StatCard
            label="NCD Mortality"
            value={latestNCD.value?.toFixed(1)}
            unit="per 100,000"
            color="purple"
          />
        )}
        {latestSuicide && (
          <StatCard
            label="Suicide Rate"
            value={latestSuicide.value?.toFixed(1)}
            unit="per 100,000"
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
          color="#2563eb"
          source="who_gho"
          yDomain={[0, 'auto']}
        />
        <TrendChart
          title="Confirmed Malaria Cases"
          subtitle="Total reported cases"
          data={malaria}
          unit="cases"
          color="#16a34a"
          source="who_gho"
          yDomain={[0, 'auto']}
        />
        <TrendChart
          title="New HIV Infections"
          subtitle="Per 1,000 uninfected population"
          data={hiv}
          unit="per 1,000"
          color="#dc2626"
          source="who_gho"
          yDomain={[0, 'auto']}
        />
        <TrendChart
          title="NCD Mortality Rate"
          subtitle="Age-standardized, per 100,000 population"
          data={ncd}
          unit="per 100,000"
          color="#9333ea"
          source="who_gho"
          yDomain={[0, 'auto']}
        />
      </div>

      {suicide && suicide.length > 0 && (
        <TrendChart
          title="Suicide Mortality Rate"
          subtitle="Age-standardized, per 100,000 population"
          data={suicide}
          unit="per 100,000"
          color="#ea580c"
          source="who_gho"
          yDomain={[0, 'auto']}
        />
      )}
    </div>
  )
}
