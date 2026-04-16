import { useRef } from 'react'
import { Trash, Clock, DotsSixVertical, ArrowsClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { motion } from 'framer-motion'
import { Task } from '@/types'

const PRIORITY_DOT_COLORS = ['', 'bg-green-500', 'bg-yellow-500', 'bg-red-500']
const PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High']
const PRIORITY_PICKER_COLORS = ['bg-muted-foreground/30', 'bg-green-500', 'bg-yellow-500', 'bg-red-500']
const RECURRENCE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'daily', label: 'D' },
  { value: 'weekly', label: 'W' },
  { value: 'monthly', label: 'M' },
]
const RECURRENCE_LABELS: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

export interface TaskItemProps {
  task: Task
  isCompleted?: boolean
  isEditing: boolean
  editText: string
  editDeadline: string
  editPriority: number
  editRecurrence: string
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onStartEdit: (task: Task) => void
  onEditTextChange: (text: string) => void
  onEditDeadlineChange: (deadline: string) => void
  onEditPriorityChange: (priority: number) => void
  onEditRecurrenceChange: (recurrence: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  dragControls?: boolean
}

function PriorityDot({ priority, muted }: { priority?: number; muted?: boolean }) {
  if (!priority || priority === 0) return null
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT_COLORS[priority]} ${muted ? 'opacity-50' : ''}`}
      title={PRIORITY_LABELS[priority]}
    />
  )
}

function RecurrenceBadge({ recurrence, muted }: { recurrence?: string; muted?: boolean }) {
  if (!recurrence) return null
  return (
    <span className={`inline-flex items-center gap-0.5 ${muted ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} title={`Repeats ${RECURRENCE_LABELS[recurrence]?.toLowerCase()}`}>
      <ArrowsClockwise size={10} />
      <span className="text-[10px]">{RECURRENCE_LABELS[recurrence]?.[0]}</span>
    </span>
  )
}

export function TaskItem({
  task,
  isCompleted,
  isEditing,
  editText,
  editDeadline,
  editPriority,
  editRecurrence,
  onToggle,
  onDelete,
  onStartEdit,
  onEditTextChange,
  onEditDeadlineChange,
  onEditPriorityChange,
  onEditRecurrenceChange,
  onSaveEdit,
  onCancelEdit,
  dragControls,
}: TaskItemProps) {
  const editInputRef = useRef<HTMLInputElement>(null)

  if (isCompleted) {
    return (
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
          onCheckedChange={() => onToggle(task.id)}
          className="mt-0.5 flex-shrink-0"
        />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <PriorityDot priority={task.priority} muted />
            <label
              htmlFor={`task-${task.id}`}
              className="text-sm text-muted-foreground line-through cursor-pointer select-none truncate"
            >
              {task.text}
            </label>
          </div>
          {(task.deadline || task.recurrence) && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 mt-0.5">
              {task.deadline && (
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>
                    {new Date(task.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <RecurrenceBadge recurrence={task.recurrence} muted />
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(task.id)}
          className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
        >
          <Trash size={16} />
        </Button>
      </motion.div>
    )
  }

  return (
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
          if (info.offset.x < -100) onDelete(task.id)
        }}
        className="group flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-muted/50 transition-colors touch-pan-y relative"
      >
        {dragControls && (
          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none" data-drag-handle>
            <DotsSixVertical size={16} weight="bold" />
          </div>
        )}
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={() => onToggle(task.id)}
          className="mt-0.5 flex-shrink-0"
        />

        {isEditing ? (
          <div className="flex-1 flex flex-col gap-2" data-edit-area>
            <Input
              ref={editInputRef}
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit()
                if (e.key === 'Escape') onCancelEdit()
              }}
              onBlur={(e) => {
                if (!e.relatedTarget?.closest('[data-edit-area]')) onSaveEdit()
              }}
              className="flex-1 h-9"
              autoFocus
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Clock size={14} className="text-muted-foreground flex-shrink-0" />
              <Input
                type="datetime-local"
                data-edit-area
                value={editDeadline}
                onChange={(e) => onEditDeadlineChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEdit()
                  if (e.key === 'Escape') onCancelEdit()
                }}
                onBlur={(e) => {
                  if (!e.relatedTarget?.closest('[data-edit-area]')) onSaveEdit()
                }}
                className="h-8 w-fit text-xs bg-background"
              />
              {editDeadline && (
                <Button
                  variant="ghost"
                  size="icon"
                  data-edit-area
                  onClick={() => {
                    onEditDeadlineChange('')
                    onEditRecurrenceChange('')
                    requestAnimationFrame(() => editInputRef.current?.focus())
                  }}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  title="Remove deadline"
                >
                  <Trash size={12} />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1" data-edit-area>
                {PRIORITY_PICKER_COLORS.map((color, i) => (
                  <button
                    key={i}
                    data-edit-area
                    onClick={() => onEditPriorityChange(i)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${color} ${editPriority === i ? 'border-foreground scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    title={PRIORITY_LABELS[i]}
                    type="button"
                  />
                ))}
              </div>
              {editDeadline && (
                <div className="flex items-center gap-0.5 border rounded-md overflow-hidden" data-edit-area>
                  {RECURRENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      data-edit-area
                      onClick={() => onEditRecurrenceChange(opt.value)}
                      className={`px-2 py-1 text-[10px] font-medium transition-colors ${editRecurrence === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
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
        ) : (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <PriorityDot priority={task.priority} />
              <label
                htmlFor={`task-${task.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  onStartEdit(task)
                }}
                className="text-sm text-foreground cursor-pointer select-none truncate"
              >
                {task.text}
              </label>
            </div>
            {(task.deadline || task.recurrence) && (
              <div className="flex items-center gap-2 text-[11px] mt-0.5">
                {task.deadline && (
                  new Date(task.deadline).getTime() < Date.now() ? (
                    <div className="flex items-center gap-1">
                      <Clock size={12} weight="bold" className="text-destructive" />
                      <span className="text-destructive font-medium">
                        {new Date(task.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {new Date(task.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                )}
                <RecurrenceBadge recurrence={task.recurrence} />
              </div>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(task.id)}
          className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
        >
          <Trash size={16} />
        </Button>
      </motion.div>
    </motion.div>
  )
}
