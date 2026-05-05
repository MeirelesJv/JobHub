'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard } from './KanbanCard'
import type { Application, ApplicationStatus } from '@/types'

export interface ColumnConfig {
  status:     ApplicationStatus
  label:      string
  headerBg:   string
  countStyle: string
  dotColor:   string
}

export const COLUMN_CONFIG: ColumnConfig[] = [
  {
    status:     'applied',
    label:      'Aplicado',
    headerBg:   'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800',
    countStyle: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    dotColor:   'bg-blue-400',
  },
  {
    status:     'in_review',
    label:      'Em Análise',
    headerBg:   'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800',
    countStyle: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    dotColor:   'bg-amber-400',
  },
  {
    status:     'interview',
    label:      'Entrevista',
    headerBg:   'bg-violet-50 border-violet-100 dark:bg-violet-900/20 dark:border-violet-800',
    countStyle: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
    dotColor:   'bg-violet-400',
  },
  {
    status:     'offer',
    label:      'Oferta',
    headerBg:   'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800',
    countStyle: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    dotColor:   'bg-emerald-400',
  },
  {
    status:     'rejected',
    label:      'Recusado',
    headerBg:   'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800',
    countStyle: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    dotColor:   'bg-red-400',
  },
]

interface Props {
  config:   ColumnConfig
  items:    Application[]
  onDelete: (app: Application) => void
}

export function KanbanColumn({ config, items, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: config.status })

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl border-t border-x ${config.headerBg}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{config.label}</h3>
        </div>
        <span className={`min-w-[1.5rem] text-center px-2 py-0.5 rounded-full text-xs font-bold ${config.countStyle}`}>
          {items.length}
        </span>
      </div>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={[
          'flex-1 rounded-b-xl border-x border-b p-2.5 flex flex-col gap-2',
          'transition-colors duration-150 overflow-y-auto',
          isOver
            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700'
            : 'bg-gray-50/80 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
        ].join(' ')}
        style={{ minHeight: 200, maxHeight: 'calc(100vh - 240px)' }}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((app) => (
            <KanbanCard key={app.id} application={app} onDelete={onDelete} />
          ))}
        </SortableContext>

        {items.length === 0 && !isOver && (
          <div className="flex-1 flex items-center justify-center py-6">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Nenhuma candidatura aqui</p>
          </div>
        )}

        {isOver && (
          <div className="rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-600 bg-primary-50/60 dark:bg-primary-900/20 h-16 flex items-center justify-center">
            <p className="text-xs text-primary-500 dark:text-primary-400 font-medium">Solte aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function KanbanColumnSkeleton() {
  return (
    <div className="w-72 flex-shrink-0 animate-pulse">
      <div className="h-12 rounded-t-xl bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600" />
      <div className="rounded-b-xl border-x border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 space-y-2.5 min-h-[200px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600 p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div className="w-4 h-4 bg-gray-100 dark:bg-gray-600 rounded" />
              <div className="w-4 h-4 bg-gray-100 dark:bg-gray-600 rounded" />
            </div>
            <div className="h-3.5 bg-gray-100 dark:bg-gray-600 rounded w-3/4" />
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/2" />
            <div className="flex justify-between mt-1">
              <div className="h-4 w-14 bg-gray-100 dark:bg-gray-600 rounded-full" />
              <div className="h-3 w-10 bg-gray-100 dark:bg-gray-600 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
