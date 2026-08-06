'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  useResume, useUpdateResume, useCuratedKeywords,
  useAddExperience, useUpdateExperience, useDeleteExperience,
  useAddEducation, useUpdateEducation, useDeleteEducation,
  useAddSkill, useDeleteSkill,
  useAddLanguage, useDeleteLanguage,
  type Experience, type Education, type Skill, type Language,
  type EducationType, type EducationStatus, type Gender,
} from '@/hooks/useResume'
import { useToast } from '@/store/toast.store'
import { DesiredRolesSettings } from '@/components/settings/DesiredRolesSettings'
import { LocationSettings }     from '@/components/settings/LocationSettings'
import { PreferencesSettings }  from '@/components/settings/PreferencesSettings'

// ─── helpers ─────────────────────────────────────────────────────────────────

function toMonth(date: string | null | undefined): string {
  if (!date) return ''
  return date.slice(0, 7)  // YYYY-MM-DD → YYYY-MM
}

function fromMonth(month: string): string | null {
  if (!month) return null
  return `${month}-01`
}

function fmtDate(date: string | null | undefined): string {
  if (!date) return ''
  try {
    return format(parseISO(date), 'MMM yyyy', { locale: ptBR })
  } catch {
    return date
  }
}

const SKILL_LEVEL_LABELS: Record<string, string> = {
  beginner:     'Iniciante',
  intermediate: 'Intermediário',
  advanced:     'Avançado',
  expert:       'Especialista',
}

const LANG_LEVEL_LABELS: Record<string, string> = {
  basic:        'Básico',
  intermediate: 'Intermediário',
  advanced:     'Avançado',
  fluent:       'Fluente',
  native:       'Nativo',
}

// ─── shared UI ───────────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      {children}
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors font-medium flex items-center justify-center gap-1.5"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      {label}
    </button>
  )
}

function FormInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
      <input
        {...props}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 dark:disabled:bg-gray-600"
      />
    </div>
  )
}

function FormSelect({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
      <select
        {...props}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function FormActions({ onCancel, isPending, label }: { onCancel: () => void; isPending: boolean; label?: string }) {
  return (
    <div className="flex gap-2 justify-end pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-lg transition-colors"
      >
        {isPending ? 'Salvando…' : (label ?? 'Salvar')}
      </button>
    </div>
  )
}

function InlineConfirm({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-red-600 font-medium">Remover?</span>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-medium rounded-lg transition-colors"
      >
        {loading ? '…' : 'Sim'}
      </button>
      <button onClick={onCancel} className="px-2.5 py-1 border border-gray-200 dark:border-gray-600 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
        Não
      </button>
    </div>
  )
}

// ─── Keyword tagger (reused by Experience + used for auto-detection) ─────────

function KeywordTagger({
  keywords, onChange, curated, suggestFrom,
}: {
  keywords: string[]
  onChange: (kw: string[]) => void
  curated: string[]
  suggestFrom?: string
}) {
  const [input, setInput] = useState('')

  function add(term: string) {
    const clean = term.trim()
    if (!clean) return
    if (keywords.some((k) => k.toLowerCase() === clean.toLowerCase())) { setInput(''); return }
    onChange([...keywords, clean])
    setInput('')
  }
  function remove(term: string) {
    onChange(keywords.filter((k) => k !== term))
  }

  const detected = suggestFrom
    ? curated.filter((term) =>
        suggestFrom.toLowerCase().includes(term.toLowerCase()) &&
        !keywords.some((k) => k.toLowerCase() === term.toLowerCase())
      )
    : []

  const inputSuggestions = input.trim().length >= 2
    ? curated
        .filter((term) =>
          term.toLowerCase().includes(input.trim().toLowerCase()) &&
          !keywords.some((k) => k.toLowerCase() === term.toLowerCase())
        )
        .slice(0, 6)
    : []

  return (
    <div>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-xs font-medium capitalize">
              {kw}
              <button type="button" onClick={() => remove(kw)} className="p-0.5 rounded-full hover:bg-primary-100 dark:hover:bg-primary-800">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
            placeholder="Adicionar palavra-chave…"
            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={() => add(input)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            Adicionar
          </button>
        </div>
        {inputSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1">
            {inputSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 capitalize"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {detected.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Detectadas no texto — clique pra adicionar:</p>
          <div className="flex flex-wrap gap-1.5">
            {detected.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => add(term)}
                className="px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors capitalize"
              >
                + {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Experience section ───────────────────────────────────────────────────────

const EXP_BLANK = { title: '', company: '', location: '', description: '', start_date: '', end_date: '', is_current: false }

function ExperienceSection({ items, curatedKeywords }: { items: Experience[]; curatedKeywords: string[] }) {
  const toast = useToast()
  const addExp    = useAddExperience()
  const updateExp = useUpdateExperience()
  const deleteExp = useDeleteExperience()

  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState<Experience | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [form, setForm] = useState(EXP_BLANK)
  const [keywords, setKeywords] = useState<string[]>([])

  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function openAdd() {
    setForm(EXP_BLANK)
    setKeywords([])
    setEditItem(null)
    setShowForm(true)
  }

  function openEdit(item: Experience) {
    setForm({
      title: item.title,
      company: item.company,
      location: item.location ?? '',
      description: item.description ?? '',
      start_date: toMonth(item.start_date),
      end_date: toMonth(item.end_date),
      is_current: item.is_current,
    })
    setKeywords(item.keywords ?? [])
    setEditItem(item)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditItem(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      title:       form.title,
      company:     form.company,
      location:    form.location || null,
      description: form.description || null,
      start_date:  fromMonth(form.start_date),
      end_date:    form.is_current ? null : fromMonth(form.end_date),
      is_current:  form.is_current,
      keywords,
    }
    if (editItem) {
      await updateExp.mutateAsync({ id: editItem.id, ...payload })
      toast.success('Experiência atualizada')
    } else {
      await addExp.mutateAsync(payload)
      toast.success('Experiência adicionada')
    }
    closeForm()
  }

  async function handleDelete(id: number) {
    await deleteExp.mutateAsync(id)
    toast.success('Experiência removida')
    setConfirmId(null)
  }

  const isSaving = addExp.isPending || updateExp.isPending

  return (
    <div className="space-y-3">
      {items.map((exp) => (
        <SectionCard key={exp.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{exp.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{exp.company}</p>
              {exp.location && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{exp.location}</p>}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {fmtDate(exp.start_date)} → {exp.is_current ? 'Atual' : fmtDate(exp.end_date)}
              </p>
              {exp.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed line-clamp-3">{exp.description}</p>
              )}
              {exp.keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {exp.keywords.map((kw) => (
                    <span key={kw} className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 capitalize">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {confirmId === exp.id ? (
                <InlineConfirm
                  onConfirm={() => handleDelete(exp.id)}
                  onCancel={() => setConfirmId(null)}
                  loading={deleteExp.isPending}
                />
              ) : (
                <>
                  <button
                    onClick={() => openEdit(exp)}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmId(exp.id)}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Remover"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </SectionCard>
      ))}

      {showForm && (
        <SectionCard>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {editItem ? 'Editar experiência' : 'Nova experiência'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Cargo *" value={form.title} required onChange={(e) => set('title', e.target.value)} placeholder="Engenheiro de Software" />
              <FormInput label="Empresa *" value={form.company} required onChange={(e) => set('company', e.target.value)} placeholder="ACME Corp." />
            </div>
            <FormInput label="Localização" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="São Paulo, SP (ou Remoto)" />
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Início" type="month" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              <FormInput label="Fim" type="month" value={form.end_date} disabled={form.is_current} onChange={(e) => set('end_date', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.is_current} onChange={(e) => set('is_current', e.target.checked)} className="rounded border-gray-300 dark:border-gray-500 dark:bg-gray-700 text-primary-600 focus:ring-primary-500" />
              Trabalho aqui atualmente
            </label>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Descrição</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Principais responsabilidades e conquistas…"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Palavras-chave <span className="font-normal text-gray-400 dark:text-gray-500">(usadas no match com vagas)</span>
              </label>
              <KeywordTagger keywords={keywords} onChange={setKeywords} curated={curatedKeywords} suggestFrom={form.description} />
            </div>
            <FormActions onCancel={closeForm} isPending={isSaving} />
          </form>
        </SectionCard>
      )}

      {!showForm && <AddButton label="Adicionar experiência" onClick={openAdd} />}
    </div>
  )
}

// ─── Education section ────────────────────────────────────────────────────────

const EDU_TYPE_OPTIONS: { value: EducationType; label: string }[] = [
  { value: 'graduacao',   label: 'Graduação'   },
  { value: 'pos',         label: 'Pós-graduação' },
  { value: 'tecnico',     label: 'Técnico'      },
  { value: 'curso',       label: 'Curso'        },
  { value: 'certificado', label: 'Certificado'  },
  { value: 'outro',       label: 'Outro'        },
]

const EDU_STATUS_OPTIONS: { value: EducationStatus; label: string }[] = [
  { value: 'concluido', label: 'Concluído' },
  { value: 'cursando',  label: 'Cursando'  },
  { value: 'trancado',  label: 'Trancado'  },
]

const EDU_STATUS_LABEL: Record<string, string> = {
  concluido: 'Concluído',
  cursando:  'Cursando',
  trancado:  'Trancado',
}

const EDU_TYPE_LABEL: Record<string, string> = {
  graduacao: 'Graduação', pos: 'Pós-graduação', tecnico: 'Técnico', curso: 'Curso', certificado: 'Certificado', outro: 'Outro',
}

const EDU_BLANK = {
  institution: '', degree: '', field_of_study: '',
  education_type: 'graduacao' as EducationType,
  status: 'concluido' as EducationStatus,
  expected_completion_date: '',
  start_date: '', end_date: '',
}

function EducationSection({ items }: { items: Education[] }) {
  const toast = useToast()
  const addEdu    = useAddEducation()
  const updateEdu = useUpdateEducation()
  const deleteEdu = useDeleteEducation()

  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState<Education | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [form, setForm] = useState(EDU_BLANK)

  function set<K extends keyof typeof EDU_BLANK>(k: K, v: (typeof EDU_BLANK)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function openAdd() {
    setForm(EDU_BLANK)
    setEditItem(null)
    setShowForm(true)
  }

  function openEdit(item: Education) {
    setForm({
      institution:    item.institution ?? '',
      degree:         item.degree ?? '',
      field_of_study: item.field_of_study ?? '',
      education_type: item.education_type,
      status:         item.status,
      expected_completion_date: toMonth(item.expected_completion_date),
      start_date:     toMonth(item.start_date),
      end_date:       toMonth(item.end_date),
    })
    setEditItem(item)
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditItem(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      institution:    form.institution || null,
      degree:         form.degree || null,
      field_of_study: form.field_of_study || null,
      education_type: form.education_type,
      status:         form.status,
      expected_completion_date: form.status === 'cursando' ? fromMonth(form.expected_completion_date) : null,
      start_date:     fromMonth(form.start_date),
      end_date:       form.status === 'cursando' ? null : fromMonth(form.end_date),
    }
    if (editItem) {
      await updateEdu.mutateAsync({ id: editItem.id, ...payload })
      toast.success('Formação atualizada')
    } else {
      await addEdu.mutateAsync(payload)
      toast.success('Formação adicionada')
    }
    closeForm()
  }

  const isSaving = addEdu.isPending || updateEdu.isPending

  return (
    <div className="space-y-3">
      {items.map((edu) => (
        <SectionCard key={edu.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {edu.degree ?? EDU_TYPE_LABEL[edu.education_type]}
                  {edu.field_of_study ? ` em ${edu.field_of_study}` : ''}
                </p>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {EDU_TYPE_LABEL[edu.education_type]}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  edu.status === 'cursando'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : edu.status === 'trancado'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {EDU_STATUS_LABEL[edu.status]}
                </span>
              </div>
              {edu.institution && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{edu.institution}</p>}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {fmtDate(edu.start_date)} →{' '}
                {edu.status === 'cursando'
                  ? (edu.expected_completion_date ? `previsão ${fmtDate(edu.expected_completion_date)}` : 'em andamento')
                  : fmtDate(edu.end_date)}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {confirmId === edu.id ? (
                <InlineConfirm
                  onConfirm={async () => { await deleteEdu.mutateAsync(edu.id); toast.success('Formação removida'); setConfirmId(null) }}
                  onCancel={() => setConfirmId(null)}
                  loading={deleteEdu.isPending}
                />
              ) : (
                <>
                  <button onClick={() => openEdit(edu)} className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => setConfirmId(edu.id)} className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </SectionCard>
      ))}

      {showForm && (
        <SectionCard>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {editItem ? 'Editar formação' : 'Nova formação'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormSelect
                label="Tipo *"
                value={form.education_type}
                options={EDU_TYPE_OPTIONS}
                onChange={(e) => set('education_type', e.target.value as EducationType)}
              />
              <FormSelect
                label="Status *"
                value={form.status}
                options={EDU_STATUS_OPTIONS}
                onChange={(e) => set('status', e.target.value as EducationStatus)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Grau" value={form.degree} onChange={(e) => set('degree', e.target.value)} placeholder="Bacharelado" />
              <FormInput label="Área / formação" value={form.field_of_study} onChange={(e) => set('field_of_study', e.target.value)} placeholder="Ciência da Computação" />
            </div>
            <FormInput
              label="Instituição (opcional — não entra no match)"
              value={form.institution}
              onChange={(e) => set('institution', e.target.value)}
              placeholder="Universidade de São Paulo"
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Início" type="month" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              {form.status === 'cursando' ? (
                <FormInput
                  label="Previsão de conclusão"
                  type="month"
                  value={form.expected_completion_date}
                  onChange={(e) => set('expected_completion_date', e.target.value)}
                />
              ) : (
                <FormInput label="Fim" type="month" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
              )}
            </div>
            <FormActions onCancel={closeForm} isPending={isSaving} />
          </form>
        </SectionCard>
      )}

      {!showForm && <AddButton label="Adicionar formação" onClick={openAdd} />}
    </div>
  )
}

// ─── Skills section ───────────────────────────────────────────────────────────

const SKILL_LEVELS = [
  { value: '',             label: 'Sem nível'      },
  { value: 'beginner',     label: 'Iniciante'      },
  { value: 'intermediate', label: 'Intermediário'  },
  { value: 'advanced',     label: 'Avançado'       },
  { value: 'expert',       label: 'Especialista'   },
]

function SkillSection({ items, curatedKeywords }: { items: Skill[]; curatedKeywords: string[] }) {
  const toast = useToast()
  const addSkill    = useAddSkill()
  const deleteSkill = useDeleteSkill()

  const [showForm,  setShowForm]  = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', level: '' })

  const existingNames = new Set(items.map((i) => i.name.toLowerCase()))
  const suggestions = form.name.trim().length >= 2
    ? curatedKeywords
        .filter((term) =>
          term.toLowerCase().includes(form.name.trim().toLowerCase()) &&
          !existingNames.has(term.toLowerCase())
        )
        .slice(0, 6)
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await addSkill.mutateAsync({ name: form.name, level: form.level || null })
    toast.success('Habilidade adicionada')
    setForm({ name: '', level: '' })
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      <SectionCard>
        {items.length === 0 && !showForm ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Nenhuma habilidade cadastrada</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3">
            {items.map((sk) => (
              <div key={sk.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-sm font-medium">
                <span>{sk.name}{sk.level ? ` · ${SKILL_LEVEL_LABELS[sk.level] ?? sk.level}` : ''}</span>
                {confirmId === sk.id ? (
                  <>
                    <button
                      onClick={async () => { await deleteSkill.mutateAsync(sk.id); toast.success('Habilidade removida'); setConfirmId(null) }}
                      disabled={deleteSkill.isPending}
                      className="p-0.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button onClick={() => setConfirmId(null)} className="p-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmId(sk.id)}
                    className="p-0.5 rounded-full text-primary-400 dark:text-primary-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <FormInput
                  label="Habilidade *"
                  value={form.name}
                  required
                  autoComplete="off"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="React, Python, SQL…"
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, name: s }))}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 capitalize"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <FormSelect label="Nível" value={form.level} options={SKILL_LEVELS} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} />
            </div>
            <FormActions onCancel={() => setShowForm(false)} isPending={addSkill.isPending} label="Adicionar" />
          </form>
        )}
      </SectionCard>

      {!showForm && <AddButton label="Adicionar habilidade" onClick={() => setShowForm(true)} />}
    </div>
  )
}

// ─── Languages section ────────────────────────────────────────────────────────

const LANG_LEVELS = [
  { value: 'basic',        label: 'Básico'        },
  { value: 'intermediate', label: 'Intermediário' },
  { value: 'advanced',     label: 'Avançado'      },
  { value: 'fluent',       label: 'Fluente'       },
  { value: 'native',       label: 'Nativo'        },
]

const LANG_LEVEL_STYLE: Record<string, string> = {
  basic:        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  intermediate: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  advanced:     'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  fluent:       'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  native:       'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
}

function LanguageSection({ items }: { items: Language[] }) {
  const toast     = useToast()
  const addLang   = useAddLanguage()
  const deleteLang = useDeleteLanguage()

  const [showForm,  setShowForm]  = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', proficiency: 'intermediate' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await addLang.mutateAsync({ name: form.name, proficiency: form.proficiency })
    toast.success('Idioma adicionado')
    setForm({ name: '', proficiency: 'intermediate' })
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      {items.map((lang) => (
        <SectionCard key={lang.id}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <p className="font-medium text-gray-900 dark:text-gray-100">{lang.name}</p>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${LANG_LEVEL_STYLE[lang.proficiency] ?? 'bg-gray-100 text-gray-600'}`}>
                {LANG_LEVEL_LABELS[lang.proficiency] ?? lang.proficiency}
              </span>
            </div>
            {confirmId === lang.id ? (
              <InlineConfirm
                onConfirm={async () => { await deleteLang.mutateAsync(lang.id); toast.success('Idioma removido'); setConfirmId(null) }}
                onCancel={() => setConfirmId(null)}
                loading={deleteLang.isPending}
              />
            ) : (
              <button onClick={() => setConfirmId(lang.id)} className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </SectionCard>
      ))}

      {showForm && (
        <SectionCard>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Novo idioma</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Idioma *" value={form.name} required onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Inglês, Espanhol…" />
              <FormSelect label="Nível *" value={form.proficiency} options={LANG_LEVELS} onChange={(e) => setForm((f) => ({ ...f, proficiency: e.target.value }))} />
            </div>
            <FormActions onCancel={() => setShowForm(false)} isPending={addLang.isPending} label="Adicionar" />
          </form>
        </SectionCard>
      )}

      {!showForm && <AddButton label="Adicionar idioma" onClick={() => setShowForm(true)} />}
    </div>
  )
}

// ─── Other info section (gênero, PCD) ─────────────────────────────────────────

const GENDER_OPTIONS: { value: Gender | ''; label: string }[] = [
  { value: '',                     label: 'Prefiro não informar' },
  { value: 'feminino',             label: 'Feminino'   },
  { value: 'masculino',            label: 'Masculino'  },
  { value: 'nao_binario',          label: 'Não-binário' },
  { value: 'prefiro_nao_informar', label: 'Prefiro não informar' },
]

function OtherInfoSection({ gender, isPcd }: { gender: Gender | null; isPcd: boolean }) {
  const toast  = useToast()
  const update = useUpdateResume()

  const [form, setForm] = useState({ gender: gender ?? '', is_pcd: isPcd })
  const isDirty = form.gender !== (gender ?? '') || form.is_pcd !== isPcd

  async function handleSave() {
    await update.mutateAsync({ gender: (form.gender || null) as Gender | null, is_pcd: form.is_pcd })
    toast.success('Informações salvas')
  }

  return (
    <SectionCard>
      <div className="space-y-4">
        <FormSelect
          label="Gênero"
          value={form.gender}
          options={GENDER_OPTIONS}
          onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender | '' }))}
        />
        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pessoa com deficiência (PCD)</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Aumenta o match em vagas afirmativas PCD</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_pcd}
            onClick={() => setForm((f) => ({ ...f, is_pcd: !f.is_pcd }))}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none overflow-hidden ${form.is_pcd ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_pcd ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </label>
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={update.isPending || !isDirty}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Extra keywords section (pasted from an external AI's resume extraction) ──

const KEYWORD_EXTRACTION_PROMPT = `Analise o currículo em anexo (PDF) e extraia TODAS as palavras-chave relevantes pra matching de vagas de emprego em português do Brasil.

Para cada experiência, competência técnica ou responsabilidade descrita, gere não só o termo literal, mas também sinônimos, variações e termos relacionados que um recrutador ou uma vaga poderia usar pra descrever a mesma coisa. Exemplo: se o currículo diz "manutenção e otimização de bancos de dados em ambiente AWS, garantindo performance e estabilidade", gere termos como: otimização de banco de dados, manutenção de banco de dados, performance de banco de dados, tuning de banco de dados, estabilidade de sistemas, AWS, administração de banco de dados, DBA.

Regras de saída:
- Responda SOMENTE com a lista de termos, separados por vírgula, sem numeração, sem explicação, sem markdown.
- Termos em português (exceto siglas/tecnologias que normalmente ficam em inglês, ex: AWS, SQL, API).
- Sem repetição.
- Cubra: ferramentas/tecnologias, metodologias, tipos de tarefa (ex: "análise de causa raiz", "gestão de incidentes"), domínio de negócio (ex: "instituições financeiras", "fintech") e nível de senioridade se mencionado.
- Não invente nada que não esteja implícito no currículo.`

function openAiChat(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function ExtraKeywordsSection({ extraKeywords }: { extraKeywords: string[] }) {
  const toast = useToast()
  const update = useUpdateResume()
  const [value, setValue] = useState(extraKeywords.join(', '))

  const parsed = value.split(/[,\n]/).map((k) => k.trim()).filter(Boolean)
  const isDirty = JSON.stringify(parsed) !== JSON.stringify(extraKeywords)

  async function handleSave() {
    await update.mutateAsync({ extra_keywords: parsed })
    toast.success('Palavras-chave salvas')
  }

  const encodedPrompt = encodeURIComponent(KEYWORD_EXTRACTION_PROMPT)

  return (
    <SectionCard>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Palavras-chave extras</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Peça pra uma IA extrair as palavras-chave do seu currículo (só anexar o PDF no chat que abrir) e cole o
        resultado abaixo, separado por vírgula. Elas entram no cálculo de compatibilidade com as vagas, junto com
        suas habilidades e experiências.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => openAiChat(`https://chatgpt.com/?q=${encodedPrompt}`)}
          className="px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          Abrir no ChatGPT
        </button>
        <button
          type="button"
          onClick={() => openAiChat(`https://claude.ai/new?q=${encodedPrompt}`)}
          className="px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          Abrir no Claude
        </button>
      </div>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ex: otimização de banco de dados, tuning AWS, análise de causa raiz, ITIL, SLA…"
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none"
      />
      <div className="flex justify-end mt-3">
        <button
          onClick={handleSave}
          disabled={update.isPending || !isDirty}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {update.isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </SectionCard>
  )
}

// ─── Summary section ──────────────────────────────────────────────────────────

function SummarySection({ summary }: { summary: string | null }) {
  const toast = useToast()
  const update = useUpdateResume()
  const [value, setValue] = useState(summary ?? '')

  const isDirty = value !== (summary ?? '')

  async function handleSave() {
    await update.mutateAsync({ summary: value })
    toast.success('Resumo salvo')
  }

  return (
    <SectionCard>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Resumo profissional</h2>
      <textarea
        rows={6}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Descreva sua trajetória, principais competências e objetivos profissionais…"
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none"
      />
      <div className="flex justify-end mt-3">
        <button
          onClick={handleSave}
          disabled={update.isPending || !isDirty}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {update.isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </SectionCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Ordenado por impacto no match/pesquisa de vagas: preferências de busca e
// palavras-chave pesam mais no score do que idiomas/outros dados cadastrais.
const TABS = ['Preferências de busca', 'Resumo', 'Habilidades', 'Experiências', 'Formação', 'Idiomas', 'Outros'] as const
type Tab = (typeof TABS)[number]

const TAB_ICONS: Record<Tab, string> = {
  'Preferências de busca': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  'Resumo':                'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  'Habilidades':           'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.951.69h4.914c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.52-4.674z',
  'Experiências':          'M20 7h-3V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H4a1 1 0 00-1 1v11a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM9 5h6v2H9V5z',
  'Formação':              'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0118 15.5c0 .845-.084 1.671-.244 2.472M12 14l-6.16-3.422A12.083 12.083 0 006 15.5c0 .845.084 1.671.244 2.472M12 14v7',
  'Idiomas':               'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9l4.5-10.5L21.5 18m-9-3h9',
  'Outros':                'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
}

const TAB_COUNTS = (resume: NonNullable<ReturnType<typeof useResume>['data']>): Partial<Record<Tab, number>> => ({
  'Experiências': resume.experiences.length,
  'Formação':     resume.educations.length,
  'Habilidades':  resume.skills.length,
  'Idiomas':      resume.languages.length,
})

function ResumeSkeleton() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse space-y-4">
      <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-32" />
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="flex-1 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />)}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className={`h-4 bg-gray-100 dark:bg-gray-700 rounded w-${i === 3 ? '1/2' : i === 2 ? '3/4' : 'full'}`} />)}
      </div>
    </div>
  )
}

export default function ResumePage() {
  const { data: resume, isLoading } = useResume()
  const { data: curatedKeywords = [] } = useCuratedKeywords()
  const searchParams = useSearchParams()
  const initialTab: Tab = searchParams.get('tab') === 'preferencias' ? 'Preferências de busca' : 'Resumo'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  if (isLoading) return <ResumeSkeleton />
  if (!resume) return null

  const counts = TAB_COUNTS(resume)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Currículo</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Quanto mais completo, melhor o cálculo de compatibilidade com as vagas
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const count = counts[tab]
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              ].join(' ')}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d={TAB_ICONS[tab]} />
              </svg>
              {tab}
              {count !== undefined && count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'Resumo' && (
        <div className="space-y-6">
          <SummarySection summary={resume.summary} />
          <ExtraKeywordsSection extraKeywords={resume.extra_keywords} />
        </div>
      )}
      {activeTab === 'Experiências'         && <ExperienceSection items={resume.experiences} curatedKeywords={curatedKeywords} />}
      {activeTab === 'Formação'             && <EducationSection  items={resume.educations} />}
      {activeTab === 'Habilidades'          && <SkillSection      items={resume.skills} curatedKeywords={curatedKeywords} />}
      {activeTab === 'Idiomas'              && <LanguageSection   items={resume.languages} />}
      {activeTab === 'Outros'               && <OtherInfoSection  gender={resume.gender} isPcd={resume.is_pcd} />}
      {activeTab === 'Preferências de busca' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cargos desejados</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 mb-4">
              Configure os cargos que está buscando. O sistema buscará vagas para todos eles.
            </p>
            <DesiredRolesSettings />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Localização</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 mb-4">
              Defina onde você quer trabalhar. As buscas serão filtradas para sua cidade.
            </p>
            <LocationSettings />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Preferências de vaga</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 mb-4">
              Filtre as vagas por nível, regime e salário esperado.
            </p>
            <PreferencesSettings />
          </div>
        </div>
      )}
    </div>
  )
}
