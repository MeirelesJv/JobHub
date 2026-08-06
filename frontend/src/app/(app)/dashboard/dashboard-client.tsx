'use client'

import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  useApplicationStats, useCreateManualApplication, useRecentApplications,
  type ManualApplicationInput,
} from '@/hooks/useApplications'
import { useToast } from '@/store/toast.store'

const JOB_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ' },
  { value: 'freelance', label: 'Freelance' },
]

const LEVEL_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'junior', label: 'Júnior' },
  { value: 'pleno', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
]

const EMPTY_FORM = {
  title: '', company: '', url: '', location: '',
  job_type: '', level: '', remote: false, notes: '',
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500'

function RegisterJobCard() {
  const toast  = useToast()
  const create = useCreateManualApplication()
  const [form, setForm] = useState(EMPTY_FORM)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const canSubmit = form.title.trim() !== '' && form.company.trim() !== '' && form.url.trim() !== ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const payload: ManualApplicationInput = {
      title:    form.title.trim(),
      company:  form.company.trim(),
      url:      form.url.trim(),
      location: form.location.trim() || undefined,
      job_type: (form.job_type || undefined) as ManualApplicationInput['job_type'],
      level:    (form.level || undefined) as ManualApplicationInput['level'],
      remote:   form.remote,
      notes:    form.notes.trim() || undefined,
    }

    try {
      await create.mutateAsync(payload)
      toast.success('Vaga cadastrada e candidatura registrada!')
      setForm(EMPTY_FORM)
    } catch {
      toast.error('Erro ao cadastrar. Tente novamente.')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cadastrar vaga</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 ml-[52px]">
        Achou uma vaga fora do JobHub e já se candidatou? Registre aqui pra acompanhar no kanban.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Cargo *">
            <input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="Ex: Analista de Sistemas Júnior" required />
          </FormField>
          <FormField label="Empresa *">
            <input className={inputClass} value={form.company} onChange={(e) => set('company', e.target.value)}
              placeholder="Ex: BIB Tech" required />
          </FormField>
        </div>

        <FormField label="Link da vaga *">
          <input className={inputClass} type="url" value={form.url} onChange={(e) => set('url', e.target.value)}
            placeholder="https://…" required />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Localização">
            <input className={inputClass} value={form.location} onChange={(e) => set('location', e.target.value)}
              placeholder="São Paulo, SP" />
          </FormField>
          <FormField label="Tipo">
            <select className={inputClass} value={form.job_type} onChange={(e) => set('job_type', e.target.value)}>
              {JOB_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Nível">
            <select className={inputClass} value={form.level} onChange={(e) => set('level', e.target.value)}>
              {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={form.remote}
              onClick={() => set('remote', !form.remote)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none overflow-hidden ${form.remote ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.remote ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">Vaga remota</span>
          </label>

          <button
            type="submit"
            disabled={!canSubmit || create.isPending}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 dark:disabled:bg-primary-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {create.isPending ? 'Cadastrando…' : 'Cadastrar e registrar candidatura'}
          </button>
        </div>
      </form>
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  applied: 'Candidatado', in_review: 'Em análise', interview: 'Entrevista',
  offer: 'Oferta', rejected: 'Recusada', cancelled: 'Cancelada',
}
const STATUS_BADGE: Record<string, string> = {
  applied:   'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  in_review: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  interview: 'bg-secondary-50 text-secondary-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  offer:     'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  rejected:  'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

function RecentApplications() {
  const { data, isLoading } = useRecentApplications()
  const items = (data ?? []).slice(0, 6)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Últimas candidaturas</h2>
        <a href="/applications" className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
          Ver kanban →
        </a>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma candidatura registrada ainda.</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Cadastre sua primeira vaga acima ↑</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((app) => (
            <li key={app.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{app.job.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {app.job.company} · {formatDistanceToNow(parseISO(app.applied_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[app.status]}`}>
                {STATUS_LABEL[app.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-3 flex-1 min-w-[120px]">
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

export default function DashboardClient() {
  const { data: stats } = useApplicationStats()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Registre as vagas que você aplicou e acompanhe tudo em um só lugar</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <StatChip label="Candidaturas" value={stats?.total ?? 0} />
        <StatChip label="Em análise"   value={stats?.in_review ?? 0} />
        <StatChip label="Entrevistas"  value={stats?.interview ?? 0} />
        <StatChip label="Ofertas"      value={stats?.offer ?? 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <RegisterJobCard />
        </div>
        <div className="xl:col-span-2">
          <RecentApplications />
        </div>
      </div>
    </div>
  )
}
