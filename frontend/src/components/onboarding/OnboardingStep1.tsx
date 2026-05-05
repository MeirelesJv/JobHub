'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useToast } from '@/store/toast.store'
import type { AuthUser } from '@/types'

interface Props {
  onNext: () => void
}

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

export default function OnboardingStep1({ onNext }: Props) {
  const toast    = useToast()
  const user     = useAuthStore((s) => s.user)
  const setUser  = useAuthStore((s) => s.setUser)

  const [fullName,     setFullName]     = useState(user?.full_name ?? '')
  const [desiredRole,  setDesiredRole]  = useState(user?.desired_role ?? '')
  const [locationSel,  setLocationSel]  = useState(user?.location_preference ?? '')
  const [locationText, setLocationText] = useState('')
  const [level,        setLevel]        = useState(user?.level_preference ?? '')

  const effectiveLocation = locationSel === '_custom' ? locationText : locationSel

  const save = useMutation({
    mutationFn: async () => {
      const { data: updated } = await api.patch<AuthUser>('/api/users/profile', {
        full_name:           fullName.trim(),
        desired_role:        desiredRole.trim() || null,
        location_preference: effectiveLocation  || null,
        level_preference:    level              || null,
      })
      if (desiredRole.trim()) {
        try {
          await api.post('/api/users/roles', { role_name: desiredRole.trim(), is_primary: true })
        } catch {
          // Role may already exist — ignore conflict errors
        }
      }
      return updated
    },
    onSuccess: (updated) => {
      setUser(updated)
      onNext()
    },
    onError: () => toast.error('Erro ao salvar perfil. Tente novamente.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return
    save.mutate()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Vamos começar!</h1>
      <p className="text-gray-500 text-sm mb-8">
        Conte um pouco sobre você para personalizar sua busca de vagas.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Seu nome completo *">
          <input
            type="text"
            value={fullName}
            required
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Maria da Silva"
            className={inputCls}
          />
        </Field>

        <Field label="Qual cargo você está buscando?">
          <input
            type="text"
            value={desiredRole}
            onChange={(e) => setDesiredRole(e.target.value)}
            placeholder="Ex: Desenvolvedor Full Stack, Analista de Dados…"
            className={inputCls}
          />
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

        <Field label="Qual é seu nível de experiência?">
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

        <button
          type="submit"
          disabled={save.isPending || !fullName.trim()}
          className="w-full py-3 mt-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {save.isPending ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Salvando…
            </>
          ) : (
            <>
              Próximo
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  )
}

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
