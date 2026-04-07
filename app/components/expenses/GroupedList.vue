<template>
  <div class="space-y-4">
    <!-- Empty state -->
    <div v-if="groupedExpenses.length === 0" class="text-center py-12">
      <div class="text-6xl mb-4">📝</div>
      <h3 class="text-lg font-semibold text-neutral-900 mb-2">{{ emptyTitle }}</h3>
      <p class="text-sm text-neutral-600">{{ emptyMessage }}</p>
    </div>

    <!-- Render only visible items for performance -->
    <div v-else>
      <div v-for="group in visibleGroupedExpenses" :key="group.date" class="space-y-3">
        <!-- Date Header -->
        <div class="flex items-center justify-between px-2 py-2 bg-neutral-100 rounded-lg sticky top-0 z-10">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-neutral-900">
              {{ getRelativeDayLabel(group.date) }}
            </span>
            <span class="text-xs text-neutral-600">
              {{ formatDate(group.date) }}
            </span>
          </div>
          <div class="text-sm font-bold text-neutral-900">
            {{ formattedTotalForDate(getTotalForDate(group.items)) }}
          </div>
        </div>

        <!-- Planned expenses for this date -->
        <div v-if="plannedExpensesForDate[group.date]" class="space-y-3">
          <ExpensesPlannedCard
            v-for="planned in plannedExpensesForDate[group.date]"
            :key="planned.id"
            :planned-expense="planned"
            :currency="currency"
            @click="$emit('planned-expense-click', planned)"
          />
        </div>

        <!-- Expenses for this date -->
        <div class="space-y-3">
          <ExpensesCard
            v-for="expense in group.items"
            :key="expense.id"
            :expense="expense"
            :shared-avatars="sharedAvatarsByExpenseId?.[expense.id]"
            :currency="currency"
            @click="$emit('expense-click', expense)"
          />
        </div>
        <br />
      </div>

      <!-- Load more button if there are more items -->
      <div v-if="hasMoreItems" class="flex justify-center mt-6 mb-4">
        <Button
          @click="loadMore"
          class="w-full max-w-xs bg-teal-600 hover:bg-teal-700 text-white"
        >
          Cargar más ({{ remainingCount }} {{ remainingCount === 1 ? 'día' : 'días' }})
        </Button>
      </div>
      <div v-else class="text-center mt-6 mb-4 text-sm text-neutral-500">
        Todos los días cargados
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Expense, PlannedExpense } from '~/types'
import { formatDate, getRelativeDayLabel } from '~/utils/dates'
import { CURRENCIES } from '~/composables/useSettings'

const { formatAmount: globalFormatAmount } = useCurrency()

interface Props {
  expenses: Expense[]
  plannedExpenses?: PlannedExpense[]
  sharedAvatarsByExpenseId?: Record<string, { src?: string | null; fallback: string }[]>
  emptyTitle?: string
  emptyMessage?: string
  currency?: string
}

const props = withDefaults(defineProps<Props>(), {
  plannedExpenses: () => [],
  emptyTitle: 'Sin gastos',
  emptyMessage: 'No hay gastos para mostrar',
  currency: undefined
})

const formattedTotalForDate = (amount: number) => {
  if (props.currency) {
    const symbol = CURRENCIES.find(c => c.code === props.currency)?.symbol || '$'
    return `${symbol}${amount.toLocaleString()}`
  }
  return globalFormatAmount(amount)
}

defineEmits<{
  'expense-click': [expense: Expense]
  'planned-expense-click': [plannedExpense: PlannedExpense]
}>()

const {
  groupedExpenses,
  visibleGroupedExpenses,
  hasMoreItems,
  remainingCount,
  loadMore,
  getTotalForDate
} = useGroupedExpenses(toRef(props, 'expenses'))

const plannedExpensesForDate = computed(() => {
  // Group planned expenses by their plannedDate
  const grouped: Record<string, PlannedExpense[]> = {}

  props.plannedExpenses.forEach(planned => {
    const dateKey = planned.plannedDate
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(planned)
  })

  return grouped
})
</script>
