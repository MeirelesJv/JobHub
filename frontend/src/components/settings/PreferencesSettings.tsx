'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useToast } from '@/store/toast.store'
import type { AuthUser } from '@/types'

const LEVEL_OPTIONS = [
  { value: '',        label: 'Qualquer nível' },
  { value: 'junior',  label: 'Júnior'          },
  { value: 'pleno',   label: 'Pleno'           },
  { value: 'senior',  label: 'Sênior'          },
]

const JOB_TYPE_OPTIONS = [
  { value: '',           label: 'Qualquer regime' },
  { value: 'clt',        label: 'CLT'              },
  { value: 'pj',         label: 'PJ'               },
  { value: 'freelance',  label: 'Freelance'        },
]

export function PreferencesSettings() {
  const toast   = useToast()
  const user    = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [level,      setLevel]      = useState('')
  const [jobType,    setJobType]    = useState('')
  const [salaryMin,  setSalaryMin]  = useState('')

  useEffect(() => {
    if (!user) return
    setLevel(user.level_preference ?? '')
    setJobType(user.job_type_preference ?? '')
    setSalaryMin(user.salary_expectation_min != null ? String(user.salary_expectation_min) : '')
  }, [user])

  const isDirty =
    level   !== (user?.level_preference    ?? '') ||
    jobType !== (user?.job_type_preference ?? '') ||
    (salaryMin === '' ? null : Number(salaryMin)) !== (user?.salary_expectation_min ?? null)

  const save = useMutation({
    mutationFn: () =>
      api.patch<AuthUser>('/api/users/profile', {
        level_preference:    level    || null,
        job_type_preference: jobType  || null,
        salary_expectation_min: salaryMin ? Number(salaryMin) : null,
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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nível de experiência</label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
        >
          {LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

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
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Pretensão salarial mínima (R$)
        </label>
        <input
          type="number"
          min={0}
          step={500}
          value={salaryMin}
          onChange={(e) => setSalaryMin(e.target.value)}
          placeholder="Ex: 5000"
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Deixe em branco para não filtrar por salário</p>
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
