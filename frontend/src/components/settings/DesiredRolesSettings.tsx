'use client'

import { useState } from 'react'
import {
  useDesiredRoles,
  useAddRole,
  useUpdateRole,
  useDeleteRole,
  useSetPrimaryRole,
  type DesiredRole,
} from '@/hooks/useDesiredRoles'

const MAX_ROLES = 5

export function DesiredRolesSettings() {
  const { data: roles = [], isLoading } = useDesiredRoles()
  const addRole     = useAddRole()
  const updateRole  = useUpdateRole()
  const deleteRole  = useDeleteRole()
  const setPrimary  = useSetPrimaryRole()

  const [adding, setAdding]       = useState(false)
  const [newName, setNewName]     = useState('')
  const [editId, setEditId]       = useState<number | null>(null)
  const [editName, setEditName]   = useState('')

  function startAdd() {
    setAdding(true)
    setNewName('')
    setEditId(null)
  }

  function cancelAdd() {
    setAdding(false)
    setNewName('')
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    addRole.mutate(
      { role_name: name, is_primary: roles.length === 0 },
      { onSuccess: () => { setAdding(false); setNewName('') } }
    )
  }

  function startEdit(role: DesiredRole) {
    setEditId(role.id)
    setEditName(role.role_name)
    setAdding(false)
  }

  function cancelEdit() {
    setEditId(null)
    setEditName('')
  }

  function submitEdit(e: React.FormEvent, id: number) {
    e.preventDefault()
    const name = editName.trim()
    if (!name) return
    updateRole.mutate(
      { id, role_name: name },
      { onSuccess: () => { setEditId(null); setEditName('') } }
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {roles.length} de {MAX_ROLES} cargo{roles.length !== 1 ? 's' : ''} cadastrado{roles.length !== 1 ? 's' : ''}
        </p>
      </div>

      {roles.length === 0 && !adding && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-gray-600 rounded-xl">
          Nenhum cargo cadastrado. Adicione ao menos um cargo para personalizarmos suas buscas.
        </div>
      )}

      {roles.map((role) => (
        <div key={role.id} className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
          {editId === role.id ? (
            <form onSubmit={(e) => submitEdit(e, role.id)} className="flex gap-2 p-3">
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Nome do cargo"
              />
              <button
                type="submit"
                disabled={updateRole.isPending || !editName.trim()}
                className="px-3 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {updateRole.isPending ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{role.role_name}</span>
                  {role.is_primary && (
                    <span className="flex-shrink-0 text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      Principal
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!role.is_primary && (
                  <button
                    onClick={() => setPrimary.mutate(role.id)}
                    disabled={setPrimary.isPending}
                    title="Definir como principal"
                    className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Definir principal
                  </button>
                )}
                <button
                  onClick={() => startEdit(role)}
                  title="Editar"
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteRole.mutate(role.id)}
                  disabled={deleteRole.isPending || roles.length === 1}
                  title={roles.length === 1 ? 'Você precisa ter ao menos um cargo' : 'Remover'}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <form onSubmit={submitAdd} className="flex gap-2 border border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            placeholder="Ex: Desenvolvedor Full Stack"
          />
          <button
            type="submit"
            disabled={addRole.isPending || !newName.trim()}
            className="px-3 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {addRole.isPending ? 'Adicionando…' : 'Adicionar'}
          </button>
          <button
            type="button"
            onClick={cancelAdd}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button
          onClick={startAdd}
          disabled={roles.length >= MAX_ROLES}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-500 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400 text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {roles.length >= MAX_ROLES ? `Limite de ${MAX_ROLES} cargos atingido` : 'Adicionar cargo'}
        </button>
      )}
    </div>
  )
}
