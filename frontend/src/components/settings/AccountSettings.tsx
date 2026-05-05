'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useToast } from '@/store/toast.store'
import type { AuthUser } from '@/types'

export function AccountSettings() {
  const toast        = useToast()
  const queryClient  = useQueryClient()
  const user         = useAuthStore((s) => s.user)
  const setUser      = useAuthStore((s) => s.setUser)

  const [fullName,         setFullName]         = useState(user?.full_name ?? '')
  const [currentPassword,  setCurrentPassword]  = useState('')
  const [newPassword,      setNewPassword]       = useState('')
  const [confirmPassword,  setConfirmPassword]   = useState('')
  const [pwError,          setPwError]           = useState('')

  const updateProfile = useMutation({
    mutationFn: () =>
      api.patch<AuthUser>('/api/users/profile', { full_name: fullName.trim() }).then((r) => r.data),
    onSuccess: (updated) => {
      setUser(updated)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success('Nome atualizado!')
    },
    onError: () => toast.error('Erro ao salvar. Tente novamente.'),
  })

  const updatePassword = useMutation({
    mutationFn: () =>
      api.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password:     newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwError('')
      toast.success('Senha alterada com sucesso!')
    },
    onError: (err: any) => {
      setPwError(err?.response?.data?.detail ?? 'Erro ao alterar senha')
    },
  })

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setPwError('As senhas não coincidem'); return }
    if (newPassword.length < 8)          { setPwError('Mínimo de 8 caracteres');  return }
    setPwError('')
    updatePassword.mutate()
  }

  return (
    <div className="space-y-8">
      {/* Name */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Dados pessoais</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nome completo</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
          <input
            type="email"
            value={user?.email ?? ''}
            disabled
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">O email não pode ser alterado</p>
        </div>

        <button
          onClick={() => updateProfile.mutate()}
          disabled={updateProfile.isPending || fullName.trim() === (user?.full_name ?? '')}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {updateProfile.isPending ? 'Salvando…' : 'Salvar nome'}
        </button>
      </div>

      <hr className="border-gray-100 dark:border-gray-700" />

      {/* Password */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Alterar senha</h3>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Senha atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nova senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {pwError && <p className="text-sm text-red-600">{pwError}</p>}

          <button
            type="submit"
            disabled={updatePassword.isPending || !currentPassword || !newPassword}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {updatePassword.isPending ? 'Alterando…' : 'Alterar senha'}
          </button>
        </form>
      </div>

      <hr className="border-gray-100 dark:border-gray-700" />

      {/* Danger zone */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Zona de perigo</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ações irreversíveis para sua conta.</p>
        <button
          disabled
          className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 cursor-not-allowed"
        >
          Excluir conta <span className="text-xs">(em breve)</span>
        </button>
      </div>
    </div>
  )
}
