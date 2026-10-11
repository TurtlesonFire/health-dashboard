import React, { Suspense, lazy, useState } from 'react'
import Header from './components/Header'

// Each tab is code-split: Recharts (the bulk of the bundle) loads with the
// first module that needs it, and the other four arrive on demand. Named
// exports are mapped to the default export shape React.lazy expects.
const OverviewModule = lazy(() =>
  import('./modules/OverviewModule').then((m) => ({ default: m.default })),
)
const CapacityModule = lazy(() =>
  import('./modules/CapacityModule').then((m) => ({ default: m.default })),
)
const DiseaseBurdenModule = lazy(() =>
  import('./modules/DiseaseBurdenModule').then((m) => ({ default: m.default })),
)
const RiskFactorsModule = lazy(() =>
  import('./modules/RiskFactorsModule').then((m) => ({ default: m.default })),
)
const ContextModule = lazy(() =>
  import('./modules/ContextModule').then((m) => ({ default: m.default })),
)

function ModuleFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      <span className="ml-3 text-gray-500">Loading…</span>
    </div>
  )
}

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
        <Suspense fallback={<ModuleFallback />}>{renderModule()}</Suspense>
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
