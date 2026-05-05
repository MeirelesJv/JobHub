import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface DesiredRole {
  id:         number
  role_name:  string
  is_primary: boolean
  order:      number
}

function setRoles(qc: ReturnType<typeof useQueryClient>) {
  return (data: DesiredRole[]) => qc.setQueryData<DesiredRole[]>(['desiredRoles'], data)
}

export function useDesiredRoles() {
  return useQuery<DesiredRole[]>({
    queryKey: ['desiredRoles'],
    queryFn:  () => api.get<DesiredRole[]>('/api/users/roles').then((r) => r.data),
  })
}

export function useAddRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { role_name: string; is_primary?: boolean; order?: number }) =>
      api.post<DesiredRole>('/api/users/roles', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['desiredRoles'] }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<DesiredRole> & { id: number }) =>
      api.put<DesiredRole>(`/api/users/roles/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['desiredRoles'] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/users/roles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['desiredRoles'] }),
  })
}

export function useSetPrimaryRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.patch<DesiredRole>(`/api/users/roles/${id}/primary`).then((r) => r.data),
    onSuccess: (updated) => {
      // Optimistically update cache: only one primary at a time
      qc.setQueryData<DesiredRole[]>(['desiredRoles'], (prev) =>
        prev?.map((r) => ({ ...r, is_primary: r.id === updated.id })) ?? []
      )
      qc.invalidateQueries({ queryKey: ['desiredRoles'] })
    },
  })
}
