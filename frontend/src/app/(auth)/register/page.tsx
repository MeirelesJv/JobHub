'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { setToken } from '@/lib/auth'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser, TokenResponse } from '@/types'

interface FormFields {
  full_name: string
  email: string
  password: string
  confirm: string
}

type FieldErrors = Partial<Record<keyof FormFields, string>>

export default function RegisterPage() {
  const router     = useRouter()
  const loginStore = useAuthStore((s) => s.login)

  const [form, setForm]     = useState<FormFields>({ full_name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<FieldErrors>({})

  function update(field: keyof FormFields) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function validate(): boolean {
    const e: FieldErrors = {}
    if (!form.full_name.trim())             e.full_name = 'Nome obrigatório'
    if (!form.email)                        e.email     = 'Email obrigatório'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido'
    if (!form.password)                     e.password  = 'Senha obrigatória'
    else if (form.password.length < 8)      e.password  = 'Mínimo 8 caracteres'
    if (!form.confirm)                      e.confirm   = 'Confirme a senha'
    else if (form.confirm !== form.password) e.confirm  = 'Senhas não coincidem'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: tokens } = await api.post<TokenResponse>('/api/auth/register', {
        email:     form.email,
        password:  form.password,
        full_name: form.full_name,
      })
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
    ? (mutation.error as any)?.response?.data?.detail ?? 'Erro ao criar conta'
    : null

  const fields: Array<{ id: keyof FormFields; label: string; type: string; placeholder: string; autocomplete: string }> = [
    { id: 'full_name', label: 'Nome completo',    type: 'text',     placeholder: 'João Silva',         autocomplete: 'name' },
    { id: 'email',     label: 'Email',             type: 'email',    placeholder: 'voce@email.com',     autocomplete: 'email' },
    { id: 'password',  label: 'Senha',             type: 'password', placeholder: '8+ caracteres',      autocomplete: 'new-password' },
    { id: 'confirm',   label: 'Confirmar senha',   type: 'password', placeholder: 'Repita a senha',     autocomplete: 'new-password' },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Criar sua conta</h1>
      <p className="text-gray-500 text-sm mb-6">Comece a encontrar vagas hoje</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {fields.map(({ id, label, type, placeholder, autocomplete }) => (
          <div key={id}>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
            <input
              id={id} type={type} autoComplete={autocomplete}
              value={form[id]} onChange={update(id)}
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                ${errors[id] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
              placeholder={placeholder}
            />
            {errors[id] && <p className="mt-1 text-xs text-red-600">{errors[id]}</p>}
          </div>
        ))}

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
              Criando conta…
            </>
          ) : 'Criar conta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Já tem conta?{' '}
        <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700">
          Entrar
        </Link>
      </p>
    </>
  )
}
