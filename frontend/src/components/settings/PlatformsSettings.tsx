'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { useUserStore } from '@/store/user.store'
import { useToast } from '@/store/toast.store'
import type { JobPlatform, UserProfile } from '@/types'

const PLATFORMS: { value: JobPlatform; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn'      },
  { value: 'gupy',     label: 'Gupy'          },
  { value: 'vagas',    label: 'Vagas.com.br'  },
  { value: 'catho',    label: 'Catho'         },
  { value: 'infojobs', label: 'InfoJobs'      },
]

const INTERVALS: { value: number; label: string }[] = [
  { value: 10,  label: '10 minutos' },
  { value: 30,  label: '30 minutos' },
  { value: 60,  label: '1 hora'     },
  { value: 120, label: '2 horas'    },
]

const LOOKBACKS: { value: number; label: string }[] = [
  { value: 7,  label: '7 dias'  },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
]

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

function sameSet<T>(a: T[], b: T[]): boolean {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { value: number; label: string }[]
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              'flex items-center gap-2 py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-colors text-left',
              active
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500',
            ].join(' ')}
          >
            <span className={[
              'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
              active ? 'border-primary-600' : 'border-gray-300 dark:border-gray-600',
            ].join(' ')}>
              {active && <span className="w-2 h-2 rounded-full bg-primary-600" />}
            </span>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function PlatformCheckboxGroup({
  value,
  onChange,
}: {
  value: JobPlatform[]
  onChange: (next: JobPlatform[]) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PLATFORMS.map((p) => {
        const active = value.includes(p.value)
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(toggle(value, p.value))}
            className={[
              'flex items-center gap-2 py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-colors text-left',
              active
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500',
            ].join(' ')}
          >
            <span className={[
              'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center',
              active ? 'border-primary-600 bg-primary-600' : 'border-gray-300 dark:border-gray-600',
            ].join(' ')}>
              {active && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

export function PlatformsSettings() {
  const toast   = useToast()
  const user    = useUserStore((s) => s.user)
  const setUser = useUserStore((s) => s.setUser)

  const [manual, setManual] = useState<JobPlatform[]>([])
  const [auto, setAuto] = useState<JobPlatform[]>([])
  const [interval, setInterval] = useState<number>(120)
  const [lookback, setLookback] = useState<number>(30)

  useEffect(() => {
    if (!user) return
    setManual(user.enabled_platforms ?? PLATFORMS.map((p) => p.value))
    setAuto(user.auto_sync_platforms ?? PLATFORMS.map((p) => p.value))
    setInterval(user.sync_interval_minutes ?? 120)
    setLookback(user.search_lookback_days ?? 30)
  }, [user])

  const currentManual = user?.enabled_platforms ?? PLATFORMS.map((p) => p.value)
  const currentAuto = user?.auto_sync_platforms ?? PLATFORMS.map((p) => p.value)
  const currentInterval = user?.sync_interval_minutes ?? 120
  const currentLookback = user?.search_lookback_days ?? 30
  const isDirty =
    !sameSet(manual, currentManual) ||
    !sameSet(auto, currentAuto) ||
    interval !== currentInterval ||
    lookback !== currentLookback

  const save = useMutation({
    mutationFn: () =>
      api
        .patch<UserProfile>('/api/users/profile', {
          enabled_platforms: manual,
          auto_sync_platforms: auto,
          sync_interval_minutes: interval,
          search_lookback_days: lookback,
        })
        .then((r) => r.data),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Preferências salvas!')
    },
    onError: () => toast.error('Erro ao salvar. Tente novamente.'),
  })

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Sites para pesquisa manual
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Usados quando você clica em &quot;Buscar vagas agora&quot;. Sites desmarcados aqui não aparecem nessa busca.
        </p>
        <PlatformCheckboxGroup value={manual} onChange={setManual} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Sites para busca automática
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Buscados sozinhos em segundo plano, no intervalo escolhido abaixo — independente da lista de busca manual.
        </p>
        <PlatformCheckboxGroup value={auto} onChange={setAuto} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Frequência da busca automática
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          De quanto em quanto tempo o JobHub procura vagas novas em segundo plano.
        </p>
        <RadioGroup options={INTERVALS} value={interval} onChange={setInterval} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Limite de busca
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Só traz vagas publicadas dentro desse período. Vagas somem do feed automaticamente 1 dia depois de saírem desse limite (se ninguém se candidatou).
        </p>
        <RadioGroup options={LOOKBACKS} value={lookback} onChange={setLookback} />
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || !isDirty}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {save.isPending ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  )
}
