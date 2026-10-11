import React, { useEffect, useState } from 'react'
import TrendChart from '../components/TrendChart'
import StatCard from '../components/StatCard'
import { getIndicatorData, getMetricInfo, bothSexesSeries } from '../api'
import { formatValue } from '../format'

export default function ContextModule() {
  const [population, setPopulation] = useState(null)
  const [gdpPerCapita, setGdpPerCapita] = useState(null)
  const [water, setWater] = useState(null)
  const [sanitation, setSanitation] = useState(null)
  const [aging, setAging] = useState(null)
  const [metricInfo, setMetricInfo] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [pop, gdp, w, s, a, info] = await Promise.all([
          getIndicatorData('SP.POP.TOTL'),
          // Peso series: the World Bank's LCU figure for the Philippines is the
          // official peso value, so no client-side FX conversion is needed.
          getIndicatorData('NY.GDP.PCAP.CN'),
          getIndicatorData('SH.H2O.SMDW.ZS'),
          getIndicatorData('SH.STA.SMSS.ZS'),
          getIndicatorData('SP.POP.65UP.TO.ZS'),
          getMetricInfo(),
        ])
        setPopulation(bothSexesSeries(pop))
        setGdpPerCapita(bothSexesSeries(gdp))
        setWater(bothSexesSeries(w))
        setSanitation(bothSexesSeries(s))
        setAging(bothSexesSeries(a))
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
        <span className="ml-3 text-gray-500">Loading context data...</span>
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

  const latestPop = population?.[population.length - 1]
  const latestGDP = gdpPerCapita?.[gdpPerCapita.length - 1]
  const latestWater = water?.[water.length - 1]
  const latestSanitation = sanitation?.[sanitation.length - 1]
  const latestAging = aging?.[aging.length - 1]

  const info = (code) => metricInfo[code]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Context & Demographics</h2>
        <p className="text-sm text-gray-500">
          Population, economic, and environmental health determinants.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {latestPop && (
          <StatCard
            label="Population"
            value={latestPop.value}
            unitKey="count"
            color="blue"
            hint={
              latestPop.value != null
                ? `${Number(latestPop.value).toLocaleString('en-PH')} people`
                : undefined
            }
          />
        )}
        {latestGDP && (
          <StatCard
            label="GDP per Capita"
            value={latestGDP.value}
            unitKey="php"
            color="green"
            hint="Current Philippine pesos"
          />
        )}
        {latestWater && (
          <StatCard
            label="Safe Water Access"
            value={latestWater.value}
            unitKey="percent"
            color="blue"
          />
        )}
        {latestAging && (
          <StatCard
            label="Population 65+"
            value={latestAging.value}
            unitKey="percent"
            color="purple"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          title="Population"
          subtitle="Total population, millions"
          data={population}
          unitKey="count"
          color="#2563eb"
          source="world_bank"
          yDomain={[0, 'auto']}
          metricInfo={info('SP.POP.TOTL')}
        />
        <TrendChart
          title="GDP per Capita"
          subtitle="Current Philippine pesos"
          data={gdpPerCapita}
          unitKey="php"
          color="#16a34a"
          source="world_bank"
          yDomain={[0, 'auto']}
          metricInfo={info('NY.GDP.PCAP.CN')}
        />
        <TrendChart
          title="Safely Managed Drinking Water"
          subtitle="% of population"
          data={water}
          unitKey="percent"
          color="#0891b2"
          source="world_bank"
          yDomain={[0, 100]}
          metricInfo={info('SH.H2O.SMDW.ZS')}
        />
        <TrendChart
          title="Safely Managed Sanitation"
          subtitle="% of population"
          data={sanitation}
          unitKey="percent"
          color="#7c3aed"
          source="world_bank"
          yDomain={[0, 100]}
          metricInfo={info('SH.STA.SMSS.ZS')}
        />
      </div>

      {aging && aging.length > 0 && (
        <TrendChart
          title="Population Aging"
          subtitle="% of population aged 65 and above"
          data={aging}
          unitKey="percent"
          color="#dc2626"
          source="world_bank"
          yDomain={[0, 'auto']}
          metricInfo={info('SP.POP.65UP.TO.ZS')}
        />
      )}
    </div>
  )
}