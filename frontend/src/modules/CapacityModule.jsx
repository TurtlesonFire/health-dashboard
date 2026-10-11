import React, { useEffect, useState } from 'react'
import TrendChart from '../components/TrendChart'
import StatCard from '../components/StatCard'
import { getIndicatorData, bothSexesSeries } from '../api'

export default function CapacityModule() {
  const [beds, setBeds] = useState(null)
  const [physicians, setPhysicians] = useState(null)
  const [healthExpGDP, setHealthExpGDP] = useState(null)
  const [oopExp, setOopExp] = useState(null)
  const [uhcIndex, setUhcIndex] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [b, p, he, oop, uhc] = await Promise.all([
          getIndicatorData('SH.MED.BEDS.ZS'),
          getIndicatorData('SH.MED.PHYS.ZS'),
          getIndicatorData('SH.XPD.CHEX.GD.ZS'),
          getIndicatorData('SH.XPD.OOPC.CH.ZS'),
          getIndicatorData('UHC_INDEX_REPORTED'),
        ])
        setBeds(bothSexesSeries(b))
        setPhysicians(bothSexesSeries(p))
        setHealthExpGDP(bothSexesSeries(he))
        setOopExp(bothSexesSeries(oop))
        setUhcIndex(bothSexesSeries(uhc))
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
        <span className="ml-3 text-gray-500">Loading health system data...</span>
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

  const latestBeds = beds?.[beds.length - 1]
  const latestPhysicians = physicians?.[physicians.length - 1]
  const latestHealthExp = healthExpGDP?.[healthExpGDP.length - 1]
  const latestOOP = oopExp?.[oopExp.length - 1]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Health System Capacity</h2>
        <p className="text-sm text-gray-500">
          Supply-side indicators: workforce, financing, and service coverage.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {latestBeds && (
          <StatCard
            label="Hospital Beds"
            value={latestBeds.value?.toFixed(2)}
            unit="per 1,000"
            color="blue"
          />
        )}
        {latestPhysicians && (
          <StatCard
            label="Physicians"
            value={latestPhysicians.value?.toFixed(3)}
            unit="per 1,000"
            color="green"
          />
        )}
        {latestHealthExp && (
          <StatCard
            label="Health Expenditure"
            value={latestHealthExp.value?.toFixed(1)}
            unit="% GDP"
            color="purple"
          />
        )}
        {latestOOP && (
          <StatCard
            label="Out-of-Pocket"
            value={latestOOP.value?.toFixed(1)}
            unit="% CHE"
            color="orange"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          title="Hospital Beds"
          subtitle="Per 1,000 people"
          data={beds}
          unit="per 1,000"
          color="#2563eb"
          source="world_bank"
          yDomain={[0, 'auto']}
        />
        <TrendChart
          title="Physicians"
          subtitle="Per 1,000 people"
          data={physicians}
          unit="per 1,000"
          color="#16a34a"
          source="world_bank"
          yDomain={[0, 'auto']}
        />
        <TrendChart
          title="Current Health Expenditure"
          subtitle="% of GDP"
          data={healthExpGDP}
          unit="%"
          color="#9333ea"
          source="world_bank"
          yDomain={[0, 'auto']}
        />
        <TrendChart
          title="Out-of-Pocket Expenditure"
          subtitle="% of current health expenditure"
          data={oopExp}
          unit="%"
          color="#ea580c"
          source="world_bank"
          yDomain={[0, 'auto']}
        />
      </div>

      {uhcIndex && uhcIndex.length > 0 && (
        <TrendChart
          title="UHC Service Coverage Index"
          subtitle="WHO universal health coverage index"
          data={uhcIndex}
          unit="index"
          color="#0891b2"
          source="who_gho"
          yDomain={[0, 100]}
        />
      )}
    </div>
  )
}