'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import OnboardingStep1 from '@/components/onboarding/OnboardingStep1'
import OnboardingStep2 from '@/components/onboarding/OnboardingStep2'
import OnboardingStep3 from '@/components/onboarding/OnboardingStep3'

export default function OnboardingPage() {
  const router = useRouter()
  const user   = useAuthStore((s) => s.user)
  const [step, setStep] = useState(1)

  useEffect(() => {
    if (user?.onboarding_completed === true) {
      router.replace('/dashboard')
    }
  }, [user, router])

  if (user?.onboarding_completed === true) return null

  return (
    <OnboardingLayout step={step} totalSteps={3}>
      {step === 1 && (
        <OnboardingStep1 onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <OnboardingStep2
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <OnboardingStep3 onBack={() => setStep(2)} />
      )}
    </OnboardingLayout>
  )
}
