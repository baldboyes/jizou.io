const pad2 = (n: number) => String(n).padStart(2, '0')

const parseFloatingDateTimeParts = (value: string) => {
  const v = value.trim()

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return { y: Number(y), m: Number(m), d: Number(d), h: 0, min: 0, s: 0, ms: 0 }
  }

  const basic = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(v)
  if (basic) {
    const [, y, m, d, h, min, s, ms] = basic
    return {
      y: Number(y),
      m: Number(m),
      d: Number(d),
      h: Number(h),
      min: Number(min),
      s: s ? Number(s) : 0,
      ms: ms ? Number(ms.padEnd(3, '0')) : 0
    }
  }

  return null
}

export const toFloatingLocalDate = (value?: string | Date | null) => {
  if (!value) return null
  if (value instanceof Date) return value

  const v = String(value)

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(v)) {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return null
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds()
    )
  }

  const parts = parseFloatingDateTimeParts(v)
  if (!parts) return null

  return new Date(parts.y, parts.m - 1, parts.d, parts.h, parts.min, parts.s, parts.ms)
}

export const toIsoZFromFloatingInput = (value?: string | null) => {
  if (!value) return null
  const parts = parseFloatingDateTimeParts(String(value))
  if (!parts) return null

  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.min, parts.s, parts.ms)).toISOString()
}

export const toIsoZFromFloatingDate = (date: Date) => {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    )
  ).toISOString()
}

export const toDateTimeLocalInput = (value?: string | Date | null) => {
  const d = toFloatingLocalDate(value)
  if (!d) return null

  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const da = pad2(d.getDate())
  const h = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  return `${y}-${m}-${da}T${h}:${min}`
}

export const nowFloatingDateTimeLocalInput = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const da = pad2(d.getDate())
  const h = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  return `${y}-${m}-${da}T${h}:${min}`
}

export const nowFloatingIsoZ = () => {
  return toIsoZFromFloatingDate(new Date())
}
