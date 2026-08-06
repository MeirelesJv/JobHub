'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useUserStore } from '@/store/user.store'
import type { UserProfile } from '@/types'
import { Toaster } from '@/components/ui/Toaster'

function UserHydrator() {
  const setUser = useUserStore((s) => s.setUser)

  useEffect(() => {
    api.get<UserProfile>('/api/users/profile').then((res) => setUser(res.data))
  }, [setUser])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <UserHydrator />
      {children}
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
