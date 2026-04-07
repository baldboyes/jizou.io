import { offlineOutboxListTripIds } from '~/utils/offlineDb'

export default defineNuxtPlugin((nuxtApp) => {
  const { userId } = useAuth()
  const { syncPendingExpenseCreates } = useExpensesNew()
  const router = useRouter()

  const syncAll = async () => {
    const uid = userId.value ? String(userId.value) : null
    if (!uid) return
    if (navigator.onLine === false) return
    const tripIds = await offlineOutboxListTripIds(uid)
    for (const tripId of tripIds) {
      await syncPendingExpenseCreates(tripId)
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      syncAll()
    })
  }

  router.afterEach((to) => {
    const m = String(to.path).match(/\/trips\/(\d+)\/gastos-dia/)
    if (m?.[1]) syncPendingExpenseCreates(Number(m[1]))
  })

  nuxtApp.hook('app:mounted', () => {
    syncAll()
  })
})

