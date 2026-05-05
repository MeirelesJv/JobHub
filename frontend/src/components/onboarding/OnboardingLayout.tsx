'use client'

interface Props {
  step:        number
  totalSteps:  number
  children:    React.ReactNode
}

export function OnboardingLayout({ step, totalSteps, children }: Props) {
  const progress = Math.round((step / totalSteps) * 100)

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-primary-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 py-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-gray-900">JobHub</span>
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={[
                  'rounded-full transition-all duration-300',
                  i + 1 < step  ? 'w-2 h-2 bg-primary-600' :
                  i + 1 === step ? 'w-3 h-3 bg-primary-600' :
                                   'w-2 h-2 bg-gray-200',
                ].join(' ')}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Passo {step} de {totalSteps}</p>
        </div>

        {children}
      </div>
    </div>
  )
}
