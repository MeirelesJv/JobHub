'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useToast } from '@/store/toast.store'
import type { AuthUser } from '@/types'

const LOCATION_OPTIONS = [
  { value: 'São Paulo, SP',        label: 'São Paulo, SP'           },
  { value: 'Rio de Janeiro, RJ',   label: 'Rio de Janeiro, RJ'      },
  { value: 'Belo Horizonte, MG',   label: 'Belo Horizonte, MG'      },
  { value: 'Curitiba, PR',         label: 'Curitiba, PR'            },
  { value: 'Porto Alegre, RS',     label: 'Porto Alegre, RS'        },
  { value: 'Brasília, DF',         label: 'Brasília, DF'            },
  { value: 'Florianópolis, SC',    label: 'Florianópolis, SC'       },
  { value: 'Recife, PE',           label: 'Recife, PE'              },
  { value: 'Salvador, BA',         label: 'Salvador, BA'            },
  { value: 'Fortaleza, CE',        label: 'Fortaleza, CE'           },
  { value: 'Remoto',               label: 'Remoto (qualquer lugar)' },
  { value: '_custom',              label: 'Outra cidade…'           },
]

export function LocationSettings() {
  const toast   = useToast()
  const user    = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [locationSel,  setLocationSel]  = useState('')
  const [locationText, setLocationText] = useState('')
  const [remote,       setRemote]       = useState(false)

  useEffect(() => {
    if (!user) return
    const pref = user.location_preference ?? ''
    const known = LOCATION_OPTIONS.find((o) => o.value !== '_custom' && o.value === pref)
    if (known) {
      setLocationSel(pref)
    } else if (pref) {
      setLocationSel('_custom')
      setLocationText(pref)
    }
    setRemote(user.remote_preference ?? false)
  }, [user])

  const effectiveLocation = locationSel === '_custom' ? locationText.trim() : locationSel

  const save = useMutation({
    mutationFn: () =>
      api.patch<AuthUser>('/api/users/profile', {
        location_preference: effectiveLocation || null,
        remote_preference: remote,
      }).then((r) => r.data),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Localização salva!')
    },
    onError: () => toast.error('Erro ao salvar. Tente novamente.'),
  })

  const isDirty =
    effectiveLocation !== (user?.location_preference ?? '') ||
    remote !== (user?.remote_preference ?? false)

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Cidade preferida
        </label>
        <select
          value={locationSel}
          onChange={(e) => setLocationSel(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
            className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          />
        )}
      </div>

      {/* Remote toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Aceito trabalho remoto</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Exibir também vagas 100% remotas</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={remote}
          onClick={() => setRemote((v) => !v)}
          className={[
            'relative inline-flex flex-shrink-0 w-11 h-6 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 overflow-hidden',
            remote ? 'bg-primary-600' : 'bg-gray-200',
          ].join(' ')}
        >
          <span
            className={[
              'absolute left-0 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
              remote ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || !isDirty}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {save.isPending ? 'Salvando…' : 'Salvar localização'}
      </button>
    </div>
  )
}
