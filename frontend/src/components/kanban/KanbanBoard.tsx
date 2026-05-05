'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { KanbanColumn, KanbanColumnSkeleton, COLUMN_CONFIG } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { useKanban, useUpdateApplicationStatus, useDeleteApplication } from '@/hooks/useKanban'
import { useToast } from '@/store/toast.store'
import type { Application, ApplicationStatus, KanbanResponse } from '@/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function findCard(data: KanbanResponse, id: UniqueIdentifier): Application | null {
  for (const col of COLUMN_CONFIG) {
    const found = (data[col.status] ?? []).find((a) => a.id === id)
    if (found) return found
  }
  return null
}

function getCardStatus(data: KanbanResponse, id: UniqueIdentifier): ApplicationStatus | null {
  for (const col of COLUMN_CONFIG) {
    if ((data[col.status] ?? []).some((a) => a.id === id)) return col.status
  }
  return null
}

function resolveTargetStatus(
  data: KanbanResponse,
  overId: UniqueIdentifier,
): ApplicationStatus | null {
  const colStatuses = COLUMN_CONFIG.map((c) => c.status) as string[]
  if (colStatuses.includes(overId as string)) return overId as ApplicationStatus
  return getCardStatus(data, overId)
}

// ─── delete modal ────────────────────────────────────────────────────────────

interface DeleteModalProps {
  app:       Application
  onConfirm: () => void
  onCancel:  () => void
  loading:   boolean
}

function DeleteModal({ app, onConfirm, onCancel, loading }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-2">Remover candidatura</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Tem certeza que deseja remover a candidatura para{' '}
          <span className="font-semibold text-gray-700">{app.job.title}</span>{' '}
          em <span className="font-semibold text-gray-700">{app.job.company}</span>?
          <br />
          <span className="text-red-500">Essa ação não pode ser desfeita.</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Removendo…
              </>
            ) : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── board ───────────────────────────────────────────────────────────────────

export function KanbanBoard() {
  const toast        = useToast()
  const { data, isLoading } = useKanban()
  const updateStatus = useUpdateApplicationStatus()
  const deleteApp    = useDeleteApplication()

  const [activeId,     setActiveId]     = useState<UniqueIdentifier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(e.active.id)
  }, [])

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    if (!over || !data) return

    const targetStatus = resolveTargetStatus(data, over.id)
    if (!targetStatus) return

    const sourceStatus = getCardStatus(data, active.id)
    if (sourceStatus === targetStatus) return

    updateStatus.mutate(
      { id: active.id as number, status: targetStatus },
      { onError: () => toast.error('Erro ao mover candidatura. A ação foi revertida.') },
    )
  }, [data, updateStatus, toast])

  const handleDelete = useCallback((app: Application) => {
    setDeleteTarget(app)
  }, [])

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return
    deleteApp.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Candidatura removida')
        setDeleteTarget(null)
      },
      onError: () => {
        toast.error('Erro ao remover candidatura. Tente novamente.')
        setDeleteTarget(null)
      },
    })
  }, [deleteTarget, deleteApp, toast])

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_CONFIG.map((c) => <KanbanColumnSkeleton key={c.status} />)}
      </div>
    )
  }

  const activeCard = activeId && data ? findCard(data, activeId) : null

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
            {COLUMN_CONFIG.map((config) => (
              <KanbanColumn
                key={config.status}
                config={config}
                items={data?.[config.status] ?? []}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeCard && (
            <KanbanCard
              application={activeCard}
              onDelete={() => {}}
              isDragOverlay
            />
          )}
        </DragOverlay>
      </DndContext>

      {deleteTarget && (
        <DeleteModal
          app={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteApp.isPending}
        />
      )}
    </>
  )
}
