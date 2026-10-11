import React, { useState } from 'react'
import Header from './components/Header'
import OverviewModule from './modules/OverviewModule'
import CapacityModule from './modules/CapacityModule'
import DiseaseBurdenModule from './modules/DiseaseBurdenModule'
import RiskFactorsModule from './modules/RiskFactorsModule'
import ContextModule from './modules/ContextModule'

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')

  const renderModule = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewModule />
      case 'capacity':
        return <CapacityModule />
      case 'disease':
        return <DiseaseBurdenModule />
      case 'risk':
        return <RiskFactorsModule />
      case 'context':
        return <ContextModule />
      default:
        return <OverviewModule />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderModule()}
      </main>
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-gray-400 text-center">
            Data sources: WHO Global Health Observatory, World Bank Open Data.
            Built for the Philippine health systems community.
          </p>
        </div>
      </footer>
    </div>
  )
}