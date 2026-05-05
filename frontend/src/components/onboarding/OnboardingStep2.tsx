'use client'

import { useState, useEffect } from 'react'
import { isExtensionInstalled } from '@/lib/extension'

interface Props {
  onNext: () => void
  onBack: () => void
}

const BENEFITS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Candidatura automática',
    desc: 'Aplica vagas no LinkedIn e Gupy sem você precisar preencher formulários.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    title: 'Detecção de candidaturas manuais',
    desc: 'Quando você aplica no site original, a extensão registra automaticamente no JobHub.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    title: 'Sincronização silenciosa',
    desc: 'Coleta novas vagas em segundo plano enquanto você navega normalmente.',
  },
]

export default function OnboardingStep2({ onNext, onBack }: Props) {
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    isExtensionInstalled().then((detected) => {
      if (detected) setInstalled(true)
    })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Instale a extensão Chrome</h1>
      <p className="text-gray-500 text-sm mb-8">
        A extensão do JobHub roda em segundo plano e turbina suas candidaturas.
      </p>

      {/* Benefits */}
      <div className="space-y-4 mb-8">
        {BENEFITS.map((b, i) => (
          <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
              {b.icon}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{b.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Install CTA or installed badge */}
      {installed ? (
        <div className="flex items-center gap-3 w-full py-3 px-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Extensão instalada ✓</p>
            <p className="text-xs text-emerald-600">Detectada e pronta para uso</p>
          </div>
        </div>
      ) : (
        <a
          href="https://chrome.google.com/webstore"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors text-sm mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 10.545a1.455 1.455 0 1 0 0 2.91 1.455 1.455 0 0 0 0-2.91z" />
          </svg>
          Instalar extensão Chrome
        </a>
      )}

      {/* Manual override checkbox (only when not auto-detected) */}
      {!installed && (
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 transition-colors mb-6">
          <div
            onClick={() => setInstalled((v) => !v)}
            className="w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center flex-shrink-0 transition-colors"
          >
          </div>
          <span className="text-sm text-gray-700">Já instalei a extensão</span>
        </label>
      )}
      {installed && <div className="mb-6" />}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          {installed ? 'Próximo' : 'Pular por enquanto'}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
