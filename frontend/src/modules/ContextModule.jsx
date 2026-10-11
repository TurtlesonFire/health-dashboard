import React, { useEffect, useState } from 'react'
import TrendChart from '../components/TrendChart'
import StatCard from '../components/StatCard'
import { getIndicatorData } from '../api'

const SEX_BOTH = 'SEX_BTSX'

export default function ContextModule() {
  const [population, setPopulation] = useState(null)
  const [gdpPerCapita, setGdpPerCapita] = useState(null)
  const [water, setWater] = useState(null)
  const [sanitation, setSanitation] = useState(null)
  const [aging, setAging] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [pop, gdp, w, s, a] = await Promise.all([
          getIndicatorData('SP.POP.TOTL'),
          getIndicatorData('NY.GDP.PCAP.CD'),
          getIndicatorData('SH.H2O.SMDW.ZS'),
          getIndicatorData('SH.STA.SMSS.ZS'),
          getIndicatorData('SP.POP.65UP.TO.ZS'),
        ])
        setPopulation(pop.filter(d => d.sex === SEX_BOTH).sort((a, b) => a.year - b.year))
        setGdpPerCapita(gdp.filter(d => d.sex === SEX_BOTH).sort((a, b) => a.year - b.year))
        setWater(w.filter(d => d.sex === SEX_BOTH).sort((a, b) => a.year - b.year))
        setSanitation(s.filter(d => d.sex === SEX_BOTH).sort((a, b) => a.year - b.year))
        setAging(a.filter(d => d.sex === SEX_BOTH).sort((a, b) => a.year - b.year))
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
            value={latestPop.value >= 1000000
              ? (latestPop.value / 1000000).toFixed(1) + 'M'
              : latestPop.value?.toLocaleString()}
            unit={latestPop.value >= 1000000 ? '' : 'people'}
            color="blue"
          />
        )}
        {latestGDP && (
          <StatCard
            label="GDP per Capita"
            value={'$' + latestGDP.value?.toFixed(0)}
            color="green"
          />
        )}
        {latestWater && (
          <StatCard
            label="Safe Water Access"
            value={latestWater.value?.toFixed(1)}
            unit="%"
            color="blue"
          />
        )}
        {latestAging && (
          <StatCard
            label="Population 65+"
            value={latestAging.value?.toFixed(1)}
            unit="%"
            color="purple"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          title="Population"
          subtitle="Total population"
          data={population}
          unit="people"
          color="#2563eb"
          source="world_bank"
          yDomain={[0, 'auto']}
        />
        <TrendChart
          title="GDP per Capita"
          subtitle="Current US$"
          data={gdpPerCapita}
          unit="US$"
          color="#16a34a"
          source="world_bank"
          yDomain={[0, 'auto']}
        />
        <TrendChart
          title="Safely Managed Drinking Water"
          subtitle="% of population"
          data={water}
          unit="%"
          color="#0891b2"
          source="world_bank"
          yDomain={[0, 100]}
        />
        <TrendChart
          title="Safely Managed Sanitation"
          subtitle="% of population"
          data={sanitation}
          unit="%"
          color="#7c3aed"
          source="world_bank"
          yDomain={[0, 100]}
        />
      </div>

      {aging && aging.length > 0 && (
        <TrendChart
          title="Population Aging"
          subtitle="% of population aged 65 and above"
          data={aging}
          unit="%"
          color="#dc2626"
          source="world_bank"
          yDomain={[0, 'auto']}
        />
      )}
    </div>
  )
}