'use client'

import { useTheme, type Theme } from '@/hooks/useTheme'

const OPTIONS: { value: Theme; label: string; description: string; preview: React.ReactNode }[] = [
  {
    value: 'system',
    label: 'Automático',
    description: 'Segue o sistema operacional',
    preview: (
      <div className="flex rounded overflow-hidden h-10 w-full">
        <div className="flex-1 bg-white flex items-center justify-center gap-1 p-1">
          <div className="w-2 h-2 rounded-full bg-primary-500" />
          <div className="flex-1 h-1.5 rounded bg-gray-200" />
        </div>
        <div className="flex-1 bg-gray-900 flex items-center justify-center gap-1 p-1">
          <div className="w-2 h-2 rounded-full bg-primary-400" />
          <div className="flex-1 h-1.5 rounded bg-gray-600" />
        </div>
      </div>
    ),
  },
  {
    value: 'light',
    label: 'Claro',
    description: 'Sempre tema claro',
    preview: (
      <div className="rounded overflow-hidden h-10 w-full bg-white flex items-center gap-2 px-3">
        <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="h-1.5 rounded bg-gray-200 w-3/4" />
          <div className="h-1 rounded bg-gray-100 w-1/2" />
        </div>
      </div>
    ),
  },
  {
    value: 'dark',
    label: 'Escuro',
    description: 'Sempre tema escuro',
    preview: (
      <div className="rounded overflow-hidden h-10 w-full bg-gray-900 flex items-center gap-2 px-3">
        <div className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="h-1.5 rounded bg-gray-600 w-3/4" />
          <div className="h-1 rounded bg-gray-700 w-1/2" />
        </div>
      </div>
    ),
  },
]

const ICONS: Record<Theme, React.ReactNode> = {
  system: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  light: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  dark: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {OPTIONS.map((opt) => {
        const selected = theme === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={[
              'flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all',
              selected
                ? 'border-primary-600 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/30',
            ].join(' ')}
          >
            {/* Preview */}
            <div className="w-full border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              {opt.preview}
            </div>

            {/* Label row */}
            <div className="flex items-center gap-2">
              <span className={selected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}>
                {ICONS[opt.value]}
              </span>
              <div>
                <p className={`text-sm font-semibold ${selected ? 'text-primary-700 dark:text-primary-400' : 'text-gray-800 dark:text-gray-200'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</p>
              </div>
              {selected && (
                <div className="ml-auto w-4 h-4 rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
