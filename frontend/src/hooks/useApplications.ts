import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Application, ApplicationStats } from '@/types'

export function useCreateApplication() {
  const qc = useQueryClient()
  return useMutation<Application, Error, number>({
    mutationFn: (job_id: number) =>
      api.post<Application>('/api/applications', { job_id, mode: 'manual' }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['application-stats'] })
      qc.invalidateQueries({ queryKey: ['kanban'] })
    },
  })
}

export function useApplicationStats() {
  return useQuery<ApplicationStats>({
    queryKey: ['application-stats'],
    queryFn:  () => api.get<ApplicationStats>('/api/applications/stats').then((r) => r.data),
  })
}
