import { Plus, ArrowsClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'

const PRIORITY_OPTIONS = [
  { label: '—', value: 0, activeClass: 'bg-muted text-foreground' },
  { label: 'Low', value: 1, activeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  { label: 'Med', value: 2, activeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  { label: 'High', value: 3, activeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
]
const RECURRENCE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'daily', label: 'D' },
  { value: 'weekly', label: 'W' },
  { value: 'monthly', label: 'M' },
]

export interface AddTaskFormProps {
  newTaskText: string
  newTaskDeadline: string
  newTaskPriority: number
  newTaskRecurrence: string
  addOpen: boolean
  onTextChange: (text: string) => void
  onDeadlineChange: (deadline: string) => void
  onPriorityChange: (priority: number) => void
  onRecurrenceChange: (recurrence: string) => void
  onAdd: () => void
}

export function AddTaskForm({
  newTaskText,
  newTaskDeadline,
  newTaskPriority,
  newTaskRecurrence,
  addOpen,
  onTextChange,
  onDeadlineChange,
  onPriorityChange,
  onRecurrenceChange,
  onAdd,
}: AddTaskFormProps) {
  return (
    <>
      {/* Desktop add task form */}
      <div className="hidden sm:flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Input
            id="new-task-input"
            value={newTaskText}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTaskText.trim()) onAdd()
            }}
            placeholder="Add a new task..."
            className="flex-1 h-10 text-sm bg-background min-w-0"
            autoFocus
          />
          <Button
            onClick={onAdd}
            disabled={!newTaskText.trim()}
            className="h-10 px-5 gap-1.5 text-sm"
          >
            <Plus size={18} weight="bold" />
            Add
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="datetime-local"
            value={newTaskDeadline}
            onChange={(e) => onDeadlineChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTaskText.trim()) onAdd()
            }}
            className="flex-shrink-0 h-8 w-fit bg-background text-xs text-foreground"
            aria-label="Set a deadline (optional)"
          />
          <div className="flex items-center gap-0.5 border rounded-md overflow-hidden">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onPriorityChange(opt.value)}
                className={`px-2 py-1 text-[10px] font-medium transition-colors ${newTaskPriority === opt.value ? opt.activeClass : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                title={opt.value === 0 ? 'No priority' : `${opt.label} priority`}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>
          {newTaskDeadline && (
            <div className="flex items-center gap-0.5 border rounded-md overflow-hidden">
              {RECURRENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onRecurrenceChange(opt.value)}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${newTaskRecurrence === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  title={opt.value ? `Repeat ${opt.value}` : 'No repeat'}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
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
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTaskText.trim()) onAdd()
                }}
                placeholder="What needs to be done?"
                className="h-10 text-sm bg-background"
                autoFocus
              />
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={newTaskDeadline}
                  onChange={(e) => onDeadlineChange(e.target.value)}
                  className="flex-1 h-9 bg-background text-sm text-foreground"
                  aria-label="Set a deadline (optional)"
                />
                <Button onClick={onAdd} disabled={!newTaskText.trim()} className="h-9 px-4 gap-1 text-sm">
                  <Plus size={16} weight="bold" />
                  Add
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5 border rounded-md overflow-hidden">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onPriorityChange(opt.value)}
                      className={`px-2 py-1 text-[10px] font-medium transition-colors ${newTaskPriority === opt.value ? opt.activeClass : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                      title={opt.value === 0 ? 'No priority' : `${opt.label} priority`}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {newTaskDeadline && (
                  <div className="flex items-center gap-0.5 border rounded-md overflow-hidden">
                    {RECURRENCE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => onRecurrenceChange(opt.value)}
                        className={`px-2 py-1 text-[10px] font-medium transition-colors ${newTaskRecurrence === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                        title={opt.value ? `Repeat ${opt.value}` : 'No repeat'}
                        type="button"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
