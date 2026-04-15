import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Task } from '@/types'

interface UseTaskManagerParams {
  tasks: Task[] | undefined
  setTasks: (updater: Task[] | ((prev: Task[] | undefined) => Task[])) => void
}

export function useTaskManager({ tasks, setTasks }: UseTaskManagerParams) {
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskDeadline, setNewTaskDeadline] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [recentlyDeleted, setRecentlyDeleted] = useState<Task | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addTask = () => {
    const trimmed = newTaskText.trim()
    if (!trimmed) return

    const now = Date.now()
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
      createdAt: now,
      updatedAt: now,
      ...(newTaskDeadline ? { deadline: newTaskDeadline } : {})
    }

    setTasks(current => [...(current || []), newTask])
    setNewTaskText('')
    setNewTaskDeadline('')
    toast.success('Task added')
  }

  const toggleTask = (id: string) => {
    setTasks(current =>
      (current || []).map(task =>
        task.id === id ? { ...task, completed: !task.completed, updatedAt: Date.now() } : task
      )
    )
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
        task.id === editingId ? { ...task, text: trimmed, deadline: editDeadline || undefined, updatedAt: Date.now() } : task
      )
    )
    setEditingId(null)
    setEditText('')
    setEditDeadline('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
    setEditDeadline('')
  }

  return {
    newTaskText,
    setNewTaskText,
    newTaskDeadline,
    setNewTaskDeadline,
    editingId,
    editText,
    setEditText,
    editDeadline,
    setEditDeadline,
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
