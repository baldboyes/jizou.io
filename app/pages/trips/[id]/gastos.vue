<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Wallet, TrendingUp, ArrowRightLeft, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useExpensesNew } from '~/composables/useExpensesNew'
import { useTripsNew } from '~/composables/useTripsNew'
import { useWalletNew } from '~/composables/useWalletNew'
import { useTripOrganizationNew } from '~/composables/useTripOrganizationNew'
import { useSharedExpenses } from '~/composables/useSharedExpenses'
import { useDirectusRepo } from '~/composables/useDirectusRepo'
import type { Expense, PlannedExpense, ExpenseCategory, PaymentMethod, Budget } from '~/types'
import { getCategoryInfo } from '~/types'
import type { DateFilterRange } from '~/components/common/DateRangeFilter.vue'
import { formatDate, getDateString } from '~/utils/dates'
import { groupByDate } from '~/utils/grouping'
import { nowFloatingDateTimeLocalInput, toFloatingLocalDate, toIsoZFromFloatingInput } from '~/utils/floatingDateTime'
import ExpenseDrawer from '~/components/expenses/ExpenseDrawer.vue'
import ExpensesFilters from '~/components/expenses/Filters.vue'
import ExpensesGroupedList from '~/components/expenses/GroupedList.vue'
import ExpensesDetailDialog from '~/components/expenses/DetailDialog.vue'
import MapsView from '~/components/maps/View.vue'
import DashboardStatsCard from '~/components/dashboard/StatsCard.vue'
import ChartsDailySpending from '~/components/charts/DailySpending.vue'
import ChartsCategoryBreakdown from '~/components/charts/CategoryBreakdown.vue'
import ChartsPaymentMethod from '~/components/charts/PaymentMethod.vue'
import { CURRENCIES } from '~/composables/useSettings'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '~/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '~/components/ui/alert-dialog'

definePageMeta({
  layout: 'dashboard'
})

const router = useRouter()
const route = useRoute()
const tripId = computed(() => route.params.id as string)
const { t } = useI18n()

// New Composables
const { expenses: rawExpenses, fetchExpenses, deleteExpense, updateExpense } = useExpensesNew()
const { currentTrip, getTrip, collaborators } = useTripsNew() // Use new Trips composable
const { 
  cambios, fetchCambios,
  createCambio, deleteCambio, 
  totalInvestedEUR, totalJPYAcquired, currentJPYBalance,
  paymentBreakdown 
} = useWalletNew()
const { fetchOrganizationData } = useTripOrganizationNew()
const { 
  fetchTripExpenseSplits,
  fetchTripSettlements,
  createTripSettlement,
  updateTripSettlement,
  deleteTripSettlement
} = useSharedExpenses()
const { directusUserId } = useDirectusRepo()

const tripExpenseSplits = ref<any[]>([])
const tripSettlements = ref<any[]>([])

const refreshSharedData = async (id: number) => {
  const [splits, settlements] = await Promise.all([
    fetchTripExpenseSplits(id).catch(() => []),
    fetchTripSettlements(id).catch(() => [])
  ])
  tripExpenseSplits.value = splits as any[]
  tripSettlements.value = settlements as any[]
}

// Load data
onMounted(async () => {
  if (tripId.value) {
    const id = parseInt(tripId.value)
    // Fetch all necessary data
    await Promise.all([
      fetchExpenses(id),
      fetchCambios(id),
      fetchOrganizationData(id),
      getTrip(id), // Ensure currentTrip is populated
      refreshSharedData(id)
    ])
  }
})

// Budget from Trip
const budget = computed<Budget>(() => ({
  dailyLimit: currentTrip.value?.daily_budget || 0,
  startDate: currentTrip.value?.start_date || new Date().toISOString(),
  currency: currentTrip.value?.currency || null
}))

// Override currency symbol for this page using trip currency
const currencySymbol = computed(() => {
  if (!budget.value.currency) return '$'
  const currencyInfo = CURRENCIES.find(c => c.code === budget.value.currency)
  return currencyInfo?.symbol || '$'
})

// Custom format amount function that uses the trip's currency
const formatAmount = (amount: number) => {
  return `${currencySymbol.value}${amount.toLocaleString()}`
}

// Calculate remaining daily budget
const remainingDailyBudget = computed(() => {
  const limit = budget.value.dailyLimit
  if (!limit) return 0
  
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const today = `${year}-${month}-${day}`
  
  const todayExpenses = expenses.value.filter(e => {
    return e.timestamp.startsWith(today)
  })
  
  const todaySpent = todayExpenses.reduce((sum, e) => sum + e.amount, 0)
  return limit - todaySpent
})

// View mode
const viewMode = ref<string>('list')

// Filters
const searchQuery = ref('')
const selectedCategory = ref('all')
const selectedPayment = ref('all')
const showSharedOnly = ref(false)
const dateRange = ref<DateFilterRange>({ start: null, end: null })

// Dialog state
const showExpenseDetail = ref(false)
const selectedExpense = ref<Expense | null>(null)

// Drawer state
const showExpenseDrawer = ref(false)
const expenseToEdit = ref<Expense | null>(null)

// ------------------------------------------------------------------
// WALLET LOGIC
// ------------------------------------------------------------------

const isWalletModalOpen = ref(false)
const walletFormData = ref<{
  fecha: string
  origen_eur: number
  destino_jpy: number
  lugar: string
  destino_fondo: 'cash' | 'card' | 'ic' // Updated to English
}>({
  fecha: nowFloatingDateTimeLocalInput(),
  origen_eur: 0,
  destino_jpy: 0,
  lugar: '',
  destino_fondo: 'cash'
})

const handleWalletSave = async () => {
  try {
    const isoZ = toIsoZFromFloatingInput(walletFormData.value.fecha)
    if (!isoZ) return
    await createCambio({
      date: isoZ,
      amount_from: walletFormData.value.origen_eur,
      currency_from: 'EUR',
      amount_to: walletFormData.value.destino_jpy,
      currency_to: 'JPY',
      place: walletFormData.value.lugar,
      fund_destination: walletFormData.value.destino_fondo,
      trip_id: parseInt(tripId.value)
    })
    isWalletModalOpen.value = false
    // Reset form
    walletFormData.value = {
      fecha: nowFloatingDateTimeLocalInput(),
      origen_eur: 0,
      destino_jpy: 0,
      lugar: '',
      destino_fondo: 'cash'
    }
    toast.success(String(t('trip_expenses_page.wallet.toasts.saved')))
  } catch (e) {
    console.error(e)
    toast.error(String(t('trip_expenses_page.wallet.toasts.error')))
  }
}

const formatEUR = (v: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}
const formatJPY = (v: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(v)
}

// ------------------------------------------------------------------
// DATA MAPPING
// ------------------------------------------------------------------

// No need for mapToExpense! useExpensesNew already returns Expense (AppExpense)

const mapToPlannedExpense = (e: Expense): PlannedExpense => ({
  id: e.id,
  plannedDate: getDateString(e.timestamp),
  placeName: e.placeName,
  amount: e.amount,
  category: e.category,
  notes: e.notes,
  location: e.location,
  paymentMethod: e.paymentMethod,
  shared: e.shared
})

const expenses = computed(() => {
  return rawExpenses.value
    .filter((e: Expense) => e.status !== 'planned')
})

const plannedExpenses = computed(() => {
  return rawExpenses.value
    .filter((e: Expense) => e.status === 'planned')
    .map(mapToPlannedExpense)
})

// ------------------------------------------------------------------
// HISTORY LOGIC
// ------------------------------------------------------------------

// Filtered expenses
const filteredExpenses = computed(() => {
  let result = [...expenses.value]

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(e => e.placeName.toLowerCase().includes(query))
  }

  // Category filter
  if (selectedCategory.value !== 'all') {
    result = result.filter(e => e.category === selectedCategory.value)
  }

  // Payment method filter
  if (selectedPayment.value !== 'all') {
    result = result.filter(e => e.paymentMethod === selectedPayment.value)
  }

  // Shared filter
  if (showSharedOnly.value) {
    result = result.filter(e => e.shared === true)
  }

  // Date filter
  if (dateRange.value.start && dateRange.value.end) {
    result = result.filter(e => {
      const expenseDate = toFloatingLocalDate(e.timestamp) || new Date(e.timestamp)
      return expenseDate >= dateRange.value.start! && expenseDate <= dateRange.value.end!
    })
  }

  return result
})

// Filtered planned expenses
const filteredPlannedExpenses = computed(() => {
  let result = [...plannedExpenses.value]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(e => e.placeName.toLowerCase().includes(query))
  }

  if (selectedCategory.value !== 'all') {
    result = result.filter(e => e.category === selectedCategory.value)
  }

  if (selectedPayment.value !== 'all') {
    result = result.filter(e => e.paymentMethod === selectedPayment.value)
  }

  if (showSharedOnly.value) {
    result = result.filter(e => e.shared === true)
  }

  return result
})

const hasFilters = computed(() =>
  searchQuery.value !== '' || selectedCategory.value !== 'all' || selectedPayment.value !== 'all' || showSharedOnly.value || dateRange.value.start !== null
)

const totalExpensesCount = computed(() => expenses.value.length)

const totalAmount = computed(() =>
  expenses.value.reduce((sum, e) => sum + e.amount, 0)
)

const filteredTotal = computed(() =>
  filteredExpenses.value.reduce((sum, e) => sum + e.amount, 0)
)

// Handlers
function handleSearchChange(query: string) {
  searchQuery.value = query
}

function handleCategoryChange(category: string) {
  selectedCategory.value = category
}

function handlePaymentChange(payment: string) {
  selectedPayment.value = payment
}

function handleSharedChange(showShared: boolean) {
  showSharedOnly.value = showShared
}

function handleDateChange(range: DateFilterRange) {
  dateRange.value = range
}

function handleExpenseClick(expense: Expense) {
  selectedExpense.value = expense
  showExpenseDetail.value = true
}

function handleAdd() {
  expenseToEdit.value = null
  showExpenseDrawer.value = true
}

function handleEdit(expense: Expense) {
  showExpenseDetail.value = false
  expenseToEdit.value = expense // Pass directly
  showExpenseDrawer.value = true
}

function handleDelete(expense: Expense) {
  if (expense.id) {
    deleteExpense(expense.id)
    selectedExpense.value = null
  }
}

function handleDrawerSuccess() {
  fetchExpenses(tripId.value)
}

// Handle planned expense click - convert to real expense
  async function handlePlannedExpenseClick(plannedExpense: PlannedExpense) {
    const original = rawExpenses.value.find(e => e.id === plannedExpense.id)
    if (original) {
      const now = new Date()
      const dateStr = getDateString(now)
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
      const timestamp = `${dateStr} ${timeStr}`

      await updateExpense(original.id, {
        timestamp: timestamp,
        status: 'real'
      }) 
      
      fetchExpenses(tripId.value)
    }
  }

// ------------------------------------------------------------------
// STATS LOGIC
// ------------------------------------------------------------------

const totalSpent = computed(() => statsExpenses.value.reduce((sum, e) => sum + e.amount, 0))

const tripDays = computed(() => {
  const dates = groupByDate(statsExpenses.value, 'timestamp', (d) => getDateString(d))
  return dates.length
})

const averageDaily = computed(() => {
  if (tripDays.value === 0) return 0
  return Math.round(totalSpent.value / tripDays.value)
})

const topExpenses = computed(() => {
  return [...statsExpenses.value]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
})

const sharedByPerson = computed(() => {
  const byId = new Map<number, number>()
  for (const s of sharedSplits.value as any[]) {
    const uid = Number(s?.trip_user_id ?? 0)
    if (!uid) continue
    const amount = Math.round(Number(s?.amount) || 0)
    byId.set(uid, (byId.get(uid) || 0) + amount)
  }
  return Array.from(byId.entries())
    .map(([tripUserId, amount]) => ({
      tripUserId,
      label: participantLabelById.value.get(tripUserId) || String(tripUserId),
      amount
    }))
    .sort((a, b) => b.amount - a.amount)
})

type TripParticipant = { tripUserId: number; label: string; userId: string | null }
type SuggestedTransfer = { fromTripUserId: number; toTripUserId: number; amount: number }

const tripParticipants = computed<TripParticipant[]>(() => {
  const list = Array.isArray(collaborators.value) ? collaborators.value : []
  return list
    .map((c: any) => {
      const tripUserId = Number(c?.relationId ?? 0)
      if (!tripUserId) return null
      const first = String(c?.first_name || '').trim()
      const last = String(c?.last_name || '').trim()
      const email = String(c?.email || '').trim()
      const label = (first || last) ? `${first} ${last}`.trim() : (email || String(c?.id || ''))
      return { tripUserId, label, userId: c?.id ? String(c.id) : null }
    })
    .filter(Boolean) as TripParticipant[]
})

const participantLabelById = computed(() => {
  const m = new Map<number, string>()
  for (const p of tripParticipants.value) m.set(p.tripUserId, p.label)
  return m
})

const myTripUserId = computed<number | null>(() => {
  const me = directusUserId.value
  if (!me) return null
  const match = tripParticipants.value.find(p => p.userId && p.userId === me)
  return match?.tripUserId || null
})

const sharedExpenses = computed(() => expenses.value.filter(e => e.shared))
const sharedExpenseIdSet = computed(() => new Set(sharedExpenses.value.map(e => Number(e.id)).filter(Boolean)))
const sharedSplits = computed(() => {
  const set = sharedExpenseIdSet.value
  return (tripExpenseSplits.value || []).filter((s: any) => set.has(Number(s?.expense_id)))
})

const statsScope = ref<'me' | 'trip'>('me')

const statsExpenses = computed<Expense[]>(() => {
  if (statsScope.value === 'trip') return expenses.value
  const myId = myTripUserId.value
  if (!myId) return expenses.value

  const byExpenseId = new Map<number, number>()
  for (const s of sharedSplits.value as any[]) {
    if (Number(s?.trip_user_id) !== myId) continue
    const expenseId = Number(s?.expense_id ?? 0)
    if (!expenseId) continue
    byExpenseId.set(expenseId, Math.round(Number(s?.amount) || 0))
  }

  const me = directusUserId.value

  return expenses.value
    .map((e: any) => {
      if (!e.shared) return e as Expense
      const amount = byExpenseId.get(Number(e.id)) || 0
      return { ...e, amount } as Expense
    })
    .filter((e: any) => {
      if (e.shared) return (Number(e.amount) || 0) > 0
      if (!me) return true
      return String(e.userCreatedId || '') === String(me)
    })
})

const balances = computed(() => {
  const byId = new Map<number, { tripUserId: number; label: string; paid: number; owed: number; net: number }>()

  for (const p of tripParticipants.value) {
    byId.set(p.tripUserId, { tripUserId: p.tripUserId, label: p.label, paid: 0, owed: 0, net: 0 })
  }

  for (const e of sharedExpenses.value) {
    const payer = Number((e as any).paidByTripUserId ?? 0)
    if (!payer) continue
    if (!byId.has(payer)) byId.set(payer, { tripUserId: payer, label: participantLabelById.value.get(payer) || String(payer), paid: 0, owed: 0, net: 0 })
    byId.get(payer)!.paid += Number(e.amount) || 0
  }

  for (const s of sharedSplits.value as any[]) {
    const uid = Number(s.trip_user_id ?? 0)
    if (!uid) continue
    if (!byId.has(uid)) byId.set(uid, { tripUserId: uid, label: participantLabelById.value.get(uid) || String(uid), paid: 0, owed: 0, net: 0 })
    byId.get(uid)!.owed += Number(s.amount) || 0
  }

  const completed = (tripSettlements.value || []).filter((x: any) => x?.settlement_status === 'completed')
  for (const st of completed as any[]) {
    const from = Number(st.from_trip_user_id ?? 0)
    const to = Number(st.to_trip_user_id ?? 0)
    const amt = Number(st.amount) || 0
    if (from) {
      if (!byId.has(from)) byId.set(from, { tripUserId: from, label: participantLabelById.value.get(from) || String(from), paid: 0, owed: 0, net: 0 })
      byId.get(from)!.paid += amt
    }
    if (to) {
      if (!byId.has(to)) byId.set(to, { tripUserId: to, label: participantLabelById.value.get(to) || String(to), paid: 0, owed: 0, net: 0 })
      byId.get(to)!.owed += amt
    }
  }

  const result = Array.from(byId.values()).map((b) => ({
    ...b,
    net: (b.paid || 0) - (b.owed || 0)
  }))

  return result.sort((a, b) => b.net - a.net)
})

function computeSuggestedTransfers(rows: { tripUserId: number; net: number }[]): SuggestedTransfer[] {
  const creditors = rows.filter(r => r.net > 0).map(r => ({ ...r })).sort((a, b) => b.net - a.net)
  const debtors = rows.filter(r => r.net < 0).map(r => ({ ...r })).sort((a, b) => a.net - b.net)
  const transfers: SuggestedTransfer[] = []

  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!
    const creditor = creditors[j]!
    const amount = Math.min(creditor.net, -debtor.net)
    if (amount > 0) transfers.push({ fromTripUserId: debtor.tripUserId, toTripUserId: creditor.tripUserId, amount: Math.round(amount) })
    debtor.net += amount
    creditor.net -= amount
    if (Math.abs(debtor.net) < 1e-9) i++
    if (Math.abs(creditor.net) < 1e-9) j++
  }

  return transfers.filter(t => t.amount > 0)
}

const suggestedTransfers = computed(() => computeSuggestedTransfers(balances.value.map(b => ({ tripUserId: b.tripUserId, net: b.net }))))
const settlementsSorted = computed(() => [...(tripSettlements.value || [])].sort((a: any, b: any) => String(b?.date || '').localeCompare(String(a?.date || ''))))
const isGeneratingSettlements = ref(false)
const showRegenerateConfirm = ref(false)

const handleRegisterPayment = async (tx: SuggestedTransfer) => {
  try {
    await createTripSettlement(Number(tripId.value), {
      from_trip_user_id: tx.fromTripUserId as any,
      to_trip_user_id: tx.toTripUserId as any,
      amount: tx.amount,
      date: new Date().toISOString(),
      settlement_status: 'pending'
    } as any)
    await refreshSharedData(Number(tripId.value))
    toast.success(t('trip_expenses_page.shared.toasts.saved'))
  } catch (e) {
    toast.error(t('trip_expenses_page.shared.toasts.error'))
  }
}

const handleGeneratePendingSettlements = async () => {
  if (isGeneratingSettlements.value) return
  isGeneratingSettlements.value = true
  try {
    const nowIso = new Date().toISOString()
    const pending = (tripSettlements.value || []).filter((s: any) => s?.settlement_status === 'pending')
    const pendingByPair = new Map<string, any>()

    for (const s of pending) {
      const from = Number(s?.from_trip_user_id ?? 0)
      const to = Number(s?.to_trip_user_id ?? 0)
      if (!from || !to) continue
      const key = `${from}->${to}`
      if (!pendingByPair.has(key)) pendingByPair.set(key, s)
    }

    for (const tx of suggestedTransfers.value) {
      const from = Number(tx.fromTripUserId)
      const to = Number(tx.toTripUserId)
      const amount = Math.round(Number(tx.amount) || 0)
      if (!from || !to || amount <= 0) continue

      const key = `${from}->${to}`
      const existing = pendingByPair.get(key)
      if (!existing?.id) {
        await createTripSettlement(Number(tripId.value), {
          from_trip_user_id: from as any,
          to_trip_user_id: to as any,
          amount,
          date: nowIso,
          settlement_status: 'pending'
        } as any)
      }
    }

    await refreshSharedData(Number(tripId.value))
    toast.success(t('trip_expenses_page.shared.toasts.generated'))
  } catch (e) {
    toast.error(t('trip_expenses_page.shared.toasts.error'))
  } finally {
    isGeneratingSettlements.value = false
  }
}

const handleConfirmRegeneratePending = async () => {
  if (isGeneratingSettlements.value) return
  isGeneratingSettlements.value = true
  try {
    const nowIso = new Date().toISOString()
    const pending = (tripSettlements.value || []).filter((s: any) => s?.settlement_status === 'pending')

    for (const s of pending as any[]) {
      if (!s?.id) continue
      await updateTripSettlement(Number(tripId.value), s.id, { settlement_status: 'void' } as any)
    }

    for (const tx of suggestedTransfers.value) {
      const from = Number(tx.fromTripUserId)
      const to = Number(tx.toTripUserId)
      const amount = Math.round(Number(tx.amount) || 0)
      if (!from || !to || amount <= 0) continue

      await createTripSettlement(Number(tripId.value), {
        from_trip_user_id: from as any,
        to_trip_user_id: to as any,
        amount,
        date: nowIso,
        settlement_status: 'pending'
      } as any)
    }

    await refreshSharedData(Number(tripId.value))
    toast.success(t('trip_expenses_page.shared.toasts.regenerated'))
  } catch (e) {
    toast.error(t('trip_expenses_page.shared.toasts.error'))
  } finally {
    isGeneratingSettlements.value = false
    showRegenerateConfirm.value = false
  }
}

const handleMarkSettlementCompleted = async (id: number | string) => {
  try {
    await updateTripSettlement(Number(tripId.value), id, { settlement_status: 'completed', settled_at: new Date().toISOString() } as any)
    await refreshSharedData(Number(tripId.value))
    toast.success(t('trip_expenses_page.shared.toasts.completed'))
  } catch (e) {
    toast.error(t('trip_expenses_page.shared.toasts.error'))
  }
}

const handleDeleteSettlement = async (id: number | string) => {
  try {
    await deleteTripSettlement(Number(tripId.value), id)
    await refreshSharedData(Number(tripId.value))
    toast.success(t('trip_expenses_page.shared.toasts.deleted'))
  } catch (e) {
    toast.error(t('trip_expenses_page.shared.toasts.error'))
  }
}
</script>

<template>
  <div class="max-w-screen-sm mx-auto px-4 py-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-neutral-900">{{ formatAmount(totalAmount) }}</h1>
        <div class="text-sm text-neutral-600">
          {{ totalExpensesCount }} {{ totalExpensesCount === 1 ? $t('trip_expenses_page.labels.expense_singular') : $t('trip_expenses_page.labels.expense_plural') }}
        </div>
      </div>
      <Button @click="handleAdd" size="icon" class="rounded-full h-12 w-12 shadow-lg bg-teal-600 hover:bg-teal-700">
        <Plus class="h-6 w-6" />
      </Button>
    </div>

    <Tabs v-model="viewMode" class="w-full">
      <TabsList class="grid w-full grid-cols-5 mb-4">
        <TabsTrigger value="list">{{ $t('trip_expenses_page.tabs.list') }}</TabsTrigger>
        <TabsTrigger value="map">{{ $t('trip_expenses_page.tabs.map') }}</TabsTrigger>
        <TabsTrigger value="stats">{{ $t('trip_expenses_page.tabs.stats') }}</TabsTrigger>
        <TabsTrigger value="wallet">{{ $t('trip_expenses_page.tabs.wallet') }}</TabsTrigger>
        <TabsTrigger value="shared">{{ $t('trip_expenses_page.tabs.shared') }}</TabsTrigger>
      </TabsList>

      <div v-if="viewMode === 'list' || viewMode === 'map'" class="mb-4">
        <ExpensesFilters
          :search-query="searchQuery"
          :category="selectedCategory"
          :payment="selectedPayment"
          :shared="showSharedOnly"
          :date-range="dateRange"
          @update:search-query="searchQuery = $event"
          @update:category="selectedCategory = $event"
          @update:payment="selectedPayment = $event"
          @update:shared="showSharedOnly = $event"
          @update:date-range="dateRange = $event"
          @search-change="handleSearchChange"
          @category-change="handleCategoryChange"
          @payment-change="handlePaymentChange"
          @shared-change="handleSharedChange"
          @date-change="handleDateChange"
        />
      </div>

      <!-- Results Summary -->
      <div v-if="(viewMode === 'list' || viewMode === 'map') && hasFilters && filteredExpenses.length > 0" class="mb-4">
        <div class="text-sm text-neutral-600 bg-teal-50 px-4 py-2 rounded-lg">
          {{ $t('trip_expenses_page.results.showing') }} {{ filteredExpenses.length }} {{ filteredExpenses.length === 1 ? $t('trip_expenses_page.results.result_singular') : $t('trip_expenses_page.results.result_plural') }}
          • {{ $t('trip_expenses_page.results.total_prefix') }} {{ formatAmount(filteredTotal) }}
        </div>
      </div>

      <!-- Expenses List -->
      <TabsContent value="list" class="space-y-6">
        <ExpensesGroupedList
          :expenses="filteredExpenses"
          :planned-expenses="filteredPlannedExpenses"
          :currency="budget.currency || undefined"
          :empty-title="$t('trip_expenses_page.empty.title')"
          :empty-message="$t('trip_expenses_page.empty.subtitle')"
          @expense-click="handleExpenseClick"
          @planned-expense-click="handlePlannedExpenseClick"
        />
      </TabsContent>

      <!-- MAP CONTENT -->
      <TabsContent value="map">
        <div class="h-[60vh] rounded-lg overflow-hidden border border-neutral-200">
          <MapsView
            :expenses="filteredExpenses"
            :selected-expense-id="selectedExpense?.id"
            @marker-click="handleExpenseClick"
          />
        </div>
      </TabsContent>

      <!-- STATS CONTENT -->
      <TabsContent value="stats">
        <div v-if="expenses.length === 0" class="text-center py-12">
          <div class="text-6xl mb-4">📊</div>
          <h2 class="text-xl font-semibold text-neutral-900 mb-2">{{ $t('trip_expenses_page.stats.empty.title') }}</h2>
          <p class="text-neutral-600 mb-6">
            {{ $t('trip_expenses_page.stats.empty.subtitle') }}
          </p>
          <Button @click="handleAdd" class="bg-teal-600 h-14 text-lg">
            <Plus class="mr-2 h-5 w-5" />
            {{ $t('trip_expenses_page.stats.empty.cta') }}
          </Button>
        </div>

        <div v-else class="space-y-6">
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm text-neutral-600">{{ $t('trip_expenses_page.stats.scope.label') }}</div>
            <Select v-model="statsScope">
              <SelectTrigger class="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">{{ $t('trip_expenses_page.stats.scope.me') }}</SelectItem>
                <SelectItem value="trip">{{ $t('trip_expenses_page.stats.scope.trip') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <DashboardStatsCard
              :label="$t('trip_expenses_page.stats.overview.total')"
              :value="formatAmount(totalSpent)"
              :subtitle="`${statsExpenses.length} ${statsExpenses.length === 1 ? $t('trip_expenses_page.labels.expense_singular') : $t('trip_expenses_page.labels.expense_plural')}`"
              icon="💰"
              icon-bg-class="bg-teal-100"
            />
            <DashboardStatsCard
              :label="$t('trip_expenses_page.stats.overview.daily_average')"
              :value="formatAmount(averageDaily)"
              :subtitle="`${tripDays} ${tripDays === 1 ? $t('trip_expenses_page.labels.day_singular') : $t('trip_expenses_page.labels.day_plural')} ${$t('trip_expenses_page.stats.overview.days_with_expenses_suffix')}`"
              icon="📅"
              icon-bg-class="bg-blue-100"
            />
          </div>

          <Card v-if="sharedByPerson.length > 0">
            <CardHeader>
              <CardTitle class="text-lg">{{ $t('trip_expenses_page.stats.shared_by_person.title') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div v-for="row in sharedByPerson" :key="row.tripUserId" class="flex items-center justify-between p-3 border rounded-md bg-white">
                <div class="text-sm font-medium text-neutral-900 truncate">{{ row.label }}</div>
                <div class="text-sm font-bold text-neutral-900">{{ formatAmount(row.amount) }}</div>
              </div>
            </CardContent>
          </Card>

          <ChartsDailySpending :expenses="statsExpenses" :daily-limit="budget.dailyLimit" />
          <ChartsCategoryBreakdown :expenses="statsExpenses" />
          <ChartsPaymentMethod :expenses="statsExpenses" />

          <Card>
            <CardHeader>
              <CardTitle class="text-lg">{{ $t('trip_expenses_page.stats.top_expenses.title') }}</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="space-y-3">
                <div
                  v-for="(expense, index) in topExpenses"
                  :key="expense.id"
                  class="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  @click="handleExpenseClick(expense)"
                >
                  <div class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-sm font-semibold text-neutral-700">
                    {{ index + 1 }}
                  </div>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span>{{ getCategoryInfo(expense.category).icon }}</span>
                      <span class="text-sm font-medium text-neutral-900">{{ expense.placeName }}</span>
                    </div>
                    <div class="text-xs text-neutral-600">{{ formatDate(expense.timestamp) }}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-bold text-neutral-900">{{ formatAmount(expense.amount) }}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- WALLET CONTENT -->
      <TabsContent value="wallet" class="space-y-6">
        <div class="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">{{ $t('trip_expenses_page.wallet.summary.total_invested') }}</CardTitle>
              <TrendingUp class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{{ formatEUR(totalInvestedEUR) }}</div>
              <p class="text-xs text-muted-foreground">{{ $t('trip_expenses_page.wallet.summary.total_invested_subtitle') }}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">{{ $t('trip_expenses_page.wallet.summary.jpy_available') }}</CardTitle>
              <Wallet class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold" :class="currentJPYBalance < 0 ? 'text-red-500' : 'text-green-600'">
                {{ formatJPY(currentJPYBalance) }}
              </div>
              <p class="text-xs text-muted-foreground">{{ $t('trip_expenses_page.wallet.summary.jpy_available_subtitle') }}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">{{ $t('trip_expenses_page.wallet.summary.total_exchanged') }}</CardTitle>
              <ArrowRightLeft class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{{ formatJPY(totalJPYAcquired) }}</div>
              <p class="text-xs text-muted-foreground">{{ $t('trip_expenses_page.wallet.summary.total_exchanged_subtitle') }}</p>
            </CardContent>
          </Card>
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold tracking-tight">{{ $t('trip_expenses_page.wallet.payments.title') }}</h3>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">{{ $t('trip_expenses_page.wallet.payments.paid_eur') }}</CardTitle>
                <div class="h-2 w-2 rounded-full bg-green-500" />
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">{{ formatEUR(paymentBreakdown.eur.paid) }}</div>
                <p class="text-xs text-muted-foreground">{{ $t('trip_expenses_page.wallet.payments.paid_eur_subtitle') }}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">{{ $t('trip_expenses_page.wallet.payments.pending_eur') }}</CardTitle>
                <div class="h-2 w-2 rounded-full bg-orange-500" />
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold text-orange-600">{{ formatEUR(paymentBreakdown.eur.pending) }}</div>
                <p class="text-xs text-muted-foreground">{{ $t('trip_expenses_page.wallet.payments.pending_eur_subtitle') }}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">{{ $t('trip_expenses_page.wallet.payments.paid_jpy') }}</CardTitle>
                <div class="h-2 w-2 rounded-full bg-green-500" />
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">{{ formatJPY(paymentBreakdown.jpy.paid) }}</div>
                <p class="text-xs text-muted-foreground">{{ $t('trip_expenses_page.wallet.payments.paid_jpy_subtitle') }}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">{{ $t('trip_expenses_page.wallet.payments.pending_jpy') }}</CardTitle>
                <div class="h-2 w-2 rounded-full bg-orange-500" />
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold text-orange-600">{{ formatJPY(paymentBreakdown.jpy.pending) }}</div>
                <p class="text-xs text-muted-foreground">{{ $t('trip_expenses_page.wallet.payments.pending_jpy_subtitle') }}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between pb-2">
            <div class="flex items-center gap-2">
              <ArrowRightLeft class="h-5 w-5 text-indigo-500" />
              <CardTitle class="text-lg">{{ $t('trip_expenses_page.wallet.history.title') }}</CardTitle>
            </div>
            <Button size="sm" @click="isWalletModalOpen = true"><Plus class="h-4 w-4 mr-2" /> {{ $t('trip_expenses_page.wallet.history.add') }}</Button>
          </CardHeader>
          <CardContent>
            <div v-if="cambios.length === 0" class="text-center py-16 border rounded-lg bg-slate-50 border-dashed text-muted-foreground">
              <Wallet class="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <h3 class="text-lg font-semibold text-slate-700">{{ $t('trip_expenses_page.wallet.history.empty.title') }}</h3>
              <p class="max-w-md mx-auto mt-2">{{ $t('trip_expenses_page.wallet.history.empty.subtitle') }}</p>
            </div>
            <div v-else class="space-y-2">
              <div v-for="c in cambios" :key="c.id" class="flex justify-between items-center p-3 border rounded hover:bg-slate-50">
                <div>
                  <div class="font-medium flex items-center gap-2">
                    {{ formatEUR(c.amount_from) }} <span class="text-muted-foreground">➜</span> {{ formatJPY(c.amount_to) }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ new Date(c.date).toLocaleDateString() }} • {{ c.place }} • <span class="capitalize">{{ c.fund_destination }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-right text-xs text-muted-foreground">
                    {{ $t('trip_expenses_page.wallet.history.rate_prefix') }} {{ (c.rate).toFixed(2) }}
                  </div>
                  <button @click="deleteCambio(c.id)" class="text-red-400 hover:text-red-600"><Trash2 class="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="shared" class="space-y-6">
        <div v-if="sharedExpenses.length === 0" class="text-center py-12">
          <div class="text-6xl mb-4">👥</div>
          <h2 class="text-xl font-semibold text-neutral-900 mb-2">{{ $t('trip_expenses_page.shared.empty.title') }}</h2>
          <p class="text-neutral-600">{{ $t('trip_expenses_page.shared.empty.subtitle') }}</p>
        </div>

        <div v-else class="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{{ $t('trip_expenses_page.shared.balances_title') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div v-for="b in balances" :key="b.tripUserId" class="flex items-center justify-between p-3 border rounded-md bg-white">
                <div class="text-sm font-medium text-neutral-900 truncate">{{ b.label }}</div>
                <div class="text-right">
                  <div class="text-sm font-bold" :class="b.net < 0 ? 'text-red-600' : (b.net > 0 ? 'text-green-600' : 'text-neutral-700')">
                    {{ formatAmount(b.net) }}
                  </div>
                  <div class="text-xs text-neutral-500">
                    {{ formatAmount(b.paid) }} • {{ formatAmount(b.owed) }}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div class="flex items-center justify-between w-full gap-3">
                <CardTitle>{{ $t('trip_expenses_page.shared.transactions_title') }}</CardTitle>
                <div class="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="suggestedTransfers.length === 0 || isGeneratingSettlements"
                    @click="handleGeneratePendingSettlements"
                  >
                    {{ $t('trip_expenses_page.shared.actions.generate_pending') }}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    :disabled="suggestedTransfers.length === 0 || isGeneratingSettlements"
                    @click="showRegenerateConfirm = true"
                  >
                    {{ $t('trip_expenses_page.shared.actions.regenerate_pending') }}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent class="space-y-2">
              <div v-for="tx in suggestedTransfers" :key="`${tx.fromTripUserId}-${tx.toTripUserId}-${tx.amount}`" class="flex items-center justify-between p-3 border rounded-md bg-white">
                <div class="text-sm text-neutral-900 truncate">
                  <span class="font-medium">{{ participantLabelById.get(tx.fromTripUserId) || tx.fromTripUserId }}</span>
                  <span class="text-neutral-500 mx-2">→</span>
                  <span class="font-medium">{{ participantLabelById.get(tx.toTripUserId) || tx.toTripUserId }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-sm font-bold text-neutral-900">{{ formatAmount(tx.amount) }}</div>
                  <Button size="sm" variant="outline" @click="handleRegisterPayment(tx)">
                    {{ $t('trip_expenses_page.shared.actions.register_payment') }}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{{ $t('trip_expenses_page.shared.settlements_title') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div v-if="settlementsSorted.length === 0" class="text-sm text-neutral-600">
                {{ $t('trip_expenses_page.shared.empty.subtitle') }}
              </div>
              <div v-else>
                <div v-for="s in settlementsSorted" :key="s.id" class="flex items-center justify-between p-3 border rounded-md bg-white">
                  <div class="space-y-0.5 min-w-0">
                    <div class="text-sm text-neutral-900 truncate">
                      <span class="font-medium">{{ participantLabelById.get(Number(s.from_trip_user_id)) || s.from_trip_user_id }}</span>
                      <span class="text-neutral-500 mx-2">→</span>
                      <span class="font-medium">{{ participantLabelById.get(Number(s.to_trip_user_id)) || s.to_trip_user_id }}</span>
                      <span class="text-neutral-500 mx-2">•</span>
                      <span class="font-bold">{{ formatAmount(Number(s.amount) || 0) }}</span>
                    </div>
                    <div class="text-xs text-neutral-500">
                      {{ new Date(String(s.date)).toLocaleDateString() }} • {{ $t(`trip_expenses_page.shared.status.${s.settlement_status}`) }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <Button
                      v-if="s.settlement_status === 'pending'"
                      size="sm"
                      variant="outline"
                      @click="handleMarkSettlementCompleted(s.id)"
                    >
                      {{ $t('trip_expenses_page.shared.actions.mark_completed') }}
                    </Button>
                    <Button
                      v-if="s.settlement_status !== 'completed'"
                      size="sm"
                      variant="ghost"
                      class="text-red-600 hover:text-red-700 hover:bg-red-50"
                      @click="handleDeleteSettlement(s.id)"
                    >
                      {{ $t('trip_expenses_page.shared.actions.delete') }}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>

    <ExpensesDetailDialog
      v-model="showExpenseDetail"
      :expense="selectedExpense"
      @edit="handleEdit"
      @delete="handleDelete"
    />

    <Dialog v-model:open="isWalletModalOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ $t('trip_expenses_page.wallet.modal.title') }}</DialogTitle>
        </DialogHeader>
        
        <div class="grid gap-4 py-4">
          <div class="grid grid-cols-2 gap-4">
            <div><Label>{{ $t('trip_expenses_page.wallet.modal.fields.given_eur') }}</Label><Input type="number" v-model="walletFormData.origen_eur" /></div>
            <div><Label>{{ $t('trip_expenses_page.wallet.modal.fields.received_jpy') }}</Label><Input type="number" v-model="walletFormData.destino_jpy" /></div>
          </div>
          
          <div><Label>{{ $t('trip_expenses_page.wallet.modal.fields.date') }}</Label><Input type="datetime-local" v-model="walletFormData.fecha" /></div>
          <div><Label>{{ $t('trip_expenses_page.wallet.modal.fields.place') }}</Label><Input v-model="walletFormData.lugar" /></div>
          
          <div>
            <Label>{{ $t('trip_expenses_page.wallet.modal.fields.destination') }}</Label>
            <Select v-model="walletFormData.destino_fondo">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{{ $t('trip_expenses_page.wallet.modal.destination.cash') }}</SelectItem>
                <SelectItem value="card">{{ $t('trip_expenses_page.wallet.modal.destination.card') }}</SelectItem>
                <SelectItem value="suica">{{ $t('trip_expenses_page.wallet.modal.destination.suica') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button @click="handleWalletSave">{{ $t('trip_expenses_page.wallet.modal.actions.save') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ExpenseDrawer
      v-model:open="showExpenseDrawer"
      :trip-id="tripId"
      :expense-to-edit="expenseToEdit"
      :trip-moneda="budget.currency"
      @success="handleDrawerSuccess"
    />

    <AlertDialog :open="showRegenerateConfirm" @update:open="showRegenerateConfirm = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t('trip_expenses_page.shared.regenerate.confirm.title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ $t('trip_expenses_page.shared.regenerate.confirm.description') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t('trip_expenses_page.shared.regenerate.confirm.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="handleConfirmRegeneratePending">
            {{ $t('trip_expenses_page.shared.regenerate.confirm.confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
