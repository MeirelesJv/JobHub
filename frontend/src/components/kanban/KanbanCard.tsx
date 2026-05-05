'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Application } from '@/types'

interface Props {
  application:   Application
  onDelete:      (app: Application) => void
  isDragOverlay?: boolean
}

const PLATFORM_BADGE: Record<string, string> = {
  linkedin: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  gupy:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  vagas:    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  catho:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  infojobs: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  gupy:     'Gupy',
  vagas:    'Vagas.com.br',
  catho:    'Catho',
  infojobs: 'InfoJobs',
}

export function KanbanCard({ application, onDelete, isDragOverlay = false }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id })

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition: isDragOverlay ? undefined : transition,
  }

  const badge = PLATFORM_BADGE[application.job.platform] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  const label = PLATFORM_LABEL[application.job.platform] ?? application.job.platform

  const dateStr = application.applied_at
    ? format(parseISO(application.applied_at), "d 'de' MMM", { locale: ptBR })
    : '—'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={[
        'bg-white dark:bg-gray-800 rounded-xl border p-4 select-none outline-none',
        isDragging && !isDragOverlay
          ? 'opacity-30 border-dashed border-gray-300 dark:border-gray-600 shadow-none'
          : 'border-gray-200 dark:border-gray-700 shadow-sm',
        isDragOverlay
          ? 'shadow-2xl border-primary-300 rotate-1 cursor-grabbing'
          : 'hover:shadow-md transition-shadow',
      ].join(' ')}
    >
      {/* Top row: drag handle + delete */}
      <div className="flex items-start justify-between mb-2 -mx-1">
        <button
          {...listeners}
          className="p-1 rounded cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors touch-none"
          tabIndex={-1}
          aria-label="Arrastar card"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="7"  cy="4"  r="1.5" />
            <circle cx="13" cy="4"  r="1.5" />
            <circle cx="7"  cy="10" r="1.5" />
            <circle cx="13" cy="10" r="1.5" />
            <circle cx="7"  cy="16" r="1.5" />
            <circle cx="13" cy="16" r="1.5" />
          </svg>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(application) }}
          className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          aria-label="Remover candidatura"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 mb-1">
        {application.job.title}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-3">{application.job.company}</p>

      <div className="flex items-center justify-between gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>{label}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{dateStr}</span>
      </div>
    </div>
  )
}
