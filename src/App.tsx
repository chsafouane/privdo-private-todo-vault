import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, LockKey, DownloadSimple, UploadSimple, Moon, Sun, TrashSimple, CaretDown, MagnifyingGlass, X, CloudCheck, CaretRight, List, SortAscending, SortDescending, Clock, HardDrives, FolderOpen, FileArrowDown } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { useEncryptedStorage } from '@/lib/useEncryptedTasks'
import { encryptDataWithPin, decryptDataWithPin, clearEncryptionKey } from '@/lib/encryption'
import { Task, TaskList, Vault, isValidTaskArray, isValidVault, ensureSortOrder, DEFAULT_VAULT } from '@/types'
import { PinScreen } from '@/components/PinScreen'
import { syncWidgetData } from '@/lib/widgetSync'
import { useTaskManager } from '@/hooks/useTaskManager'
import { TaskItem } from '@/components/TaskItem'
import { AddTaskForm } from '@/components/AddTaskForm'
import { PinDialog } from '@/components/PinDialog'
import { SyncSetup } from '@/components/SyncSetup'
import { SyncSettings } from '@/components/SyncSettings'
import { SyncStatusIcon } from '@/components/SyncStatusIcon'
import { useSyncEngine } from '@/hooks/useSyncEngine'
import { ListSelector } from '@/components/ListSelector'
import { Logo } from '@/components/Logo'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'

function VaultApp({ storagePath, loadedTasks }: { storagePath: string | null; loadedTasks?: Task[] | null }) {
  const [vault, setVault, isVaultReady] = useEncryptedStorage<Vault>('vault', DEFAULT_VAULT, storagePath)
  const [legacyTasks] = useEncryptedStorage<Task[]>('tasks', [], storagePath)
  const isLoadedFile = !!loadedTasks

  const [activeListId, setActiveListId] = useState<string | null>(() => localStorage.getItem('lastListId'))
  const [listSelectorOpen, setListSelectorOpen] = useState(false)

  // --- Migrate legacy single-list data into vault ---
  useEffect(() => {
    if (!isVaultReady || !vault) return
    if (vault.lists.length > 0) return // already has lists
    if (legacyTasks && legacyTasks.length > 0) {
      const listId = crypto.randomUUID()
      const now = Date.now()
      setVault({
        lists: [{ id: listId, name: 'My Tasks', createdAt: now, updatedAt: now, sortOrder: 1 }],
        tasks: { [listId]: ensureSortOrder(legacyTasks) },
      })
      setActiveListId(listId)
      localStorage.setItem('lastListId', listId)
    } else {
      // Fresh install — create default list
      const listId = crypto.randomUUID()
      const now = Date.now()
      setVault({
        lists: [{ id: listId, name: 'My Tasks', createdAt: now, updatedAt: now, sortOrder: 1 }],
        tasks: { [listId]: [] },
      })
      setActiveListId(listId)
      localStorage.setItem('lastListId', listId)
    }
  }, [isVaultReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Handle loaded file ---
  useEffect(() => {
    if (loadedTasks && loadedTasks.length > 0 && activeListId && vault) {
      setVault(v => {
        const cur = v || DEFAULT_VAULT
        return {
          ...cur,
          tasks: { ...cur.tasks, [activeListId]: loadedTasks },
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Resolve active list ---
  const liveLists = (vault?.lists || []).filter(l => !l.deletedAt)
  useEffect(() => {
    if (!vault || liveLists.length === 0) return
    if (!activeListId || !liveLists.find(l => l.id === activeListId)) {
      const fallback = liveLists[0].id
      setActiveListId(fallback)
      localStorage.setItem('lastListId', fallback)
    }
  }, [vault, activeListId, liveLists])

  const activeList = liveLists.find(l => l.id === activeListId)
  const tasks = vault?.tasks[activeListId || ''] || []

  const setTasks = useCallback((updater: Task[] | ((prev: Task[] | undefined) => Task[])) => {
    setVault(v => {
      const cur = v || DEFAULT_VAULT
      if (!activeListId) return cur
      const current = cur.tasks[activeListId] || []
      const next = typeof updater === 'function' ? updater(current) : updater
      return { ...cur, tasks: { ...cur.tasks, [activeListId]: next } }
    })
  }, [activeListId, setVault])

  // --- List CRUD ---
  const createList = useCallback((name: string) => {
    const now = Date.now()
    const maxOrder = (vault?.lists || []).reduce((max, l) => Math.max(max, l.sortOrder ?? 0), 0)
    const listId = crypto.randomUUID()
    const newList: TaskList = { id: listId, name, createdAt: now, updatedAt: now, sortOrder: maxOrder + 1 }
    setVault(v => {
      const cur = v || DEFAULT_VAULT
      return {
        ...cur,
        lists: [...cur.lists, newList],
        tasks: { ...cur.tasks, [listId]: [] },
      }
    })
    setActiveListId(listId)
    localStorage.setItem('lastListId', listId)
    toast.success('List created')
  }, [vault, setVault])

  const renameList = useCallback((listId: string, name: string) => {
    setVault(v => {
      const cur = v || DEFAULT_VAULT
      return {
        ...cur,
        lists: cur.lists.map(l => l.id === listId ? { ...l, name, updatedAt: Date.now() } : l),
      }
    })
  }, [setVault])

  const deleteList = useCallback((listId: string) => {
    const now = Date.now()
    setVault(v => {
      const cur = v || DEFAULT_VAULT
      return {
        ...cur,
        lists: cur.lists.map(l => l.id === listId ? { ...l, deletedAt: now, updatedAt: now } : l),
      }
    })
    if (activeListId === listId) {
      const remaining = liveLists.filter(l => l.id !== listId)
      if (remaining.length > 0) {
        setActiveListId(remaining[0].id)
        localStorage.setItem('lastListId', remaining[0].id)
      }
    }
    toast('List deleted')
  }, [activeListId, liveLists, setVault])

  const selectList = useCallback((listId: string) => {
    setActiveListId(listId)
    localStorage.setItem('lastListId', listId)
  }, [])

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  // Mobile FAB
  const [addOpen, setAddOpen] = useState(false)

  // Task CRUD hook
  const {
    newTaskText, setNewTaskText, newTaskDeadline, setNewTaskDeadline,
    newTaskPriority, setNewTaskPriority, newTaskRecurrence, setNewTaskRecurrence,
    editingId, editText, setEditText, editDeadline, setEditDeadline,
    editPriority, setEditPriority, editRecurrence, setEditRecurrence,
    undoTimeoutRef,
    addTask: addTaskBase, toggleTask, deleteTask, clearCompleted,
    startEdit, saveEdit, cancelEdit,
  } = useTaskManager({ tasks, setTasks })

  // Sync engine — operates on the full vault
  const {
    syncConfig,
    syncState,
    performSync,
    setupPassphraseSync,
    setupEmailSync,
    disconnect: disconnectSync,
  } = useSyncEngine(vault, setVault, isVaultReady)

  const [syncSetupOpen, setSyncSetupOpen] = useState(false)
  const [syncSettingsOpen, setSyncSettingsOpen] = useState(false)

  const addTask = () => {
    addTaskBase()
    setAddOpen(false)
  }

  const [pinDialogMode, setPinDialogMode] = useState<'export' | 'import' | null>(null)
  const [pinDialogValue, setPinDialogValue] = useState('')
  const [pendingImportContent, setPendingImportContent] = useState<any>(null)
  const [completedCollapsed, setCompletedCollapsed] = useState(true)
  const [deadlineSortAsc, setDeadlineSortAsc] = useState(() => {
    return localStorage.getItem('deadlineSortAsc') !== 'false'
  })
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
              new Notification("Privdo: Task deadline passed", {
                body: "A task deadline has passed. Open the app to check.",
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

  // Widget sync effect — always sync to native shared storage when tasks change
  useEffect(() => {
    if (!tasks) return
    syncWidgetData(tasks).catch(() => { /* silent on web/unsupported */ })
  }, [tasks])

  // Migrate tasks without sortOrder on load
  useEffect(() => {
    if (!tasks || tasks.length === 0) return
    const migrated = ensureSortOrder(tasks)
    if (migrated !== tasks) setTasks(migrated)
  }, [isVaultReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prune tombstones older than 30 days on mount
  useEffect(() => {
    if (!tasks || tasks.length === 0) return
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const hasOldTombstones = tasks.some(t => t.deletedAt && t.deletedAt < thirtyDaysAgo)
    if (hasOldTombstones) {
      setTasks(current => (current || []).filter(t => !t.deletedAt || t.deletedAt >= thirtyDaysAgo))
    }
  }, [isVaultReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const liveTasks = (tasks || []).filter(t => !t.deletedAt)

  const filterBySearch = useCallback((list: Task[]) => {
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(t => t.text.toLowerCase().includes(q))
  }, [searchQuery])

  const sortByOrder = useCallback((list: Task[]) => {
    return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [])

  const activeTasks = sortByOrder(filterBySearch(liveTasks.filter(t => !t.completed)))
  const completedTasks = sortByOrder(filterBySearch(liveTasks.filter(t => t.completed)))

  const scheduledTasks = activeTasks
    .filter(t => t.deadline)
    .sort((a, b) => {
      const dateA = new Date(a.deadline!).getTime()
      const dateB = new Date(b.deadline!).getTime()
      const dateCompare = deadlineSortAsc ? dateA - dateB : dateB - dateA
      if (dateCompare !== 0) return dateCompare
      return (b.priority ?? 0) - (a.priority ?? 0)
    })
  const unscheduledTasks = activeTasks.filter(t => !t.deadline)

  const toggleDeadlineSort = useCallback(() => {
    setDeadlineSortAsc(prev => {
      const next = !prev
      localStorage.setItem('deadlineSortAsc', String(next))
      return next
    })
  }, [])

  const handleReorder = useCallback((reordered: Task[]) => {
    const now = Date.now()
    const updates = new Map<string, number>()
    reordered.forEach((t, i) => updates.set(t.id, i + 1))
    setTasks(current =>
      (current || []).map(t => {
        const newOrder = updates.get(t.id)
        if (newOrder != null && newOrder !== t.sortOrder) {
          return { ...t, sortOrder: newOrder, updatedAt: now }
        }
        return t
      })
    )
  }, [setTasks])

  const triggerExport = () => {
    if (!vault || vault.lists.length === 0) {
      toast.error('No data to export')
      return
    }
    setPinDialogValue('')
    setPinDialogMode('export')
  }

  const handleExportConfirm = async () => {
    if (!vault || !pinDialogValue.trim()) return
    const encrypted = await encryptDataWithPin(vault, pinDialogValue)
    const exportObject = {
      version: 2,
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
  
  const handleImportConfirm = async () => {
    if (!pendingImportContent || !pinDialogValue.trim()) return
    const fileContent = pendingImportContent
    
    // Handle encrypted backups
    if (fileContent && fileContent.encryptedData) {
      const decrypted = await decryptDataWithPin(fileContent.encryptedData, pinDialogValue)
      if (isValidVault(decrypted)) {
        setVault(decrypted)
        toast.success('Vault imported successfully')
        setPinDialogMode(null)
        setPinDialogValue('')
        setPendingImportContent(null)
      } else if (isValidTaskArray(decrypted)) {
        // Legacy Task[] backup — import into current list
        setTasks(decrypted)
        toast.success('Tasks imported into current list')
        setPinDialogMode(null)
        setPinDialogValue('')
        setPendingImportContent(null)
      } else {
        toast.error('Decryption failed. Invalid PIN or corrupted backup.')
      }
    } 
    // Fallback for unencrypted
    else if (isValidVault(fileContent)) {
      setVault(fileContent)
      toast.success('Vault imported successfully')
      setPinDialogMode(null)
      setPinDialogValue('')
      setPendingImportContent(null)
    } else if (isValidTaskArray(fileContent)) {
      setTasks(fileContent)
      toast.success('Tasks imported into current list')
      setPinDialogMode(null)
      setPinDialogValue('')
      setPendingImportContent(null)
    } else {
      toast.error('Invalid backup format')
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
        } else if (isValidVault(fileContent)) {
          setVault(fileContent)
          toast.success('Vault imported successfully')
        } else if (isValidTaskArray(fileContent)) {
          setTasks(fileContent)
          toast.success('Tasks imported into current list')
        } else {
          toast.error('Invalid backup format')
        }
      } catch (err) {
        toast.error('Failed to parse database file')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const handlePinDialogClose = () => {
    setPinDialogMode(null)
    setPinDialogValue('')
    setPendingImportContent(null)
  }

  const handlePinDialogConfirm = () => {
    if (pinDialogMode === 'import') {
      handleImportConfirm()
    } else {
      handleExportConfirm()
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-stretch sm:items-center sm:py-6 md:py-10">
      <div className="flex-1 sm:flex-initial flex flex-col w-full max-w-2xl mx-auto bg-card sm:rounded-2xl sm:shadow-[var(--shadow-lg)] sm:border sm:border-border/60 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header — two-row layout */}
          <div className="px-5 pt-5 pb-4 border-b border-border/70 bg-surface-1">
            {/* Row 1: brand + icon cluster */}
            <div className="flex items-center justify-between mb-4">
              <Logo size="md" showWordmark />
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => { setSearchOpen(o => !o); setSearchQuery('') }} title="Search">
                  <MagnifyingGlass size={18} />
                </Button>
                <SyncStatusIcon
                  status={syncConfig?.enabled ? syncState.status : 'disabled'}
                  onClick={() => syncConfig?.enabled ? setSyncSettingsOpen(true) : setSyncSetupOpen(true)}
                />
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={triggerExport} title="Export">
                  <DownloadSimple size={18} />
                </Button>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".json"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={triggerImport}
                    title="Import Database"
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg pointer-events-none">
                    <UploadSimple size={18} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 2: list title + count + storage chip */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button
                onClick={() => setListSelectorOpen(true)}
                className="group flex items-center gap-1.5 min-w-0 text-left transition-colors"
                title="Switch list"
              >
                <h1 className="text-2xl font-bold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                  {activeList?.name || 'My Tasks'}
                </h1>
                <CaretRight size={16} weight="bold" className="text-muted-foreground/70 group-hover:text-primary transition-colors flex-shrink-0" />
                {activeTasks.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 flex-shrink-0 rounded-full px-2 h-5 text-[11px] font-semibold">
                    {activeTasks.length}
                  </Badge>
                )}
              </button>
              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent bg-accent-soft px-2.5 py-1 rounded-full max-w-full truncate"
                title={isLoadedFile ? 'Loaded from file' : (storagePath || 'Browser local storage')}
              >
                {isLoadedFile ? (
                  <><FileArrowDown size={12} weight="bold" /><span className="truncate">Loaded from file</span></>
                ) : storagePath ? (
                  <><FolderOpen size={12} weight="bold" /><span className="truncate">{storagePath}</span></>
                ) : (
                  <><HardDrives size={12} weight="bold" /><span className="truncate">Local vault</span></>
                )}
              </div>
            </div>

            {/* Search bar (expandable) */}
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 mt-4">
                    <div className="relative flex-1">
                      <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search tasks..."
                        className="h-10 pl-9 text-sm bg-background"
                        autoFocus
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4">
              <AddTaskForm
                newTaskText={newTaskText}
                newTaskDeadline={newTaskDeadline}
                newTaskPriority={newTaskPriority}
                newTaskRecurrence={newTaskRecurrence}
                addOpen={addOpen}
                onTextChange={setNewTaskText}
                onDeadlineChange={setNewTaskDeadline}
                onPriorityChange={setNewTaskPriority}
                onRecurrenceChange={setNewTaskRecurrence}
                onAdd={addTask}
              />
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-24 sm:pb-4">
            {liveTasks.length === 0 ? (
              <EmptyState
                size="lg"
                icon={<Logo size="xl" />}
                title="Your vault is empty"
                description="Add your first task above — everything is encrypted and stays on this device."
              />
            ) : activeTasks.length === 0 && completedTasks.length === 0 && searchQuery ? (
              <EmptyState
                icon={
                  <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center">
                    <MagnifyingGlass size={22} className="text-muted-foreground" />
                  </div>
                }
                title="No matching tasks"
                description="Try a different search term"
              />
            ) : (
              <>
                {activeTasks.length > 0 && (
                  <>
                    {scheduledTasks.length > 0 && (
                      <div className="space-y-1">
                        <SectionHeader
                          icon={Clock}
                          title="Upcoming"
                          count={scheduledTasks.length}
                          action={
                            <button
                              onClick={toggleDeadlineSort}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-2"
                              title={deadlineSortAsc ? 'Earliest first' : 'Latest first'}
                            >
                              {deadlineSortAsc ? <SortAscending size={14} /> : <SortDescending size={14} />}
                            </button>
                          }
                        />
                        <AnimatePresence mode="popLayout">
                          {scheduledTasks.map((task) => (
                            <TaskItem
                              key={task.id}
                              task={task}
                              isEditing={editingId === task.id}
                              editText={editText}
                              editDeadline={editDeadline}
                              editPriority={editPriority}
                              editRecurrence={editRecurrence}
                              onToggle={toggleTask}
                              onDelete={deleteTask}
                              onStartEdit={startEdit}
                              onEditTextChange={setEditText}
                              onEditDeadlineChange={setEditDeadline}
                              onEditPriorityChange={setEditPriority}
                              onEditRecurrenceChange={setEditRecurrence}
                              onSaveEdit={saveEdit}
                              onCancelEdit={cancelEdit}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}

                    {scheduledTasks.length > 0 && unscheduledTasks.length > 0 && (
                      <div className="h-2" aria-hidden />
                    )}

                    {unscheduledTasks.length > 0 && (
                      <div className="space-y-1">
                        {scheduledTasks.length > 0 && (
                          <SectionHeader
                            icon={List}
                            title="Other"
                            count={unscheduledTasks.length}
                          />
                        )}
                        <Reorder.Group axis="y" values={unscheduledTasks} onReorder={handleReorder} className="space-y-1" as="div">
                          {unscheduledTasks.map((task) => (
                            <Reorder.Item key={task.id} value={task} as="div" className="list-none">
                              <TaskItem
                                task={task}
                                isEditing={editingId === task.id}
                                editText={editText}
                                editDeadline={editDeadline}
                                editPriority={editPriority}
                                editRecurrence={editRecurrence}
                                onToggle={toggleTask}
                                onDelete={deleteTask}
                                onStartEdit={startEdit}
                                onEditTextChange={setEditText}
                                onEditDeadlineChange={setEditDeadline}
                                onEditPriorityChange={setEditPriority}
                                onEditRecurrenceChange={setEditRecurrence}
                                onSaveEdit={saveEdit}
                                onCancelEdit={cancelEdit}
                                dragControls
                              />
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      </div>
                    )}
                  </>
                )}

                {completedTasks.length > 0 && (
                  <>
                    {activeTasks.length > 0 && <Separator className="my-5 opacity-60" />}

                    <div className="space-y-1 opacity-80">
                      <div className="flex items-center justify-between px-3 mb-2">
                        <button
                          onClick={() => setCompletedCollapsed(c => !c)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <motion.div animate={{ rotate: completedCollapsed ? -90 : 0 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}>
                            <CaretDown size={12} weight="bold" />
                          </motion.div>
                          Completed <span className="text-muted-foreground/60 font-medium normal-case tracking-normal">· {completedTasks.length}</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearCompleted}
                          className="h-7 text-[11px] text-muted-foreground hover:text-destructive gap-1 rounded-md"
                        >
                          <TrashSimple size={12} />
                          Clear
                        </Button>
                      </div>
                      <AnimatePresence mode="popLayout">
                        {!completedCollapsed && completedTasks.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            isCompleted
                            isEditing={false}
                            editText=""
                            editDeadline=""
                            editPriority={0}
                            editRecurrence=""
                            onToggle={toggleTask}
                            onDelete={deleteTask}
                            onStartEdit={startEdit}
                            onEditTextChange={setEditText}
                            onEditDeadlineChange={setEditDeadline}
                            onEditPriorityChange={setEditPriority}
                            onEditRecurrenceChange={setEditRecurrence}
                            onSaveEdit={saveEdit}
                            onCancelEdit={cancelEdit}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </>
                )}

                {activeTasks.length === 0 && completedTasks.length > 0 && !searchQuery && (
                  <EmptyState
                    size="sm"
                    icon={
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                        className="w-16 h-16 rounded-2xl bg-accent-soft text-accent flex items-center justify-center text-2xl"
                      >
                        🎉
                      </motion.div>
                    }
                    title="All done!"
                    description="Great job completing all your tasks"
                  />
                )}
              </>
            )}
          </div>

          {/* Footer — privacy value prop as a brand moment */}
          <div className="px-5 py-3.5 border-t border-border/70 bg-surface-1">
            <div className="flex items-center justify-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-accent font-medium">
                <LockKey size={14} weight="fill" />
                <span>Encrypted · stored on this device</span>
              </div>
              {syncConfig?.enabled && (
                <>
                  <span className="text-border" aria-hidden>•</span>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CloudCheck size={14} weight="fill" className="text-accent" />
                    <span>End-to-end synced</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="sm:hidden fixed bottom-6 right-4 z-50">
        <Button
          onClick={() => setAddOpen(o => !o)}
          size="icon"
          className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary-strong text-primary-foreground shadow-[var(--shadow-brand)] ring-1 ring-inset ring-white/15 hover:brightness-105 active:brightness-95"
        >
          <motion.div animate={{ rotate: addOpen ? 45 : 0 }} transition={{ duration: 0.18, ease: [0.3, 0, 0, 1] }}>
            <Plus size={26} weight="bold" />
          </motion.div>
        </Button>
      </div>
      
      <PinDialog
        mode={pinDialogMode}
        pinValue={pinDialogValue}
        onPinChange={setPinDialogValue}
        onClose={handlePinDialogClose}
        onConfirm={handlePinDialogConfirm}
      />

      <SyncSetup
        open={syncSetupOpen}
        onClose={() => setSyncSetupOpen(false)}
        onPassphraseSetup={async (passphrase) => {
          await setupPassphraseSync(passphrase)
          toast.success('Sync enabled')
        }}
        onEmailSetup={async (email, password) => {
          await setupEmailSync(email, password)
          toast.success('Sync enabled')
        }}
      />

      <SyncSettings
        open={syncSettingsOpen}
        onClose={() => setSyncSettingsOpen(false)}
        syncConfig={syncConfig}
        syncStatus={syncState.status}
        lastSyncAt={syncState.lastSyncAt}
        error={syncState.error}
        onSync={performSync}
        onDisconnect={() => {
          disconnectSync()
          toast('Sync disconnected')
        }}
        onSetup={() => setSyncSetupOpen(true)}
      />

      <ListSelector
        open={listSelectorOpen}
        onClose={() => setListSelectorOpen(false)}
        lists={vault?.lists || []}
        tasks={vault?.tasks || {}}
        activeListId={activeListId}
        onSelect={selectList}
        onCreate={createList}
        onRename={renameList}
        onDelete={deleteList}
      />
    </div>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);
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

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [isAuthenticated]);

  const handleLoadFile = (tasks: Task[], fileName: string) => {
    setLoadedTasks(tasks);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return (
      <PinScreen
        onUnlock={(hash, p) => {
          setIsAuthenticated(true);
          setStoragePath(p);
          setLoadedTasks(null);
        }}
        onLoadFile={handleLoadFile}
      />
    );
  }

  return <VaultApp storagePath={storagePath} loadedTasks={loadedTasks} />;
}