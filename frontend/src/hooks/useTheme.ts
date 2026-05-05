'use client'

import { useCallback, useEffect, useState } from 'react'

export type Theme         = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'jobhub-theme'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'system'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme,         setThemeState]   = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const stored   = getStoredTheme()
    const resolved = stored === 'system' ? getSystemTheme() : stored
    setThemeState(stored)
    setResolvedTheme(resolved)
    applyTheme(resolved)

    const mq      = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      setThemeState((current) => {
        if (current !== 'system') return current
        const next: ResolvedTheme = e.matches ? 'dark' : 'light'
        setResolvedTheme(next)
        applyTheme(next)
        return current
      })
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    const resolved = next === 'system' ? getSystemTheme() : next
    setThemeState(next)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  return { theme, resolvedTheme, setTheme }
}
