<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { type Task } from '~/types/directus'
import { TASK_PRIORITIES, TASK_STATUSES } from '~/utils/task-constants'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '~/components/ui/drawer'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { ScrollArea } from '~/components/ui/scroll-area'
import { DateTimePicker } from '~/components/ui/date-time-picker'
import { useTripTasksNew } from '~/composables/useTripTasksNew'
import { useTripsNew } from '~/composables/useTripsNew'
import { useDirectusRepo } from '~/composables/useDirectusRepo'
import { tv } from 'tailwind-variants'
import { Trash2, Save } from 'lucide-vue-next'
import { cn } from '~/lib/utils'

const props = defineProps<{
  open: boolean
  task?: Task | null
  tripId: number
  defaultGroupId?: number | string
  defaultEntityType?: string
  defaultEntityId?: number | string
}>()

const emit = defineEmits(['update:open', 'saved', 'delete'])

const { createTask, updateTask, deleteTask, tasksByGroup } = useTripTasksNew()
const { collaborators, currentTrip } = useTripsNew() // Use collaborators instead of travelers if travelers doesn't exist
const { directusUserId } = useDirectusRepo()
const { t } = useI18n()

const formData = ref<Partial<Task>>({
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  due_date: '',
  task_group: undefined,
  assigned_to: undefined,
  entity_type: undefined,
  entity_id: undefined
})

const getPriorityDotClass = (priority: string) => {
  const color = TASK_PRIORITIES.find(p => p.value === priority)?.color || ''
  const bg = color.split(' ').find(c => c.startsWith('bg-'))
  return bg || 'bg-muted'
}

const isEditing = computed(() => !!props.task)
const isCompleted = computed(() => props.task?.status === 'completed')
const isLoading = ref(false)

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

// Mock travelers from collaborators or empty array if not implemented yet
const travelers = computed(() => collaborators.value || [])

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    if (props.task) {
      formData.value = { ...props.task }
      
      // Manejar assigned_to si es un objeto (User expandido)
      if (typeof formData.value.assigned_to === 'object' && formData.value.assigned_to !== null) {
        formData.value.assigned_to = (formData.value.assigned_to as any).id
      }

      // Asegurar que assigned_to sea undefined si es null para que el placeholder funcione
      if (formData.value.assigned_to === null) {
        formData.value.assigned_to = undefined
      }
    } else {
      formData.value = {
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        due_date: undefined,
        task_group: props.defaultGroupId,
        assigned_to: directusUserId.value || undefined, // Default to current user
        entity_type: props.defaultEntityType as any,
        entity_id: props.defaultEntityId,
      }
    }
  }
})

const dueDateModel = computed<string | undefined>({
  get: () => {
    const v: any = (formData.value as any).due_date
    return v ? String(v) : undefined
  },
  set: (v) => {
    ;(formData.value as any).due_date = v || undefined
  }
})

const assignedToModel = computed<string>({
  get: () => {
    const v: any = (formData.value as any).assigned_to
    if (!v) return 'unassigned'
    if (typeof v === 'object') return String(v.id || 'unassigned')
    return String(v)
  },
  set: (v) => {
    ;(formData.value as any).assigned_to = v === 'unassigned' ? undefined : String(v)
  }
})

const handleSave = async () => {
  isLoading.value = true
  try {
    const assignedToRaw: any = (formData.value as any).assigned_to
    const assignedTo = assignedToRaw && typeof assignedToRaw === 'object'
      ? String(assignedToRaw.id || '')
      : (assignedToRaw ? String(assignedToRaw) : null)

    const payload: Partial<Task> = {
      title: formData.value.title,
      description: formData.value.description,
      priority: formData.value.priority,
      status: formData.value.status,
      due_date: formData.value.due_date || undefined,
      task_group: formData.value.task_group,
      assigned_to: assignedTo as any,
      entity_type: formData.value.entity_type,
      entity_id: formData.value.entity_id
    }

    if (isEditing.value && props.task) {
      await updateTask(props.task.id, payload)
    } else {
      await createTask({ ...payload, trip_id: props.tripId }) 
    }
    emit('saved')
    emit('update:open', false)
  } catch (e) {
    // Error manejado en composable
  } finally {
    isLoading.value = false
  }
}

const handleDelete = async () => {
  if (!props.task || !confirm(String(t('trip_task_modal.confirm_delete')))) return
  
  isLoading.value = true
  try {
    await deleteTask(props.task.id)
    emit('saved') // Refrescar lista
    emit('update:open', false)
  } catch (e) {
    // Error handled
  } finally {
    isLoading.value = false
  }
}

const styles = computed(() => taskModalStyles())

const taskModalStyles = tv({
  slots: {
    content: 'h-[90vh] flex flex-col fixed bottom-0 left-0 right-0 w-full mx-auto rounded-xl',
    header: 'w-full max-w-3xl mx-auto px-4',
    scrollArea: 'flex-1 h-[calc(90vh-180px)] px-0 pb-0',
    body: 'w-full max-w-3xl mx-auto px-4 grid gap-4 py-4',
    field: 'grid gap-2',
    grid2: 'grid grid-cols-2 gap-4',
    footer: 'w-full max-w-3xl mx-auto px-4 flex justify-between sm:justify-between',
    actions: 'flex gap-2',
  }
})
</script>

<template>
  <Drawer v-model:open="isOpen">
    <DrawerContent :class="styles.content()">
      <DrawerHeader :class="styles.header()">
        <DrawerTitle>{{ isEditing ? t('trip_task_modal.edit_title') : t('trip_task_modal.new_title') }}</DrawerTitle>
      </DrawerHeader>

      <ScrollArea :class="styles.scrollArea()">
        <div :class="styles.body()">
        <div :class="styles.field()">
          <Label htmlFor="title">{{ t('trip_task_modal.title_label') }}</Label>
          <Input id="title" v-model="formData.title" :placeholder="String(t('trip_task_modal.title_placeholder'))" :disabled="isCompleted" />
        </div>
        
        <div :class="styles.field()">
          <Label htmlFor="description">{{ t('trip_task_modal.description_label') }}</Label>
          <Textarea id="description" v-model="formData.description" :placeholder="String(t('trip_task_modal.description_placeholder'))" :disabled="isCompleted" />
        </div>
        
        <div :class="styles.grid2()">
          <div :class="styles.field()">
            <Label>{{ t('trip_task_modal.priority_label') }}</Label>
            <Select v-model="formData.priority" :disabled="isCompleted">
              <SelectTrigger>
                <SelectValue :placeholder="String(t('trip_task_modal.select_placeholder'))" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in TASK_PRIORITIES" :key="p.value" :value="p.value">
                  <span :class="cn('inline-block size-2.5 rounded-full', getPriorityDotClass(p.value))" />
                  <span>{{ t(`tasks.priority.${p.value}`) }}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div :class="styles.field()">
            <Label>{{ t('trip_task_modal.status_label') }}</Label>
            <Select v-model="formData.status" :disabled="isCompleted">
              <SelectTrigger>
                <SelectValue :placeholder="String(t('trip_task_modal.select_placeholder'))" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in TASK_STATUSES" :key="s.value" :value="s.value">
                  {{ t(`trip_tasks_board.status_${s.value}`) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div :class="styles.field()">
          <Label htmlFor="due_date">{{ t('trip_task_modal.due_date_label') }}</Label>
          <DateTimePicker
            v-model="dueDateModel"
            :min="currentTrip?.start_date || undefined"
            :max="currentTrip?.end_date || undefined"
            full-width
          />
        </div>

        <div :class="styles.field()">
          <Label>{{ t('trip_task_modal.assigned_to_label') }}</Label>
          <Select v-model="assignedToModel" :disabled="isCompleted">
            <SelectTrigger>
              <SelectValue :placeholder="String(t('trip_task_modal.unassigned'))" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">{{ t('trip_task_modal.unassigned') }}</SelectItem>
              <SelectItem v-for="t in travelers" :key="t.id" :value="String(t.id)">
                {{ t.first_name }} {{ t.last_name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div :class="styles.field()" class="hidden">
          <Label>{{ t('trip_task_modal.group_label') }}</Label>
          <Select 
            v-model="formData.task_group" 
            :disabled="isCompleted"
          >
            <SelectTrigger>
              <SelectValue :placeholder="String(t('trip_task_modal.group_placeholder'))" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="General">{{ t('trip_task_modal.groups.general') }}</SelectItem>
              <SelectItem value="Vuelos">{{ t('trip_task_modal.groups.flights') }}</SelectItem>
              <SelectItem value="Alojamientos">{{ t('trip_task_modal.groups.accommodation') }}</SelectItem>
              <SelectItem value="Transporte">{{ t('trip_task_modal.groups.transport') }}</SelectItem>
              <SelectItem value="Actividades">{{ t('trip_task_modal.groups.activities') }}</SelectItem>
              <SelectItem value="Seguros">{{ t('trip_task_modal.groups.insurance') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>
      </ScrollArea>

      <DrawerFooter :class="styles.footer()">
        <div :class="styles.actions()">

          <Button 
            v-if="isEditing" 
            variant="destructive" 
            @click="handleDelete"
            :disabled="isLoading"
          >
            <Trash2 class="w-4 h-4" />
            {{ t('trip_task_modal.delete') }}
          </Button>
          <Button @click="handleSave" :disabled="isLoading || !formData.title" class="w-full">
            <Save class="w-4 h-4" />
            {{ isLoading ? t('trip_task_modal.saving') : t('trip_task_modal.save') }}
          </Button>
        </div>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
