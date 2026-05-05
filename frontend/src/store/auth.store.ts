import { create } from 'zustand'
import type { AuthUser } from '@/types'
import { clearAuth, setToken, setUser } from '@/lib/auth'
import { sendTokenToExtension, sendLogoutToExtension } from '@/lib/extension'

interface AuthState {
  user:            AuthUser | null
  token:           string | null
  isAuthenticated: boolean
  login:   (user: AuthUser, token: string) => void
  logout:  () => void
  setUser: (user: AuthUser) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:            null,
  token:           null,
  isAuthenticated: false,

  login: (user, token) => {
    setToken(token)
    setUser(user)
    set({ user, token, isAuthenticated: true })
    sendTokenToExtension(token, user.id, user.email)
  },

  logout: () => {
    clearAuth()
    sendLogoutToExtension()
    set({ user: null, token: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  setUser: (user) => {
    setUser(user)
    set({ user })
  },
}))
