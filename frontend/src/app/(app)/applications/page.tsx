'use client'

import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { useApplicationStats } from '@/hooks/useApplications'
import { COLUMN_CONFIG } from '@/components/kanban/KanbanColumn'

const STAT_MAP: Record<string, { label: string; textColor: string; bgColor: string }> = {
  applied:   { label: 'Aplicado',   textColor: 'text-blue-700',    bgColor: 'bg-blue-50'    },
  in_review: { label: 'Em Análise', textColor: 'text-amber-700',   bgColor: 'bg-amber-50'   },
  interview: { label: 'Entrevista', textColor: 'text-violet-700',  bgColor: 'bg-violet-50'  },
  offer:     { label: 'Oferta',     textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  rejected:  { label: 'Recusado',   textColor: 'text-red-700',     bgColor: 'bg-red-50'     },
}

function StatsBar() {
  const { data: stats } = useApplicationStats()

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {/* Total */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
        <span className="text-2xl font-bold text-gray-900">{stats?.total ?? '—'}</span>
        <span className="text-xs text-gray-500 leading-tight">candidaturas<br />no total</span>
      </div>

      {/* Per-status mini stats */}
      {COLUMN_CONFIG.map(({ status }) => {
        const meta = STAT_MAP[status]
        if (!meta) return null
        const count = stats?.[status as keyof typeof stats] ?? 0
        return (
          <div
            key={status}
            className={`flex items-center gap-2 ${meta.bgColor} rounded-xl px-4 py-2.5`}
          >
            <span className={`text-2xl font-bold ${meta.textColor}`}>{count}</span>
            <span className={`text-xs ${meta.textColor} opacity-80 leading-tight`}>
              {meta.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function ApplicationsPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Candidaturas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Arraste os cards entre colunas para atualizar o status
        </p>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* Kanban board */}
      <KanbanBoard />
    </div>
  )
}
