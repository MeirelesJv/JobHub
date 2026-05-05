'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { setToken } from '@/lib/auth'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser, TokenResponse } from '@/types'

export default function LoginPage() {
  const router = useRouter()
  const loginStore = useAuthStore((s) => s.login)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors]     = useState<{ email?: string; password?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (!email)                        e.email    = 'Email obrigatório'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Email inválido'
    if (!password)                     e.password = 'Senha obrigatória'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: tokens } = await api.post<TokenResponse>('/api/auth/login', { email, password })
      setToken(tokens.access_token)
      const { data: user } = await api.get<AuthUser>('/api/auth/me')
      return { tokens, user }
    },
    onSuccess: ({ tokens, user }) => {
      loginStore(user, tokens.access_token)
      router.push('/dashboard')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) mutation.mutate()
  }

  const apiError = mutation.error
    ? (mutation.error as any)?.response?.data?.detail ?? 'Email ou senha inválidos'
    : null

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Entrar na sua conta</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Bem-vindo de volta!</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition
              focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              dark:text-gray-100 dark:placeholder-gray-500
              ${errors.email ? 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-700' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700'}`}
            placeholder="voce@email.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Senha
          </label>
          <input
            id="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition
              focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              ${errors.password ? 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-700' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700'}`}
            placeholder="••••••••"
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
        </div>

        {apiError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400
            text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Entrando…
            </>
          ) : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Não tem conta?{' '}
        <Link href="/register" className="font-semibold text-primary-600 hover:text-primary-700">
          Criar conta
        </Link>
      </p>
    </>
  )
}
