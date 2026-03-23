/**
 * Date formatting and manipulation utilities
 */

import type { Expense } from '~/types'
import { format, addDays as fnsAddDays, addHours as fnsAddHours } from 'date-fns'
import { es } from 'date-fns/locale'
import { toFloatingLocalDate, toIsoZFromFloatingDate } from '~/utils/floatingDateTime'

const asFloatingDate = (date: string | Date) => {
  if (date instanceof Date) return date
  return toFloatingLocalDate(date) || new Date(date)
}

export const formatDateTime = (dateStr?: string | Date) => {
  if (!dateStr) return ''
  return format(asFloatingDate(dateStr), "PPP HH:mm", { locale: es })
}

export const formatDate = (dateStr?: string | Date) => {
  if (!dateStr) return ''
  return format(asFloatingDate(dateStr), "PPP", { locale: es })
}

export const formatTime = (dateStr?: string | Date) => {
  if (!dateStr) return ''
  return format(asFloatingDate(dateStr), "HH:mm")
}

export const formatDateFull = (dateStr?: string | Date) => {
  if (!dateStr) return ''
  return format(asFloatingDate(dateStr), "EEEE, d 'de' MMMM", { locale: es })
}

export const formatDateWithDayShort = (dateStr?: string | Date) => {
  if (!dateStr) return ''
  return format(asFloatingDate(dateStr), "EEE, dd MMM", { locale: es })
}

export const addDays = (dateStr: string, amount: number) => {
  if (!dateStr) return ''
  const date = asFloatingDate(dateStr)
  return toIsoZFromFloatingDate(fnsAddDays(date, amount))
}

export const addHours = (dateStr: string, amount: number) => {
  if (!dateStr) return ''
  const date = asFloatingDate(dateStr)
  return toIsoZFromFloatingDate(fnsAddHours(date, amount))
}

/**
 * Format date in short format (e.g., "18/05/25")
 * @param date - Date string or Date object
 * @returns Short formatted date
 */
export function formatDateShort(date: string | Date): string {
  const d = asFloatingDate(date)
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}

/**
 * Check if date is today
 * Handles both "YYYY-MM-DD HH:MM" format and ISO format
 * @param date - Date string or Date object
 * @returns True if date is today
 */
export function isToday(date: string | Date): boolean {
  const today = getCurrentDateString()

  if (typeof date === 'string') {
    // Check if it's our custom format "YYYY-MM-DD HH:MM"
    if (date.includes(' ') && !date.includes('T')) {
      const datePart = date.split(' ')[0]
      return datePart === today
    }
    // Handle ISO format or other string formats
    const d = toFloatingLocalDate(date)
    if (!d) return false
    return getDateString(d) === today
  }
  // Handle Date object
  return getDateString(date) === today
}

/**
 * Check if date is yesterday
 * Handles both "YYYY-MM-DD HH:MM" format and ISO format
 * @param date - Date string or Date object
 * @returns True if date is yesterday
 */
export function isYesterday(date: string | Date): boolean {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = getDateString(yesterday)

  if (typeof date === 'string') {
    // Check if it's our custom format "YYYY-MM-DD HH:MM"
    if (date.includes(' ') && !date.includes('T')) {
      const datePart = date.split(' ')[0]
      return datePart === yesterdayStr
    }
    // Handle ISO format or other string formats
    const d = toFloatingLocalDate(date)
    if (!d) return false
    return getDateString(d) === yesterdayStr
  }
  // Handle Date object
  return getDateString(date) === yesterdayStr
}

/**
 * Get relative day label (Today, Yesterday, or formatted date)
 * @param date - Date string or Date object
 * @returns Relative label
 */
export function getRelativeDayLabel(date: string | Date): string {
  if (isToday(date)) return 'Hoy'
  if (isYesterday(date)) return 'Ayer'
  return formatDate(date)
}

/**
 * Get number of days elapsed since start date
 * @param startDate - Start date string (ISO format)
 * @returns Number of days elapsed
 */
export function getDaysElapsed(startDate: string): number {
  const start = asFloatingDate(startDate)
  const today = new Date()
  const diffTime = today.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays) // At least 1 day
}

/**
 * Get difference in days between two dates, returned as a signed string (e.g. "+5")
 * @param start - Start date ISO string
 * @param end - End date ISO string
 * @returns Formatted string (e.g. "+5") or null if invalid/no difference
 */
export const getDayDiff = (start?: string, end?: string) => {
  if (!start || !end) return null
  const d1 = asFloatingDate(start); d1.setHours(0,0,0,0)
  const d2 = asFloatingDate(end); d2.setHours(0,0,0,0)
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? `+${diff}` : null
}

export const getDurationDays = (start?: string, end?: string) => {
  if (!start || !end) return 0
  const d1 = asFloatingDate(start); d1.setHours(0, 0, 0, 0)
  const d2 = asFloatingDate(end); d2.setHours(0, 0, 0, 0)
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff) + 1
}

/**
 * Get date string in YYYY-MM-DD format from timestamp
 * Handles both "YYYY-MM-DD HH:MM" format and ISO format
 * @param date - Date object or string timestamp
 * @returns Date in YYYY-MM-DD format
 */
export function getDateString(date: string | Date): string {
  if (typeof date === 'string') {
    // Check if it's our custom format "YYYY-MM-DD HH:MM"
    if (date.includes(' ') && !date.includes('T')) {
      return date.split(' ')[0] || date
    }
    // Handle ISO format or other string formats
    const d = asFloatingDate(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  // Handle Date object
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get current date string in YYYY-MM-DD format (local timezone)
 * This ensures the date is correct for the user's current timezone
 * @returns Current date in YYYY-MM-DD format
 */
export function getCurrentDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get current time string in HH:MM format (local timezone)
 * @returns Current time in HH:MM format
 */
export function getCurrentTimeString(): string {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Get time string from a timestamp in HH:MM format
 * Handles both "YYYY-MM-DD HH:MM" format and ISO format
 * @param date - Date object or string timestamp
 * @returns Time in HH:MM format
 */
export function getTimeString(date: string | Date): string {
  if (typeof date === 'string') {
    // Check if it's our custom format "YYYY-MM-DD HH:MM"
    if (date.includes(' ') && !date.includes('T')) {
      const timePart = date.split(' ')[1]
      return timePart || '00:00'
    }
    // Handle ISO format or other string formats
    const d = asFloatingDate(date)
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  // Handle Date object
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Get start of day timestamp (local timezone)
 * @param date - Date object or string
 * @returns Timestamp string in our format "YYYY-MM-DD 00:00"
 */
export function getStartOfDay(date: string | Date): string {
  const dateStr = getDateString(date)
  return `${dateStr} 00:00`
}

/**
 * Get end of day timestamp (local timezone)
 * @param date - Date object or string
 * @returns Timestamp string in our format "YYYY-MM-DD 23:59"
 */
export function getEndOfDay(date: string | Date): string {
  const dateStr = getDateString(date)
  return `${dateStr} 23:59`
}

/**
 * Sort expenses by timestamp (newest first)
 * Handles both "YYYY-MM-DD HH:MM" format and ISO format
 * @param expenses - Array of expenses
 * @returns Sorted array
 */
export function sortByTimestamp(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    const dateA = asFloatingDate(a.timestamp)
    const dateB = asFloatingDate(b.timestamp)
    return dateB.getTime() - dateA.getTime()
  })
}

/**
 * Get ISO string for current time
 * @returns Current timestamp as ISO string
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Parse ISO date string to Date object
 * @param isoString - ISO date string
 * @returns Date object
 */
export function parseISODate(isoString: string): Date {
  return asFloatingDate(isoString)
}
