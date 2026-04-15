import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash, LockKey, Clock, DownloadSimple, UploadSimple, Moon, Sun, TrashSimple, CaretDown, MagnifyingGlass, SortAscending, X, ArrowCounterClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useEncryptedStorage } from '@/lib/useEncryptedTasks'
import { encryptDataWithPin, decryptDataWithPin, clearEncryptionKey } from '@/lib/encryption'
import { PinScreen } from '@/components/PinScreen'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: number
  updatedAt: number
  deadline?: string
  deletedAt?: number
}

type SortMode = 'created' | 'deadline' | 'alpha'

function MainApp({ storagePath, databaseName, loadedTasks }: { storagePath: string | null; databaseName: string; loadedTasks?: Task[] | null }) {
  const [tasks, setTasks, isReady] = useEncryptedStorage<Task[]>('tasks', [], storagePath)
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskDeadline, setNewTaskDeadline] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const isLoadedFile = !!loadedTasks

  // Search & sort
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('created')

  // Undo delete
  const [recentlyDeleted, setRecentlyDeleted] = useState<Task | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mobile FAB
  const [addOpen, setAddOpen] = useState(false)

  // If tasks were loaded from an external file, use those instead
  useEffect(() => {
    if (loadedTasks && loadedTasks.length > 0) {
      setTasks(loadedTasks);
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [pinDialogMode, setPinDialogMode] = useState<'export' | 'import' | null>(null)
  const [pinDialogValue, setPinDialogValue] = useState('')
  const [pendingImportContent, setPendingImportContent] = useState<any>(null)
  const [completedCollapsed, setCompletedCollapsed] = useState(true)
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  })

  const notifiedTasks = useRef<Set<string>>(new Set())

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode])

  // Offline/online indicator
  useEffect(() => {
    const handleOffline = () => toast('You are offline — your tasks are safe locally', { duration: 3000 })
    const handleOnline = () => toast.success('Back online', { duration: 2000 })
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  // Request notifications permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission()
    }
  }, [])

  // Check deadlines
  useEffect(() => {
    if (!tasks || tasks.length === 0) return

    const checkReminders = () => {
      const now = Date.now()
      tasks.forEach(task => {        
        if (!task.completed && task.deadline) {
          const dl = new Date(task.deadline).getTime()
          if (now >= dl && !notifiedTasks.current.has(task.id)) {
            notifiedTasks.current.add(task.id)
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Task Reminder: " + task.text, {
                body: "Your task deadline has passed.",
                icon: "/favicon.ico"
              })
            }
          }
        }
      })
    }

    checkReminders()
    const interval = setInterval(checkReminders, 60000)
    return () => clearInterval(interval)
  }, [tasks])

  // Prune tombstones older than 30 days on mount
  useEffect(() => {
    if (!tasks || tasks.length === 0) return
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const hasOldTombstones = tasks.some(t => t.deletedAt && t.deletedAt < thirtyDaysAgo)
    if (hasOldTombstones) {
      setTasks(current => (current || []).filter(t => !t.deletedAt || t.deletedAt >= thirtyDaysAgo))
    }
  }, [isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    }
  }, [])

  const liveTasks = (tasks || []).filter(t => !t.deletedAt)

  const filterBySearch = useCallback((list: Task[]) => {
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(t => t.text.toLowerCase().includes(q))
  }, [searchQuery])

  const sortTasks = useCallback((list: Task[]) => {
    const sorted = [...list]
    switch (sortMode) {
      case 'deadline':
        return sorted.sort((a, b) => {
          if (!a.deadline && !b.deadline) return b.createdAt - a.createdAt
          if (!a.deadline) return 1
          if (!b.deadline) return -1
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        })
      case 'alpha':
        return sorted.sort((a, b) => a.text.localeCompare(b.text))
      default:
        return sorted.sort((a, b) => b.createdAt - a.createdAt)
    }
  }, [sortMode])

  const activeTasks = sortTasks(filterBySearch(liveTasks.filter(t => !t.completed)))
  const completedTasks = sortTasks(filterBySearch(liveTasks.filter(t => t.completed)))

  const addTask = () => {
    const trimmed = newTaskText.trim()
    if (!trimmed) return

    const now = Date.now()
    const newTask: Task = {
      id: now.toString(),
      text: trimmed,
      completed: false,
      createdAt: now,
      updatedAt: now,
      ...(newTaskDeadline ? { deadline: newTaskDeadline } : {})
    }

    setTasks(current => [...(current || []), newTask])
    setNewTaskText('')
    setNewTaskDeadline('')
    setAddOpen(false)
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
      // Clear any previous undo timer
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
      setRecentlyDeleted(task)

      // Soft delete
      setTasks(current =>
        (current || []).map(t =>
          t.id === id ? { ...t, deletedAt: Date.now(), updatedAt: Date.now() } : t
        )
      )

      // Auto-purge after 5s
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

  const cycleSortMode = () => {
    setSortMode(current => {
      switch (current) {
        case 'created': return 'deadline'
        case 'deadline': return 'alpha'
        case 'alpha': return 'created'
      }
    })
  }

  const sortLabel = sortMode === 'created' ? 'Newest' : sortMode === 'deadline' ? 'Deadline' : 'A-Z'

  const triggerExport = () => {
    if (!tasks || tasks.length === 0) {
      toast.error('No tasks to export')
      return
    }
    setPinDialogValue('')
    setPinDialogMode('export')
  }

  const handleExportConfirm = () => {
    if (!tasks || !pinDialogValue.trim()) return
    const encrypted = encryptDataWithPin(tasks, pinDialogValue)
    const exportObject = {
      version: 1,
      encryptedData: encrypted
    }
    const dataStr = JSON.stringify(exportObject, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'privdo_backup.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Secure backup exported successfully')
    setPinDialogMode(null)
    setPinDialogValue('')
  }
  
  const handleImportConfirm = () => {
    if (!pendingImportContent || !pinDialogValue.trim()) return
    const fileContent = pendingImportContent
    
    // Handle encrypted backups
    if (fileContent && fileContent.encryptedData) {
      const decryptedTasks = decryptDataWithPin(fileContent.encryptedData, pinDialogValue)
      if (Array.isArray(decryptedTasks)) {
        setTasks(decryptedTasks)
        toast.success('Secure database imported successfully')
        setPinDialogMode(null)
        setPinDialogValue('')
        setPendingImportContent(null)
      } else {
        toast.error('Decryption failed. Invalid PIN or corrupted backup.')
      }
    } 
    // Fallback for unencrypted
    else if (Array.isArray(fileContent)) {
      setTasks(fileContent)
      toast.success('Unencrypted database imported successfully')
      setPinDialogMode(null)
      setPinDialogValue('')
      setPendingImportContent(null)
    } else {
      toast.error('Invalid database format')
      setPinDialogMode(null)
      setPinDialogValue('')
      setPendingImportContent(null)
    }
  }

  const triggerImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const fileContent = JSON.parse(event.target?.result as string)
        if (fileContent && fileContent.encryptedData) {
          setPendingImportContent(fileContent)
          setPinDialogValue('')
          setPinDialogMode('import')
        } else if (Array.isArray(fileContent)) {
          setTasks(fileContent)
          toast.success('Unencrypted database imported successfully')
        } else {
          toast.error('Invalid database format')
        }
      } catch (err) {
        toast.error('Failed to parse database file')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col bg-card overflow-hidden">
          {/* Compact header */}
          <div className="px-4 pt-4 pb-3 border-b border-border bg-gradient-to-br from-primary/5 to-accent/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-foreground tracking-tight truncate">{databaseName}</h1>
                  {activeTasks.length > 0 && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {activeTasks.length}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate" title={isLoadedFile ? 'Loaded from file' : (storagePath || 'Browser local storage')}>
                  {isLoadedFile ? 'Loaded from file' : (storagePath || 'Browser local storage')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSearchOpen(o => !o); setSearchQuery('') }} title="Search">
                  <MagnifyingGlass size={16} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cycleSortMode} title={`Sort: ${sortLabel}`}>
                  <SortAscending size={16} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
                  {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={triggerExport} title="Export">
                  <DownloadSimple size={16} />
                </Button>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".json"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={triggerImport}
                    title="Import Database"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 pointer-events-none">
                    <UploadSimple size={16} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Sort indicator pill */}
            {sortMode !== 'created' && (
              <div className="flex items-center gap-1 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground font-medium">
                  Sorted by {sortLabel}
                </span>
              </div>
            )}

            {/* Search bar (expandable) */}
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search tasks..."
                        className="h-9 pl-8 text-sm bg-background"
                        autoFocus
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Desktop add task form */}
            <div className="hidden sm:flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex gap-2 w-full">
                <Input
                  id="new-task-input"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTaskText.trim()) addTask()
                  }}
                  placeholder="Add a new task..."
                  className="flex-1 h-10 text-sm bg-background min-w-0"
                  autoFocus
                />
                <Input
                  type="datetime-local"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTaskText.trim()) addTask()
                  }}
                  className="flex-shrink-0 h-10 w-fit bg-background text-sm text-foreground items-center"
                  aria-label="Set a deadline (optional)"
                />
              </div>
              <Button
                onClick={addTask}
                disabled={!newTaskText.trim()}
                className="h-10 px-5 gap-1.5 text-sm"
              >
                <Plus size={18} weight="bold" />
                Add
              </Button>
            </div>

            {/* Mobile inline add form (slides open from FAB) */}
            <AnimatePresence>
              {addOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="sm:hidden overflow-hidden"
                >
                  <div className="flex flex-col gap-2 pt-2">
                    <Input
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTaskText.trim()) addTask()
                      }}
                      placeholder="What needs to be done?"
                      className="h-10 text-sm bg-background"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Input
                        type="datetime-local"
                        value={newTaskDeadline}
                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                        className="flex-1 h-9 bg-background text-sm text-foreground"
                        aria-label="Set a deadline (optional)"
                      />
                      <Button onClick={addTask} disabled={!newTaskText.trim()} className="h-9 px-4 gap-1 text-sm">
                        <Plus size={16} weight="bold" />
                        Add
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-24 sm:pb-4">
            {liveTasks.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Plus size={32} className="text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">No tasks yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first task to get started</p>
              </div>
            ) : activeTasks.length === 0 && completedTasks.length === 0 && searchQuery ? (
              <div className="text-center py-12 px-4">
                <p className="text-muted-foreground font-medium">No matching tasks</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
              </div>
            ) : (
              <>
                {activeTasks.length > 0 && (
                  <div className="space-y-1">
                    <AnimatePresence mode="popLayout">
                      {activeTasks.map((task) => (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          transition={{ duration: 0.2 }}
                          className="relative"
                        >
                          {/* Swipe delete background */}
                          <div className="absolute inset-0 rounded-lg bg-destructive/10 flex items-center justify-end pr-4 pointer-events-none">
                            <Trash size={18} className="text-destructive" />
                          </div>
                          <motion.div
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.25}
                            onDragEnd={(_e, info) => {
                              if (info.offset.x < -100) deleteTask(task.id)
                            }}
                            className="group flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-muted/50 transition-colors touch-pan-y relative"
                          >
                            <Checkbox
                              id={`task-${task.id}`}
                              checked={task.completed}
                              onCheckedChange={() => toggleTask(task.id)}
                              className="mt-0.5 flex-shrink-0"
                            />
                            
                            {editingId === task.id ? (
                              <div className="flex-1 flex flex-col gap-2">
                                <Input
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit()
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                  onBlur={(e) => {
                                    if (!e.relatedTarget?.closest('[data-edit-deadline]')) saveEdit()
                                  }}
                                  className="flex-1 h-9"
                                  autoFocus
                                />
                                <div className="flex items-center gap-2">
                                  <Clock size={14} className="text-muted-foreground flex-shrink-0" />
                                  <Input
                                    type="datetime-local"
                                    data-edit-deadline
                                    value={editDeadline}
                                    onChange={(e) => setEditDeadline(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEdit()
                                      if (e.key === 'Escape') cancelEdit()
                                    }}
                                    onBlur={(e) => {
                                      if (!e.relatedTarget?.closest('[data-edit-deadline]') && e.relatedTarget?.tagName !== 'INPUT') saveEdit()
                                    }}
                                    className="h-8 w-fit text-xs bg-background"
                                  />
                                  {editDeadline && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      data-edit-deadline
                                      onClick={() => setEditDeadline('')}
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      title="Remove deadline"
                                    >
                                      <Trash size={12} />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 flex flex-col min-w-0">
                                <label
                                  htmlFor={`task-${task.id}`}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    startEdit(task)
                                  }}
                                  className="text-sm text-foreground cursor-pointer select-none truncate"
                                >
                                  {task.text}
                                </label>
                                {task.deadline && (
                                  <div className="flex items-center gap-1 text-[11px] mt-0.5">
                                    {new Date(task.deadline).getTime() < Date.now() ? (
                                      <>
                                        <Clock size={12} weight="bold" className="text-destructive" />
                                        <span className="text-destructive font-medium">
                                          {new Date(task.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Clock size={12} className="text-muted-foreground" />
                                        <span className="text-muted-foreground">
                                          {new Date(task.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTask(task.id)}
                              className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                            >
                              <Trash size={16} />
                            </Button>
                          </motion.div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {completedTasks.length > 0 && (
                  <>
                    {activeTasks.length > 0 && <Separator className="my-4" />}
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between px-3 mb-2">
                        <button
                          onClick={() => setCompletedCollapsed(c => !c)}
                          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <motion.div animate={{ rotate: completedCollapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
                            <CaretDown size={12} weight="bold" />
                          </motion.div>
                          Completed ({completedTasks.length})
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearCompleted}
                          className="h-6 text-[11px] text-muted-foreground hover:text-destructive gap-1"
                        >
                          <TrashSimple size={12} />
                          Clear
                        </Button>
                      </div>
                      <AnimatePresence mode="popLayout">
                        {!completedCollapsed && completedTasks.map((task) => (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ duration: 0.2 }}
                            className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              id={`task-${task.id}`}
                              checked={task.completed}
                              onCheckedChange={() => toggleTask(task.id)}
                              className="mt-0.5 flex-shrink-0"
                            />
                            
                            <div className="flex-1 flex flex-col min-w-0">
                              <label
                                htmlFor={`task-${task.id}`}
                                className="text-sm text-muted-foreground line-through cursor-pointer select-none truncate"
                              >
                                {task.text}
                              </label>
                              {task.deadline && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60 mt-0.5">
                                  <Clock size={12} />
                                  <span>
                                    {new Date(task.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                  </span>
                                </div>
                              )}
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTask(task.id)}
                              className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                            >
                              <Trash size={16} />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </>
                )}

                {activeTasks.length === 0 && completedTasks.length > 0 && !searchQuery && (
                  <div className="text-center py-8 px-4">
                    <div className="w-16 h-16 rounded-full bg-accent/10 mx-auto mb-4 flex items-center justify-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 10 }}
                      >
                        🎉
                      </motion.div>
                    </div>
                    <p className="text-foreground font-medium">All done!</p>
                    <p className="text-sm text-muted-foreground mt-1">Great job completing all your tasks</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <LockKey size={14} weight="fill" className="text-accent" />
              <span>Encrypted & stored locally</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="sm:hidden fixed bottom-6 right-4 z-50">
        <Button
          onClick={() => setAddOpen(o => !o)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
        >
          <motion.div animate={{ rotate: addOpen ? 45 : 0 }} transition={{ duration: 0.15 }}>
            <Plus size={24} weight="bold" />
          </motion.div>
        </Button>
      </div>
      
      <Dialog open={pinDialogMode !== null} onOpenChange={(open) => {
        if (!open) {
          setPinDialogMode(null)
          setPinDialogValue('')
          setPendingImportContent(null)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pinDialogMode === 'import' ? 'Decrypt Backup' : 'Encrypt Backup'}
            </DialogTitle>
            <DialogDescription>
              {pinDialogMode === 'import' 
                ? 'Enter the PIN used to encrypt this backup file.' 
                : 'Enter a PIN to encrypt this backup. You will need it to import these tasks later.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pinDialogValue}
              onChange={(e) => setPinDialogValue(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Enter PIN..."
              className="text-center text-xl tracking-[0.5em] font-mono h-12"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  pinDialogMode === 'import' ? handleImportConfirm() : handleExportConfirm()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => {
                setPinDialogMode(null)
                setPinDialogValue('')
                setPendingImportContent(null)
              }}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={pinDialogMode === 'import' ? handleImportConfirm : handleExportConfirm}
              disabled={pinDialogValue.length < 4}
            >
              {pinDialogMode === 'import' ? 'Import' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [databaseName, setDatabaseName] = useState('My Tasks');
  const [loadedTasks, setLoadedTasks] = useState<Task[] | null>(null);

  // Auto-lock after 5 minutes of inactivity
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_LOCK_MS = 5 * 60 * 1000;

  useEffect(() => {
    if (!isAuthenticated) return;

    const resetTimer = () => {
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = setTimeout(() => {
        clearEncryptionKey();
        setIsAuthenticated(false);
        setLoadedTasks(null);
        toast('Locked due to inactivity');
      }, AUTO_LOCK_MS);
    };

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [isAuthenticated]);

  const handleLoadFile = (tasks: Task[], fileName: string) => {
    const name = fileName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    setDatabaseName(name);
    setLoadedTasks(tasks);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return (
      <PinScreen
        onUnlock={(hash, p) => {
          setIsAuthenticated(true);
          setStoragePath(p);
          setDatabaseName('My Tasks');
          setLoadedTasks(null);
        }}
        onLoadFile={handleLoadFile}
      />
    );
  }

  return <MainApp storagePath={storagePath} databaseName={databaseName} loadedTasks={loadedTasks} />;
}