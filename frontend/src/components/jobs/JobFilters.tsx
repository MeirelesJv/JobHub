'use client'

import type { JobPlatform, JobType, JobLevel } from '@/types'
import type { JobFilters } from '@/hooks/useJobs'

interface Props {
  filters:   JobFilters
  onChange:  (f: JobFilters) => void
  onClose?:  () => void
}

const PLATFORMS: { value: JobPlatform; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn'  },
  { value: 'gupy',     label: 'Gupy'      },
  { value: 'vagas',    label: 'Vagas.com.br' },
  { value: 'catho',    label: 'Catho'     },
  { value: 'infojobs', label: 'InfoJobs'  },
]

const LEVELS: { value: JobLevel; label: string }[] = [
  { value: 'junior', label: 'Júnior' },
  { value: 'pleno',  label: 'Pleno'  },
  { value: 'senior', label: 'Sênior' },
]

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'clt',       label: 'CLT'       },
  { value: 'pj',        label: 'PJ'        },
  { value: 'freelance', label: 'Freelance' },
]

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

function hasActiveFilters(f: JobFilters) {
  return f.q || f.platforms.length || f.levels.length || f.job_types.length || f.remote !== null
}

export function JobFilters({ filters, onChange, onClose }: Props) {
  const set = (partial: Partial<JobFilters>) => onChange({ ...filters, ...partial })

  return (
    <div className="flex flex-col h-full">
      {/* Mobile header */}
      {onClose && (
        <div className="flex items-center justify-between mb-5 lg:hidden">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Filtros</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Buscar</label>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cargo, empresa…"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Plataforma */}
      <FilterGroup label="Plataforma">
        {PLATFORMS.map(({ value, label }) => (
          <Checkbox
            key={value}
            label={label}
            checked={filters.platforms.includes(value)}
            onChange={() => set({ platforms: toggle(filters.platforms, value) })}
          />
        ))}
      </FilterGroup>

      {/* Nível */}
      <FilterGroup label="Nível">
        {LEVELS.map(({ value, label }) => (
          <Checkbox
            key={value}
            label={label}
            checked={filters.levels.includes(value)}
            onChange={() => set({ levels: toggle(filters.levels, value) })}
          />
        ))}
      </FilterGroup>

      {/* Regime */}
      <FilterGroup label="Regime">
        {JOB_TYPES.map(({ value, label }) => (
          <Checkbox
            key={value}
            label={label}
            checked={filters.job_types.includes(value)}
            onChange={() => set({ job_types: toggle(filters.job_types, value) })}
          />
        ))}
      </FilterGroup>

      {/* Remoto */}
      <FilterGroup label="Modalidade">
        <label className="flex items-center justify-between py-1 cursor-pointer">
          <span className="text-sm text-gray-700 dark:text-gray-300">Apenas remoto</span>
          <button
            role="switch"
            aria-checked={filters.remote === true}
            onClick={() => set({ remote: filters.remote === true ? null : true })}
            className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500
              ${filters.remote === true ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${filters.remote === true ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        </label>
      </FilterGroup>

      {/* Clear */}
      {hasActiveFilters(filters) && (
        <button
          onClick={() => onChange({ q: '', platforms: [], levels: [], job_types: [], remote: null, sort_by: 'date_desc' })}
          className="mt-auto pt-4 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Limpar filtros
        </button>
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2.5 py-1 cursor-pointer group">
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
          ${checked ? 'bg-primary-600 border-primary-600' : 'border-gray-300 dark:border-gray-500 group-hover:border-primary-400'}`}
        onClick={onChange}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  )
}
