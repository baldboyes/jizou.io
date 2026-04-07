export function getOfflineUserId() {
  if (typeof window === 'undefined') return null
  try {
    const { userId } = useAuth()
    const id = userId.value ? String(userId.value) : null
    return id
  } catch {
    return null
  }
}

export function buildOfflineKey(userId: string, parts: Array<string | number>) {
  const safe = parts.map(p => String(p).replace(/[:\s]/g, '_')).join(':')
  return `offline:${userId}:${safe}`
}

export function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const a = Math.random().toString(16).slice(2)
  const b = Date.now().toString(16)
  return `${b}-${a}`
}
