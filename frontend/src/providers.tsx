'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useState } from 'react'
import { getToken, getUser } from '@/lib/auth'
import { useAuthStore } from '@/store/auth.store'
import { Toaster } from '@/components/ui/Toaster'

function AuthHydrator() {
  const login = useAuthStore((s) => s.login)

  useEffect(() => {
    const token = getToken()
    const user  = getUser()
    if (token && user) login(user, token)
  }, [login])

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
      <AuthHydrator />
      {children}
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
