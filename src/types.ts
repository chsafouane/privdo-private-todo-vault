export interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: number
  updatedAt: number
  deadline?: string
  deletedAt?: number
  sortOrder: number
}

export interface TaskList {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  sortOrder: number
  deletedAt?: number
}

export interface Vault {
  lists: TaskList[]
  tasks: Record<string, Task[]>
}

export function isValidTaskArray(data: unknown): data is Task[] {
  if (!Array.isArray(data)) return false
  return data.every(item =>
    typeof item === 'object' && item !== null &&
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.completed === 'boolean' &&
    typeof item.createdAt === 'number' &&
    typeof item.updatedAt === 'number' &&
    (!('deadline' in item) || item.deadline === undefined || typeof item.deadline === 'string') &&
    (!('deletedAt' in item) || item.deletedAt === undefined || typeof item.deletedAt === 'number') &&
    (!('sortOrder' in item) || typeof item.sortOrder === 'number')
  )
}

export function isValidVault(data: unknown): data is Vault {
  if (typeof data !== 'object' || data === null) return false
  const v = data as Record<string, unknown>
  if (!Array.isArray(v.lists)) return false
  if (typeof v.tasks !== 'object' || v.tasks === null) return false
  return v.lists.every(item =>
    typeof item === 'object' && item !== null &&
    typeof (item as any).id === 'string' &&
    typeof (item as any).name === 'string'
  )
}

/** Ensure all tasks have a sortOrder, assigning one based on createdAt if missing. */
export function ensureSortOrder(tasks: Task[]): Task[] {
  const needsMigration = tasks.some(t => t.sortOrder == null)
  if (!needsMigration) return tasks

  const sorted = [...tasks].sort((a, b) => a.createdAt - b.createdAt)
  return sorted.map((t, i) => t.sortOrder != null ? t : { ...t, sortOrder: i + 1 })
}

export const DEFAULT_VAULT: Vault = { lists: [], tasks: {} }
