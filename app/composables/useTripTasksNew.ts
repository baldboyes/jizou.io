import { readItems, createItem, updateItem, deleteItem } from '@directus/sdk'
import type { Task } from '~/types/directus'
import { toast } from 'vue-sonner'
import { offlineKvGet, offlineKvSet } from '~/utils/offlineDb'
import { buildOfflineKey, getOfflineUserId } from '~/utils/offlineKeys'

export const useTripTasksNew = () => {
  const { getClient, directusUserId, resetAuth } = useDirectusRepo()
  
  const tasks = useState<Task[]>('trip-tasks-new', () => [])
  const loading = useState<boolean>('trip-tasks-new-loading', () => false)

  const fetchTasks = async (tripId: number) => {
    loading.value = true
    try {
      const userId = getOfflineUserId()
      if (userId && Number.isFinite(tripId) && tripId > 0) {
        const cached = await offlineKvGet<Task[]>(buildOfflineKey(userId, ['trip', tripId, 'tasks']))
        if (Array.isArray(cached)) tasks.value = cached
      }

      const client = await getClient()
      const result = await client.request(readItems('tasks', {
        filter: { trip_id: { _eq: tripId } },
        sort: ['due_date'],
        fields: ['*'],
        limit: -1
      }))

      tasks.value = Array.isArray(result) ? result as Task[] : []
      if (userId && Number.isFinite(tripId) && tripId > 0) {
        await offlineKvSet(buildOfflineKey(userId, ['trip', tripId, 'tasks']), tasks.value)
      }
    } catch (e) {
      console.error('Error fetching tasks (new):', e)
    } finally {
      loading.value = false
    }
  }

  const createTask = async (task: Partial<Task>) => {
    try {
      const client = await getClient()
      const payload = {
        ...task,
        status: task.status || 'pending',
        assigned_to: task.assigned_to || directusUserId.value
      } as any

      let result: any
      try {
        result = await client.request(createItem('tasks', payload))
      } catch (e: any) {
        const code = e?.errors?.[0]?.extensions?.code
        if (code === 'INVALID_CREDENTIALS') {
          resetAuth()
          const fresh = await getClient()
          result = await fresh.request(createItem('tasks', payload))
        } else {
          throw e
        }
      }
      
      tasks.value.push(result as Task)
      toast.success('Tarea creada')
      return result
    } catch (e) {
      console.error('Error creating task (new):', e)
      toast.error('Error al crear la tarea')
      throw e
    }
  }

  const updateTask = async (id: number, update: Partial<Task>) => {
    try {
      const client = await getClient()
      const result = await client.request(updateItem('tasks', id, update as any))
      
      const index = tasks.value.findIndex(t => t.id === id)
      if (index !== -1) tasks.value[index] = result as Task
      
      toast.success('Tarea actualizada')
      return result
    } catch (e) {
      console.error('Error updating task (new):', e)
      toast.error('Error al actualizar la tarea')
      throw e
    }
  }

  const deleteTask = async (id: number) => {
    try {
      const client = await getClient()
      await client.request(deleteItem('tasks', id))
      tasks.value = tasks.value.filter(t => t.id !== id)
      toast.success('Tarea eliminada')
    } catch (e) {
      console.error('Error deleting task (new):', e)
      toast.error('Error al eliminar la tarea')
      throw e
    }
  }

  // Grouping Logic
  const tasksByGroup = computed(() => {
    const grouped: Record<string, Task[]> = {}
    
    // Initialize default groups if needed, or just let them be dynamic
    // The previous logic had hardcoded groups. We can replicate that if desired.
    const defaultGroups = ['General', 'Vuelos', 'Alojamientos', 'Transporte', 'Actividades', 'Seguros']
    defaultGroups.forEach(g => grouped[g] = [])

    tasks.value.forEach(t => {
      const groupName = (t.task_group as string) || 'General'
      if (!grouped[groupName]) grouped[groupName] = []
      grouped[groupName].push(t)
    })
    
    return grouped
  })

  return {
    tasks,
    loading,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    tasksByGroup
  }
}
