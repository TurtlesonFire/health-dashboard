import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import SourceBadge from './SourceBadge'

export default function TrendChart({
  title,
  subtitle,
  data,
  dataKey = 'value',
  xKey = 'year',
  unit = '',
  color = '#2563eb',
  source,
  height = 300,
  yDomain,
  referenceLines = [],
}) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">{title}</h3>
        <p className="card-subtitle">{subtitle}</p>
        <div className="flex items-center justify-center h-64 text-gray-400">
          No data available
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="card-title">{title}</h3>
          <p className="card-subtitle">{subtitle}</p>
        </div>
        {source && <SourceBadge source={source} />}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#e5e7eb' }}
            domain={yDomain || ['auto', 'auto']}
            label={unit ? { value: unit, angle: -90, position: 'insideLeft', style: { fontSize: 11 } } : undefined}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            formatter={(value) => [`${Number(value).toFixed(1)} ${unit}`, title]}
          />
          {referenceLines.map((rl, i) => (
            <ReferenceLine
              key={i}
              y={rl.y}
              label={rl.label}
              stroke={rl.color || '#ef4444'}
              strokeDasharray="5 5"
            />
          ))}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

