import { useState } from 'react'
import { Plus, Trash, LockKey } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useEncryptedStorage } from '@/lib/useEncryptedTasks'

interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: number
}

function App() {
  const [tasks, setTasks, isReady] = useEncryptedStorage<Task[]>('tasks', [])
  const [newTaskText, setNewTaskText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const activeTasks = (tasks || []).filter(t => !t.completed)
  const completedTasks = (tasks || []).filter(t => t.completed)

  const addTask = () => {
    const trimmed = newTaskText.trim()
    if (!trimmed) return

    const newTask: Task = {
      id: Date.now().toString(),
      text: trimmed,
      completed: false,
      createdAt: Date.now()
    }

    setTasks(current => [...(current || []), newTask])
    setNewTaskText('')
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

  const startEdit = (task: Task) => {
    setEditingId(task.id)
    setEditText(task.text)
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
        task.id === editingId ? { ...task, text: trimmed } : task
      )
    )
    setEditingId(null)
    setEditText('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
          <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-accent/5">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">My Tasks</h1>
              {activeTasks.length > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {activeTasks.length} active
                </Badge>
              )}
            </div>

            <div className="flex gap-3">
              <Input
                id="new-task-input"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTask()
                }}
                placeholder="Add a new task..."
                className="flex-1 h-12 text-base bg-background"
                autoFocus
              />
              <Button
                onClick={addTask}
                disabled={!newTaskText.trim()}
                className="h-12 px-6 gap-2"
              >
                <Plus size={20} weight="bold" />
                Add
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
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
                          className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`task-${task.id}`}
                            checked={task.completed}
                            onCheckedChange={() => toggleTask(task.id)}
                            className="mt-0.5"
                          />
                          
                          {editingId === task.id ? (
                            <Input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit()
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              onBlur={saveEdit}
                              className="flex-1 h-9"
                              autoFocus
                            />
                          ) : (
                            <label
                              htmlFor={`task-${task.id}`}
                              onClick={(e) => {
                                e.preventDefault()
                                startEdit(task)
                              }}
                              className="flex-1 text-base text-foreground cursor-pointer select-none"
                            >
                              {task.text}
                            </label>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
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
                      <h2 className="text-sm font-medium text-muted-foreground px-3 mb-3">
                        Completed ({completedTasks.length})
                      </h2>
                      <AnimatePresence mode="popLayout">
                        {completedTasks.map((task) => (
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
                            
                            <label
                              htmlFor={`task-${task.id}`}
                              className="flex-1 text-base text-muted-foreground line-through cursor-pointer select-none"
                            >
                              {task.text}
                            </label>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
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
    </div>
  )
}

export default App