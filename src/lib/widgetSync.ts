import { Capacitor } from '@capacitor/core'
import { WidgetBridgePlugin } from 'capacitor-widget-bridge'

const GROUP = 'group.com.privdo.app'
const WIDGET_KEY = 'widgetTask'
const ANDROID_WIDGET_CLASS = 'com.privdo.app.PrivdoWidget'

interface WidgetTask {
  text: string
  completed: boolean
  deadline?: string
}

interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: number
  updatedAt: number
  deadline?: string
  deletedAt?: number
}

let registered = false

/**
 * Pick the first active task sorted by nearest deadline.
 */
function pickWidgetTask(tasks: Task[]): WidgetTask | null {
  const active = tasks
    .filter(t => !t.completed && !t.deletedAt)
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return a.createdAt - b.createdAt
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })

  const task = active[0]
  if (!task) return null
  return { text: task.text, completed: false, deadline: task.deadline }
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
