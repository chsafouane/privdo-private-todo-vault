import { useState } from 'react'
import { Plus, Trash, PencilSimple, Check, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TaskList, Task } from '@/types'

interface ListSelectorProps {
  open: boolean
  onClose: () => void
  lists: TaskList[]
  tasks: Record<string, Task[]>
  activeListId: string | null
  onSelect: (listId: string) => void
  onCreate: (name: string) => void
  onRename: (listId: string, name: string) => void
  onDelete: (listId: string) => void
}

export function ListSelector({
  open,
  onClose,
  lists,
  tasks,
  activeListId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ListSelectorProps) {
  const [newListName, setNewListName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const liveLists = lists
    .filter(l => !l.deletedAt)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const handleCreate = () => {
    const name = newListName.trim()
    if (!name) return
    onCreate(name)
    setNewListName('')
  }

  const handleStartEdit = (list: TaskList) => {
    setEditingId(list.id)
    setEditName(list.name)
  }

  const handleSaveEdit = () => {
    if (!editingId) return
    const name = editName.trim()
    if (name) onRename(editingId, name)
    setEditingId(null)
    setEditName('')
  }

  const taskCount = (listId: string) => {
    const listTasks = tasks[listId] || []
    return listTasks.filter(t => !t.deletedAt && !t.completed).length
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Your Lists</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {liveLists.map(list => (
            <div
              key={list.id}
              className={`group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${
                list.id === activeListId ? 'bg-accent/10 text-accent-foreground' : 'hover:bg-muted/50'
              }`}
              onClick={() => {
                if (editingId !== list.id) {
                  onSelect(list.id)
                  onClose()
                }
              }}
            >
              {editingId === list.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="h-7 text-sm"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); handleSaveEdit() }}>
                    <Check size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setEditingId(null) }}>
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium truncate">{list.name}</span>
                  <span className="text-xs text-muted-foreground">{taskCount(list.id)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 sm:opacity-0 transition-opacity"
                    onClick={e => { e.stopPropagation(); handleStartEdit(list) }}
                  >
                    <PencilSimple size={12} />
                  </Button>
                  {liveLists.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 sm:opacity-0 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={e => { e.stopPropagation(); onDelete(list.id) }}
                    >
                      <Trash size={12} />
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Input
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="New list name..."
            className="h-9 text-sm"
          />
          <Button size="sm" onClick={handleCreate} disabled={!newListName.trim()}>
            <Plus size={14} className="mr-1" />
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
