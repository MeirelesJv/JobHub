'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  useResume, useUpdateResume, useUpdateProfile,
  useAddExperience, useUpdateExperience, useDeleteExperience,
  useAddEducation, useUpdateEducation, useDeleteEducation,
  useAddSkill, useDeleteSkill,
  useAddLanguage, useDeleteLanguage,
  type Experience, type Education, type Skill, type Language,
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

// ─── Experience section ───────────────────────────────────────────────────────

const EXP_BLANK = { title: '', company: '', location: '', description: '', start_date: '', end_date: '', is_current: false }

function ExperienceSection({ items }: { items: Experience[] }) {
  const toast = useToast()
  const addExp    = useAddExperience()
  const updateExp = useUpdateExperience()
  const deleteExp = useDeleteExperience()

  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState<Experience | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [form, setForm] = useState(EXP_BLANK)

  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function openAdd() {
    setForm(EXP_BLANK)
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
            <FormActions onCancel={closeForm} isPending={isSaving} />
          </form>
        </SectionCard>
      )}

      {!showForm && <AddButton label="Adicionar experiência" onClick={openAdd} />}
    </div>
  )
}

// ─── Education section ────────────────────────────────────────────────────────

const EDU_BLANK = { institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', is_current: false }

function EducationSection({ items }: { items: Education[] }) {
  const toast = useToast()
  const addEdu    = useAddEducation()
  const updateEdu = useUpdateEducation()
  const deleteEdu = useDeleteEducation()

  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState<Education | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [form, setForm] = useState(EDU_BLANK)

  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function openAdd() {
    setForm(EDU_BLANK)
    setEditItem(null)
    setShowForm(true)
  }

  function openEdit(item: Education) {
    setForm({
      institution:   item.institution,
      degree:        item.degree ?? '',
      field_of_study: item.field_of_study ?? '',
      start_date:    toMonth(item.start_date),
      end_date:      toMonth(item.end_date),
      is_current:    item.is_current,
    })
    setEditItem(item)
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditItem(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      institution:   form.institution,
      degree:        form.degree || null,
      field_of_study: form.field_of_study || null,
      start_date:    fromMonth(form.start_date),
      end_date:      form.is_current ? null : fromMonth(form.end_date),
      is_current:    form.is_current,
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
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {edu.degree ?? 'Formação'}
                {edu.field_of_study ? ` em ${edu.field_of_study}` : ''}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{edu.institution}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {fmtDate(edu.start_date)} → {edu.is_current ? 'Cursando' : fmtDate(edu.end_date)}
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
            <FormInput label="Instituição *" value={form.institution} required onChange={(e) => set('institution', e.target.value)} placeholder="Universidade de São Paulo" />
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Grau" value={form.degree} onChange={(e) => set('degree', e.target.value)} placeholder="Bacharelado" />
              <FormInput label="Área" value={form.field_of_study} onChange={(e) => set('field_of_study', e.target.value)} placeholder="Ciência da Computação" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Início" type="month" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              <FormInput label="Fim" type="month" value={form.end_date} disabled={form.is_current} onChange={(e) => set('end_date', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.is_current} onChange={(e) => set('is_current', e.target.checked)} className="rounded border-gray-300 dark:border-gray-500 dark:bg-gray-700 text-primary-600 focus:ring-primary-500" />
              Estou cursando atualmente
            </label>
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

function SkillSection({ items }: { items: Skill[] }) {
  const toast = useToast()
  const addSkill    = useAddSkill()
  const deleteSkill = useDeleteSkill()

  const [showForm,  setShowForm]  = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', level: '' })

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
              <FormInput label="Habilidade *" value={form.name} required onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="React, Python, SQL…" />
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

// ─── Basic info section ───────────────────────────────────────────────────────

interface BasicInfo {
  full_name:           string | null
  desired_role:        string | null
  location_preference: string | null
}

function BasicInfoSection({ info }: { info: BasicInfo }) {
  const toast         = useToast()
  const updateProfile = useUpdateProfile()

  const [form, setForm] = useState({
    full_name:           info.full_name           ?? '',
    desired_role:        info.desired_role         ?? '',
    location_preference: info.location_preference  ?? '',
  })

  const isDirty =
    form.full_name           !== (info.full_name           ?? '') ||
    form.desired_role        !== (info.desired_role         ?? '') ||
    form.location_preference !== (info.location_preference  ?? '')

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    await updateProfile.mutateAsync({
      full_name:           form.full_name           || undefined,
      desired_role:        form.desired_role         || undefined,
      location_preference: form.location_preference  || undefined,
    })
    toast.success('Informações atualizadas')
  }

  return (
    <SectionCard>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Informações básicas</h2>
      <div className="space-y-3">
        <FormInput
          label="Nome completo"
          value={form.full_name}
          onChange={(e) => set('full_name', e.target.value)}
          placeholder="Seu nome completo"
        />
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            label="Cargo desejado"
            value={form.desired_role}
            onChange={(e) => set('desired_role', e.target.value)}
            placeholder="Ex: Engenheiro de Software"
          />
          <FormInput
            label="Localização"
            value={form.location_preference}
            onChange={(e) => set('location_preference', e.target.value)}
            placeholder="Ex: São Paulo, SP"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={updateProfile.isPending || !isDirty}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {updateProfile.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
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

const TABS = ['Resumo', 'Experiências', 'Formação', 'Habilidades', 'Idiomas', 'Preferências de busca'] as const
type Tab = (typeof TABS)[number]

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
  const [activeTab, setActiveTab] = useState<Tab>('Resumo')

  if (isLoading) return <ResumeSkeleton />
  if (!resume) return null

  const counts = TAB_COUNTS(resume)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Currículo</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Mantenha seu perfil atualizado para melhores correspondências</p>
      </div>

      <BasicInfoSection info={{
        full_name:           resume.full_name,
        desired_role:        resume.desired_role,
        location_preference: resume.location_preference,
      }} />

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
      {activeTab === 'Resumo'               && <SummarySection    summary={resume.summary} />}
      {activeTab === 'Experiências'         && <ExperienceSection items={resume.experiences} />}
      {activeTab === 'Formação'             && <EducationSection  items={resume.educations} />}
      {activeTab === 'Habilidades'          && <SkillSection      items={resume.skills} />}
      {activeTab === 'Idiomas'              && <LanguageSection   items={resume.languages} />}
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
