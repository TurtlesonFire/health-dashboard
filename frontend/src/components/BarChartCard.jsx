import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import SourceBadge from './SourceBadge'

export default function BarChartCard({
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
  // 'horizontal' ranks categories down the left edge, which is what a region
  // ranking needs — region names are far too long for vertical bar labels.
  layout = 'vertical',
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
        <BarChart
          data={data}
          layout={layout}
          margin={layout === 'horizontal'
            ? { top: 5, right: 40, left: 8, bottom: 5 }
            : { top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          {layout === 'horizontal' ? (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                width={150}
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e5e7eb' }}
              />
            </>
          ) : (
            <>
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
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            formatter={(value) => [`${Number(value).toFixed(1)} ${unit}`, title]}
          />
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={layout === 'horizontal' ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}