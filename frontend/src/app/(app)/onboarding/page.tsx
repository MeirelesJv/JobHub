'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUserStore } from '@/store/user.store'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import OnboardingForm from '@/components/onboarding/OnboardingForm'

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user   = useUserStore((s) => s.user)

  const preview = process.env.NODE_ENV !== 'production' && searchParams.get('preview') === '1'

  useEffect(() => {
    if (!preview && user?.onboarding_completed === true) {
      router.replace('/dashboard')
    }
  }, [user, router, preview])

  if (!preview && user?.onboarding_completed === true) return null

  return (
    <OnboardingLayout step={1} totalSteps={1}>
      <OnboardingForm />
    </OnboardingLayout>
  )
}
