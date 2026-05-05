'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useToast } from '@/store/toast.store'
import type { AuthUser } from '@/types'

interface Props {
  onBack: () => void
}

const PLATFORMS = ['LinkedIn', 'Gupy', 'Vagas.com.br', 'Catho', 'InfoJobs'] as const

const CONTRACT_OPTIONS = [
  { value: 'clt',       label: 'CLT'       },
  { value: 'pj',        label: 'PJ'        },
  { value: 'freelance', label: 'Freelance' },
]

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

export default function OnboardingStep3({ onBack }: Props) {
  const router   = useRouter()
  const toast    = useToast()
  const user     = useAuthStore((s) => s.user)
  const setUser  = useAuthStore((s) => s.setUser)

  const [platforms,   setPlatforms]  = useState<string[]>(['LinkedIn', 'Gupy', 'Vagas.com.br'])
  const [contracts,   setContracts]  = useState<string[]>([])
  const [remote,      setRemote]     = useState<boolean>(false)
  const [salary,      setSalary]     = useState('')

  // Sync initial state from user profile when it loads
  useEffect(() => {
    setRemote(user?.remote_preference ?? false)
  }, [user?.remote_preference])

  const finish = useMutation({
    mutationFn: async () => {
      const updated = await api.patch<AuthUser>('/api/users/profile', {
        job_type_preference:    contracts[0] ?? null,
        remote_preference:      remote === true,   // explicit boolean, never undefined
        salary_expectation_min: salary ? parseInt(salary, 10) : null,
        onboarding_completed:   true,
      }).then((r) => r.data)
      return updated
    },
    onSuccess: async (updated) => {
      setUser(updated)
      // Trigger job sync with user preferences in background
      try {
        const location = updated.location_preference
        await api.post('/api/jobs/sync', location ? { locations: [location.split(',')[0].trim()] } : {})
      } catch {
        // Sync failure is non-critical; continue to dashboard
      }
      toast.success('Configuração concluída! Buscando vagas para você…')
      router.push('/dashboard')
    },
    onError: () => toast.error('Erro ao salvar configurações. Tente novamente.'),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Preferências de busca</h1>
      <p className="text-gray-500 text-sm mb-8">
        Personalize quais vagas aparecem no seu feed.
      </p>

      {/* Platforms */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Plataformas para monitorar</p>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => {
            const active = platforms.includes(p)
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatforms((prev) => toggle(prev, p))}
                className={[
                  'py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-colors text-left',
                  active ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  <span className={[
                    'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center',
                    active ? 'border-primary-600 bg-primary-600' : 'border-gray-300',
                  ].join(' ')}>
                    {active && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  {p}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Contract type */}
      <section className="mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Tipo de contrato</p>
        <div className="flex gap-2 flex-wrap">
          {CONTRACT_OPTIONS.map(({ value, label }) => {
            const active = contracts.includes(value)
            return (
              <button
                key={value}
                type="button"
                onClick={() => setContracts((prev) => toggle(prev, value))}
                className={[
                  'px-4 py-2 rounded-xl border-2 text-sm font-medium transition-colors',
                  active ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Remote toggle */}
      <section className="mb-6">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-gray-700">Aceito trabalho remoto</p>
            <p className="text-xs text-gray-400 mt-0.5">Incluir vagas 100% remotas no feed</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={remote}
            onClick={() => setRemote((v) => !v)}
            className={[
              'relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none overflow-hidden',
              remote ? 'bg-primary-600' : 'bg-gray-300',
            ].join(' ')}
          >
            <span className={[
              'absolute left-0 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
              remote ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')} />
          </button>
        </div>
      </section>

      {/* Salary */}
      <section className="mb-8">
        <p className="text-sm font-semibold text-gray-700 mb-1.5">
          Pretensão salarial mínima <span className="font-normal text-gray-400">(opcional)</span>
        </p>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">R$</span>
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="5000"
            min={0}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </section>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={() => finish.mutate()}
          disabled={finish.isPending}
          className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          {finish.isPending ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Finalizando…
            </>
          ) : (
            <>
              Concluir configuração
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
