const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.privdo.app'

interface ApiOptions {
  method?: string
  body?: any
  token?: string | null
}

class ApiError extends Error {
  status: number
  data: any

  constructor(status: number, data: any) {
    super(data?.error || `API error ${status}`)
    this.status = status
    this.data = data
  }
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options
  const headers: Record<string, string> = {}

  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(res.status, data)
  }

  return data as T
}

// Auth
export function activateLicense(licenseKey: string, deviceId: string, deviceName: string) {
  return request<{ token: string; userId: string; plan: string; expiresAt: string | null }>(
    '/auth/activate',
    { method: 'POST', body: { licenseKey, deviceId, deviceName } }
  )
}

export function refreshToken(token: string) {
  return request<{ token: string; plan: string; expiresAt: string | null }>(
    '/auth/refresh',
    { method: 'POST', token }
  )
}

export function getDevices(token: string) {
  return request<{ devices: Array<{ id: string; name: string; last_sync_at: number | null; created_at: number }> }>(
    '/auth/devices',
    { token }
  )
}

export function removeDevice(token: string, deviceId: string) {
  return request<{ deleted: boolean }>(
    `/auth/devices/${deviceId}`,
    { method: 'DELETE', token }
  )
}

// Sync
export function pullSync(token: string) {
  return request<{ encryptedBlob: string | null; version: number; syncedAt: number | null }>(
    '/sync',
    { token }
  )
}

export function pushSync(token: string, encryptedBlob: string, version: number) {
  return request<{ version: number; syncedAt: number }>(
    '/sync',
    { method: 'PUT', token, body: { encryptedBlob, version } }
  )
}

export { ApiError }
