import type { Expense } from '~/types'
import { groupByDate } from '~/utils/grouping'
import { getDateString } from '~/utils/dates'
import { toFloatingLocalDate } from '~/utils/floatingDateTime'

export function useGroupedExpenses(expenses: Ref<Expense[]>, itemsPerPage: number = 10) {
  const currentPage = ref(1)

  // Reset pagination when expenses length changes
  watch(() => expenses.value.length, () => {
    currentPage.value = 1
  })

  const groupedExpenses = computed(() => {
    // Group and sort by date (newest first)
    // Use custom formatter to get YYYY-MM-DD key
    const grouped = groupByDate(expenses.value, 'timestamp', (d) => getDateString(d))
    
    // Sort items within groups (newest first)
    grouped.forEach(g => {
        g.items.sort((a, b) => (toFloatingLocalDate(b.timestamp)?.getTime() || 0) - (toFloatingLocalDate(a.timestamp)?.getTime() || 0))
    })
    
    // Sort groups by date descending (newest first)
    // groupByDate returns ascending order by default
    return grouped.reverse()
  })

  const visibleGroupedExpenses = computed(() => {
    const endIndex = currentPage.value * itemsPerPage
    return groupedExpenses.value.slice(0, endIndex)
  })

  const hasMoreItems = computed(() => {
    return visibleGroupedExpenses.value.length < groupedExpenses.value.length
  })

  const remainingCount = computed(() => {
    return groupedExpenses.value.length - visibleGroupedExpenses.value.length
  })

  function loadMore() {
    currentPage.value++
  }

  function getTotalForDate(dateExpenses: Expense[]): number {
    return dateExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  }

  return {
    groupedExpenses,
    visibleGroupedExpenses,
    hasMoreItems,
    remainingCount,
    loadMore,
    getTotalForDate
  }
}
