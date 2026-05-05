import { useCallback, useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Job, JobListResponse, JobPlatform, JobType, JobLevel } from '@/types'

const PAGE_SIZE = 20

export type SortBy = 'date_desc' | 'date_asc' | 'title_asc' | 'platform_asc'

export interface JobFilters {
  q:         string
  platforms: JobPlatform[]
  levels:    JobLevel[]
  job_types: JobType[]
  remote:    boolean | null
  sort_by:   SortBy
}

export const defaultFilters: JobFilters = {
  q:         '',
  platforms: [],
  levels:    [],
  job_types: [],
  remote:    null,
  sort_by:   'date_desc',
}

function buildParams(filters: JobFilters, page: number): URLSearchParams {
  const p = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
  if (filters.q)                      p.set('query', filters.q)
  if (filters.platforms.length === 1) p.set('platform', filters.platforms[0])
  if (filters.levels.length === 1)    p.set('level', filters.levels[0])
  if (filters.job_types.length === 1) p.set('job_type', filters.job_types[0])
  if (filters.remote !== null)        p.set('remote', String(filters.remote))
  if (filters.sort_by !== 'date_desc') p.set('sort_by', filters.sort_by)
  return p
}

export function useJobs(filters: JobFilters) {
  return useInfiniteQuery<JobListResponse>({
    queryKey: ['jobs', filters],
    queryFn: ({ pageParam }) =>
      api.get<JobListResponse>(`/api/jobs?${buildParams(filters, pageParam as number)}`).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _all, lastPageParam) => {
      const loaded = (lastPageParam as number) * PAGE_SIZE
      return loaded < lastPage.total ? (lastPageParam as number) + 1 : undefined
    },
  })
}

export function useJob(id: number | null) {
  return useQuery<Job>({
    queryKey: ['job', id],
    queryFn:  () => api.get<Job>(`/api/jobs/${id}`).then((r) => r.data),
    enabled:  id !== null,
  })
}

interface SyncStatus {
  status:    'pending' | 'running' | 'completed' | 'failed'
  progress:  number
  message:   string
  jobs_new?:   number
  jobs_found?: number
}

const SYNC_TIMEOUT_MS = 20 * 60 * 1000  // 20 minutes

export function useSyncJobs() {
  const qc = useQueryClient()
  const [taskId,   setTaskId]   = useState<string | null>(null)
  const [syncing,  setSyncing]  = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)

  const statusQuery = useQuery<SyncStatus>({
    queryKey: ['syncStatus', taskId],
    queryFn:  () => api.get<SyncStatus>(`/api/jobs/sync/status/${taskId}`).then((r) => r.data),
    enabled:  syncing && !!taskId,
    refetchInterval: (query) => {
      const d = query.state.data
      if (!d) return 1000
      if (d.status === 'completed' || d.status === 'failed') return false
      if (startedAt && Date.now() - startedAt > SYNC_TIMEOUT_MS) return false
      return 1000
    },
  })

  // React to terminal states
  useEffect(() => {
    const d = statusQuery.data
    if (!d) return
    const done = d.status === 'completed' || d.status === 'failed'
    const timedOut = startedAt ? Date.now() - startedAt > SYNC_TIMEOUT_MS : false
    if (!done && !timedOut) return

    if (d.status === 'completed') {
      qc.invalidateQueries({ queryKey: ['jobs'] })
    }
    // Keep progress visible briefly before hiding
    const t = setTimeout(() => {
      setSyncing(false)
      setTaskId(null)
      setStartedAt(null)
    }, 1500)
    return () => clearTimeout(t)
  }, [statusQuery.data, qc, startedAt])

  const startSync = useCallback(async (platform?: string) => {
    if (syncing) return
    setSyncing(true)
    setStartedAt(Date.now())
    try {
      const body = platform ? { platforms: [platform] } : {}
      const { data } = await api.post<{ task_id: string }>('/api/jobs/sync', body)
      setTaskId(data.task_id)
    } catch {
      setSyncing(false)
      setStartedAt(null)
    }
  }, [syncing])

  return {
    isSyncing:  syncing,
    progress:   statusQuery.data?.progress  ?? (syncing ? 5 : 0),
    message:    statusQuery.data?.message   ?? (syncing ? 'Iniciando…' : ''),
    status:     statusQuery.data?.status    ?? (syncing ? 'running' : 'idle' as const),
    jobsFound:  statusQuery.data?.jobs_found ?? 0,
    startSync,
  }
}
