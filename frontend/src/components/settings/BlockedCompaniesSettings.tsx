'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { useUserStore } from '@/store/user.store'
import { useToast } from '@/store/toast.store'
import type { UserProfile } from '@/types'

export function BlockedCompaniesSettings() {
  const toast   = useToast()
  const user    = useUserStore((s) => s.user)
  const setUser = useUserStore((s) => s.setUser)

  const [blockedCompaniesText, setBlockedCompaniesText] = useState('')

  const parseBlockedCompanies = (value: string) => {
    const seen = new Set<string>()
    return value
      .split(/[\n,]+/)
      .map((company) => company.trim().replace(/\s+/g, ' '))
      .filter((company) => {
        const key = company.toLowerCase()
        if (!company || seen.has(key)) return false
        seen.add(key)
        return true
      })
  }

  useEffect(() => {
    if (!user) return
    setBlockedCompaniesText((user.blocked_companies ?? []).join('\n'))
  }, [user])

  const blockedCompanies = parseBlockedCompanies(blockedCompaniesText)
  const currentBlockedCompanies = user?.blocked_companies ?? []
  const isDirty = JSON.stringify(blockedCompanies) !== JSON.stringify(currentBlockedCompanies)

  const save = useMutation({
    mutationFn: () =>
      api.patch<UserProfile>('/api/users/profile', {
        blocked_companies: blockedCompanies,
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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Empresas que você não quer ver
        </label>
        <textarea
          value={blockedCompaniesText}
          onChange={(e) => setBlockedCompaniesText(e.target.value)}
          placeholder="Ex: Empresa A&#10;Empresa B"
          rows={4}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-y"
        />
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Separe por linha ou vírgula. Vagas dessas empresas não aparecem na busca.
        </p>
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
