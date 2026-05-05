'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApplicationStats } from '@/types'

interface StatCard {
  label:     string
  key:       keyof ApplicationStats
  icon:      React.ReactNode
  bgColor:   string
  textColor: string
}

const CARDS: StatCard[] = [
  {
    label: 'Total candidaturas',
    key:   'total',
    bgColor:   'bg-primary-50 dark:bg-primary-900/30',
    textColor: 'text-primary-700 dark:text-primary-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: 'Em análise',
    key:   'in_review',
    bgColor:   'bg-yellow-50 dark:bg-yellow-900/20',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Entrevistas',
    key:   'interview',
    bgColor:   'bg-secondary-50 dark:bg-emerald-900/20',
    textColor: 'text-secondary-700 dark:text-emerald-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    label: 'Ofertas',
    key:   'offer',
    bgColor:   'bg-emerald-50 dark:bg-emerald-900/20',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
]

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700" />
        <div className="w-16 h-8 rounded-lg bg-gray-100 dark:bg-gray-700" />
      </div>
      <div className="h-4 w-32 bg-gray-100 dark:bg-gray-700 rounded" />
    </div>
  )
}

export default function DashboardClient() {
  const { data: stats, isLoading, isError } = useQuery<ApplicationStats>({
    queryKey: ['application-stats'],
    queryFn:  async () => (await api.get('/api/applications/stats')).data,
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Visão geral das suas candidaturas</p>
      </div>

      {isError && (
        <div className="mb-6 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          Não foi possível carregar as estatísticas. Verifique se o backend está rodando.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : CARDS.map(({ label, key, icon, bgColor, textColor }) => (
              <div
                key={key}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl ${bgColor} ${textColor} flex items-center justify-center`}>
                    {icon}
                  </div>
                  <span className={`text-3xl font-bold ${textColor}`}>
                    {stats?.[key] ?? 0}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
              </div>
            ))}
      </div>

      <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Atividade recente</h2>
        {!isLoading && stats?.total === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma candidatura ainda.</p>
            <a href="/jobs" className="mt-2 inline-block text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
              Explorar vagas →
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Gráfico de evolução em breve</p>
        )}
      </div>
    </div>
  )
}
