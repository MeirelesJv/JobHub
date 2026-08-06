'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { useUserStore } from '@/store/user.store'
import { useToast } from '@/store/toast.store'
import type { UserProfile } from '@/types'

const JOB_TYPE_OPTIONS = [
  { value: '',           label: 'Qualquer regime' },
  { value: 'clt',        label: 'CLT'              },
  { value: 'pj',         label: 'PJ'               },
  { value: 'freelance',  label: 'Freelance'        },
]

export function PreferencesSettings() {
  const toast   = useToast()
  const user    = useUserStore((s) => s.user)
  const setUser = useUserStore((s) => s.setUser)

  const [jobType, setJobType] = useState('')

  useEffect(() => {
    if (!user) return
    setJobType(user.job_type_preference ?? '')
  }, [user])

  const isDirty = jobType !== (user?.job_type_preference ?? '')

  const save = useMutation({
    mutationFn: () =>
      api.patch<UserProfile>('/api/users/profile', {
        job_type_preference: jobType || null,
      }).then((r) => r.data),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Preferências salvas!')
    },
    onError: () => toast.error('Erro ao salvar. Tente novamente.'),
  })

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Regime de contratação</label>
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
        >
          {JOB_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Nível de experiência agora é definido por cargo, em "Cargos desejados" acima.
        </p>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || !isDirty}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {save.isPending ? 'Salvando…' : 'Salvar preferências'}
      </button>
    </div>
  )
}
