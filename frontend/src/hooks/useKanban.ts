import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Application, ApplicationStatus, KanbanResponse } from '@/types'

const ALL_STATUSES: ApplicationStatus[] = ['applied', 'in_review', 'interview', 'offer', 'rejected', 'cancelled']

function moveCard(data: KanbanResponse, id: number, newStatus: ApplicationStatus): KanbanResponse {
  const result = { ...data }
  let moved: Application | null = null

  for (const s of ALL_STATUSES) {
    const arr = result[s] ?? []
    const idx = arr.findIndex((a) => a.id === id)
    if (idx !== -1) {
      moved = { ...arr[idx], status: newStatus }
      result[s] = arr.filter((a) => a.id !== id)
      break
    }
  }

  if (moved) {
    result[newStatus] = [...(result[newStatus] ?? []), moved]
  }

  return result
}

export function useKanban() {
  return useQuery<KanbanResponse>({
    queryKey: ['kanban'],
    queryFn:  () => api.get<KanbanResponse>('/api/applications/kanban').then((r) => r.data),
  })
}

export function useUpdateApplicationStatus() {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: number; status: ApplicationStatus }, { prev?: KanbanResponse }>({
    mutationFn: ({ id, status }) =>
      api.patch(`/api/applications/${id}/status`, { status }).then((r) => r.data),

    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['kanban'] })
      const prev = qc.getQueryData<KanbanResponse>(['kanban'])
      if (prev) qc.setQueryData(['kanban'], moveCard(prev, id, status))
      return { prev }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['kanban'], ctx.prev)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['kanban'] })
    },
  })
}

export function useDeleteApplication() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: (id) => api.delete(`/api/applications/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban'] })
      qc.invalidateQueries({ queryKey: ['application-stats'] })
    },
  })
}
