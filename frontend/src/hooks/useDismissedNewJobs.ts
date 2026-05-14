'use client'

import { useCallback, useState } from 'react'

const STORAGE_KEY = 'jobhub:dismissed_new_jobs'

function loadDismissed(): Set<number> {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? new Set<number>(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export function useDismissedNewJobs() {
  const [dismissed, setDismissed] = useState<Set<number>>(loadDismissed)

  const dismiss = useCallback((jobId: number) => {
    setDismissed((prev) => {
      if (prev.has(jobId)) return prev

      const next = new Set(prev)
      next.add(jobId)

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {
        // Ignore private browsing and storage quota failures.
      }

      return next
    })
  }, [])

  return { dismissed, dismiss }
}
