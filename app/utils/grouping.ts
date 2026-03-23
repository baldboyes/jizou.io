/**
 * Agrupa una lista de elementos por fecha.
 * @template T Tipo de los elementos a agrupar
 * @param {T[]} items Lista de elementos a agrupar
 * @param {keyof T | ((item: T) => string | Date | undefined | null)} dateField Campo de fecha o función selectora
 * @param {(date: Date) => string} [dateFormatter] Función opcional para formatear la fecha (clave del grupo)
 * @returns {{ date: string, items: T[] }[]} Lista agrupada por fecha formateada y ordenada cronológicamente
 */

import { formatDateWithDayShort } from '~/utils/dates'
import { toFloatingLocalDate } from '~/utils/floatingDateTime'

export function groupByDate<T>(
  items: T[] | undefined | null, 
  dateField: keyof T | ((item: T) => string | Date | undefined | null),
  dateFormatter?: (date: Date) => string
): { date: string, items: T[] }[] {
  if (!items || items.length === 0) return []

  // Helper to get date object
  const getDate = (item: T): Date | null => {
    const val = typeof dateField === 'function' ? dateField(item) : item[dateField]
    if (!val) return null
    if (val instanceof Date) return val
    if (typeof val === 'string') return toFloatingLocalDate(val) || new Date(val)
    if (typeof val === 'number') return new Date(val)
    return null
  }

  // Sort by date
  const sorted = [...items].sort((a, b) => {
    const dateA = getDate(a)
    const dateB = getDate(b)
    if (!dateA && !dateB) return 0
    if (!dateA) return 1
    if (!dateB) return -1
    return dateA.getTime() - dateB.getTime()
  })

  const groups: { date: string, items: T[] }[] = []

  sorted.forEach(item => {
    const dateObj = getDate(item)
    if (!dateObj) return

    let dateStr: string
    
    if (dateFormatter) {
      dateStr = dateFormatter(dateObj)
    } else {
      dateStr = formatDateWithDayShort(dateObj)
    }

    let lastGroup = groups[groups.length - 1]
    if (!lastGroup || lastGroup.date !== dateStr) {
      lastGroup = { date: dateStr, items: [] }
      groups.push(lastGroup)
    }
    lastGroup.items.push(item)
  })

  return groups
}
