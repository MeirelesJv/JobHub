import { create } from 'zustand'
import type { UserProfile } from '@/types'

interface UserState {
  user:    UserProfile | null
  setUser: (user: UserProfile) => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
