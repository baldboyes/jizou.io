<template>
  <Drawer v-model:open="isOpen">
    <DrawerContent class="h-[90vh] flex flex-col fixed bottom-0 left-0 right-0 w-full mx-auto rounded-xl">
      <DrawerHeader class="w-full max-w-7xl mx-auto px-4">
        <DrawerTitle>{{ isEditMode ? 'Editar Gasto' : 'Nuevo Gasto' }}</DrawerTitle>
      </DrawerHeader>

      <ScrollArea class="flex-1 h-[calc(90vh-180px)] px-0 pb-0">
        <div class="max-w-7xl mx-auto flex gap-16 flex-col lg:flex-row px-4">
          <!-- Left Column: Form -->
          <div class="w-full lg:w-2/3 space-y-4 py-4">
            <form id="expense-form" @submit.prevent="handleSubmit" class="space-y-4">
              <div class="flex items-start justify-between gap-4">
                <div class="w-3/4 space-y-4">
                  <!-- Amount -->
                  <div>
                    <Label for="amount" class="text-base">Gasto ({{ currencySymbol }}) *</Label>
                    <div class="relative mt-2">
                      <span class="absolute left-2 top-4 text-lg text-neutral-600">{{ currencySymbol }}</span>
                      <Input
                        id="amount"
                        v-model="form.amount"
                        type="number"
                        inputmode="decimal"
                        placeholder="1,200"
                        class="pl-6 text-xl h-14 bg-white"
                        required
                        step="1"
                        min="1"
                      />
                    </div>
                  </div>
                  <!-- Place Name -->
                  <div>
                    <Label for="placeName" class="text-base">Nombre del Lugar *</Label>
                    <Input
                      id="placeName"
                      v-model="form.placeName"
                      type="text"
                      placeholder="Ej: Ichiran Ramen"
                      class="mt-2 h-14 text-xl bg-white"
                      required
                    />
                  </div>
                </div>

                <!-- Payment Method -->
                <div class="w-1/4">
                  <Label class="text-base mb-3 block">Pago *</Label>
                  <div class="flex flex-col items-center gap-2 w-full justify-between -mt-1">
                    <button
                      type="button"
                      class="flex flex-col items-center justify-center gap-0 p-0 rounded-lg border-2 transition-all h-12 w-full"
                      :class="[
                        form.paymentMethod === 'cash'
                          ? 'border-red-500 bg-red-50'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      ]"
                      @click="form.paymentMethod = 'cash'"
                    >
                      <span class="text-2xl">💴</span>
                    </button>
                    <button
                      type="button"
                      class="flex flex-col items-center justify-center gap-0 p-0 rounded-lg border-2 transition-all h-12 w-full"
                      :class="[
                        form.paymentMethod === 'card'
                          ? 'border-red-500 bg-red-50'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      ]"
                      @click="form.paymentMethod = 'card'"
                    >
                      <span class="text-2xl">💳</span>
                    </button>
                    <button
                      type="button"
                      class="flex flex-col items-center justify-center gap-0 p-0 rounded-lg border-2 transition-all h-12 w-full"
                      :class="[
                        form.paymentMethod === 'ic'
                          ? 'border-red-500 bg-red-50'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      ]"
                      @click="form.paymentMethod = 'ic'"
                    >
                      <img src="/ic.webp" alt="IC" class="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Category -->
              <CategorySelector :model-value="form.category" @update:model-value="form.category = $event" />

              <!-- Date and Time -->
              <div class="w-full">
                <Label for="date" class="text-base mb-2 block">Fecha y Hora *</Label>
                <DateTimePicker 
                  v-model="form.date" 
                  class="w-full"
                />
              </div>

              <!-- Location -->
              <div>
                <Label class="text-base mb-2 block">Ubicación *</Label>
                <Card>
                  <CardContent class="py-0 px-4 space-y-2">
                    <button
                      v-if="!locationCaptured && !isEditMode"
                      type="button"
                      class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      @click="showMapEditor = true"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <span>Seleccionar ubicación en el mapa</span>
                    </button>

                    <div v-if="locationCaptured || isEditMode" class="space-y-3">
                      <div class="flex items-start gap-2 text-sm text-neutral-700 bg-red-50 p-3 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 text-red-600">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="m9 12 2 2 4-4"/>
                        </svg>
                        <div>
                          <div class="font-medium">{{ form.location.city || 'Sin ubicación' }}</div>
                          <div class="text-xs text-neutral-600">{{ form.location.prefecture || 'Sin prefectura' }}</div>
                        </div>
                      </div>

                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                          @click="showMapEditor = true"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          Cambiar ubicación
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <!-- Notes -->
              <div>
                <Label for="notes" class="text-base">Notas</Label>
                <Textarea
                  id="notes"
                  v-model="form.notes"
                  placeholder="Agrega detalles adicionales sobre este gasto..."
                  class="mt-2 min-h-[100px] bg-white"
                />
              </div>

              <!-- Shared -->
              <div class="flex items-center space-x-3 p-3 bg-neutral-50 rounded-xl cursor-pointer" @click="toggleShared">
                <div
                  class="size-4 shrink-0 rounded-[4px] border shadow-xs transition-all flex items-center justify-center"
                  :class="form.shared ? 'bg-red-600 border-red-600' : 'bg-white border-neutral-300'"
                >
                  <svg
                    v-if="form.shared"
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <Label class="text-base cursor-pointer flex items-center gap-2 pointer-events-none select-none">
                  <span>👥</span>
                  <span>{{ t('expenses.shared.toggle') }}</span>
                </Label>
              </div>

              <Card v-if="form.shared" class="bg-white">
                <CardContent class="p-4 space-y-4">
                  <div class="font-medium text-neutral-900">{{ t('expenses.shared.section_title') }}</div>

                  <div class="space-y-2">
                    <Label class="text-xs mb-1.5 block text-neutral-500">{{ t('expenses.shared.paid_by_label') }}</Label>
                    <Select :model-value="paidByTripUserId ? String(paidByTripUserId) : ''" @update:model-value="paidByTripUserId = Number($event)">
                      <SelectTrigger class="w-full bg-white">
                        <SelectValue :placeholder="t('expenses.shared.paid_by_label')" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="p in tripParticipants" :key="p.tripUserId" :value="String(p.tripUserId)">
                          {{ p.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div class="space-y-2">
                    <Label class="text-xs mb-1.5 block text-neutral-500">{{ t('expenses.shared.participants_label') }}</Label>
                    <div class="space-y-2">
                      <button
                        v-for="p in tripParticipants"
                        :key="p.tripUserId"
                        type="button"
                        class="w-full flex items-center justify-between px-3 py-2 rounded-md border bg-white hover:bg-neutral-50 transition-colors"
                        @click="toggleParticipant(p.tripUserId)"
                      >
                        <span class="text-sm font-medium text-neutral-900 truncate">{{ p.label }}</span>
                        <div
                          class="size-4 shrink-0 rounded-[4px] border shadow-xs transition-all flex items-center justify-center"
                          :class="selectedTripUserIds.includes(p.tripUserId) ? 'bg-red-600 border-red-600' : 'bg-white border-neutral-300'"
                        >
                          <svg
                            v-if="selectedTripUserIds.includes(p.tripUserId)"
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <Label class="text-xs mb-1.5 block text-neutral-500">{{ t('expenses.shared.split_label') }}</Label>
                    <div class="flex gap-2">
                      <Button type="button" variant="outline" :class="sharedSplitMode === 'equal' ? 'border-red-500 bg-red-50' : ''" @click="setSharedSplitMode('equal')">
                        {{ t('expenses.shared.split_equal') }}
                      </Button>
                      <Button type="button" variant="outline" :class="sharedSplitMode === 'custom' ? 'border-red-500 bg-red-50' : ''" @click="setSharedSplitMode('custom')">
                        {{ t('expenses.shared.split_custom') }}
                      </Button>
                    </div>

                    <div class="space-y-2">
                      <div v-for="p in selectedParticipants" :key="p.tripUserId" class="grid grid-cols-12 gap-2 items-center">
                        <div class="col-span-5 text-sm font-medium text-neutral-900 truncate">{{ p.label }}</div>
                        <div class="col-span-3">
                          <Input
                            type="number"
                            inputmode="decimal"
                            :disabled="sharedSplitMode === 'equal'"
                            :model-value="splitDraft[p.tripUserId]?.percentage ?? ''"
                            :placeholder="t('expenses.shared.percentage_label')"
                            class="bg-white"
                            @update:model-value="onPercentageChange(p.tripUserId, $event)"
                          />
                        </div>
                        <div class="col-span-4">
                          <Input
                            type="number"
                            inputmode="decimal"
                            :disabled="sharedSplitMode === 'equal'"
                            :model-value="splitDraft[p.tripUserId]?.amount ?? ''"
                            :placeholder="t('expenses.shared.amount_label')"
                            class="bg-white"
                            @update:model-value="onAmountChange(p.tripUserId, $event)"
                          />
                        </div>
                      </div>
                      <div v-if="sharedSplitError" class="text-sm text-red-600">{{ sharedSplitError }}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </form>
          </div>

          <!-- Right Column: Image Placeholder -->
          <div class="w-full lg:w-1/3 space-y-8 py-4">
             <div class="border-2 border-dashed border-neutral-200 rounded-lg p-8 text-center text-neutral-500 h-full flex items-center justify-center">
               <div class="space-y-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-neutral-400">
                   <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                   <circle cx="9" cy="9" r="2"/>
                   <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                 </svg>
                 <p>Zona para subir imágenes<br>(Próximamente)</p>
               </div>
             </div>
          </div>
        </div>
      </ScrollArea>

      <DrawerFooter class="max-w-3xl mx-auto w-full">
        <div class="flex gap-3 w-full">
          <Button
            v-if="isEditMode"
            type="button"
            variant="ghost"
            class="text-red-600 hover:text-red-700 hover:bg-red-50 h-14 w-14 p-0 shrink-0 border border-red-200"
            @click="showDeleteConfirm = true"
            :disabled="isSubmitting"
          >
            <Trash2 class="h-6 w-6" />
          </Button>

          <Button
            v-if="!isEditMode"
            type="button"
            variant="outline"
            class="w-1/3 h-14"
            @click="handleSavePlanned"
            :disabled="!isFormValid || isSubmitting"
          >
            Previsto
          </Button>
          <Button
            type="button"
            class="flex-1 bg-red-600 hover:from-red-600 hover:to-red-700 h-14"
            :disabled="!isFormValid || isSubmitting"
            @click="handleSubmit"
          >
            <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isSubmitting ? 'Guardando...' : (isEditMode ? 'Actualizar' : 'Añadir') }}
          </Button>
        </div>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>

  <!-- Map Editor Dialog -->
  <Dialog v-model:open="showMapEditor">
    <DialogContent class="max-w-4xl h-[85vh] flex flex-col p-0">
      <DialogHeader class="px-6 pt-6 pb-4 shrink-0">
        <DialogTitle>Editar ubicación en el Mapa</DialogTitle>
        <DialogDescription>
          Toca en el mapa para cambiar la ubicación del gasto
        </DialogDescription>
      </DialogHeader>
      <div class="flex-1 px-6 min-h-0">
        <MapsEditable
          :latitude="form.location.coordinates.lat"
          :longitude="form.location.coordinates.lng"
          @location-change="handleLocationChange"
        />
      </div>
      <DialogFooter class="px-6 pb-6 pt-4 shrink-0">
        <Button variant="outline" @click="showMapEditor = false">
          Cerrar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete Confirmation Dialog -->
  <AlertDialog v-model:open="showDeleteConfirm">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
        <AlertDialogDescription>
          Esta acción no se puede deshacer. Se eliminará permanentemente el gasto "{{ form.placeName }}".
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <AlertDialogAction @click="handleDelete" class="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { toast } from 'vue-sonner'
import { Trash2 } from 'lucide-vue-next'
import { useI18n } from '#imports'
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerFooter,
  DrawerDescription 
} from '~/components/ui/drawer'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '~/components/ui/dialog'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Button } from '~/components/ui/button'
import { DateTimePicker } from '~/components/ui/date-time-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import type { ExpenseCategory, PaymentMethod, Expense } from '~/types'
import CategorySelector from '~/components/common/CategorySelector.vue'
import { CURRENCIES } from '~/composables/useSettings'
import { useExpensesNew } from '~/composables/useExpensesNew'
import { useGeolocation } from '~/composables/useGeolocation'
import { useTripsNew } from '~/composables/useTripsNew'
import { useDirectusRepo } from '~/composables/useDirectusRepo'
import { useSharedExpenses } from '~/composables/useSharedExpenses'
import { nowFloatingIsoZ, toIsoZFromFloatingInput } from '~/utils/floatingDateTime'

const props = defineProps<{
  open: boolean
  tripId: string | number
  expenseToEdit?: Expense | null
  tripMoneda?: string | null
}>()

const emit = defineEmits(['update:open', 'success'])
const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const currencySymbol = computed(() => {
  if (!props.tripMoneda) return '$'
  const currencyInfo = CURRENCIES.find(c => c.code === props.tripMoneda)
  return currencyInfo?.symbol || '$'
})

const { createExpense, updateExpense, deleteExpense } = useExpensesNew()
const { getCurrentLocation } = useGeolocation()
const { collaborators, fetchCollaborators } = useTripsNew()
const { directusUserId } = useDirectusRepo()
const { fetchExpenseSplits, upsertExpenseSplits, deleteExpenseSplits } = useSharedExpenses()

// Check if we're in edit mode
const isEditMode = computed(() => !!props.expenseToEdit)

// Form state
const form = reactive({
  amount: '',
  placeName: '',
  category: 'food' as ExpenseCategory,
  date: '', // ISO string
  location: {
    coordinates: {
      lat: 0,
      lng: 0
    },
    city: '',
    prefecture: ''
  },
  paymentMethod: 'cash' as PaymentMethod,
  shared: false,
  notes: ''
})

const isSubmitting = ref(false)
const locationCaptured = ref(false)
const showMapEditor = ref(false)
const showDeleteConfirm = ref(false)

type TripParticipant = { tripUserId: number; label: string; userId: string | null }

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

const selectedTripUserIds = ref<number[]>([])
const paidByTripUserId = ref<number | null>(null)
const sharedSplitMode = ref<'equal' | 'custom'>('equal')
const splitDraft = ref<Record<number, { amount: number; percentage: number }>>({})
const sharedSplitError = ref<string | null>(null)
const lastEditedSplitField = ref<'amount' | 'percentage' | null>(null)

const selectedParticipants = computed(() => {
  const set = new Set(selectedTripUserIds.value.map(Number))
  return tripParticipants.value.filter(p => set.has(p.tripUserId))
})

const totalAmount = computed(() => {
  const n = Math.round(Number(form.amount))
  return Number.isFinite(n) && n > 0 ? n : 0
})

watch(totalAmount, () => {
  if (!form.shared) return
  if (sharedSplitMode.value === 'equal') {
    recomputeEqualSplits()
    return
  }
  if (lastEditedSplitField.value === 'amount') recomputeFromAmounts()
  else recomputeFromPercentages()
})

function ensurePaidByIsValid() {
  if (!paidByTripUserId.value || !selectedTripUserIds.value.includes(paidByTripUserId.value)) {
    const fallback = selectedTripUserIds.value[0] || null
    paidByTripUserId.value = fallback
  }
}

watch(paidByTripUserId, (next) => {
  if (!form.shared) return
  const id = Number(next ?? 0)
  if (!id) return
  if (!selectedTripUserIds.value.includes(id)) {
    selectedTripUserIds.value.push(id)
    splitDraft.value = {
      ...splitDraft.value,
      [id]: splitDraft.value[id] || { amount: 0, percentage: 0 }
    }
  }
  if (sharedSplitMode.value === 'equal') {
    recomputeEqualSplits()
  } else if (lastEditedSplitField.value === 'amount') {
    recomputeFromAmounts()
  } else {
    recomputeFromPercentages()
  }
})

function recomputeEqualSplits() {
  sharedSplitError.value = null
  const total = totalAmount.value
  const ids = selectedTripUserIds.value
  if (!total || ids.length === 0) return

  const base = Math.floor(total / ids.length)
  const remainder = total % ids.length

  const next: Record<number, { amount: number; percentage: number }> = {}
  ids.forEach((id, idx) => {
    const amount = base + (idx < remainder ? 1 : 0)
    const percentage = total ? Number(((amount / total) * 100).toFixed(2)) : 0
    next[id] = { amount, percentage }
  })
  splitDraft.value = next
}

function recomputeFromPercentages() {
  sharedSplitError.value = null
  const total = totalAmount.value
  const ids = selectedTripUserIds.value
  if (!total || ids.length === 0) return

  const raw = ids.map(id => {
    const p = Number(splitDraft.value[id]?.percentage ?? 0)
    return { id, p: Number.isFinite(p) ? p : 0 }
  })

  const sumP = raw.reduce((acc, r) => acc + r.p, 0)
  if (Math.abs(sumP - 100) > 0.01) {
    sharedSplitError.value = t('expenses.shared.validation.percentages_must_equal_100')
    return
  }

  const floors = raw.map(r => {
    const exact = (total * r.p) / 100
    return { id: r.id, exact, floor: Math.floor(exact), frac: exact - Math.floor(exact) }
  })

  let remaining = total - floors.reduce((acc, r) => acc + r.floor, 0)
  floors.sort((a, b) => b.frac - a.frac)

  const next: Record<number, { amount: number; percentage: number }> = {}
  for (const r of floors) {
    const add = remaining > 0 ? 1 : 0
    if (remaining > 0) remaining -= 1
    const amount = r.floor + add
    next[r.id] = { amount, percentage: Number(((amount / total) * 100).toFixed(2)) }
  }

  splitDraft.value = next
}

function recomputeFromAmounts() {
  sharedSplitError.value = null
  const total = totalAmount.value
  const ids = selectedTripUserIds.value
  if (!total || ids.length === 0) return

  const sum = ids.reduce((acc, id) => acc + Number(splitDraft.value[id]?.amount ?? 0), 0)
  if (sum !== total) {
    sharedSplitError.value = t('expenses.shared.validation.amounts_must_match_total')
    return
  }

  const next: Record<number, { amount: number; percentage: number }> = {}
  ids.forEach((id) => {
    const amount = Math.round(Number(splitDraft.value[id]?.amount ?? 0))
    next[id] = { amount, percentage: total ? Number(((amount / total) * 100).toFixed(2)) : 0 }
  })
  splitDraft.value = next
}

function setSharedSplitMode(mode: 'equal' | 'custom') {
  sharedSplitMode.value = mode
  if (mode === 'equal') {
    recomputeEqualSplits()
  } else {
    lastEditedSplitField.value = lastEditedSplitField.value || 'percentage'
    if (lastEditedSplitField.value === 'amount') recomputeFromAmounts()
    else recomputeFromPercentages()
  }
}

function toggleParticipant(tripUserId: number) {
  const id = Number(tripUserId)
  if (!id) return
  const idx = selectedTripUserIds.value.indexOf(id)
  if (idx === -1) selectedTripUserIds.value.push(id)
  else selectedTripUserIds.value.splice(idx, 1)

  const next: Record<number, { amount: number; percentage: number }> = {}
  for (const pid of selectedTripUserIds.value) {
    next[pid] = splitDraft.value[pid] || { amount: 0, percentage: 0 }
  }
  splitDraft.value = next
  ensurePaidByIsValid()

  if (sharedSplitMode.value === 'equal') {
    recomputeEqualSplits()
  } else if (lastEditedSplitField.value === 'amount') {
    recomputeFromAmounts()
  } else {
    recomputeFromPercentages()
  }
}

function onPercentageChange(tripUserId: number, value: string | number) {
  lastEditedSplitField.value = 'percentage'
  const v = Number(value)
  splitDraft.value[tripUserId] = {
    amount: Number(splitDraft.value[tripUserId]?.amount ?? 0),
    percentage: Number.isFinite(v) ? v : 0
  }
  recomputeFromPercentages()
}

function onAmountChange(tripUserId: number, value: string | number) {
  lastEditedSplitField.value = 'amount'
  const v = Math.round(Number(value))
  splitDraft.value[tripUserId] = {
    amount: Number.isFinite(v) ? v : 0,
    percentage: Number(splitDraft.value[tripUserId]?.percentage ?? 0)
  }
  recomputeFromAmounts()
}

async function loadSharedDefaults() {
  await fetchCollaborators(Number(props.tripId))

  selectedTripUserIds.value = tripParticipants.value.map(p => p.tripUserId)
  const current = tripParticipants.value.find(p => p.userId && directusUserId.value && p.userId === directusUserId.value)
  paidByTripUserId.value = current?.tripUserId || selectedTripUserIds.value[0] || null
  sharedSplitMode.value = 'equal'
  recomputeEqualSplits()
}

// Reset form when drawer opens/closes or edit mode changes
watch(() => props.open, async (newVal) => {
  if (newVal) {
    if (props.expenseToEdit) {
      // Load existing expense (using AppExpense structure - English keys)
      const expense = props.expenseToEdit
      form.amount = expense.amount.toString()
      form.placeName = expense.placeName
      form.category = expense.category
      
      // Ensure date is in ISO format for the picker
      if (expense.timestamp) {
        form.date = /[zZ]|[+-]\d{2}:\d{2}$/.test(expense.timestamp)
          ? expense.timestamp
          : (toIsoZFromFloatingInput(expense.timestamp.includes(' ') && !expense.timestamp.includes('T') ? expense.timestamp.replace(' ', 'T') : expense.timestamp) || expense.timestamp)
      } else {
        form.date = nowFloatingIsoZ()
      }
      
      form.location = {
        coordinates: {
          lat: expense.location.coordinates.lat || 0,
          lng: expense.location.coordinates.lng || 0
        },
        city: expense.location.city || '',
        prefecture: expense.location.prefecture || ''
      }
      form.paymentMethod = expense.paymentMethod
      form.shared = expense.shared
      paidByTripUserId.value = expense.paidByTripUserId ?? null
      form.notes = expense.notes || ''

      locationCaptured.value = !!(expense.location.city && expense.location.prefecture)

      if (form.shared) {
        await fetchCollaborators(Number(props.tripId))
        if (!paidByTripUserId.value) {
          const current = tripParticipants.value.find(p => p.userId && directusUserId.value && p.userId === directusUserId.value)
          paidByTripUserId.value = current?.tripUserId || tripParticipants.value[0]?.tripUserId || null
        }

        const splits = await fetchExpenseSplits(props.tripId, expense.id).catch(() => [])
        if (splits.length) {
          selectedTripUserIds.value = splits.map(s => Number(s.trip_user_id as any)).filter(Boolean)
          const next: Record<number, { amount: number; percentage: number }> = {}
          for (const s of splits as any[]) {
            const id = Number(s.trip_user_id)
            const amount = Number(s.amount)
            const perc = s.percentage !== null && s.percentage !== undefined
              ? Number(s.percentage)
              : (totalAmount.value ? Number(((amount / totalAmount.value) * 100).toFixed(2)) : 0)
            next[id] = { amount, percentage: perc }
          }
          splitDraft.value = next
          sharedSplitMode.value = 'custom'
          lastEditedSplitField.value = 'amount'
          recomputeFromAmounts()
        } else {
          await loadSharedDefaults()
        }
      }
    } else {
      // New expense
      resetForm()
      selectedTripUserIds.value = []
      paidByTripUserId.value = null
      splitDraft.value = {}
      sharedSplitMode.value = 'equal'
      sharedSplitError.value = null
      lastEditedSplitField.value = null
      
      // Auto-capture location for new expenses
      const result = await getCurrentLocation()
      if (result) {
        form.location = { ...result }
        locationCaptured.value = true
      }

      await loadSharedDefaults()
    }
  }
})

function resetForm() {
  form.amount = ''
  form.placeName = ''
  form.category = 'food'
  form.date = nowFloatingIsoZ()
  form.location = {
    coordinates: { lat: 0, lng: 0 },
    city: '',
    prefecture: ''
  }
  form.paymentMethod = 'cash'
  form.shared = false
  form.notes = ''
  locationCaptured.value = false
}

// Handle location change from map editor
function handleLocationChange(data: { lat: number; lng: number; city: string; prefecture: string }) {
  form.location.coordinates.lat = data.lat
  form.location.coordinates.lng = data.lng
  form.location.city = data.city
  form.location.prefecture = data.prefecture
  locationCaptured.value = true
}

// Toggle shared
function toggleShared() {
  form.shared = !form.shared
  if (form.shared) {
    sharedSplitMode.value = 'equal'
    if (selectedTripUserIds.value.length === 0) {
      selectedTripUserIds.value = tripParticipants.value.map(p => p.tripUserId)
    }
    ensurePaidByIsValid()
    recomputeEqualSplits()
  } else {
    sharedSplitError.value = null
  }
}

// Form validation
const isFormValid = computed(() => {
  return (
    form.amount &&
    parseFloat(form.amount) > 0 &&
    form.placeName.trim() &&
    form.category &&
    form.date &&
    form.location.city.trim() &&
    form.location.prefecture.trim() &&
    form.paymentMethod
  )
})

const isSharedValid = computed(() => {
  if (!form.shared) return true
  if (selectedTripUserIds.value.length === 0) return false
  if (!paidByTripUserId.value) return false
  return !sharedSplitError.value
})

// Helper to format date for API (YYYY-MM-DD HH:MM)
function formatTimestampForApi(isoString: string): string {
  if (!isoString) return ''
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(isoString)) return isoString
  const normalized = toIsoZFromFloatingInput(isoString.includes(' ') && !isoString.includes('T') ? isoString.replace(' ', 'T') : isoString)
  return normalized || isoString
}

function buildSplitsForSave() {
  const total = totalAmount.value
  if (!total) return []
  return selectedTripUserIds.value.map((tripUserId) => {
    const amount = Math.round(Number(splitDraft.value[tripUserId]?.amount ?? 0))
    const percentage = Number(splitDraft.value[tripUserId]?.percentage ?? 0)
    return { trip_user_id: tripUserId, amount, percentage }
  })
}

function validateSharedBeforeSave(): string | null {
  if (!form.shared) return null
  if (selectedTripUserIds.value.length === 0) return t('expenses.shared.validation.no_participants')
  if (!paidByTripUserId.value) return t('expenses.shared.validation.no_participants')
  const splits = buildSplitsForSave()
  if (splits.some(s => !Number.isFinite(s.amount) || s.amount < 0)) return t('expenses.shared.validation.amounts_must_match_total')
  const sumAmounts = splits.reduce((acc, s) => acc + Number(s.amount || 0), 0)
  if (sumAmounts !== totalAmount.value) return t('expenses.shared.validation.amounts_must_match_total')
  if (sharedSplitMode.value === 'custom') {
    if (lastEditedSplitField.value === 'amount') {
      const sum = selectedTripUserIds.value.reduce((acc, id) => acc + Number(splitDraft.value[id]?.amount ?? 0), 0)
      if (sum !== totalAmount.value) return t('expenses.shared.validation.amounts_must_match_total')
    } else {
      const sum = selectedTripUserIds.value.reduce((acc, id) => acc + Number(splitDraft.value[id]?.percentage ?? 0), 0)
      if (Math.abs(sum - 100) > 0.01) return t('expenses.shared.validation.percentages_must_equal_100')
    }
  }
  return null
}

// Submit handler
async function handleSubmit() {
  if (!isFormValid.value || !isSharedValid.value || isSubmitting.value) return

  isSubmitting.value = true

  try {
    const sharedError = validateSharedBeforeSave()
    if (sharedError) {
      toast.error(sharedError)
      return
    }

    const timestamp = formatTimestampForApi(form.date)

    const expenseData = {
      timestamp: timestamp,
      placeName: form.placeName.trim(),
      amount: parseFloat(form.amount),
      category: form.category,
      notes: form.notes.trim(),
      location: {
        coordinates: {
            lat: form.location.coordinates.lat,
            lng: form.location.coordinates.lng
        },
        city: form.location.city,
        prefecture: form.location.prefecture
      },
      paymentMethod: form.paymentMethod,
      shared: form.shared,
      paidByTripUserId: form.shared ? paidByTripUserId.value : null,
      trip_id: props.tripId,
      status: 'real' // Default to real
    }

    if (isEditMode.value && props.expenseToEdit) {
      const wasShared = !!props.expenseToEdit.shared
      if (wasShared) {
        const currentSplits = await fetchExpenseSplits(props.tripId, props.expenseToEdit.id)
        if (currentSplits.some(s => !!s.settled)) throw new Error('shared_expense_locked')
      }

      if (wasShared && !form.shared) {
        await deleteExpenseSplits(props.tripId, props.expenseToEdit.id)
        await updateExpense(props.expenseToEdit.id, expenseData)
        toast.success('Gasto actualizado')
      } else {
        await updateExpense(props.expenseToEdit.id, expenseData)
        if (form.shared) {
          await upsertExpenseSplits(props.tripId, props.expenseToEdit.id, buildSplitsForSave())
          toast.success(t('expenses.toasts.shared_updated'))
        } else {
          toast.success('Gasto actualizado')
        }
      }
    } else {
      const created = await createExpense(expenseData as any)
      if (form.shared) {
        try {
          await upsertExpenseSplits(props.tripId, created.id, buildSplitsForSave())
          toast.success(t('expenses.toasts.shared_created'))
        } catch (e) {
          await deleteExpense(created.id).catch(() => null)
          throw e
        }
      } else {
        toast.success('Gasto añadido')
      }
    }

    emit('success')
    isOpen.value = false
  } catch (error) {
    console.error('Error saving expense:', error)
    if ((error as any)?.message === 'shared_expense_locked') toast.error(t('expenses.toasts.shared_locked'))
    else toast.error('Error al guardar el gasto')
  } finally {
    isSubmitting.value = false
  }
}

// Save as planned expense handler
async function handleSavePlanned() {
  if (!isFormValid.value || !isSharedValid.value || isSubmitting.value) return

  isSubmitting.value = true

  try {
    const sharedError = validateSharedBeforeSave()
    if (sharedError) {
      toast.error(sharedError)
      return
    }

    const timestamp = formatTimestampForApi(form.date)

    const expenseData = {
      timestamp: timestamp,
      placeName: form.placeName.trim(),
      amount: parseFloat(form.amount),
      category: form.category,
      notes: form.notes.trim(),
      location: {
        coordinates: {
            lat: form.location.coordinates.lat,
            lng: form.location.coordinates.lng
        },
        city: form.location.city,
        prefecture: form.location.prefecture
      },
      paymentMethod: form.paymentMethod,
      shared: form.shared,
      paidByTripUserId: form.shared ? paidByTripUserId.value : null,
      trip_id: props.tripId,
      status: 'planned'
    }

    const created = await createExpense(expenseData as any)
    if (form.shared) {
      try {
        await upsertExpenseSplits(props.tripId, created.id, buildSplitsForSave())
        toast.success(t('expenses.toasts.shared_created'))
      } catch (e) {
        await deleteExpense(created.id).catch(() => null)
        throw e
      }
    } else {
      toast.success('Gasto previsto añadido')
    }

    emit('success')
    isOpen.value = false
  } catch (error) {
    console.error('Error saving planned expense:', error)
    if ((error as any)?.message === 'shared_expense_locked') toast.error(t('expenses.toasts.shared_locked'))
    else toast.error('Error al guardar el gasto previsto')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete() {
  if (!props.expenseToEdit || isSubmitting.value) return

  isSubmitting.value = true
  try {
    if (props.expenseToEdit.shared) {
      const splits = await fetchExpenseSplits(props.tripId, props.expenseToEdit.id)
      if (splits.some(s => !!s.settled)) throw new Error('shared_expense_locked')
    }
    await deleteExpense(props.expenseToEdit.id)
    toast.success('Gasto eliminado')
    emit('success')
    isOpen.value = false
    showDeleteConfirm.value = false
  } catch (error) {
    console.error('Error deleting expense:', error)
    if ((error as any)?.message === 'shared_expense_locked') toast.error(t('expenses.toasts.shared_locked'))
    else toast.error('Error al eliminar el gasto')
  } finally {
    isSubmitting.value = false
  }
}
</script>
