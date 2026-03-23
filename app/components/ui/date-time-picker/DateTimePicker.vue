<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Calendar as CalendarIcon, Clock } from 'lucide-vue-next'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { cn } from '~/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toDateTimeLocalInput, toFloatingLocalDate, toIsoZFromFloatingDate } from '~/utils/floatingDateTime'
import { 
  parseDate, 
  type DateValue 
} from '@internationalized/date'

const props = defineProps<{
  modelValue?: string | null
  min?: string
  max?: string
  defaultTime?: string
  hideTime?: boolean
  fullWidth?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)

// Time state
const hours = ref<string | number>(12)
const minutes = ref<string | number>(0)

// Calendar state (DateValue)
const dateVal = ref<DateValue | undefined>(undefined)

// Initialize from props
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    const d = toFloatingLocalDate(newVal)
    if (d && !isNaN(d.getTime())) {
      hours.value = String(d.getHours()).padStart(2, '0')
      minutes.value = String(d.getMinutes()).padStart(2, '0')

      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      try {
        // Only update dateVal if different to avoid loop
        const parsed = parseDate(isoDate)
        if (!dateVal.value || dateVal.value.toString() !== parsed.toString()) {
           dateVal.value = parsed
        }
      } catch (e) {
        // Ignore parse error
      }
    }
  } else {
    // Keep internal state if just clearing? Or clear?
    // If external clears, we clear.
    if (dateVal.value) dateVal.value = undefined
    
    // Apply default time if provided
    if (props.defaultTime) {
      const [h, m] = props.defaultTime.split(':').map(Number)
      if (!isNaN(h) && !isNaN(m)) {
        hours.value = String(h).padStart(2, '0')
        minutes.value = String(m).padStart(2, '0')
      }
    }
  }
}, { immediate: true })

// Update parent when state changes
const updateModel = () => {
  if (!dateVal.value) {
    // If date is cleared, should we emit null? 
    // Yes, usually.
    return
  }

  const d = dateVal.value
  // Create JS Date from components
  // Note: DateValue from reka-ui has .year, .month, .day
  const jsDate = new Date(d.year, d.month - 1, d.day, Number(hours.value), Number(minutes.value))
  const isoLocal = toDateTimeLocalInput(jsDate)
  const isoZ = toIsoZFromFloatingDate(jsDate)
  
  // If hiding time, we still emit ISO with time, but it will be 00:00 or default.
  // Actually, if we hide time, we should probably respect that visually but the value
  // expected by Directus is likely DateTime.
  // The user requirement says "no quiero sacar las horas" (don't want to output hours).
  // But our DB fields are likely DateTime.
  // Let's assume we keep emitting the full ISO string for compatibility,
  // but the UI hides the time picker.
  
  // Avoid emitting if same as prop to prevent loops
  if (isoLocal && isoLocal !== toDateTimeLocalInput(props.modelValue)) {
    emit('update:modelValue', isoZ)
  }
}

watch(dateVal, () => updateModel())

// Display formatted string
const formattedDate = computed(() => {
  if (!props.modelValue) return null
  try {
    const formatStr = props.hideTime ? "PPP" : "PPP HH:mm"
    const d = toFloatingLocalDate(props.modelValue)
    if (!d) return null
    return format(d, formatStr, { locale: es })
  } catch (e) {
    return null
  }
})

// Time Handlers
const onTimeChange = () => {
  let h = Number(hours.value)
  let m = Number(minutes.value)

  // Clamp values
  if (h < 0) h = 0
  if (h > 23) h = 23
  if (m < 0) m = 0
  if (m > 59) m = 59
  
  // Update refs with padded strings
  hours.value = String(h).padStart(2, '0')
  minutes.value = String(m).padStart(2, '0')
  
  updateModel()
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        :class="cn(
          'w-full justify-start text-left font-normal border-input hover:bg-white focus-visible:border-ring focus-visible:ring-ring/50',
          !modelValue && 'text-muted-foreground'
        )"
      >
        <CalendarIcon class="mr-2 h-4 w-4" />
        <span class="capitalize">{{ formattedDate ? formattedDate : "Seleccionar fecha" }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent :class="cn(props.fullWidth ? 'w-[--radix-popover-trigger-width]' : 'w-auto', 'p-0')" align="start">
      <Calendar 
        v-model="dateVal" 
        locale="es-ES" 
        :week-starts-on="1"
        initial-focus 
        :min-value="min ? parseDate(min.split('T')[0]) : undefined"
        :max-value="max ? parseDate(max.split('T')[0]) : undefined"
      />
      <div v-if="!hideTime" class="p-3 border-t border-border bg-slate-50">
        <div class="flex items-center gap-2 justify-center">
            <Clock class="h-4 w-4 text-muted-foreground mt-4" />
            <div class="flex items-center gap-1">
              <div class="flex flex-col items-center">
                <Label class="text-[10px] text-muted-foreground mb-1">Hora</Label>
                <Input type="number" v-model="hours" @change="onTimeChange" min="0" max="23" class="w-16 text-center" />
              </div>
              <span class="text-xl mt-4">:</span>
              <div class="flex flex-col items-center">
                 <Label class="text-[10px] text-muted-foreground mb-1">Minuto</Label>
                 <Input type="number" v-model="minutes" @change="onTimeChange" min="0" max="59" class="w-16 text-center" />
              </div>
            </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
