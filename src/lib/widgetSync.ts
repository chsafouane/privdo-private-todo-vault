import { Capacitor } from '@capacitor/core'
import { WidgetBridgePlugin } from 'capacitor-widget-bridge'
import { Task } from '@/types'

const GROUP = 'group.com.privdo.app'
const WIDGET_KEY = 'widgetTask'
const ANDROID_WIDGET_CLASS = 'com.privdo.app.PrivdoWidget'

interface WidgetTask {
  text: string
  completed: boolean
  deadline?: string
}

let registered = false

/**
 * Pick the first active task sorted by sortOrder (matching app order).
 * Returns only truncated text to minimize plaintext exposure in shared storage.
 */
function pickWidgetTask(tasks: Task[]): WidgetTask | null {
  const active = tasks
    .filter(t => !t.completed && !t.deletedAt)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const task = active[0]
  if (!task) return null
  // Truncate text to limit plaintext exposure in widget shared storage
  const maxLen = 50
  const text = task.text.length > maxLen ? task.text.slice(0, maxLen) + '…' : task.text
  return { text, completed: false, deadline: task.deadline }
}

/**
 * Sync the widget task to native shared storage and reload widget timelines.
 * No-op on web/electron where widgets are unsupported.
 */
export async function syncWidgetData(tasks: Task[]): Promise<void> {
  const platform = Capacitor.getPlatform()
  if (platform !== 'ios' && platform !== 'android') return

  // Register Android widget class once
  if (platform === 'android' && !registered) {
    await WidgetBridgePlugin.setRegisteredWidgets({ widgets: [ANDROID_WIDGET_CLASS] })
    registered = true
  }

  const widgetTask = pickWidgetTask(tasks)

  await WidgetBridgePlugin.setItem({
    key: WIDGET_KEY,
    group: GROUP,
    value: JSON.stringify(widgetTask),
  })

  await WidgetBridgePlugin.reloadAllTimelines()
}
