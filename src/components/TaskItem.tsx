import { useRef } from 'react'
import { Trash, Clock, DotsSixVertical } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { motion } from 'framer-motion'
import { Task } from '@/types'

export interface TaskItemProps {
  task: Task
  isCompleted?: boolean
  isEditing: boolean
  editText: string
  editDeadline: string
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onStartEdit: (task: Task) => void
  onEditTextChange: (text: string) => void
  onEditDeadlineChange: (deadline: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  dragControls?: boolean
}

export function TaskItem({
  task,
  isCompleted,
  isEditing,
  editText,
  editDeadline,
  onToggle,
  onDelete,
  onStartEdit,
  onEditTextChange,
  onEditDeadlineChange,
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
          <div className="flex-1 flex flex-col gap-2">
            <Input
              ref={editInputRef}
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit()
                if (e.key === 'Escape') onCancelEdit()
              }}
              onBlur={(e) => {
                if (!e.relatedTarget?.closest('[data-edit-deadline]')) onSaveEdit()
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
                onChange={(e) => onEditDeadlineChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEdit()
                  if (e.key === 'Escape') onCancelEdit()
                }}
                onBlur={(e) => {
                  if (!e.relatedTarget?.closest('[data-edit-deadline]') && e.relatedTarget?.tagName !== 'INPUT') onSaveEdit()
                }}
                className="h-8 w-fit text-xs bg-background"
              />
              {editDeadline && (
                <Button
                  variant="ghost"
                  size="icon"
                  data-edit-deadline
                  onClick={() => {
                    onEditDeadlineChange('')
                    requestAnimationFrame(() => editInputRef.current?.focus())
                  }}
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
                onStartEdit(task)
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
          onClick={() => onDelete(task.id)}
          className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
        >
          <Trash size={16} />
        </Button>
      </motion.div>
    </motion.div>
  )
}
