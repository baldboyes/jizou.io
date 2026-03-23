<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { useTripOrganizationNew } from '~/composables/useTripOrganizationNew'
  import type { Transport } from '~/types/directus'
  import { useTripItemForm } from '~/composables/useTripItemForm'
  import { addDays, addHours, formatDateTime, formatDate } from '~/utils/dates'
  import { differenceInDays, differenceInHours } from 'date-fns'
  import { nowFloatingIsoZ, toFloatingLocalDate } from '~/utils/floatingDateTime'
  import { 
    Drawer, 
    DrawerContent, 
    DrawerHeader, 
    DrawerTitle, 
    DrawerFooter,
    DrawerDescription 
  } from '~/components/ui/drawer'
  import { Button } from '~/components/ui/button'
  import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import CurrencySelector from '~/components/ui/CurrencySelector/CurrencySelector.vue'
import { DateTimePicker } from '~/components/ui/date-time-picker'
import FileUploader from '~/components/ui/FileUploader/FileUploader.vue'
  import FileList from '~/components/ui/FileList/FileList.vue'
  import { useDirectusRepo } from '~/composables/useDirectusRepo'
  import { readItem } from '@directus/sdk'
  import { Plus, Trash2 } from 'lucide-vue-next'

  const props = defineProps<{
    open: boolean
    tripId: string | number
    currentTrip?: any
    itemToEdit?: any
  }>()

  const emit = defineEmits(['update:open', 'saved'])
  const { t } = useI18n()

  const { createTransport, updateTransport, transports } = useTripOrganizationNew()
  const { getClient } = useDirectusRepo()

  type FormState = Partial<Transport> & {
    duracion_cantidad?: number
  }

  const availablePasses = computed(() => {
    return transports.value.filter(t => t.category === 'pass')
  })

  // Initialize generic form logic
  const { 
    formData, 
    handleCreate, 
    handleEdit, 
    handleSave 
  } = useTripItemForm<FormState>(
    () => ({ 
      currency: props.currentTrip?.currency || 'JPY', 
      category: 'route', 
      stops: [], 
      price: 0, 
      payment_status: 'pending', 
      duration_type: 'days',
      duracion_cantidad: 1,
      pass_id: null,
      attachments: []
    } as unknown as FormState),
    createTransport,
    updateTransport,
    String(t('trip_transport_drawer.item_label'))
  )

  // Sync open state
  const isOpen = computed({
    get: () => props.open,
    set: (val) => emit('update:open', val)
  })

  // Watch for edit item changes
  watch(() => props.itemToEdit, (newItem) => {
    if (newItem) {
      handleEdit(newItem)
      if (!formData.value.stops) formData.value.stops = []
      
      // Ensure pass_id is set correctly from the edited item
      // Directus might return an object or an ID, handle both
      if (newItem.pass_id) {
          if (typeof newItem.pass_id === 'object' && newItem.pass_id !== null) {
              // @ts-ignore
              formData.value.pass_id = (newItem.pass_id as any).id
          } else {
              formData.value.pass_id = newItem.pass_id
          }
      } else {
          formData.value.pass_id = null
      }

      // Calculate duration if editing a pass
      if (newItem.category === 'pass' && newItem.start_date && newItem.end_date) {
          if (newItem.duration_type === 'hours') {
            const start = toFloatingLocalDate(newItem.start_date)
            const end = toFloatingLocalDate(newItem.end_date)
            if (start && end) {
              formData.value.duracion_cantidad = differenceInHours(end, start)
            }
          } else {
            const start = toFloatingLocalDate(newItem.start_date)
            const end = toFloatingLocalDate(newItem.end_date)
            if (start && end) {
              formData.value.duracion_cantidad = differenceInDays(end, start) + 1
            }
          }
      }
    } else {
    handleCreate()
  }
}, { immediate: true })

watch(isOpen, (isOpened) => {
  if (isOpened && !props.itemToEdit) {
    handleCreate()
  }
})

// Watch for changes to calculate End Date
  watch([() => formData.value.start_date, () => formData.value.duracion_cantidad, () => formData.value.duration_type], () => {
    if (formData.value.category !== 'pass') return
    if (!formData.value.start_date) return

    const amount = Number(formData.value.duracion_cantidad || 0)
    if (amount <= 0) return

    if (formData.value.duration_type === 'hours') {
      formData.value.end_date = addHours(formData.value.start_date, amount)
    } else {
      const daysToAdd = Math.max(0, amount - 1)
      formData.value.end_date = addDays(formData.value.start_date, daysToAdd)
    }
  })

  // Watch for pass selection to auto-set price/payment
  watch(() => formData.value.pass_id, (newVal) => {
    if (newVal && formData.value.category === 'route') {
      formData.value.price = 0
      formData.value.payment_status = 'paid'
    }
  })

  const saveTransport = () => {
    handleSave((data) => {
      // Remove UI-only field
      // @ts-ignore
      delete data.duracion_cantidad
      
      // Calculate derived values for logic but remove them before sending
      let derivedOrigen = ''
      let derivedDestino = ''
      
      if (data.category === 'route' && data.stops && data.stops.length > 0) {
        const sorted = [...data.stops].sort((a: any, b: any) => {
          const da = toFloatingLocalDate(a.departure_time)?.getTime() || 0
          const db = toFloatingLocalDate(b.departure_time)?.getTime() || 0
          return da - db
        })
        
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        
        if (first && last) {
            data.start_date = first.departure_time
            data.end_date = last.arrival_time
            
            derivedOrigen = first.departure_place
            derivedDestino = last.arrival_place
        }
        
        // Clean up system fields from nested scales to ensure clean JSON
        data.stops = data.stops.map((e: any) => {
          const clean = { ...e }
          // @ts-ignore
          delete clean.user_created
          // @ts-ignore
          delete clean.user_updated
          // @ts-ignore
          delete clean.date_created
          // @ts-ignore
          delete clean.date_updated
          // @ts-ignore
          delete clean.id
          return clean
        })
      }

      // Default title if empty
      if (!data.name) {
        if (data.category === 'pass') {
            data.name = String(t('trip_transport_drawer.defaults.pass_name'))
        } else {
            // Use derived values or fallback to existing ones (if editing) or defaults
            // We cast to any to access the properties we are about to delete
            const start = derivedOrigen || (data as any).departure_place || String(t('trip_transport_drawer.defaults.origin'))
            const end = derivedDestino || (data as any).arrival_place || String(t('trip_transport_drawer.defaults.destination'))
            data.name = `${start} ➝ ${end}`
        }
      }
      
      // Ensure pass_id is an ID (Directus expects ID, not object)
      if (data.pass_id && typeof data.pass_id === 'object') {
          // @ts-ignore
          data.pass_id = (data.pass_id as any).id
      }

      // Remove calculated fields that don't exist in backend
      delete (data as any).departure_place
      delete (data as any).arrival_place
      delete (data as any).type
      
      data.trip_id = typeof props.tripId === 'string' ? parseInt(props.tripId) : props.tripId
      return data
    }, () => {
      emit('saved')
      emit('update:open', false)
    })
  }

  const isValid = computed(() => {
    // if (!formData.value.nombre) return false
    if (formData.value.category === 'pass') {
      return formData.value.start_date && formData.value.end_date
    }
    return true
  })

  const formId = computed(() => (formData.value as any).id)
  const formAdjuntos = computed(() => (formData.value as any).attachments || [])

  const onFileUploaded = async () => {
    // @ts-ignore
    if (!formData.value.id) return
    
    try {
      const client = await getClient()
      // @ts-ignore
      const response = await client.request(readItem('transports', formData.value.id, {
        fields: ['attachments.directus_files_id.*']
      }))
      
      // Update attachments in form data
      // @ts-ignore
      if (response && response.attachments) {
        // @ts-ignore
        formData.value.attachments = response.attachments
      }
    } catch (e) {
      console.error('Error refreshing attachments:', e)
    }
  }

  // Escalas Logic
  const addEscala = () => {
    if (!formData.value.stops) formData.value.stops = []
    formData.value.stops.push({
      departure_time: formData.value.start_date || nowFloatingIsoZ(),
      arrival_time: formData.value.start_date || nowFloatingIsoZ(),
      departure_place: '',
      arrival_place: '',
      type: 'train'
    })
  }

  const removeEscala = (index: number) => {
    if (formData.value.stops) {
      formData.value.stops.splice(index, 1)
    }
  }

  const paseIdString = computed({
    get: () => formData.value.pass_id ? String(formData.value.pass_id) : 'none',
    set: (val: string) => {
      formData.value.pass_id = val === 'none' ? null : String(val)
    }
  })
</script>

<template>
  <Drawer v-model:open="isOpen">
    <DrawerContent class="h-[90vh] flex flex-col fixed bottom-0 left-0 right-0 w-full mx-auto rounded-xl">
      <DrawerHeader class="w-full max-w-7xl mx-auto px-4">
        <DrawerTitle>{{ formData.id ? $t('trip_transport_drawer.title.edit') : $t('trip_transport_drawer.title.new') }}</DrawerTitle>
      </DrawerHeader>
      <ScrollArea class="flex-1 h-[calc(90vh-180px)] px-0 pb-0">
        <div class="max-w-7xl mx-auto flex gap-16 flex-col lg:flex-row px-4">
          <div class="w-full lg:w-2/3 space-y-4 py-4">
            <div v-if="formData.category === 'pass'">
              <Label>{{ $t('trip_transport_drawer.fields.title') }}</Label>
              <Input v-model="formData.name" :placeholder="$t('trip_transport_drawer.placeholders.title')" />
            </div>

            <div>
              <Label>{{ $t('trip_transport_drawer.fields.category') }}</Label>
              <div class="flex gap-2">
                <Select v-model="formData.category" class="flex-1">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pass">{{ $t('trip_transport_drawer.category.pass') }}</SelectItem>
                    <SelectItem value="route">{{ $t('trip_transport_drawer.category.route') }}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select v-if="formData.category === 'pass'" v-model="formData.duration_type" class="w-32">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">{{ $t('trip_transport_drawer.duration_type.days') }}</SelectItem>
                    <SelectItem value="hours">{{ $t('trip_transport_drawer.duration_type.hours') }}</SelectItem>
                  </SelectContent>
                </Select>

                <Select v-if="formData.category === 'route'" v-model="paseIdString" class="w-full">
                   <SelectTrigger>
                      <SelectValue :placeholder="$t('trip_transport_drawer.placeholders.associate_pass')" />
                   </SelectTrigger>
                   <SelectContent>
                      <SelectItem value="none">{{ $t('trip_transport_drawer.associate.none') }}</SelectItem>
                      <SelectItem v-for="pase in availablePasses" :key="pase.id" :value="String(pase.id)">
                        {{ pase.name }}
                      </SelectItem>
                   </SelectContent>
                </Select>
              </div>
            </div>

            <!-- PASE -->
            <template v-if="formData.category === 'pass'">
               <div class="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{{ $t('trip_transport_drawer.fields.valid_from') }}</Label>
                    <DateTimePicker 
                      v-model="formData.start_date" 
                      :min="currentTrip?.start_date || undefined"
                      :max="currentTrip?.end_date || undefined"
                    />
                  </div>
                  <div>
                    <Label>{{ $t('trip_transport_drawer.fields.duration') }}</Label>
                    <Input type="number" v-model="formData.duracion_cantidad" min="1" />
                  </div>
               </div>
               <div>
                  <Label>{{ $t('trip_transport_drawer.fields.valid_until_calculated') }}</Label>
                  <Input :model-value="formatDateTime(formData.end_date)" disabled class="bg-muted" />
               </div>
            </template>

            <!-- TRAYECTO (ESCALAS) -->
            <template v-if="formData.category === 'route'">
               <div class="space-y-3">
                  <div class="flex justify-between items-center py-2">
                     <Label class="font-bold">{{ $t('trip_transport_drawer.scales.title') }}</Label>
                     <Button size="sm" @click="addEscala"><Plus class="h-3 w-3 mr-1" /> {{ $t('trip_transport_drawer.actions.add') }}</Button>
                  </div>

                  <div v-if="!formData.stops || formData.stops.length === 0" class="text-sm text-center py-6 border-2 border-dashed rounded-lg bg-slate-50 text-muted-foreground">
                     <p>{{ $t('trip_transport_drawer.scales.empty.title') }}</p>
                     <Button variant="link" size="sm" @click="addEscala">{{ $t('trip_transport_drawer.scales.empty.cta') }}</Button>
                  </div>

                  <div v-for="(escala, index) in formData.stops" :key="index" class="p-4 rounded-lg relative bg-neutral-50 shadow-sm">
                     <div class="flex justify-between items-center pb-6">
                        <span class="font-bold text-sm text-slate-600 flex items-center gap-2">
                           <div class="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs">{{ index + 1 }}</div>
                           {{ $t('trip_transport_drawer.scales.item_title') }}
                        </span>
                        <Button @click="removeEscala(index)" variant="destructive" size="sm">
                           <Trash2 class="h-4 w-4" />
                        </Button>
                     </div>

                     <div class="space-y-4">

                        <div>
                          <Label>{{ $t('trip_transport_drawer.fields.transport_mode') }}</Label>
                          <Select v-model="escala.type">
                              <SelectTrigger class="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="train">{{ $t('trip_transport_drawer.transport_mode.train') }}</SelectItem>
                                <SelectItem value="metro">{{ $t('trip_transport_drawer.transport_mode.metro') }}</SelectItem>
                                <SelectItem value="bus">{{ $t('trip_transport_drawer.transport_mode.bus') }}</SelectItem>
                                <SelectItem value="ferry">{{ $t('trip_transport_drawer.transport_mode.ferry') }}</SelectItem>
                                <SelectItem value="taxi">{{ $t('trip_transport_drawer.transport_mode.taxi') }}</SelectItem>
                                <SelectItem value="walk">{{ $t('trip_transport_drawer.transport_mode.walk') }}</SelectItem>
                              </SelectContent>
                          </Select>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div class="gap-3 space-y-4">
                              <div>
                                <Label>{{ $t('trip_transport_drawer.fields.origin') }}</Label>
                                <Input class="h-9" v-model="escala.departure_place" :placeholder="$t('trip_transport_drawer.placeholders.origin')" />
                              </div>
                              <div>
                                 <Label>{{ $t('trip_transport_drawer.fields.departure') }}</Label>
                                 <DateTimePicker v-model="escala.departure_time" />
                              </div>
                           </div>
                           <div class="gap-3 space-y-4">
                              <div>
                                 <Label>{{ $t('trip_transport_drawer.fields.destination') }}</Label>
                                 <Input class="h-9" v-model="escala.arrival_place" :placeholder="$t('trip_transport_drawer.placeholders.destination')" />
                              </div>
                              <div>
                                 <Label>{{ $t('trip_transport_drawer.fields.arrival') }}</Label>
                                 <DateTimePicker v-model="escala.arrival_time" />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </template>

            <div v-if="formData.category === 'pass' || (formData.category === 'route' && !formData.pass_id)" class="grid grid-cols-[2fr_1fr_1fr] gap-3 mt-2">
              <div>
                <Label>{{ $t('trip_transport_drawer.fields.total_price') }}</Label>
                <Input 
                  type="number" 
                  v-model="formData.price" 
                  :step="formData.currency === 'JPY' ? '1' : '0.01'" 
                />
              </div>
              <div>
                <Label>{{ $t('trip_transport_drawer.fields.currency') }}</Label>
                <CurrencySelector v-model="formData.currency" />
              </div>
              <div>
                <Label>{{ $t('trip_transport_drawer.fields.status') }}</Label>
                <Select v-model="formData.payment_status">
                  <SelectTrigger><SelectValue :placeholder="$t('trip_transport_drawer.placeholders.status')" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{{ $t('trip_transport_drawer.status.pending') }}</SelectItem>
                    <SelectItem value="paid">{{ $t('trip_transport_drawer.status.paid') }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
               <Label>{{ $t('trip_transport_drawer.fields.notes') }}</Label>
               <Textarea v-model="formData.notes" rows="3" />
            </div>

          </div>
          <div class="w-full lg:w-1/3 space-y-8">
            <div v-if="formData.id" class="pb-8">
              <div class="flex justify-between items-center mb-2">
                <Label>{{ $t('trip_transport_drawer.fields.attachments') }}</Label>
                <FileUploader collection="transports" :item-id="formId" @uploaded="onFileUploaded" />
              </div>
              <FileList :files="formAdjuntos" collection="transports" @deleted="onFileUploaded" />
            </div>
          </div>
        </div>
      </ScrollArea>
      <DrawerFooter class="max-w-3xl mx-auto w-full">
        <Button @click="saveTransport" :disabled="!isValid">{{ $t('trip_transport_drawer.actions.save') }}</Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
