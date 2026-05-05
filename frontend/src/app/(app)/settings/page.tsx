'use client'

import { useState } from 'react'
import { AccountSettings }       from '@/components/settings/AccountSettings'
import { AppearanceSettings }    from '@/components/settings/AppearanceSettings'

type Tab = 'appearance' | 'account'

const TABS: { id: Tab; label: string }[] = [
  { id: 'appearance',  label: 'Aparência'   },
  { id: 'account',     label: 'Conta'       },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('appearance')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configurações</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gerencie sua conta e aparência</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap',
              tab === t.id
                ? 'border-primary-600 text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        {tab === 'appearance' && (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Aparência</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Escolha o tema visual do JobHub.
              </p>
            </div>
            <AppearanceSettings />
          </>
        )}
        {tab === 'account' && (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Minha conta</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Gerencie seus dados pessoais e senha.
              </p>
            </div>
            <AccountSettings />
          </>
        )}
      </div>
    </div>
  )
}
