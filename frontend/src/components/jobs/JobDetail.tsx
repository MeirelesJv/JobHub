'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Job } from '@/types'
import { isExtensionInstalled, applyLinkedInEasyApply } from '@/lib/extension'

interface Props {
  job:      Job | null
  onClose:  () => void
  onApply:  (job: Job) => void
  applying?: boolean
}

const PLATFORM_META: Record<string, { label: string; badge: string }> = {
  linkedin: { label: 'LinkedIn',  badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  gupy:     { label: 'Gupy',      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  vagas:    { label: 'Vagas.com.br', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  catho:    { label: 'Catho',     badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  infojobs: { label: 'InfoJobs',  badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
}

const LEVEL_LABEL: Record<string, string> = { junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior' }
const TYPE_LABEL:  Record<string, string>  = { clt: 'CLT', pj: 'PJ', freelance: 'Freelance' }

export function JobDetail({ job, onClose, onApply, applying = false }: Props) {
  const [extensionAvailable, setExtensionAvailable] = useState(false)
  const [easyApplying, setEasyApplying]             = useState(false)
  const [easyApplyDone, setEasyApplyDone]           = useState(false)

  useEffect(() => {
    if (!job) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [job, onClose])

  useEffect(() => {
    isExtensionInstalled().then(setExtensionAvailable)
  }, [])

  function handleEasyApply() {
    if (!job || easyApplying || easyApplyDone) return
    setEasyApplying(true)
    applyLinkedInEasyApply({ jobUrl: job.url, linkedinJobId: job.external_id, internalJobId: job.id })
    // Fire-and-forget — result chega via Chrome notification
    setTimeout(() => { setEasyApplying(false); setEasyApplyDone(true) }, 1500)
  }

  if (!job) return null

  const platform = PLATFORM_META[job.platform] ?? { label: job.platform, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' }
  const timeAgo  = job.published_at
    ? formatDistanceToNow(parseISO(job.published_at), { addSuffix: true, locale: ptBR })
    : null

  const salary =
    job.salary_min && job.salary_max
      ? `R$ ${job.salary_min.toLocaleString('pt-BR')} – R$ ${job.salary_max.toLocaleString('pt-BR')}`
      : job.salary_min  ? `A partir de R$ ${job.salary_min.toLocaleString('pt-BR')}`
      : job.salary_max  ? `Até R$ ${job.salary_max.toLocaleString('pt-BR')}`
      : null

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white dark:bg-gray-800 w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] rounded-t-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${platform.badge}`}>
                {platform.label}
              </span>
              {job.easy_apply && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Candidatura simplificada
                </span>
              )}
              {job.remote && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                  Remoto
                </span>
              )}
              {job.level && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {LEVEL_LABEL[job.level] ?? job.level}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug">{job.title}</h2>
            <p className="text-base text-gray-600 dark:text-gray-400 mt-0.5">{job.company}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {job.location && <Chip icon="location">{job.location}</Chip>}
          {job.job_type && <Chip icon="type">{TYPE_LABEL[job.job_type] ?? job.job_type}</Chip>}
          {salary       && <Chip icon="salary" className="text-emerald-700 dark:text-emerald-400">{salary}</Chip>}
          {timeAgo      && <Chip icon="time">{timeAgo}</Chip>}
        </div>

        {/* Description */}
        <div className="flex-1 overflow-y-auto p-6">
          {job.description ? (
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {job.description}
            </div>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm italic">Descrição não disponível. Acesse o site original para mais detalhes.</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-2xl">
          {/* Easy Apply via extension — LinkedIn only */}
          {job.easy_apply && job.platform === 'linkedin' && extensionAvailable ? (
            <button
              onClick={handleEasyApply}
              disabled={easyApplying || easyApplyDone}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {easyApplyDone ? 'Candidatura iniciada ✓' : easyApplying ? 'Iniciando…' : 'Candidatura simplificada'}
            </button>
          ) : (
            <button
              onClick={() => onApply(job)}
              disabled={applying}
              className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {applying ? 'Registrando candidatura…' : 'Candidatar'}
            </button>
          )}
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors text-sm text-center"
          >
            Abrir site original
          </a>
          <button
            onClick={onClose}
            className="py-3 px-4 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

interface ChipProps {
  icon:      'location' | 'type' | 'salary' | 'time'
  children:  React.ReactNode
  className?: string
}

function Chip({ icon, children, className = '' }: ChipProps) {
  const icons = {
    location: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />,
    type:     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    salary:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    time:     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  }
  return (
    <span className={`flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full px-3 py-1 ${className}`}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {icons[icon]}
      </svg>
      {children}
    </span>
  )
}
