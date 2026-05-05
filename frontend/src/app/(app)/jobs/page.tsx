'use client'

import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
import { JobCard, JobCardSkeleton } from '@/components/jobs/JobCard'
import { JobFilters } from '@/components/jobs/JobFilters'
import { JobDetail } from '@/components/jobs/JobDetail'
import { SyncProgressBar } from '@/components/jobs/SyncProgressBar'
import { useJobs, useSyncJobs, defaultFilters, type JobFilters as Filters, type SortBy } from '@/hooks/useJobs'
import { useCreateApplication } from '@/hooks/useApplications'
import { useDesiredRoles } from '@/hooks/useDesiredRoles'
import { useToast } from '@/store/toast.store'
import { useAuthStore } from '@/store/auth.store'
import type { Job } from '@/types'

export default function JobsPage() {
  const toast = useToast()
  const user  = useAuthStore((s) => s.user)

  const [filters, setFilters]         = useState<Filters>(defaultFilters)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [applyingId, setApplyingId]   = useState<number | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [syncMenuOpen, setSyncMenuOpen] = useState(false)
  const syncMenuRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError, error, isFetchingNextPage, hasNextPage, fetchNextPage } = useJobs(filters)
  const { isSyncing, progress, message, status, jobsFound, startSync } = useSyncJobs()
  const createApplication = useCreateApplication()
  const { data: desiredRoles = [] } = useDesiredRoles()

  // Toast on sync completion / failure
  const prevStatus = useRef<string>()
  useEffect(() => {
    if (prevStatus.current === 'running' && status === 'completed') {
      toast.success('Vagas atualizadas com sucesso!')
    }
    if (prevStatus.current === 'running' && status === 'failed') {
      toast.error('Erro ao buscar vagas. Tente novamente.')
    }
    prevStatus.current = status
  }, [status, toast])

  const jobs = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  const handleClearJobs = useCallback(async () => {
    if (!confirm('Deletar todas as vagas do banco?')) return
    try {
      await import('@/lib/api').then(({ default: api }) => api.delete('/api/jobs/all'))
      toast.success('Vagas removidas!')
      window.location.reload()
    } catch {
      toast.error('Erro ao remover vagas.')
    }
  }, [toast])

  const handleApply = useCallback(async (job: Job) => {
    if (applyingId !== null) return
    setApplyingId(job.id)
    try {
      await createApplication.mutateAsync(job.id)
      toast.success('Candidatura registrada!')
      setSelectedJob(null)
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail ?? ''
      if (status === 409 || detail.toLowerCase().includes('já')) {
        toast.error('Você já se candidatou a essa vaga')
      } else {
        toast.error('Erro ao registrar candidatura. Tente novamente.')
      }
    } finally {
      setApplyingId(null)
    }
  }, [applyingId, createApplication, toast])

  const handleFiltersChange = (f: Filters) => {
    setFilters(f)
  }

  // Close sync menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (syncMenuRef.current && !syncMenuRef.current.contains(e.target as Node)) {
        setSyncMenuOpen(false)
      }
    }
    if (syncMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [syncMenuOpen])

  const PLATFORMS = [
    { slug: 'linkedin',  label: 'LinkedIn' },
    { slug: 'gupy',      label: 'Gupy' },
    { slug: 'vagas',     label: 'Vagas.com.br' },
    { slug: 'infojobs',  label: 'InfoJobs' },
    { slug: 'catho',     label: 'Catho' },
  ]

  return (
    <div className="flex h-full gap-0">
      <SyncProgressBar visible={isSyncing} progress={progress} message={message} jobsFound={jobsFound} />
      {/* Mobile filter backdrop */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setMobileFiltersOpen(false)}
        />
      )}

      {/* Filter sidebar — desktop sticky / mobile drawer */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-5 overflow-y-auto
          transform transition-transform duration-200
          lg:static lg:translate-x-0 lg:z-auto lg:w-64 lg:flex-shrink-0 lg:rounded-2xl lg:border lg:h-fit lg:sticky lg:top-0
          ${mobileFiltersOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <JobFilters
          filters={filters}
          onChange={handleFiltersChange}
          onClose={() => setMobileFiltersOpen(false)}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 pl-0 lg:pl-6">
        {/* No roles warning */}
        {desiredRoles.length === 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
            <span className="text-amber-800 dark:text-amber-300">
              Configure ao menos um cargo desejado para personalizar sua busca de vagas.
            </span>
            <a href="/settings" className="flex-shrink-0 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 font-medium underline underline-offset-2">
              Configurar cargos
            </a>
          </div>
        )}

        {/* Location + roles banner */}
        {user?.location_preference && desiredRoles.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl text-sm">
            <span className="text-primary-800 dark:text-primary-300">
              Buscando{' '}
              <strong>
                {desiredRoles.length === 1
                  ? desiredRoles[0].role_name
                  : `${desiredRoles.length} cargos`}
              </strong>{' '}
              em <strong>{user.location_preference}</strong> + remotas
            </span>
            <a href="/settings" className="flex-shrink-0 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium underline underline-offset-2">
              Alterar
            </a>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vagas</h1>
            {!isLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {total === 0 ? 'Nenhuma vaga encontrada' : `${total.toLocaleString('pt-BR')} vagas encontradas`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort */}
            <select
              value={filters.sort_by}
              onChange={(e) => setFilters((f) => ({ ...f, sort_by: e.target.value as SortBy }))}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              <option value="date_desc">Mais recentes</option>
              <option value="date_asc">Mais antigas</option>
              <option value="title_asc">Título (A → Z)</option>
              <option value="platform_asc">Plataforma</option>
            </select>
            {/* Sync split button */}
            <div ref={syncMenuRef} className="relative flex">
              {/* Main button — sync all */}
              <button
                onClick={() => { startSync(); setSyncMenuOpen(false) }}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-l-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Atualizar todas as plataformas"
              >
                <svg
                  className={`w-4 h-4 ${isSyncing ? 'animate-spin text-primary-500' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">{isSyncing ? 'Buscando…' : 'Atualizar vagas'}</span>
              </button>
              {/* Chevron to open platform picker */}
              <button
                onClick={() => setSyncMenuOpen((o) => !o)}
                disabled={isSyncing}
                className="flex items-center px-2 py-2 rounded-r-xl border border-l-0 border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Escolher plataforma"
                aria-haspopup="true"
                aria-expanded={syncMenuOpen}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* Dropdown */}
              {syncMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 text-sm">
                  <button
                    onClick={() => { startSync(); setSyncMenuOpen(false) }}
                    className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                  >
                    Todos os sites
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                  {PLATFORMS.map(({ slug, label }) => (
                    <button
                      key={slug}
                      onClick={() => { startSync(slug); setSyncMenuOpen(false) }}
                      className="w-full text-left px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear jobs button */}
            <button
              onClick={handleClearJobs}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
              title="Deletar todas as vagas"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline">Limpar vagas</span>
            </button>

            {/* Mobile filter button */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 4a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm3 4a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z" />
              </svg>
              Filtros
            </button>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <JobCardSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-red-500 dark:text-red-400 font-medium">Erro ao carregar vagas</p>
            <p className="text-gray-400 text-sm mt-1 font-mono">
              {(error as any)?.response?.status} — {(error as any)?.response?.data?.detail ?? (error as any)?.message}
            </p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma vaga encontrada</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              {desiredRoles.length === 0
                ? 'Configure seus cargos em Configurações e clique em Atualizar vagas'
                : 'Clique em "Atualizar vagas" para buscar novas oportunidades'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onApply={handleApply}
                  onExpand={setSelectedJob}
                  applying={applyingId === job.id}
                />
              ))}
            </div>

            {/* Load more */}
            {hasNextPage && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-8 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isFetchingNextPage ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Carregando…
                    </>
                  ) : (
                    'Carregar mais vagas'
                  )}
                </button>
              </div>
            )}

            {/* Skeleton rows while loading next page */}
            {isFetchingNextPage && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                {Array.from({ length: 4 }).map((_, i) => <JobCardSkeleton key={i} />)}
              </div>
            )}
          </>
        )}
      </main>

      {/* Job detail modal */}
      <JobDetail
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={handleApply}
        applying={applyingId === selectedJob?.id}
      />
    </div>
  )
}
