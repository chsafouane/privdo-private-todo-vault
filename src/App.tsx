import { useState, useEffect, useRef } from 'react'
import { Plus, Trash, LockKey, Clock, DownloadSimple, UploadSimple, Moon, Sun, TrashSimple, CaretDown } from '@phosphor-icons/react'
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
  deadline?: string
}

function MainApp({ storagePath, databaseName, loadedTasks }: { storagePath: string | null; databaseName: string; loadedTasks?: Task[] | null }) {
  const [tasks, setTasks, isReady] = useEncryptedStorage<Task[]>('tasks', [], storagePath)
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskDeadline, setNewTaskDeadline] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const isLoadedFile = !!loadedTasks

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

  const activeTasks = (tasks || []).filter(t => !t.completed)
  const completedTasks = (tasks || []).filter(t => t.completed)

  const addTask = () => {
    const trimmed = newTaskText.trim()
    if (!trimmed) return

    const newTask: Task = {
      id: Date.now().toString(),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
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
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    )
  }

  const deleteTask = (id: string) => {
    setTasks(current => (current || []).filter(task => task.id !== id))
    toast.success('Task deleted')
  }

  const clearCompleted = () => {
    setTasks(current => (current || []).filter(task => !task.completed))
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
        task.id === editingId ? { ...task, text: trimmed, deadline: editDeadline || undefined } : task
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
          <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-accent/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">{databaseName}</h1>
                  {activeTasks.length > 0 && (
                    <Badge variant="secondary" className="text-sm">
                      {activeTasks.length} active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-xs" title={isLoadedFile ? 'Loaded from file' : (storagePath || 'Browser local storage')}>
                  {isLoadedFile ? 'Loaded from file' : (storagePath || 'Browser local storage')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </Button>
                <Button variant="outline" size="icon" onClick={triggerExport} title="Export Database">
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
                  <Button variant="outline" size="icon" className="pointer-events-none">
                    <UploadSimple size={18} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-2 w-full">
                <Input
                  id="new-task-input"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTaskText.trim()) addTask()
                  }}
                  placeholder="Add a new task..."
                  className="flex-1 h-12 text-base bg-background min-w-0"
                  autoFocus
                />
                <Input
                  type="datetime-local"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTaskText.trim()) addTask()
                  }}
                  className="flex-shrink-0 h-12 w-fit bg-background text-sm text-foreground items-center"
                  aria-label="Set a deadline (optional)"
                />
              </div>
              <Button
                onClick={addTask}
                disabled={!newTaskText.trim()}
                className="h-12 w-full sm:w-auto px-6 gap-2"
              >
                <Plus size={20} weight="bold" />
                Add
              </Button>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {(tasks || []).length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Plus size={32} className="text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">No tasks yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first task above to get started</p>
              </div>
            ) : (
              <>
                {activeTasks.length > 0 && (
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {activeTasks.map((task) => (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          transition={{ duration: 0.2 }}
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.3}
                          onDragEnd={(_e, info) => {
                            if (info.offset.x < -120) deleteTask(task.id)
                          }}
                          className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors touch-pan-y"
                        >
                          <Checkbox
                            id={`task-${task.id}`}
                            checked={task.completed}
                            onCheckedChange={() => toggleTask(task.id)}
                            className="mt-0.5"
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
                                className="text-base text-foreground cursor-pointer select-none truncate"
                              >
                                {task.text}
                              </label>
                              {task.deadline && (
                                <div className="flex items-center gap-1.5 text-xs mt-1">
                                  {new Date(task.deadline).getTime() < Date.now() ? (
                                    <>
                                      <Clock size={14} weight="bold" className="text-destructive" />
                                      <span className="text-destructive font-medium">
                                        {new Date(task.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock size={14} className="text-muted-foreground" />
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
                            className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash size={18} />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {completedTasks.length > 0 && (
                  <>
                    {activeTasks.length > 0 && <Separator className="my-6" />}
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-3 mb-3">
                        <button
                          onClick={() => setCompletedCollapsed(c => !c)}
                          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <motion.div animate={{ rotate: completedCollapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
                            <CaretDown size={14} weight="bold" />
                          </motion.div>
                          Completed ({completedTasks.length})
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearCompleted}
                          className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                        >
                          <TrashSimple size={14} />
                          Clear all
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
                              className="mt-0.5"
                            />
                            
                            <div className="flex-1 flex flex-col min-w-0">
                              <label
                                htmlFor={`task-${task.id}`}
                                className="text-base text-muted-foreground line-through cursor-pointer select-none truncate"
                              >
                                {task.text}
                              </label>
                              {task.deadline && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 mt-1">
                                  <Clock size={14} />
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
                              className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash size={18} />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </>
                )}

                {activeTasks.length === 0 && completedTasks.length > 0 && (
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

          <div className="px-6 py-4 border-t border-border bg-muted/30">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <LockKey size={16} weight="fill" className="text-accent" />
              <span>All data is stored locally and encrypted on your device</span>
            </div>
          </div>
        </div>
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