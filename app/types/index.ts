/**
 * Application types for jizou.io
 */

export type ExpenseCategory = 'food' | 'transport' | 'accommodation' | 'entertainment' | 'shopping' | 'other'

export type PaymentMethod = 'cash' | 'card' | 'ic'

export interface Location {
  coordinates: {
    lat: number
    lng: number
  }
  city: string
  prefecture: string
}

export interface Expense {
  id: string
  timestamp: string // Format: "YYYY-MM-DD HH:MM" (no timezone, shows exactly what was entered)
  placeName: string
  amount: number // Amount in yenes
  category: ExpenseCategory
  notes: string
  location: Location
  paymentMethod: PaymentMethod
  shared: boolean
  paidByTripUserId?: number | null
  userCreatedId?: string
  status: 'real' | 'planned' // Added status field
  syncStatus?: 'synced' | 'pending' | 'error'
  photo?: string // Optional base64 or URL
}

export interface PlannedExpense {
  id: string
  plannedDate: string // ISO date string (YYYY-MM-DD)
  placeName: string
  amount: number // Amount in yenes
  category: ExpenseCategory
  notes: string
  location: Location
  paymentMethod: PaymentMethod
  shared: boolean
}

export interface TripExpense {
  id: number | string
  fecha: string
  concepto: string
  monto: number
  categoria: string
  notes: string // Renamed from descripcion
  metodo_pago: string
  es_compartido: boolean
  viaje_id: number | string
  ubicacion_lat?: number
  ubicacion_lng?: number
  ciudad?: string
  prefectura?: string
  moneda?: string
  estado?: 'real' | 'previsto'
}

export type Currency = string

export interface Budget {
  dailyLimit: number // Default: 8000 yenes
  startDate: string // ISO date string - trip start date
  currency: Currency | null // Selected currency
}

export interface AppData {
  budget: Budget
  expenses: Expense[]
  plannedExpenses: PlannedExpense[]
}

/**
 * Category metadata for UI display
 */
export interface CategoryInfo {
  key: ExpenseCategory
  label: string
  icon: string
  color: string
  borderColor: string
}

export const CATEGORIES: CategoryInfo[] = [
  { key: 'food', label: 'Comida y Bebida', icon: '🍜', color: 'bg-orange-400', borderColor: 'border-orange-400' },
  { key: 'transport', label: 'Transporte', icon: '🚇', color: 'bg-blue-400', borderColor: 'border-blue-400' },
  { key: 'accommodation', label: 'Alojamiento', icon: '🏨', color: 'bg-purple-400', borderColor: 'border-purple-400' },
  { key: 'entertainment', label: 'Entradas', icon: '⛩️', color: 'bg-pink-400', borderColor: 'border-pink-400' },
  { key: 'shopping', label: 'Compras', icon: '🛍️', color: 'bg-green-400', borderColor: 'border-green-400' },
  { key: 'other', label: 'Otros', icon: '📦', color: 'bg-neutral-400', borderColor: 'border-neutral-400' },
]

/**
 * Get category info by key
 */
export function getCategoryInfo(category: ExpenseCategory): CategoryInfo {
  const found = CATEGORIES.find(c => c.key === category)
  return found || CATEGORIES[CATEGORIES.length - 1]!
}
