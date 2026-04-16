import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Task } from '@/types'

function computeNextDeadline(currentDeadline: string, recurrence: 'daily' | 'weekly' | 'monthly'): string {
  const now = new Date()
  let base = new Date(currentDeadline)
  // If overdue, start from now instead of the missed date
  if (base < now) base = now

  switch (recurrence) {
    case 'daily':
      base.setDate(base.getDate() + 1)
      break
    case 'weekly':
      base.setDate(base.getDate() + 7)
      break
    case 'monthly':
      base.setMonth(base.getMonth() + 1)
      break
  }

  // Format as datetime-local string (YYYY-MM-DDTHH:mm)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`
}

interface UseTaskManagerParams {
  tasks: Task[] | undefined
  setTasks: (updater: Task[] | ((prev: Task[] | undefined) => Task[])) => void
}

export function useTaskManager({ tasks, setTasks }: UseTaskManagerParams) {
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskDeadline, setNewTaskDeadline] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<number>(0)
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editPriority, setEditPriority] = useState<number>(0)
  const [editRecurrence, setEditRecurrence] = useState<string>('')
  const [recentlyDeleted, setRecentlyDeleted] = useState<Task | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addTask = () => {
    const trimmed = newTaskText.trim()
    if (!trimmed) return

    const now = Date.now()
    const maxOrder = (tasks || []).reduce((max, t) => Math.max(max, t.sortOrder ?? 0), 0)
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
      createdAt: now,
      updatedAt: now,
      sortOrder: maxOrder + 1,
      ...(newTaskDeadline ? { deadline: newTaskDeadline } : {}),
      ...(newTaskPriority ? { priority: newTaskPriority } : {}),
      ...(newTaskRecurrence && newTaskDeadline ? { recurrence: newTaskRecurrence as Task['recurrence'] } : {}),
    }

    setTasks(current => [...(current || []), newTask])
    setNewTaskText('')
    setNewTaskDeadline('')
    setNewTaskPriority(0)
    setNewTaskRecurrence('')
    toast.success('Task added')
  }

  const toggleTask = (id: string) => {
    const task = (tasks || []).find(t => t.id === id)
    if (!task) return

    const isCompleting = !task.completed

    if (isCompleting && task.recurrence && task.deadline) {
      // Create next occurrence for recurring tasks
      const now = Date.now()
      const maxOrder = (tasks || []).reduce((max, t) => Math.max(max, t.sortOrder ?? 0), 0)
      const nextDeadline = computeNextDeadline(task.deadline, task.recurrence)
      const nextTask: Task = {
        id: crypto.randomUUID(),
        text: task.text,
        completed: false,
        createdAt: now,
        updatedAt: now,
        sortOrder: maxOrder + 1,
        deadline: nextDeadline,
        priority: task.priority,
        recurrence: task.recurrence,
      }
      setTasks(current =>
        (current || []).map(t =>
          t.id === id ? { ...t, completed: true, recurrence: undefined, updatedAt: now } : t
        ).concat(nextTask)
      )
      toast.success('Next occurrence created')
    } else {
      setTasks(current =>
        (current || []).map(t =>
          t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t
        )
      )
    }
  }

  const deleteTask = (id: string) => {
    const task = (tasks || []).find(t => t.id === id)
    if (task) {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
      setRecentlyDeleted(task)

      setTasks(current =>
        (current || []).map(t =>
          t.id === id ? { ...t, deletedAt: Date.now(), updatedAt: Date.now() } : t
        )
      )

      undoTimeoutRef.current = setTimeout(() => {
        setRecentlyDeleted(null)
      }, 5000)

      toast('Task deleted', {
        action: {
          label: 'Undo',
          onClick: () => undoDelete(id),
        },
        duration: 5000,
      })
    }
  }

  const undoDelete = (id: string) => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    setTasks(current =>
      (current || []).map(t =>
        t.id === id ? { ...t, deletedAt: undefined, updatedAt: Date.now() } : t
      )
    )
    setRecentlyDeleted(null)
    toast.success('Task restored')
  }

  const clearCompleted = () => {
    const now = Date.now()
    setTasks(current =>
      (current || []).map(task =>
        task.completed && !task.deletedAt ? { ...task, deletedAt: now, updatedAt: now } : task
      )
    )
    toast.success('Cleared completed tasks')
  }

  const startEdit = (task: Task) => {
    setEditingId(task.id)
    setEditText(task.text)
    setEditDeadline(task.deadline || '')
    setEditPriority(task.priority || 0)
    setEditRecurrence(task.recurrence || '')
  }

  const saveEdit = () => {
    if (!editingId) return

    const trimmed = editText.trim()
    if (!trimmed) {
      cancelEdit()
      return
    }

    setTasks(current =>
      (current || []).map(task =>
        task.id === editingId ? {
          ...task,
          text: trimmed,
          deadline: editDeadline || undefined,
          priority: editPriority || undefined,
          recurrence: (editRecurrence && editDeadline) ? editRecurrence as Task['recurrence'] : undefined,
          updatedAt: Date.now(),
        } : task
      )
    )
    setEditingId(null)
    setEditText('')
    setEditDeadline('')
    setEditPriority(0)
    setEditRecurrence('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
    setEditDeadline('')
    setEditPriority(0)
    setEditRecurrence('')
  }

  return {
    newTaskText,
    setNewTaskText,
    newTaskDeadline,
    setNewTaskDeadline,
    newTaskPriority,
    setNewTaskPriority,
    newTaskRecurrence,
    setNewTaskRecurrence,
    editingId,
    editText,
    setEditText,
    editDeadline,
    setEditDeadline,
    editPriority,
    setEditPriority,
    editRecurrence,
    setEditRecurrence,
    recentlyDeleted,
    addTask,
    toggleTask,
    deleteTask,
    undoDelete,
    clearCompleted,
    startEdit,
    saveEdit,
    cancelEdit,
    undoTimeoutRef,
  }
}
