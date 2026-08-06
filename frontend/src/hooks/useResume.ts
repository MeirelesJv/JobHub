import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useUserStore } from '@/store/user.store'
import type { UserProfile } from '@/types'

export interface Experience {
  id: number
  title: string        // cargo
  company: string
  location: string | null
  description: string | null
  start_date: string | null   // YYYY-MM-DD
  end_date: string | null
  is_current: boolean
  keywords: string[]
}

export type EducationType = 'graduacao' | 'pos' | 'tecnico' | 'curso' | 'certificado' | 'outro'
export type EducationStatus = 'concluido' | 'cursando' | 'trancado'

export interface Education {
  id: number
  institution: string | null
  degree: string | null
  field_of_study: string | null
  education_type: EducationType
  status: EducationStatus
  expected_completion_date: string | null
  start_date: string | null
  end_date: string | null
}

export interface Skill {
  id: number
  name: string
  level: string | null   // beginner | intermediate | advanced | expert
}

export interface Language {
  id: number
  name: string
  proficiency: string    // basic | intermediate | advanced | fluent | native
}

export type Gender = 'feminino' | 'masculino' | 'nao_binario' | 'prefiro_nao_informar'

export interface Resume {
  id: number
  title: string
  summary: string | null
  gender: Gender | null
  is_pcd: boolean
  extra_keywords: string[]
  full_name: string | null
  location_preference: string | null
  desired_role: string | null
  experiences: Experience[]
  educations: Education[]
  skills: Skill[]
  languages: Language[]
}

function setResume(qc: ReturnType<typeof useQueryClient>) {
  return (data: Resume) => qc.setQueryData<Resume>(['resume'], data)
}

export interface ProfileUpdate {
  full_name?: string
  desired_role?: string
  location_preference?: string
}

export function useUpdateProfile() {
  const qc      = useQueryClient()
  const setUser = useUserStore((s) => s.setUser)
  return useMutation({
    mutationFn: (data: ProfileUpdate) =>
      api.patch<UserProfile>('/api/users/profile', data).then((r) => r.data),
    onSuccess: (user) => {
      setUser(user)
      // Sync the new values into the cached resume object
      qc.setQueryData<Resume>(['resume'], (prev) =>
        prev ? {
          ...prev,
          full_name:           user.full_name,
          location_preference: user.location_preference ?? null,
          desired_role:        user.desired_role ?? null,
        } : prev
      )
    },
  })
}

export function useResume() {
  return useQuery<Resume>({
    queryKey: ['resume'],
    queryFn:  () => api.get<Resume>('/api/resume').then((r) => r.data),
  })
}

export function useUpdateResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title?: string; summary?: string; gender?: Gender | null; is_pcd?: boolean; extra_keywords?: string[] }) =>
      api.patch<Resume>('/api/resume', data).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

// ─── keywords (curated list for autocomplete / auto-detection) ───────────────

export function useCuratedKeywords() {
  return useQuery<string[]>({
    queryKey: ['resume-keywords'],
    queryFn:  () => api.get<{ keywords: string[] }>('/api/resume/keywords').then((r) => r.data.keywords),
    staleTime: Infinity,
  })
}

// ─── experiences ─────────────────────────────────────────────────────────────

type ExperienceInput = Omit<Experience, 'id'>

export function useAddExperience() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExperienceInput) =>
      api.post<Resume>('/api/resume/experiences', data).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

export function useUpdateExperience() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Experience) =>
      api.put<Resume>(`/api/resume/experiences/${id}`, data).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

export function useDeleteExperience() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<Resume>(`/api/resume/experiences/${id}`).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

// ─── educations ──────────────────────────────────────────────────────────────

type EducationInput = Omit<Education, 'id'>

export function useAddEducation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EducationInput) =>
      api.post<Resume>('/api/resume/educations', data).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

export function useUpdateEducation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Education) =>
      api.put<Resume>(`/api/resume/educations/${id}`, data).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

export function useDeleteEducation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<Resume>(`/api/resume/educations/${id}`).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

// ─── skills ──────────────────────────────────────────────────────────────────

export function useAddSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Skill, 'id'>) =>
      api.post<Resume>('/api/resume/skills', data).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

export function useDeleteSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<Resume>(`/api/resume/skills/${id}`).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

// ─── languages ───────────────────────────────────────────────────────────────

export function useAddLanguage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Language, 'id'>) =>
      api.post<Resume>('/api/resume/languages', data).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}

export function useDeleteLanguage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<Resume>(`/api/resume/languages/${id}`).then((r) => r.data),
    onSuccess: setResume(qc),
  })
}
