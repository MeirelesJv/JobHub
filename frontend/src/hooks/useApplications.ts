import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import api from '@/lib/api'
import type { Application, ApplicationStats } from '@/types'

export function useCreateApplication() {
  const qc = useQueryClient()
  return useMutation<Application, Error, number>({
    mutationFn: (job_id: number) =>
      api.post<Application>('/api/applications', { job_id, mode: 'manual' }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['application-stats'] })
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['kanban'] })
    },
  })
}

export interface ManualApplicationInput {
  title:    string
  company:  string
  url:      string
  location?: string
  job_type?: 'clt' | 'pj' | 'freelance'
  level?:    'junior' | 'pleno' | 'senior'
  remote:   boolean
  notes?:   string
}

export function useCreateManualApplication() {
  const qc = useQueryClient()
  return useMutation<Application, Error, ManualApplicationInput>({
    mutationFn: (data) =>
      api.post<Application>('/api/applications/manual', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['application-stats'] })
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['kanban'] })
    },
  })
}

export function useAppliedJobIds(): Set<number> {
  const { data } = useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => api.get<Application[]>('/api/applications').then((r) => r.data),
    refetchOnWindowFocus: 'always',
  })

  return useMemo(() => new Set(data?.map((application) => application.job_id) ?? []), [data])
}

export function useRecentApplications() {
  return useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => api.get<Application[]>('/api/applications').then((r) => r.data),
  })
}

export function useApplicationStats() {
  return useQuery<ApplicationStats>({
    queryKey: ['application-stats'],
    queryFn:  () => api.get<ApplicationStats>('/api/applications/stats').then((r) => r.data),
  })
}
