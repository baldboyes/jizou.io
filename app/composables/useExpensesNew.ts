import { createItem, updateItem, deleteItem, readItems } from '@directus/sdk'
import type { Expense as DirectusExpense } from '~/types/directus'
import type { Expense as AppExpense, ExpenseCategory, PaymentMethod } from '~/types'
import { offlineKvGet, offlineKvSet, offlineOutboxDelete, offlineOutboxListExpenseCreatesForTrip, offlineOutboxPut } from '~/utils/offlineDb'
import { buildOfflineKey, createClientId, getOfflineUserId } from '~/utils/offlineKeys'

export const useExpensesNew = () => {
  const { getClient, resetAuth } = useDirectusRepo()
  const expenses = useState<AppExpense[]>('expenses-new', () => [])
  const loading = useState<boolean>('expenses-new-loading', () => false)
  const error = useState<string | null>('expenses-new-error', () => null)
  const pendingCreateCountByTrip = useState<Record<string, number>>('expenses-new-pending-create-count-by-trip', () => ({}))

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

  const refreshPendingCreateCount = async (tripId: number | string) => {
    const userId = getOfflineUserId()
    const tripIdNum = Number(tripId)
    if (!userId || !Number.isFinite(tripIdNum) || tripIdNum <= 0) return 0
    const list = await offlineOutboxListExpenseCreatesForTrip(userId, tripIdNum)
    pendingCreateCountByTrip.value[String(tripIdNum)] = list.length
    return list.length
  }

  const isNetworkError = (e: any) => {
    const msg = String(e?.message || '')
    return msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('offline') || msg.includes('fetch')
  }

  const fetchExpenses = async (tripId: number | string) => {
    loading.value = true
    error.value = null
    try {
      const userId = getOfflineUserId()
      const tripIdNum = Number(tripId)
      if (userId && Number.isFinite(tripIdNum) && tripIdNum > 0) {
        const cached = await offlineKvGet<AppExpense[]>(buildOfflineKey(userId, ['trip', tripIdNum, 'expenses']))
        if (Array.isArray(cached)) expenses.value = cached
        await refreshPendingCreateCount(tripIdNum)
      }

      const apiRes = await $fetch('/api/trips/expenses', {
        method: 'GET',
        query: { tripId: Number(tripId) }
      }) as any

      if (Array.isArray(apiRes?.expenses)) {
        const server = apiRes.expenses.map(mapDirectusToApp)
        const pending = expenses.value.filter(e => e.syncStatus === 'pending' || String(e.id).startsWith('local:'))
        const merged = [...pending, ...server]
        expenses.value = merged
        if (userId && Number.isFinite(tripIdNum) && tripIdNum > 0) {
          await offlineKvSet(buildOfflineKey(userId, ['trip', tripIdNum, 'expenses']), merged)
        }
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
      const userId = getOfflineUserId()
      const tripIdNum = Number(expense.trip_id)
      const clientGeneratedId = createClientId()

      if (import.meta.client && navigator && navigator.onLine === false) {
        const localId = `local:${clientGeneratedId}`
        const { trip_id: _tripId, ...rest } = expense as any
        const localExpense = {
          ...rest,
          id: localId,
          syncStatus: 'pending'
        } as any as AppExpense

        expenses.value.unshift(localExpense)

        if (userId && Number.isFinite(tripIdNum) && tripIdNum > 0) {
          await offlineKvSet(buildOfflineKey(userId, ['trip', tripIdNum, 'expenses']), expenses.value)
          await offlineOutboxPut({
            id: createClientId(),
            userId,
            tripId: tripIdNum,
            kind: 'expense.create',
            localId,
            clientGeneratedId,
            payload: {
              ...mapAppToDirectus(expense),
              trip_id: tripIdNum,
              status: 'published',
              client_generated_id: clientGeneratedId
            },
            createdAt: Date.now(),
            lastError: null
          })
          await refreshPendingCreateCount(tripIdNum)
        }

        return localExpense
      }

      const client = await getClient()
      const payload = {
        ...mapAppToDirectus(expense),
        trip_id: Number(expense.trip_id),
        status: 'published',
        client_generated_id: clientGeneratedId
      }
      
      let result: any
      try {
        result = await client.request(createItem('expenses', payload as any))
      } catch (e: any) {
        const code = e?.errors?.[0]?.extensions?.code
        if (code === 'INVALID_CREDENTIALS') {
          resetAuth()
          const fresh = await getClient()
          result = await fresh.request(createItem('expenses', payload as any))
        } else {
          throw e
        }
      }
      const newExpense = mapDirectusToApp(result as DirectusExpense)
      
      expenses.value.unshift(newExpense)
      if (userId && Number.isFinite(tripIdNum) && tripIdNum > 0) {
        await offlineKvSet(buildOfflineKey(userId, ['trip', tripIdNum, 'expenses']), expenses.value)
        await refreshPendingCreateCount(tripIdNum)
      }
      return newExpense
    } catch (e: any) {
      console.error('Error creating expense (new):', e)
      if (isNetworkError(e)) {
        try {
          const userId = getOfflineUserId()
          const tripIdNum = Number(expense.trip_id)
          const clientGeneratedId = createClientId()
          const localId = `local:${clientGeneratedId}`
          const { trip_id: _tripId, ...rest } = expense as any
          const localExpense = {
            ...rest,
            id: localId,
            syncStatus: 'pending'
          } as any as AppExpense

          expenses.value.unshift(localExpense)

          if (userId && Number.isFinite(tripIdNum) && tripIdNum > 0) {
            await offlineKvSet(buildOfflineKey(userId, ['trip', tripIdNum, 'expenses']), expenses.value)
            await offlineOutboxPut({
              id: createClientId(),
              userId,
              tripId: tripIdNum,
              kind: 'expense.create',
              localId,
              clientGeneratedId,
              payload: {
                ...mapAppToDirectus(expense),
                trip_id: tripIdNum,
                status: 'published',
                client_generated_id: clientGeneratedId
              },
              createdAt: Date.now(),
              lastError: null
            })
            await refreshPendingCreateCount(tripIdNum)
          }

          return localExpense
        } catch (fallbackError) {
          throw e
        }
      }

      error.value = e.message || 'Error al crear el gasto'
      throw e
    } finally {
      loading.value = false
    }
  }

  const syncPendingExpenseCreates = async (tripId: number | string) => {
    const userId = getOfflineUserId()
    const tripIdNum = Number(tripId)
    if (!userId || !Number.isFinite(tripIdNum) || tripIdNum <= 0) return 0

    const items = await offlineOutboxListExpenseCreatesForTrip(userId, tripIdNum)
    if (!items.length) {
      pendingCreateCountByTrip.value[String(tripIdNum)] = 0
      return 0
    }

    const client = await getClient()
    let synced = 0

    for (const item of items) {
      try {
        const created = await client.request(createItem('expenses', item.payload as any))
        const app = mapDirectusToApp(created as DirectusExpense)
        const index = expenses.value.findIndex(e => e.id === item.localId)
        if (index !== -1) expenses.value[index] = app
        await offlineOutboxDelete(item.id)
        synced += 1
      } catch (e: any) {
        const msg = String(e?.message || '')
        const isUnique = msg.includes('unique') || msg.includes('duplicate') || msg.includes('already exists')
        if (isUnique) {
          const existing = await client.request(readItems('expenses', {
            filter: { client_generated_id: { _eq: item.clientGeneratedId } },
            limit: 1,
            fields: ['*', 'user_created']
          } as any)).catch(() => []) as any[]

          const found = Array.isArray(existing) ? existing[0] : null
          if (found) {
            const app = mapDirectusToApp(found as DirectusExpense)
            const index = expenses.value.findIndex(e => e.id === item.localId)
            if (index !== -1) expenses.value[index] = app
            await offlineOutboxDelete(item.id)
            synced += 1
            continue
          }
        }

        if (isNetworkError(e)) break

        await offlineOutboxPut({ ...item, lastError: String(e?.message || e) })
        break
      }
    }

    await refreshPendingCreateCount(tripIdNum)
    await offlineKvSet(buildOfflineKey(userId, ['trip', tripIdNum, 'expenses']), expenses.value)
    return synced
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
    syncPendingExpenseCreates,
    pendingCreateCountByTrip,
    updateExpense,
    deleteExpense
  }
}
