import React, { useEffect, useState } from 'react'
import TrendChart from '../components/TrendChart'
import StatCard from '../components/StatCard'
import { getIndicatorData, getMetricInfo, bothSexesSeries } from '../api'

export default function RiskFactorsModule() {
  const [tobacco, setTobacco] = useState(null)
  const [obesity, setObesity] = useState(null)
  const [metricInfo, setMetricInfo] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [tobData, obData, info] = await Promise.all([
          getIndicatorData('M_Est_tob_curr'),
          getIndicatorData('NCD_BMI_30A'),
          getMetricInfo(),
        ])
        setTobacco(bothSexesSeries(tobData))
        setObesity(bothSexesSeries(obData))
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
        <span className="ml-3 text-gray-500">Loading risk factor data...</span>
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

  const latestTobacco = tobacco?.[tobacco.length - 1]
  const latestObesity = obesity?.[obesity.length - 1]

  const info = (code) => metricInfo[code]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Risk Factors</h2>
        <p className="text-sm text-gray-500">
          Tobacco, alcohol, and obesity indicators.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {latestTobacco && (
          <StatCard
            label="Tobacco Use"
            value={latestTobacco.value}
            unitKey="percent"
            color="red"
          />
        )}
        {latestObesity && (
          <StatCard
            label="Obesity"
            value={latestObesity.value}
            unitKey="percent"
            color="purple"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <TrendChart
          title="Current Tobacco Use"
          subtitle="% of adults, age-standardized"
          data={tobacco}
          unitKey="percent"
          color="#dc2626"
          source="who_gho"
          yDomain={[0, 100]}
          metricInfo={info('M_Est_tob_curr')}
        />
      </div>

      {obesity && obesity.length > 0 && (
        <TrendChart
          title="Obesity Prevalence"
          subtitle="BMI ≥ 30, age-standardized estimate"
          data={obesity}
          unitKey="percent"
          color="#9333ea"
          source="who_gho"
          yDomain={[0, 100]}
          metricInfo={info('NCD_BMI_30A')}
        />
      )}
    </div>
  )
}
