import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { encryptData, decryptData, isKeySet } from '@/lib/encryption'
import { isPro, syncPush, syncPull } from '@/lib/license'
import { Task } from '@/types'

interface UseCloudSyncParams {
  tasks: Task[] | undefined
  setTasks: (updater: Task[] | ((prev: Task[] | undefined) => Task[])) => void
  isReady: boolean
}

export function useCloudSync({ tasks, setTasks, isReady }: UseCloudSyncParams) {
  const [syncing, setSyncing] = useState(false)
  const [proStatus, setProStatus] = useState(() => isPro())
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false)
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPullingRef = useRef(false)

  const handleCloudPush = async () => {
    if (!tasks || syncing || !isKeySet()) return
    setSyncing(true)
    try {
      const blob = encryptData(tasks)
      const result = await syncPush(blob)
      if (!result.success && result.error === 'conflict') {
        toast('Sync conflict detected. Cloud version was loaded — your recent local edits may have been overwritten.', {
          duration: 6000,
          action: {
            label: 'Keep local',
            onClick: () => handleCloudPush(),
          }
        })
        await handleCloudPull(false)
      } else if (!result.success) {
        // Silent fail — local data is safe
      }
    } catch {
      // Silent network error
    } finally {
      setSyncing(false)
    }
  }

  const handleCloudPull = async (silent: boolean) => {
    setSyncing(true)
    try {
      const result = await syncPull()
      if (result.success && result.encryptedBlob) {
        const pulled = decryptData(result.encryptedBlob)
        if (Array.isArray(pulled)) {
          isPullingRef.current = true
          setTasks(pulled)
          setTimeout(() => { isPullingRef.current = false }, 100)
          if (!silent) toast.success('Synced from cloud')
        }
      }
    } catch {
      if (!silent) toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  // Cloud sync: pull on mount if Pro
  useEffect(() => {
    if (!proStatus || !isReady) return
    handleCloudPull(true)
  }, [proStatus, isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cloud sync: debounced push when tasks change
  useEffect(() => {
    if (!proStatus || !isReady || !tasks || isPullingRef.current) return
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current)
    syncDebounceRef.current = setTimeout(() => {
      handleCloudPush()
    }, 3000)
    return () => { if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current) }
  }, [tasks, proStatus, isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    syncing,
    proStatus,
    setProStatus,
    licenseDialogOpen,
    setLicenseDialogOpen,
    handleCloudPush,
  }
}
