'use client'

import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Job } from '@/types'

interface Props {
  job:       Job
  onApply:   (job: Job) => void
  onExpand:  (job: Job) => void
  applying?: boolean
}

const PLATFORM_META: Record<string, { label: string; badge: string }> = {
  linkedin: { label: 'LinkedIn',  badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  gupy:     { label: 'Gupy',      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  vagas:    { label: 'Vagas.com.br', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  catho:    { label: 'Catho',     badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  infojobs: { label: 'InfoJobs',  badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
}

const LEVEL_LABEL: Record<string, string> = {
  junior: 'Júnior',
  pleno:  'Pleno',
  senior: 'Sênior',
}

const TYPE_LABEL: Record<string, string> = {
  clt:       'CLT',
  pj:        'PJ',
  freelance: 'Freelance',
}

export function JobCard({ job, onApply, onExpand, applying = false }: Props) {
  const platform = PLATFORM_META[job.platform] ?? { label: job.platform, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' }

  const timeAgo = job.published_at
    ? formatDistanceToNow(parseISO(job.published_at), { addSuffix: true, locale: ptBR })
    : null

  const salary =
    job.salary_min && job.salary_max
      ? `R$ ${job.salary_min.toLocaleString('pt-BR')} – R$ ${job.salary_max.toLocaleString('pt-BR')}`
      : job.salary_min
      ? `A partir de R$ ${job.salary_min.toLocaleString('pt-BR')}`
      : job.salary_max
      ? `Até R$ ${job.salary_max.toLocaleString('pt-BR')}`
      : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <button onClick={() => onExpand(job)} className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base leading-snug group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
              {job.title}
            </h3>
          </button>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate">{job.company}</p>
        </div>
        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${platform.badge}`}>
          {platform.label}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400 mb-4">
        {job.easy_apply && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-800 text-xs">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Candidatura simplificada
          </span>
        )}
        {job.remote ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Remoto
          </span>
        ) : job.location ? (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {job.location}
          </span>
        ) : null}
        {job.level && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {LEVEL_LABEL[job.level] ?? job.level}
          </span>
        )}
        {job.job_type && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
            {TYPE_LABEL[job.job_type] ?? job.job_type}
          </span>
        )}
        {salary && (
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {salary}
          </span>
        )}
        {timeAgo && <span className="ml-auto text-gray-400 dark:text-gray-500">{timeAgo}</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onApply(job)}
          disabled={applying}
          className="flex-1 py-2 px-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {applying ? 'Registrando…' : 'Candidatar'}
        </button>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 px-3 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors"
        >
          Ver vaga
        </a>
        <button
          onClick={() => onExpand(job)}
          className="py-2 px-3 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl transition-colors"
          title="Ver detalhes"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function JobCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
        </div>
        <div className="h-6 w-16 bg-gray-100 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="flex gap-2 mb-4">
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-20" />
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-14" />
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-16" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl" />
        <div className="h-9 w-20 bg-gray-100 dark:bg-gray-700 rounded-xl" />
        <div className="h-9 w-10 bg-gray-100 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  )
}
