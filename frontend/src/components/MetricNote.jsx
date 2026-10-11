import React from 'react'

/**
 * Collapsible plain-language explanation of a metric.
 *
 * Uses <details>/<summary> so it needs no state and stays keyboard-accessible.
 * Renders nothing when no description exists for the indicator.
 */
export default function MetricNote({ info, className = '' }) {
  if (!info || (!info.what && !info.how)) return null

  return (
    <details className={`group mt-3 ${className}`}>
      <summary className="cursor-pointer list-none text-xs font-medium text-primary-600 hover:text-primary-700 select-none">
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] leading-none"
            aria-hidden="true"
          >
            i
          </span>
          About this metric
          <span className="text-gray-400 group-open:hidden">▸</span>
          <span className="hidden text-gray-400 group-open:inline">▾</span>
        </span>
      </summary>
      <div className="mt-2 space-y-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
        {info.what && (
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-700">What it measures. </span>
            {info.what}
          </p>
        )}
        {info.how && (
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-700">How to read it. </span>
            {info.how}
          </p>
        )}
      </div>
    </details>
  )
}
