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

/** Ensure all tasks have a sortOrder, assigning one based on createdAt if missing. */
export function ensureSortOrder(tasks: Task[]): Task[] {
  const needsMigration = tasks.some(t => t.sortOrder == null)
  if (!needsMigration) return tasks

  const sorted = [...tasks].sort((a, b) => a.createdAt - b.createdAt)
  return sorted.map((t, i) => t.sortOrder != null ? t : { ...t, sortOrder: i + 1 })
}
