import { readItems } from '@directus/sdk'
import { assertTripAccess, createAdminClient, getDirectusUserIdFromEvent } from '../../utils/directus-admin'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tripIdRaw = query.tripId
  const tripId = typeof tripIdRaw === 'string'
    ? Number(tripIdRaw)
    : Array.isArray(tripIdRaw)
      ? Number(tripIdRaw[0])
      : Number(tripIdRaw)

  if (!Number.isFinite(tripId) || tripId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tripId' })
  }

  const adminClient = createAdminClient()
  const directusUserId = await getDirectusUserIdFromEvent(event, adminClient)
  await assertTripAccess(adminClient, tripId, directusUserId)

  let filter: any = { trip_id: { _eq: tripId } }

  const links = await adminClient.request(readItems('trips_users', {
    filter: { _and: [{ trip_id: { _eq: tripId } }, { directus_user_id: { _eq: directusUserId } }] },
    fields: ['id'],
    limit: 1
  })).catch(() => []) as any[]

  const myTripUserId = links?.[0]?.id ? Number(links[0].id) : null

  const splits = myTripUserId
    ? await adminClient.request(readItems('expense_splits', {
        filter: {
          _and: [
            { trip_id: { _eq: tripId } },
            { trip_user_id: { _eq: myTripUserId } },
            { status: { _neq: 'archived' } },
            { amount: { _gt: 0 } }
          ]
        },
        fields: ['expense_id'],
        limit: -1
      })).catch(() => []) as any[]
    : []

  const expenseIds = Array.from(new Set(
    (Array.isArray(splits) ? splits : [])
      .map(s => Number(s?.expense_id ?? 0))
      .filter(Boolean)
  ))

  filter = {
    trip_id: { _eq: tripId },
    _or: [
      { user_created: { _eq: directusUserId } },
      ...(expenseIds.length > 0
        ? [{ _and: [{ id: { _in: expenseIds } }, { is_shared: { _eq: true } }] }]
        : [])
    ]
  }

  const result = await adminClient.request(readItems('expenses', {
    filter,
    fields: [
      'id',
      'date',
      'concept',
      'amount',
      'category',
      'notes',
      'payment_method',
      'is_shared',
      'paid_by_trip_user_id',
      'expense_status',
      'location_lat',
      'location_lng',
      'city',
      'prefectura',
      'user_created',
      'status'
    ],
    sort: ['-date'],
    limit: -1
  })).catch(() => [])

  return { expenses: Array.isArray(result) ? result : [] }
})
