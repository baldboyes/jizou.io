import { createItem, updateItem, deleteItem } from '@directus/sdk'
import type { Expense as DirectusExpense } from '~/types/directus'
import type { Expense as AppExpense, ExpenseCategory, PaymentMethod } from '~/types'

export const useExpensesNew = () => {
  const { getClient } = useDirectusRepo()
  const expenses = useState<AppExpense[]>('expenses-new', () => [])
  const loading = useState<boolean>('expenses-new-loading', () => false)
  const error = useState<string | null>('expenses-new-error', () => null)

  // --- Mappers ---
  const mapDirectusToApp = (e: DirectusExpense): AppExpense => ({
    id: String(e.id),
    timestamp: e.date, // Directus ISO -> App ISO/String
    placeName: e.concept,
    amount: e.amount,
    category: e.category as ExpenseCategory,
    notes: e.notes || '',
    location: {
      coordinates: {
        lat: e.location_lat || 0,
        lng: e.location_lng || 0
      },
      city: e.city || '',
      prefecture: e.prefectura || ''
    },
    paymentMethod: e.payment_method as PaymentMethod,
    shared: e.is_shared,
    paidByTripUserId: typeof (e as any).paid_by_trip_user_id === 'object'
      ? Number(((e as any).paid_by_trip_user_id as any)?.id ?? 0) || null
      : (typeof (e as any).paid_by_trip_user_id === 'number' ? (e as any).paid_by_trip_user_id : null),
    userCreatedId: (e as any).user_created ? String((e as any).user_created) : undefined,
    status: e.expense_status || 'real',
    // photo: e.photo // TODO: Handle attachments if needed
  })

  const mapAppToDirectus = (e: Partial<AppExpense>): Partial<DirectusExpense> => {
    const payload: Partial<DirectusExpense> = {}
    if (e.timestamp) payload.date = e.timestamp
    if (e.placeName) payload.concept = e.placeName
    if (e.amount !== undefined) payload.amount = e.amount
    if (e.category) payload.category = e.category
    if (e.notes !== undefined) payload.notes = e.notes
    if (e.location) {
      payload.location_lat = e.location.coordinates.lat
      payload.location_lng = e.location.coordinates.lng
      payload.city = e.location.city
      payload.prefectura = e.location.prefecture
    }
    if (e.paymentMethod) payload.payment_method = e.paymentMethod
    if (e.shared !== undefined) payload.is_shared = e.shared
    if (e.paidByTripUserId !== undefined) (payload as any).paid_by_trip_user_id = e.paidByTripUserId
    if (e.status) payload.expense_status = e.status
    return payload
  }

  // --- Actions ---

  const fetchExpenses = async (tripId: number | string) => {
    loading.value = true
    error.value = null
    try {
      const apiRes = await $fetch('/api/trips/expenses', {
        method: 'GET',
        query: { tripId: Number(tripId) }
      }).catch(() => null) as any

      const result = Array.isArray(apiRes?.expenses) ? apiRes.expenses : []
      
      if (Array.isArray(result)) {
        expenses.value = result.map(mapDirectusToApp)
      } else {
        expenses.value = []
      }
    } catch (e: any) {
      console.error('Error fetching expenses (new):', e)
      error.value = e.message || 'Error al cargar los gastos'
    } finally {
      loading.value = false
    }
  }

  const createExpense = async (expense: Omit<AppExpense, 'id'> & { trip_id: number | string }) => {
    loading.value = true
    error.value = null
    try {
      const client = await getClient()
      const payload = {
        ...mapAppToDirectus(expense),
        trip_id: Number(expense.trip_id),
        status: 'published' // Default status
      }
      
      const result = await client.request(createItem('expenses', payload as any))
      const newExpense = mapDirectusToApp(result as DirectusExpense)
      
      expenses.value.unshift(newExpense)
      return newExpense
    } catch (e: any) {
      console.error('Error creating expense (new):', e)
      error.value = e.message || 'Error al crear el gasto'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateExpense = async (id: string | number, updates: Partial<AppExpense>) => {
    loading.value = true
    error.value = null
    try {
      const client = await getClient()
      const payload = mapAppToDirectus(updates)
      
      const result = await client.request(updateItem('expenses', Number(id), payload as any))
      const updatedExpense = mapDirectusToApp(result as DirectusExpense)

      const index = expenses.value.findIndex(e => e.id === String(id))
      if (index !== -1) {
        expenses.value[index] = updatedExpense
      }
      return updatedExpense
    } catch (e: any) {
      console.error('Error updating expense (new):', e)
      error.value = e.message || 'Error al actualizar el gasto'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteExpense = async (id: string | number) => {
    loading.value = true
    error.value = null
    try {
      const client = await getClient()
      await client.request(deleteItem('expenses', Number(id)))
      expenses.value = expenses.value.filter(e => e.id !== String(id))
    } catch (e: any) {
      console.error('Error deleting expense (new):', e)
      error.value = e.message || 'Error al eliminar el gasto'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense
  }
}
