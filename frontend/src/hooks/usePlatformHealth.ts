import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface PlatformHealth {
  id: number
  name: string
  slug: string
  last_sync_at: string | null
  is_healthy: boolean
  broken_step: string | null
  broken_detail: string | null
  broken_since: string | null
}

// Checa a cada 10min — não precisa ser em tempo real, só avisar em algum momento da sessão
const CHECK_INTERVAL_MS = 10 * 60 * 1000

export function usePlatformHealth() {
  return useQuery<PlatformHealth[]>({
    queryKey: ['platformHealth'],
    queryFn:  () => api.get<PlatformHealth[]>('/api/jobs/platforms').then((r) => r.data),
    refetchInterval: CHECK_INTERVAL_MS,
    staleTime: CHECK_INTERVAL_MS,
  })
}
