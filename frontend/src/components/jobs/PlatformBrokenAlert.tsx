'use client'

import { useEffect, useState } from 'react'
import { usePlatformHealth, type PlatformHealth } from '@/hooks/usePlatformHealth'

const STORAGE_KEY = 'jobhub_dismissed_platform_alerts'

function readDismissed(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function persistDismissed(dismissed: Record<string, string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed))
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function PlatformBrokenAlert() {
  const { data: platforms = [] } = usePlatformHealth()
  const [dismissed, setDismissed] = useState<Record<string, string>>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setDismissed(readDismissed())
    setHydrated(true)
  }, [])

  if (!hydrated) return null

  // Um site conta como "pendente de aviso" se está quebrado e o usuário ainda não
  // dispensou ESSA quebra específica (broken_since diferente = quebra nova, reabre o aviso)
  const pending = platforms.filter(
    (p) => !p.is_healthy && dismissed[p.slug] !== p.broken_since
  )

  if (pending.length === 0) return null

  function dismiss(platform: PlatformHealth) {
    const next = { ...dismissed, [platform.slug]: platform.broken_since ?? '' }
    setDismissed(next)
    persistDismissed(next)
  }

  function dismissAll() {
    const next = { ...dismissed }
    for (const p of pending) next[p.slug] = p.broken_since ?? ''
    setDismissed(next)
    persistDismissed(next)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismissAll} />
      <div className="relative bg-white dark:bg-gray-800 w-full sm:max-w-lg sm:rounded-2xl shadow-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {pending.length === 1 ? 'Um coletor pode estar quebrado' : `${pending.length} coletores podem estar quebrados`}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                A busca parou de encontrar vagas onde normalmente encontra — provável mudança de layout no site.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.slug} className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                  {p.broken_since && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                      desde {fmtDate(p.broken_since)}
                    </span>
                  )}
                </div>
                {p.broken_step && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1.5">
                    <span className="font-medium">Onde:</span> {p.broken_step}
                  </p>
                )}
                {p.broken_detail && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono leading-relaxed">
                    {p.broken_detail}
                  </p>
                )}
                <button
                  onClick={() => dismiss(p)}
                  className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300"
                >
                  Ciente, dispensar
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-5">
            <button
              onClick={dismissAll}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Dispensar {pending.length > 1 ? 'todos' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
