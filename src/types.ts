export interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: number
  updatedAt: number
  deadline?: string
  deletedAt?: number
}

export type SortMode = 'created' | 'deadline' | 'alpha'

export function isValidTaskArray(data: unknown): data is Task[] {
  if (!Array.isArray(data)) return false
  return data.every(item =>
    typeof item === 'object' && item !== null &&
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.completed === 'boolean' &&
    typeof item.createdAt === 'number' &&
    typeof item.updatedAt === 'number'
  )
}
