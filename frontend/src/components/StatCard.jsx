import React from 'react'

export default function StatCard({ label, value, unit, change, changeLabel, color = 'blue' }) {
  const colorMap = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
  }

  return (
    <div className="card">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] || 'text-gray-900'}`}>
        {typeof value === 'number' ? value.toFixed(1) : value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      {change !== undefined && (
        <p className="text-xs text-gray-500 mt-1">
          {change > 0 ? '+' : ''}{change} {changeLabel || 'vs prev year'}
        </p>
      )}
    </div>
  )
}