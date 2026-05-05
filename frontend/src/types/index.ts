export interface AuthUser {
  id: number
  email: string
  full_name: string
  phone?: string | null
  location?: string | null
  desired_role?: string | null
  location_preference?: string | null
  job_type_preference?: string | null
  level_preference?: string | null
  remote_preference?: boolean
  salary_expectation_min?: number | null
  onboarding_completed?: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export type JobPlatform = 'linkedin' | 'gupy' | 'vagas' | 'catho' | 'infojobs'
export type JobType    = 'clt' | 'pj' | 'freelance'
export type JobLevel   = 'junior' | 'pleno' | 'senior'

export interface Job {
  id: number
  external_id: string
  title: string
  company: string
  location?: string | null
  description?: string | null
  salary_min?: number | null
  salary_max?: number | null
  job_type?: JobType | null
  level?: JobLevel | null
  remote: boolean
  easy_apply: boolean
  platform: JobPlatform
  url: string
  published_at?: string | null
  expires_at?: string | null
  is_active: boolean
  created_at: string
}

export interface JobListResponse {
  items: Job[]
  total: number
  page: number
  page_size: number
}

export type ApplicationStatus = 'applied' | 'in_review' | 'interview' | 'offer' | 'rejected' | 'cancelled'
export type ApplicationMode   = 'turbo' | 'assisted' | 'manual'

export interface JobSummary {
  id: number
  title: string
  company: string
  platform: JobPlatform
  url: string
  job_type?: JobType | null
  level?: JobLevel | null
  location?: string | null
  remote: boolean
}

export interface Application {
  id: number
  job_id: number
  status: ApplicationStatus
  mode: ApplicationMode
  applied_at: string
  updated_at: string
  notes?: string | null
  job: JobSummary
}

export interface KanbanResponse {
  applied:    Application[]
  in_review:  Application[]
  interview:  Application[]
  offer:      Application[]
  rejected:   Application[]
  cancelled:  Application[]
}

export interface ApplicationStats {
  total:     number
  applied:   number
  in_review: number
  interview: number
  offer:     number
  rejected:  number
  cancelled: number
}
