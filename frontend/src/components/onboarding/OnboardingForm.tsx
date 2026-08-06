'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useUserStore } from '@/store/user.store'
import { useToast } from '@/store/toast.store'
import type { UserProfile } from '@/types'

const LOCATION_OPTIONS = [
  { value: 'São Paulo, SP',        label: 'São Paulo, SP'        },
  { value: 'Rio de Janeiro, RJ',   label: 'Rio de Janeiro, RJ'   },
  { value: 'Belo Horizonte, MG',   label: 'Belo Horizonte, MG'   },
  { value: 'Curitiba, PR',         label: 'Curitiba, PR'         },
  { value: 'Porto Alegre, RS',     label: 'Porto Alegre, RS'     },
  { value: 'Brasília, DF',         label: 'Brasília, DF'         },
  { value: 'Florianópolis, SC',    label: 'Florianópolis, SC'    },
  { value: 'Recife, PE',           label: 'Recife, PE'           },
  { value: 'Salvador, BA',         label: 'Salvador, BA'         },
  { value: 'Fortaleza, CE',        label: 'Fortaleza, CE'        },
  { value: 'Remoto',               label: 'Remoto (qualquer lugar)' },
  { value: '_custom',              label: 'Outra cidade…'        },
]

const LEVEL_OPTIONS = [
  { value: '',       label: 'Não especificado' },
  { value: 'junior', label: 'Júnior'           },
  { value: 'pleno',  label: 'Pleno'            },
  { value: 'senior', label: 'Sênior'           },
]

export default function OnboardingForm() {
  const router   = useRouter()
  const toast    = useToast()
  const user     = useUserStore((s) => s.user)
  const setUser  = useUserStore((s) => s.setUser)

  const [desiredRole,  setDesiredRole]  = useState(user?.desired_role ?? '')
  const [level,        setLevel]        = useState('')
  const [locationSel,  setLocationSel]  = useState(user?.location_preference ?? '')
  const [locationText, setLocationText] = useState('')
  const [remote,       setRemote]       = useState(user?.remote_preference ?? false)

  const effectiveLocation = locationSel === '_custom' ? locationText : locationSel

  const finish = useMutation({
    mutationFn: async () => {
      const updated = await api.patch<UserProfile>('/api/users/profile', {
        desired_role:         desiredRole.trim() || null,
        location_preference:  effectiveLocation  || null,
        remote_preference:    remote === true,
        onboarding_completed: true,
      }).then((r) => r.data)

      if (desiredRole.trim()) {
        try {
          await api.post('/api/users/roles', {
            role_name:  desiredRole.trim(),
            level:      level || null,
            is_primary: true,
          })
        } catch {
          // Role may already exist — ignore conflict errors
        }
      }

      return updated
    },
    onSuccess: async (updated) => {
      setUser(updated)
      try {
        const location = updated.location_preference
        await api.post('/api/jobs/sync', location ? { locations: [location.split(',')[0].trim()] } : {})
      } catch {
        // Sync failure is non-critical; continue to dashboard
      }
      toast.success('Configuração concluída! Buscando vagas para você…')
      router.push('/dashboard')
    },
    onError: () => toast.error('Erro ao salvar. Tente novamente.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    finish.mutate()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Vamos começar!</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Conte o essencial pra gente personalizar sua busca de vagas.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Qual cargo você está buscando?">
          <input
            type="text"
            value={desiredRole}
            onChange={(e) => setDesiredRole(e.target.value)}
            placeholder="Ex: Desenvolvedor Full Stack, Analista de Dados…"
            className={inputCls}
          />
        </Field>

        <Field label="Nível de experiência nesse cargo">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className={inputCls}
          >
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Onde prefere trabalhar?">
          <select
            value={locationSel}
            onChange={(e) => setLocationSel(e.target.value)}
            className={inputCls}
          >
            <option value="">Selecione uma cidade</option>
            {LOCATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {locationSel === '_custom' && (
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="Digite sua cidade"
              className={`${inputCls} mt-2`}
            />
          )}
        </Field>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Aceito trabalho remoto</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Incluir vagas 100% remotas no feed</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={remote}
            onClick={() => setRemote((v) => !v)}
            className={[
              'relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none overflow-hidden',
              remote ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600',
            ].join(' ')}
          >
            <span className={[
              'absolute left-0 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
              remote ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')} />
          </button>
        </div>

        <button
          type="submit"
          disabled={finish.isPending}
          className="w-full py-3 mt-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {finish.isPending ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Salvando…
            </>
          ) : (
            <>
              Concluir
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  )
}

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
