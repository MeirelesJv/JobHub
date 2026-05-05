'use client'

import { useEffect, useState } from 'react'

interface Props {
  visible:    boolean
  progress:   number
  message:    string
  jobsFound?: number
}

export function SyncProgressBar({ visible, progress, message, jobsFound }: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
    } else {
      const t = setTimeout(() => setShow(false), 2000)
      return () => clearTimeout(t)
    }
  }, [visible])

  if (!show) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      {/* Progress rail */}
      <div className="h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-primary-600 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status banner */}
      <div className="flex justify-center mt-1">
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-xl shadow-md text-sm">
          {/* Spinner */}
          <svg
            className="w-4 h-4 text-primary-600 animate-spin flex-shrink-0"
            fill="none" viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>

          {/* Message */}
          {message && (
            <span className="text-gray-700 dark:text-gray-200 font-medium">{message}</span>
          )}

          {/* Jobs counter badge — shown when at least 1 found */}
          {(jobsFound ?? 0) > 0 && (
            <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs font-semibold rounded-full">
              {jobsFound?.toLocaleString('pt-BR')} vagas
            </span>
          )}

          {/* Progress % */}
          <span className="text-gray-400 dark:text-gray-500 text-xs tabular-nums">{progress}%</span>
        </div>
      </div>
    </div>
  )
}
