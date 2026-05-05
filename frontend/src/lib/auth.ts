import type { AuthUser } from '@/types'

const TOKEN_KEY = 'jobhub_token'
const USER_KEY  = 'jobhub_user'

// ── cookie helpers (usadas pelo middleware) ─────────────────────────────────

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`
}

// ── token ───────────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  setCookie(TOKEN_KEY, token, 7) // espelha no cookie para o middleware
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  deleteCookie(TOKEN_KEY)
}

// ── user ────────────────────────────────────────────────────────────────────

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function removeUser(): void {
  localStorage.removeItem(USER_KEY)
}

// ── helpers ─────────────────────────────────────────────────────────────────

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function clearAuth(): void {
  removeToken()
  removeUser()
}
