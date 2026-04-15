import { Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'

export interface AddTaskFormProps {
  newTaskText: string
  newTaskDeadline: string
  addOpen: boolean
  onTextChange: (text: string) => void
  onDeadlineChange: (deadline: string) => void
  onAdd: () => void
}

export function AddTaskForm({
  newTaskText,
  newTaskDeadline,
  addOpen,
  onTextChange,
  onDeadlineChange,
  onAdd,
}: AddTaskFormProps) {
  return (
    <>
      {/* Desktop add task form */}
      <div className="hidden sm:flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex gap-2 w-full">
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
          <Input
            type="datetime-local"
            value={newTaskDeadline}
            onChange={(e) => onDeadlineChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTaskText.trim()) onAdd()
            }}
            className="flex-shrink-0 h-10 w-fit bg-background text-sm text-foreground items-center"
            aria-label="Set a deadline (optional)"
          />
        </div>
        <Button
          onClick={onAdd}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
