import React from 'react'

export default function SourceBadge({ source }) {
  const config = {
    who_gho: { label: 'WHO GHO', color: 'blue' },
    world_bank: { label: 'World Bank', color: 'green' },
    psa: { label: 'PSA', color: 'purple' },
    doh: { label: 'DOH', color: 'orange' },
  }
  const c = config[source] || { label: source, color: 'gray' }
  return (
    <span className={`badge badge-${c.color}`}>
      {c.label}
    </span>
  )
}