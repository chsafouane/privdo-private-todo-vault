import { Plus, ArrowsClockwise, NotePencil } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'

const PRIORITY_OPTIONS = [
  { label: '—', value: 0, activeClass: 'bg-muted text-foreground' },
  { label: 'Low', value: 1, activeClass: 'bg-priority-low-soft text-priority-low' },
  { label: 'Med', value: 2, activeClass: 'bg-priority-med-soft text-priority-med' },
  { label: 'High', value: 3, activeClass: 'bg-priority-high-soft text-priority-high' },
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
      <div className="hidden sm:flex flex-col gap-2.5">
        <div className="flex gap-2 w-full">
          <div className="relative flex-1 min-w-0">
            <NotePencil
              size={16}
              weight="bold"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
            />
            <Input
              id="new-task-input"
              value={newTaskText}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTaskText.trim()) onAdd()
              }}
              placeholder="Add a new task…"
              className="h-11 pl-10 pr-14 text-sm bg-background shadow-[var(--shadow-sm)]"
              autoFocus
            />
            {!newTaskText && (
              <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 h-5 text-[10px] font-semibold text-muted-foreground/70 bg-muted/70 border border-border rounded-md pointer-events-none">
                <span className="text-xs leading-none">⏎</span>
              </kbd>
            )}
          </div>
          <Button
            onClick={onAdd}
            disabled={!newTaskText.trim()}
            className="h-11 px-5 gap-1.5 text-sm font-semibold bg-gradient-to-br from-primary to-primary-strong text-primary-foreground shadow-[var(--shadow-brand)] ring-1 ring-inset ring-white/15 hover:brightness-105 disabled:shadow-none disabled:ring-0 disabled:bg-muted disabled:text-muted-foreground disabled:from-muted disabled:to-muted"
          >
            <Plus size={18} weight="bold" />
            Add
          </Button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
          <div className="flex items-center gap-0.5 border rounded-lg overflow-hidden bg-background">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onPriorityChange(opt.value)}
                className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${newTaskPriority === opt.value ? opt.activeClass : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                title={opt.value === 0 ? 'No priority' : `${opt.label} priority`}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>
          {newTaskDeadline && (
            <div className="flex items-center gap-0.5 border rounded-lg overflow-hidden bg-background">
              {RECURRENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onRecurrenceChange(opt.value)}
                  className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${newTaskRecurrence === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
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
