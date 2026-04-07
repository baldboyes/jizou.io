import { readItems, createItem, updateItem, deleteItem } from '@directus/sdk'
import type { 
  Flight, 
  Accommodation, 
  Transport, 
  Activity, 
  Insurance, 
  Trip 
} from '~/types/directus'
import { toFloatingLocalDate, toIsoZFromFloatingInput } from '~/utils/floatingDateTime'
import { offlineKvGet, offlineKvSet } from '~/utils/offlineDb'
import { buildOfflineKey, getOfflineUserId } from '~/utils/offlineKeys'

export interface TimelineItemNew {
  id: string
  type: 'flight' | 'accommodation' | 'transport' | 'activity' | 'expense'
  date: Date
  title: string
  subtitle: string
  originalItem: any
  metadata?: Record<string, any>
  user_created?: any
}

export const useTripOrganizationNew = () => {
  const { getClient } = useDirectusRepo()
  
  // State
  const flights = useState<Flight[]>('org-new-flights', () => [])
  const accommodations = useState<Accommodation[]>('org-new-accommodations', () => [])
  const transports = useState<Transport[]>('org-new-transports', () => [])
  const activities = useState<Activity[]>('org-new-activities', () => [])
  const insurances = useState<Insurance[]>('org-new-insurances', () => [])
  
  const loading = useState<boolean>('org-new-loading', () => false)

  // --- Timeline Computed ---
  const timelineItems = computed<TimelineItemNew[]>(() => {
    const items: TimelineItemNew[] = []

    // 1. Flights
    flights.value.forEach(v => {
      if (v.layovers && Array.isArray(v.layovers) && v.layovers.length > 0) {
        v.layovers.forEach((e: any, index) => {
          if (e.departure_time) {
            const d = toFloatingLocalDate(e.departure_time)
            if (!d) return
            items.push({
              id: `flight-${v.id}-scale-${index}`,
              type: 'flight',
              date: d,
              title: `Vuelo a ${e.arrival_airport}`,
              subtitle: `${e.airline || 'Vuelo'} ${e.flight_number ? '• ' + e.flight_number : ''}`,
              originalItem: v,
              metadata: { scale: e }
            })
          }
        })
      } else if (v.departure_time) {
        const d = toFloatingLocalDate(v.departure_time)
        if (!d) return
        items.push({
          id: `flight-${v.id}`,
          type: 'flight',
          date: d,
          title: `Vuelo a ${v.arrival_airport}`,
          subtitle: `${v.airline || 'Vuelo'} ${v.flight_number ? '• ' + v.flight_number : ''}`,
          originalItem: v
        })
      }
    })

    // 2. Accommodations
    accommodations.value.forEach(a => {
      if (a.check_in) {
        const d = toFloatingLocalDate(a.check_in)
        if (!d) return
        items.push({
          id: `accommodation-${a.id}`,
          type: 'accommodation',
          date: d,
          title: `Check-in: ${a.name}`,
          subtitle: a.address || a.city || 'Sin dirección',
          originalItem: a
        })
      }
    })

    // 3. Transports
    transports.value.forEach(t => {
      if (t.stops && Array.isArray(t.stops) && t.stops.length > 0) {
        t.stops.forEach((e: any, index) => {
          if (e.departure_time) {
            const d = toFloatingLocalDate(e.departure_time)
            if (!d) return
            items.push({
              id: `transport-${t.id}-scale-${index}`,
              type: 'transport',
              date: d,
              title: `${e.type || 'Transporte'}: ${e.departure_place} → ${e.arrival_place}`,
              subtitle: e.notes || '',
              originalItem: t,
              metadata: { scale: e }
            })
          }
        })
      } else if (t.start_date) {
        const d = toFloatingLocalDate(t.start_date)
        if (!d) return
        items.push({
          id: `transport-${t.id}`,
          type: 'transport',
          date: d,
          title: t.name,
          subtitle: t.category === 'pass' ? 'Activación de Pase' : 'Transporte',
          originalItem: t
        })
      }
    })

    // 4. Activities
    activities.value.forEach(act => {
      const dateStr = act.start_date

      if (dateStr) {
        const d = toFloatingLocalDate(dateStr)
        if (!d) return
        items.push({
          id: `activity-${act.id}`,
          type: 'activity',
          date: d,
          title: act.title,
          subtitle: act.type ? act.type.charAt(0).toUpperCase() + act.type.slice(1) : 'Actividad',
          originalItem: act
        })
      }
    })

    return items.sort((a, b) => a.date.getTime() - b.date.getTime())
  })

  // --- Fetch All ---
  const fetchOrganizationData = async (tripId: number) => {
    loading.value = true
    
    try {
      const userId = getOfflineUserId()
      if (userId && Number.isFinite(tripId) && tripId > 0) {
        const cached = await offlineKvGet<any>(buildOfflineKey(userId, ['trip', tripId, 'organization']))
        if (cached && typeof cached === 'object') {
          flights.value = Array.isArray(cached.flights) ? cached.flights : flights.value
          accommodations.value = Array.isArray(cached.accommodations) ? cached.accommodations : accommodations.value
          transports.value = Array.isArray(cached.transports) ? cached.transports : transports.value
          activities.value = Array.isArray(cached.activities) ? cached.activities : activities.value
          insurances.value = Array.isArray(cached.insurances) ? cached.insurances : insurances.value
        }
      }

      const client = await getClient()
      
      const query = (sortField: string) => ({
        filter: { trip_id: { _eq: tripId } },
        sort: [sortField],
        fields: [
          '*',
          // 'attachments.directus_files_id.*' // Re-enable when attachments relation is confirmed working
        ]
      })

      const [v, a, t, act, s] = await Promise.all([
        client.request(readItems('flights', query('departure_time'))),
        client.request(readItems('accommodations', query('check_in'))),
        client.request(readItems('transports', query('start_date'))),
        client.request(readItems('activities', query('start_date'))),
        client.request(readItems('insurances', query('start_date')))
      ])

      flights.value = v as Flight[]
      accommodations.value = a as Accommodation[]
      transports.value = t as Transport[]
      activities.value = act as Activity[]
      insurances.value = s as Insurance[]

      if (userId && Number.isFinite(tripId) && tripId > 0) {
        await offlineKvSet(buildOfflineKey(userId, ['trip', tripId, 'organization']), {
          flights: flights.value,
          accommodations: accommodations.value,
          transports: transports.value,
          activities: activities.value,
          insurances: insurances.value
        })
      }
      
    } catch (e: any) {
      try {
        const res = await $fetch('/api/trips/organization', { method: 'GET', query: { tripId } }) as any
        flights.value = Array.isArray(res?.flights) ? res.flights : []
        accommodations.value = Array.isArray(res?.accommodations) ? res.accommodations : []
        transports.value = Array.isArray(res?.transports) ? res.transports : []
        activities.value = Array.isArray(res?.activities) ? res.activities : []
        insurances.value = Array.isArray(res?.insurances) ? res.insurances : []

        const userId = getOfflineUserId()
        if (userId && Number.isFinite(tripId) && tripId > 0) {
          await offlineKvSet(buildOfflineKey(userId, ['trip', tripId, 'organization']), {
            flights: flights.value,
            accommodations: accommodations.value,
            transports: transports.value,
            activities: activities.value,
            insurances: insurances.value
          })
        }
      } catch (fallbackError: any) {
        console.error('Error fetching organization data (new):', e)
      }
    } finally {
      loading.value = false
    }
  }

  // --- CRUD Generic Helper ---
  const normalizeDateTimeString = (v: any) => {
    if (!v || typeof v !== 'string') return v
    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(v)) return v
    const normalized = toIsoZFromFloatingInput(v.includes(' ') && !v.includes('T') ? v.replace(' ', 'T') : v)
    return normalized || v
  }

  const normalizeItemDateTimes = (collection: string, item: any) => {
    if (!item || typeof item !== 'object') return item
    const data = { ...item }

    if (collection === 'flights') {
      if (data.departure_time) data.departure_time = normalizeDateTimeString(data.departure_time)
      if (data.arrival_time) data.arrival_time = normalizeDateTimeString(data.arrival_time)
      if (Array.isArray(data.layovers)) {
        data.layovers = data.layovers.map((e: any) => ({
          ...e,
          departure_time: normalizeDateTimeString(e?.departure_time),
          arrival_time: normalizeDateTimeString(e?.arrival_time)
        }))
      }
    }

    if (collection === 'accommodations') {
      if (data.check_in) data.check_in = normalizeDateTimeString(data.check_in)
      if (data.check_out) data.check_out = normalizeDateTimeString(data.check_out)
    }

    if (collection === 'transports') {
      if (data.start_date) data.start_date = normalizeDateTimeString(data.start_date)
      if (data.end_date) data.end_date = normalizeDateTimeString(data.end_date)
      if (Array.isArray(data.stops)) {
        data.stops = data.stops.map((e: any) => ({
          ...e,
          departure_time: normalizeDateTimeString(e?.departure_time),
          arrival_time: normalizeDateTimeString(e?.arrival_time)
        }))
      }
    }

    if (collection === 'activities') {
      if (data.start_date) data.start_date = normalizeDateTimeString(data.start_date)
      if (data.end_date) data.end_date = normalizeDateTimeString(data.end_date)
    }

    return data
  }

  const createItemGeneric = async (collection: string, item: any, state: any) => {
    try {
      const client = await getClient()
      const res = await client.request(createItem(collection as any, normalizeItemDateTimes(collection, item))) as any
      // res.attachments = [] 
      state.value.push(res)
      return res
    } catch (e) {
      console.error(`Error creating ${collection}:`, e)
      throw e
    }
  }

  const updateItemGeneric = async (collection: string, id: number, item: any, state: any) => {
    try {
      const client = await getClient()
      const res = await client.request(updateItem(collection as any, id, normalizeItemDateTimes(collection, item))) as any
      
      const index = state.value.findIndex((i: any) => i.id === id)
      if (index !== -1) state.value[index] = { ...(state.value[index] || {}), ...(res || {}) }
      return res
    } catch (e) {
      console.error(`Error updating ${collection}:`, e)
      throw e
    }
  }

  const deleteItemGeneric = async (collection: string, id: number, state: any) => {
    try {
      const client = await getClient()
      await client.request(deleteItem(collection as any, id))
      state.value = state.value.filter((i: any) => i.id !== id)
    } catch (e) {
      console.error(`Error deleting ${collection}:`, e)
      throw e
    }
  }

  // --- Specific Actions ---
  const createFlight = (item: Omit<Flight, 'id' | 'status' | 'user_created' | 'date_created'>) => createItemGeneric('flights', item, flights)
  const updateFlight = (id: number, item: Partial<Flight>) => updateItemGeneric('flights', id, item, flights)
  const deleteFlight = (id: number) => deleteItemGeneric('flights', id, flights)

  const createAccommodation = (item: Omit<Accommodation, 'id' | 'status' | 'user_created' | 'date_created'>) => createItemGeneric('accommodations', item, accommodations)
  const updateAccommodation = (id: number, item: Partial<Accommodation>) => updateItemGeneric('accommodations', id, item, accommodations)
  const deleteAccommodation = (id: number) => deleteItemGeneric('accommodations', id, accommodations)

  const createTransport = (item: Omit<Transport, 'id' | 'status' | 'user_created' | 'date_created'>) => createItemGeneric('transports', item, transports)
  const updateTransport = (id: number, item: Partial<Transport>) => updateItemGeneric('transports', id, item, transports)
  const deleteTransport = (id: number) => deleteItemGeneric('transports', id, transports)

  const createActivity = (item: Omit<Activity, 'id' | 'status' | 'user_created' | 'date_created'>) => createItemGeneric('activities', item, activities)
  const updateActivity = (id: number, item: Partial<Activity>) => updateItemGeneric('activities', id, item, activities)
  const deleteActivity = (id: number) => deleteItemGeneric('activities', id, activities)

  const createInsurance = (item: Omit<Insurance, 'id' | 'status' | 'user_created' | 'date_created'>) => createItemGeneric('insurances', item, insurances)
  const updateInsurance = (id: number, item: Partial<Insurance>) => updateItemGeneric('insurances', id, item, insurances)
  const deleteInsurance = (id: number) => deleteItemGeneric('insurances', id, insurances)

  return {
    flights,
    accommodations,
    transports,
    activities,
    insurances,
    timelineItems,
    loading,
    fetchOrganizationData,
    createFlight, updateFlight, deleteFlight,
    createAccommodation, updateAccommodation, deleteAccommodation,
    createTransport, updateTransport, deleteTransport,
    createActivity, updateActivity, deleteActivity,
    createInsurance, updateInsurance, deleteInsurance
  }
}
