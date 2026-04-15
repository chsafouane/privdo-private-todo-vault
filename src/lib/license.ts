import { activateLicense, refreshToken, pullSync, pushSync, ApiError } from './apiClient'

const STORAGE_KEYS = {
  token: 'privdo-token',
  plan: 'privdo-plan',
  licenseKey: 'privdo-license-key',
  deviceId: 'privdo-device-id',
  syncVersion: 'privdo-sync-version',
  lastSync: 'privdo-last-sync',
} as const

function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEYS.deviceId)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEYS.deviceId, id)
  }
  return id
}

function getDeviceName(): string {
  const ua = navigator.userAgent
  if (/Electron/.test(ua)) return 'Desktop App'
  if (/CriOS|Chrome/.test(ua) && /Mobile/.test(ua)) return 'Chrome Mobile'
  if (/Safari/.test(ua) && /Mobile/.test(ua)) return 'Safari Mobile'
  if (/Firefox/.test(ua)) return 'Firefox'
  if (/Chrome/.test(ua)) return 'Chrome'
  return 'Browser'
}

// License management
export function getLicenseInfo() {
  return {
    token: localStorage.getItem(STORAGE_KEYS.token),
    plan: localStorage.getItem(STORAGE_KEYS.plan) || 'free',
    licenseKey: localStorage.getItem(STORAGE_KEYS.licenseKey),
    syncVersion: parseInt(localStorage.getItem(STORAGE_KEYS.syncVersion) || '0', 10),
    lastSync: localStorage.getItem(STORAGE_KEYS.lastSync),
  }
}

export function isPro(): boolean {
  return localStorage.getItem(STORAGE_KEYS.plan) === 'pro'
}

export function clearLicense() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
}

export async function activate(licenseKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const deviceId = getDeviceId()
    const deviceName = getDeviceName()
    const result = await activateLicense(licenseKey, deviceId, deviceName)

    localStorage.setItem(STORAGE_KEYS.token, result.token)
    localStorage.setItem(STORAGE_KEYS.plan, result.plan)
    localStorage.setItem(STORAGE_KEYS.licenseKey, licenseKey)

    return { success: true }
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, error: err.message }
    }
    return { success: false, error: 'Network error. Check your connection.' }
  }
}

export async function ensureValidToken(): Promise<string | null> {
  const token = localStorage.getItem(STORAGE_KEYS.token)
  if (!token) return null

  try {
    // Try to parse JWT expiry
    const payload = JSON.parse(atob(token.split('.')[1]))
    const expiresIn = payload.exp * 1000 - Date.now()

    // Refresh if expiring in less than 24 hours
    if (expiresIn < 24 * 60 * 60 * 1000) {
      const result = await refreshToken(token)
      localStorage.setItem(STORAGE_KEYS.token, result.token)
      localStorage.setItem(STORAGE_KEYS.plan, result.plan)
      return result.token
    }

    return token
  } catch {
    // Token invalid — clear and return null
    clearLicense()
    return null
  }
}

// Sync operations
export async function syncPush(encryptedBlob: string): Promise<{ success: boolean; error?: string }> {
  const token = await ensureValidToken()
  if (!token) return { success: false, error: 'Not authenticated' }

  const currentVersion = parseInt(localStorage.getItem(STORAGE_KEYS.syncVersion) || '0', 10)

  try {
    const result = await pushSync(token, encryptedBlob, currentVersion + 1)
    localStorage.setItem(STORAGE_KEYS.syncVersion, String(result.version))
    localStorage.setItem(STORAGE_KEYS.lastSync, new Date(result.syncedAt * 1000).toISOString())
    return { success: true }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return { success: false, error: 'conflict' }
      }
      if (err.status === 401 || err.status === 403) {
        clearLicense()
        return { success: false, error: 'Session expired. Please re-activate.' }
      }
      return { success: false, error: err.message }
    }
    return { success: false, error: 'Network error' }
  }
}

export async function syncPull(): Promise<{ success: boolean; encryptedBlob: string | null; error?: string }> {
  const token = await ensureValidToken()
  if (!token) return { success: false, encryptedBlob: null, error: 'Not authenticated' }

  try {
    const result = await pullSync(token)
    if (result.version > 0) {
      localStorage.setItem(STORAGE_KEYS.syncVersion, String(result.version))
    }
    if (result.syncedAt) {
      localStorage.setItem(STORAGE_KEYS.lastSync, new Date(result.syncedAt * 1000).toISOString())
    }
    return { success: true, encryptedBlob: result.encryptedBlob }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) {
        clearLicense()
        return { success: false, encryptedBlob: null, error: 'Session expired' }
      }
      return { success: false, encryptedBlob: null, error: err.message }
    }
    return { success: false, encryptedBlob: null, error: 'Network error' }
  }
}
