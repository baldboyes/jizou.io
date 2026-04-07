<template>
  <Card
    class="hover:shadow-md transition-shadow cursor-pointer relative !border-l-[4px] !p-0 !rounded-xl border"
    :class="categoryBorderColor"
    @click="$emit('click', expense)"
  >
    <CardContent class="">
      <div class="flex items-start justify-between gap-2 py-4">
        <!-- Category Icon -->
        <div
          class="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          :class="categoryInfo.color"
        >
          {{ categoryInfo.icon }}
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <h3 class="font-semibold text-neutral-900 truncate">
              {{ expense.placeName }}
            </h3>
            <div class="flex shrink-0 items-center gap-2">
              <div
                v-if="expense.shared && visibleSharedAvatars.length > 0"
                class="flex items-center -space-x-1"
                :aria-label="$t('expenses.card.shared_participants_aria')"
              >
                <Avatar
                  v-for="p in visibleSharedAvatars"
                  :key="p.key"
                  size="xs"
                  class="border border-white bg-white shadow-sm ring-1 ring-black/5"
                >
                  <AvatarImage v-if="p.src" :src="p.src" />
                  <AvatarFallback class="text-[10px] font-semibold">{{ p.fallback }}</AvatarFallback>
                </Avatar>
                <Avatar
                  v-if="extraSharedCount > 0"
                  size="xs"
                  class="border border-white bg-white shadow-sm ring-1 ring-black/5"
                >
                  <AvatarFallback class="text-[10px] font-semibold">{{ String(extraSharedCount) }}</AvatarFallback>
                </Avatar>
              </div>
              <div class="font-bold text-neutral-900">
                {{ formattedAmount }}
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between gap-1">
            <!-- Time and Location -->
            <div class="flex items-center gap-2 text-sm text-neutral-500">
              <div class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{{ formatTime(expense.timestamp) }}</span>
              </div>

              <div class="flex items-center gap-1 truncate">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span class="truncate">{{ expense.location.city }}</span>
              </div>
            </div>

            <!-- Tags -->
            <div class="flex items-center gap-2 flex-wrap">
              <CommonPaymentMethodBadge :method="expense.paymentMethod" />
            </div>
          </div>
          <!-- Notes (if present) -->
          <p v-if="expense.notes" class="text-sm text-neutral-600 mt-2 line-clamp-2">
            {{ expense.notes }}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { Card, CardContent } from '~/components/ui/card'
  import type { Expense } from '~/types'
  import { getCategoryInfo } from '~/types'
  import { formatTime } from '~/utils/dates'
  import { useCurrency } from '~/composables/useCurrency'
  import { CURRENCIES } from '~/composables/useSettings'
  import CommonPaymentMethodBadge from '~/components/common/PaymentMethodBadge.vue'
  import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'

  const { formatAmount: globalFormat } = useCurrency()

  type SharedAvatar = { src?: string | null; fallback: string }

  interface Props {
    expense: Expense
    sharedAvatars?: SharedAvatar[]
    currency?: string
  }

  const props = defineProps<Props>()

  defineEmits<{
    click: [expense: Expense]
  }>()

  const categoryInfo = computed(() => getCategoryInfo(props.expense.category))

  const categoryBorderColor = computed(() => {
    return categoryInfo.value.borderColor
  })

  const formattedAmount = computed(() => {
    if (props.currency) {
      const symbol = CURRENCIES.find(c => c.code === props.currency)?.symbol || '$'
      return `${symbol}${props.expense.amount.toLocaleString()}`
    }
    return globalFormat(props.expense.amount)
  })

  const normalizedSharedAvatars = computed(() => {
    const input = Array.isArray(props.sharedAvatars) ? props.sharedAvatars : []
    return input
      .filter((p) => !!p && typeof p.fallback === 'string' && p.fallback.length > 0)
      .map((p, idx) => ({
        key: `${idx}:${p.fallback}:${String(p.src || '')}`,
        src: p.src || null,
        fallback: String(p.fallback).slice(0, 2)
      }))
  })

  const visibleSharedAvatars = computed(() => normalizedSharedAvatars.value.slice(0, 3))
  const extraSharedCount = computed(() => Math.max(0, normalizedSharedAvatars.value.length - visibleSharedAvatars.value.length))
</script>
