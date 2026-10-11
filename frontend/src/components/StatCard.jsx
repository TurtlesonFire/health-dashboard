import React from 'react'
import { formatValue } from '../format'

/**
 * `value` may be a number (formatted for `unit`) or a preformatted string
 * (e.g. an equity ratio like "2.8×") — strings pass through untouched.
 */
export default function StatCard({
  label,
  value,
  unit,
  unitKey,
  change,
  changeLabel,
  color = 'blue',
  hint,
}) {
  const colorMap = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
  }

  const display =
    typeof value === 'number' ? formatValue(value, unitKey || unit) : value

  return (
    <div className="card">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] || 'text-gray-900'}`}>
        {display}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {change !== undefined && (
        <p className="text-xs text-gray-500 mt-1">
          {change > 0 ? '+' : ''}{change} {changeLabel || 'vs prev year'}
        </p>
      )}
    </div>
  )
}
