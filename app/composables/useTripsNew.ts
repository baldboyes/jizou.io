import { readItems, readItem, createItem, updateItem, deleteItem } from '@directus/sdk'
import type { Trip } from '~/types/directus'
import { useI18n } from '#imports'
import { offlineKvGet, offlineKvSet } from '~/utils/offlineDb'
import { buildOfflineKey, getOfflineUserId } from '~/utils/offlineKeys'

export const useTripsNew = () => {
  const { getClient, directusUserId } = useDirectusRepo()
  const { t } = useI18n()
  const trips = useState<Trip[]>('trips-new', () => [])
  const currentTrip = useState<Trip | null>('current-trip-new', () => null)
  const collaborators = useState<any[]>('trip-collaborators-new', () => [])
  const loading = useState<boolean>('trips-new-loading', () => false)
  const error = useState<string | null>('trips-new-error', () => null)

  const fetchCollaborators = async (tripId: number) => {
    try {
      const result = await $fetch('/api/trips/collaborators', {
        method: 'GET',
        query: { tripId }
      }) as any

      collaborators.value = Array.isArray(result?.collaborators) ? result.collaborators : []
    } catch (e) {
      collaborators.value = []
    }
  }

  const fetchTrips = async () => {
    loading.value = true
    error.value = null
    try {
      const client = await getClient()

      const apiRes = await $fetch('/api/trips/my', { method: 'GET' }).catch(() => null) as any
      if (Array.isArray(apiRes?.trips)) {
        trips.value = apiRes.trips as Trip[]
        return
      }

      const result = await client.request(readItems('trips', {
        sort: ['-start_date'],
        fields: ['*', 'user_created']
      }))

      const baseTrips = Array.isArray(result) ? result as any[] : []

      const enriched = await Promise.all(baseTrips.map(async (trip: any) => {
        const collabRes = await $fetch('/api/trips/collaborators', {
          method: 'GET',
          query: { tripId: trip.id }
        }).catch(() => null) as any

        const collabs = Array.isArray(collabRes?.collaborators) ? collabRes.collaborators : []
        const owner = collabs.find((c: any) => c?.role === 'owner') || collabs.find((c: any) => String(c?.id) === String(trip?.user_created)) || null
        const collaboratorsForCard = owner ? collabs.filter((c: any) => String(c?.id) !== String(owner?.id)) : collabs

        return {
          ...trip,
          user_created: owner || null,
          collaborators: collaboratorsForCard
        }
      }))

      trips.value = enriched as Trip[]
    } catch (e: any) {
      console.error(e)
      error.value = e?.message || String(t('errors.trips.fetch_list'))
      trips.value = []
    } finally {
      loading.value = false
    }
  }

  const getTrip = async (id: number) => {
    loading.value = true
    error.value = null
    try {
      const userId = getOfflineUserId()
      if (userId && Number.isFinite(id) && id > 0) {
        const cached = await offlineKvGet<Trip>(buildOfflineKey(userId, ['trip', id, 'trip']))
        if (cached) currentTrip.value = cached as Trip
      }

      const client = await getClient()
      const result = await client.request(readItem('trips', id, {
          fields: ['*', 'expenses.*', 'activities.*', 'accommodations.*', 'flights.*', 'transports.*', 'tasks.*']
      }))
      currentTrip.value = result as Trip
      await fetchCollaborators(id)
      if (userId && Number.isFinite(id) && id > 0) {
        await offlineKvSet(buildOfflineKey(userId, ['trip', id, 'trip']), currentTrip.value)
      }
      return result
    } catch (e: any) {
      try {
        const res = await $fetch('/api/trips/item', { method: 'GET', query: { tripId: id } }) as any
        currentTrip.value = (res?.trip || null) as any
        await fetchCollaborators(id)
        const userId = getOfflineUserId()
        if (userId && Number.isFinite(id) && id > 0 && currentTrip.value) {
          await offlineKvSet(buildOfflineKey(userId, ['trip', id, 'trip']), currentTrip.value)
        }
        return res?.trip
      } catch (fallbackError: any) {
        console.error(e)
        error.value = e?.message || String(t('errors.trips.fetch_one'))
        throw e
      }
    } finally {
      loading.value = false
    }
  }

  const createTrip = async (tripData: Partial<Trip>) => {
    loading.value = true
    error.value = null
    try {
      const client = await getClient()
      
      const result = await client.request(createItem('trips', tripData as any))
      
      if (result) {
        const newTrip = result as Trip
        trips.value.unshift(newTrip)
        if (directusUserId.value && newTrip?.id) {
          await $fetch('/api/trips/associate', {
            method: 'POST',
            body: { tripId: newTrip.id, userId: directusUserId.value }
          }).catch(() => null)
        }
        return result
      }
    } catch (e: any) {
      console.error(e)
      error.value = e?.message || String(t('errors.trips.create'))
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateTrip = async (id: number, updates: Partial<Trip>) => {
    loading.value = true
    error.value = null
    try {
      const client = await getClient()
      const result = await client.request(updateItem('trips', id, updates as any))
      
      const index = trips.value.findIndex(t => t.id === id)
      if (index !== -1) {
        trips.value[index] = result as Trip
      }
      if (currentTrip.value?.id === id) {
        currentTrip.value = result as Trip
      }
      return result
    } catch (e: any) {
      console.error(e)
      error.value = e?.message || String(t('errors.trips.update'))
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteTrip = async (id: number) => {
    loading.value = true
    error.value = null
    try {
      const client = await getClient()
      await client.request(deleteItem('trips', id))
      trips.value = trips.value.filter(t => t.id !== id)
      if (currentTrip.value?.id === id) {
        currentTrip.value = null
      }
    } catch (e: any) {
      console.error(e)
      error.value = e?.message || String(t('errors.trips.delete'))
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    trips,
    currentTrip,
    collaborators,
    loading,
    error,
    fetchTrips,
    getTrip,
    fetchCollaborators,
    createTrip,
    updateTrip,
    deleteTrip
  }
}
