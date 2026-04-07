<template>
  <div class="max-w-screen-sm mx-auto px-4 py-6 flex flex-col gap-6 h-svh overflow-hidden">

    <div class="flex items-center justify-between gap-8">
      <div class="flex items-center gap-2">

        <Button variant="ghost" size="icon" class="h-10 w-10 p-0" as-child>
          <NuxtLink :to="`/es/trips/${tripId}`" class="text-red-400 hover:text-red-600 shrink-0 transition-colors duration-300">
            <LayoutDashboard class="h-6! w-6!" />
          </NuxtLink>
        </Button> 

        <Button variant="ghost" size="icon" class="h-10 w-10 p-0" as-child v-if="currentAccommodation">
          <a v-if="currentAccommodation.google_maps_link" :title="$t('trip_daily_expenses_page.actions.directions_prefix') + ' ' + currentAccommodation.name" :href="currentAccommodation.google_maps_link" target="_blank" class="text-indigo-600 hover:text-indigo-800 shrink-0">
            <span class="sr-only">{{ $t('trip_daily_expenses_page.actions.open_maps') }}</span>
            <BedDouble class="h-6! w-6!" />
          </a>
        </Button>

      </div>
      <div class="flex items-center gap-2">
        <Badge v-if="!isOnline" variant="secondary">{{ $t('trip_daily_expenses_page.offline.offline_badge') }}</Badge>
        <Badge v-else-if="pendingCreateCount > 0" variant="secondary">
          {{ $t('trip_daily_expenses_page.offline.pending_prefix') }} {{ pendingCreateCount }} {{ $t('trip_daily_expenses_page.offline.pending_suffix') }}
        </Badge>
        <WeatherWidget :weather="weather" :loading="weatherLoading" />
      </div>
    </div>

    <!-- Daily Budget Card -->
    <DashboardTripDailyBudget 
      :daily-limit="budget.dailyLimit"
      :currency="budget.currency || null"
      :expenses="todayExpenses"
    />

    <Tabs v-model="viewMode" class="w-full flex-1 min-h-0">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="expenses">{{ $t('trip_daily_expenses_page.tabs.expenses') }}</TabsTrigger>
        <TabsTrigger value="itinerary">{{ $t('trip_daily_expenses_page.tabs.itinerary') }}</TabsTrigger>
      </TabsList>

      <TabsContent value="expenses" class="space-y-6 flex-1 min-h-0 overflow-y-auto pb-24">
        <!-- Planned Expenses -->
        <div v-if="todaysPlannedExpenses.length > 0">
          <div class="flex items-center justify-between mb-3 w-full">
            <h2 class="text-lg font-semibold text-neutral-700 flex items-center justify-between gap-2 w-full">
              <span>{{ $t('trip_daily_expenses_page.planned.title') }}</span>
              <Badge variant="secondary" class="ml-1">{{ todaysPlannedExpenses.length }}</Badge>
            </h2>
          </div>
          <div class="space-y-2">
            <ExpensesPlannedCard
              v-for="planned in todaysPlannedExpenses"
              :key="planned.id"
              :planned-expense="planned"
              :currency="budget.currency || undefined"
              @click="handlePlannedExpenseClick"
              @delete="handleDeletePlanned"
            />
          </div>
        </div>

        <!-- Today's Expenses -->
        <div>
          <!-- Empty State -->
          <div
            v-if="todayExpenses.length === 0"
            class="text-center py-12 px-4"
          >
            <div class="text-6xl mb-4">💸</div>
            <h3 class="text-lg font-semibold text-neutral-900 mb-2">{{ $t('trip_daily_expenses_page.empty.title') }}</h3>
            <p class="text-sm text-neutral-600 mb-6">{{ $t('trip_daily_expenses_page.empty.subtitle') }}</p>
          </div>

          <!-- Expense Cards -->
          <div v-else class="space-y-3">
            <ExpensesCard
              v-for="expense in todayExpenses"
              :key="expense.id"
              :expense="expense"
              :currency="budget.currency || undefined"
              @click="handleExpenseClick"
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="itinerary" class="flex-1 min-h-0 overflow-y-auto pb-24">
        <ItineraryDayList
          :events="todayItineraryEvents"
          :date="todayDate"
          :trip-id="tripId"
          notes-mode="read"
          @create-expense="handleAdd"
        />
      </TabsContent>
    </Tabs>

    <!-- Floating Action Button -->
    <div class="fixed bottom-6 right-6 z-50">
      <Button
        class="h-14 w-14 rounded-full shadow-lg bg-red-400 hover:bg-red-500 p-0"
        @click="handleAdd"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </Button>
    </div>

    <!-- Expense Drawer (Add/Edit) -->
    <ExpenseDrawer
      v-model:open="showExpenseDrawer"
      :trip-id="tripId"
      :expense-to-edit="expenseToEdit"
      :trip-moneda="budget.currency"
      @success="handleDrawerSuccess"
    />

    <!-- Delete Confirmation Dialog -->
    <AlertDialog v-model:open="isDeletePlannedOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t('trip_daily_expenses_page.delete_planned.title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t('trip_daily_expenses_page.delete_planned.description_prefix') }} "{{ plannedExpenseToDelete?.placeName }}" {{ $t('trip_daily_expenses_page.delete_planned.description_suffix') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t('trip_daily_expenses_page.delete_planned.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="confirmDeletePlanned" class="bg-red-600 hover:bg-red-700 text-white">{{ $t('trip_daily_expenses_page.delete_planned.confirm') }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useOnline } from '@vueuse/core'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { BedDouble, LayoutDashboard } from 'lucide-vue-next'
import { startOfDay, parseISO } from 'date-fns'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import WeatherWidget from '~/components/weather/Widget.vue'
import ExpenseDrawer from '~/components/expenses/ExpenseDrawer.vue'
import DashboardTripDailyBudget from '~/components/dashboard/TripDailyBudget.vue'
import ExpensesPlannedCard from '~/components/expenses/PlannedCard.vue'
import ExpensesCard from '~/components/expenses/Card.vue'
import ItineraryDayList from '~/components/itinerary/ItineraryDayList.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useExpensesNew } from '~/composables/useExpensesNew'
import { useItineraryNew } from '~/composables/useItineraryNew'
import { useTripOrganizationNew } from '~/composables/useTripOrganizationNew'
import { useTripTasksNew } from '~/composables/useTripTasksNew'
import { useTripsNew } from '~/composables/useTripsNew'
import { useTripWeather } from '~/composables/useTripWeather'
import type { Expense, PlannedExpense, Budget } from '~/types'

definePageMeta({
  layout: 'dashboard',
  noTripSidebar: true
})

const route = useRoute()
const tripId = computed(() => Number(route.params.id))

const { expenses, fetchExpenses, updateExpense, deleteExpense, syncPendingExpenseCreates, pendingCreateCountByTrip } = useExpensesNew()
const { accommodations, fetchOrganizationData } = useTripOrganizationNew()
const { fetchTasks } = useTripTasksNew()
const { currentTrip, getTrip } = useTripsNew()
const { weather, loading: weatherLoading, loadWeatherForTrip } = useTripWeather()
const { selectedDate, selectedDayDetails, selectDate } = useItineraryNew()

const viewMode = ref<'expenses' | 'itinerary'>('expenses')
const isOnline = useOnline()
const pendingCreateCount = computed(() => pendingCreateCountByTrip.value[String(tripId.value)] || 0)

// Load data
onMounted(async () => {
  if (tripId.value && !Number.isNaN(tripId.value)) {
    await Promise.all([
      fetchExpenses(tripId.value),
      fetchOrganizationData(tripId.value),
      fetchTasks(tripId.value)
    ])

    if (isOnline.value && pendingCreateCount.value > 0) {
      await syncPendingExpenseCreates(tripId.value)
    }
    
    // Get trip data and then load weather
    await getTrip(tripId.value)
    if (currentTrip.value) {
      loadWeatherForTrip(currentTrip.value)
    }
  }
})

const currentAccommodation = computed(() => {
  const today = startOfDay(new Date())
  
  return accommodations.value.find(a => {
    if (!a.check_in || !a.check_out) return false
    const start = startOfDay(parseISO(a.check_in))
    const end = startOfDay(parseISO(a.check_out))
    
    return today >= start && today < end
  })
})

// Budget from Trip
const budget = computed<Budget>(() => ({
  dailyLimit: currentTrip.value?.daily_budget || 0,
  startDate: currentTrip.value?.start_date || new Date().toISOString(),
  currency: currentTrip.value?.currency || null
}))

// Filter for today
const todayString = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

const todayDate = computed(() => startOfDay(parseISO(todayString.value)))

watch(todayString, () => {
  selectDate(todayDate.value)
}, { immediate: true })

const todayExpenses = computed(() => {
  return expenses.value
    .filter(e => e.status !== 'planned' && e.timestamp.startsWith(todayString.value))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
})

const todaysPlannedExpenses = computed(() => {
  return expenses.value
    .filter(e => e.status === 'planned' && e.timestamp.startsWith(todayString.value))
    .map(e => ({
      ...e,
      plannedDate: e.timestamp.slice(0, 10)
    } as unknown as PlannedExpense))
})

const todayItineraryEvents = computed(() => {
  return selectedDayDetails.value.filter(e => e.type !== 'expense')
})


// Drawer state
const showExpenseDrawer = ref(false)
const expenseToEdit = ref<Expense | null>(null)

function handleAdd() {
  viewMode.value = 'expenses'
  expenseToEdit.value = null
  showExpenseDrawer.value = true
}

function handleExpenseClick(expense: Expense) {
  viewMode.value = 'expenses'
  expenseToEdit.value = expense
  showExpenseDrawer.value = true
}

function handleDrawerSuccess() {
  fetchExpenses(tripId.value)
}

// Handle planned expense click - convert to real expense
async function handlePlannedExpenseClick(plannedExpense: PlannedExpense) {
  const original = expenses.value.find(e => e.id === plannedExpense.id)
  if (original) {
    const now = new Date()
    await updateExpense(original.id, {
      status: 'real',
      timestamp: now.toISOString()
    })
    
    fetchExpenses(tripId.value)
  }
}

// Delete Planned Expense Logic
const isDeletePlannedOpen = ref(false)
const plannedExpenseToDelete = ref<PlannedExpense | null>(null)

function handleDeletePlanned(planned: PlannedExpense) {
  plannedExpenseToDelete.value = planned
  isDeletePlannedOpen.value = true
}

async function confirmDeletePlanned() {
  if (plannedExpenseToDelete.value) {
    await deleteExpense(plannedExpenseToDelete.value.id)
    fetchExpenses(tripId.value)
    isDeletePlannedOpen.value = false
    plannedExpenseToDelete.value = null
  }
}
</script>
