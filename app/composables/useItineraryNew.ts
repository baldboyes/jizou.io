import { computed, ref } from 'vue'
import { useTripOrganizationNew, type TimelineItemNew } from '~/composables/useTripOrganizationNew'
import { useExpensesNew } from '~/composables/useExpensesNew'
import { useTripTasksNew } from '~/composables/useTripTasksNew'
import { useTripsNew } from '~/composables/useTripsNew'
import { 
  format, 
  isSameDay, 
  addDays, 
  differenceInDays, 
  startOfDay, 
  isWithinInterval, 
  differenceInCalendarDays, 
  eachDayOfInterval 
} from 'date-fns'
import { es } from 'date-fns/locale'
import { Plane, Train, BedDouble, Ticket, Banknote, CheckSquare, Moon, MapPin } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { toFloatingLocalDate } from '~/utils/floatingDateTime'

export const useItineraryNew = () => {
  const { currentTrip } = useTripsNew()
  const { 
    accommodations,
    flights,
    transports,
    timelineItems
  } = useTripOrganizationNew()
  
  const { expenses } = useExpensesNew()
  const { tasks } = useTripTasksNew()

  // Selected Date State
  const selectedDate = ref<Date>(new Date())

  // Initialize selected date from trip start
  const initSelectedDate = () => {
    if (currentTrip.value?.start_date) {
      const start = toFloatingLocalDate(currentTrip.value.start_date) || new Date()
      const end = currentTrip.value.end_date
        ? (toFloatingLocalDate(currentTrip.value.end_date) || addDays(start, 14))
        : addDays(start, 14)

      const today = startOfDay(new Date())
      try {
        const within = isWithinInterval(today, { start: startOfDay(start), end: startOfDay(end) })
        selectedDate.value = within ? today : start
      } catch {
        selectedDate.value = start
      }
    }
  }

  // --- Timeline Header Logic ---

  const tripDays = computed(() => {
    if (!currentTrip.value?.start_date) return []
    
    const start = toFloatingLocalDate(currentTrip.value.start_date)
    if (!start) return []
    // Fallback to 14 days if no end date
    const end = currentTrip.value.end_date ? (toFloatingLocalDate(currentTrip.value.end_date) || addDays(start, 14)) : addDays(start, 14)
    
    try {
        return eachDayOfInterval({ start, end })
    } catch (e) {
        console.error('Invalid interval', e)
        return []
    }
  })

  const getDayLabel = (date: Date) => format(date, 'd', { locale: es })
  const getDayName = (date: Date) => format(date, 'EEEE', { locale: es })
  const getMonthLabel = (date: Date) => format(date, 'MMM', { locale: es })

  const isSelected = (date: Date) => isSameDay(date, selectedDate.value)

  const selectDate = (date: Date) => {
    selectedDate.value = date
  }

  const daysWithEvents = computed(() => {
    const days = tripDays.value
    if (!days.length) return []
    
    return days.map(day => {
       const dayDate = startOfDay(day)
       
       // Accommodations
       const accs = accommodations.value.map(a => {
          if (!a.check_in || !a.check_out) return null
          const startRaw = toFloatingLocalDate(a.check_in)
          const endRaw = toFloatingLocalDate(a.check_out)
          if (!startRaw || !endRaw) return null
          const start = startOfDay(startRaw)
          const end = startOfDay(endRaw)
          
          if (dayDate >= start && dayDate < end) {
             let status = 'middle'
             const duration = differenceInDays(end, start)
             if (duration === 1) status = 'single'
             else if (isSameDay(dayDate, start)) status = 'start'
             else if (isSameDay(dayDate, addDays(end, -1))) status = 'end'
             
             return { 
               id: a.id, 
               title: a.name, 
               status, 
               duration,
               check_in: a.check_in,
               check_out: a.check_out,
               type: 'accommodation', 
               colorClass: 'bg-slate-800 text-white', 
               icon: BedDouble 
             }
          }
          return null
       }).filter((item): item is NonNullable<typeof item> => !!item)
       
       // Passes (Transports with category 'pass' or similar logic)
       // Assuming 'pass_id' presence or category 'pass' indicates a pass
       const passes = transports.value.filter(t => t.category === 'pass' || !!t.pass_id).map(t => {
          if (!t.start_date || !t.end_date) return null
          const startRaw = toFloatingLocalDate(t.start_date)
          const endRaw = toFloatingLocalDate(t.end_date)
          if (!startRaw || !endRaw) return null
          const start = startOfDay(startRaw)
          const end = startOfDay(endRaw)
          
          if (dayDate >= start && dayDate <= end) {
              let status = 'middle'
              const duration = differenceInDays(end, start) + 1
              
              if (isSameDay(start, end)) status = 'single'
              else if (isSameDay(dayDate, start)) status = 'start'
              else if (isSameDay(dayDate, end)) status = 'end'
              
              return { 
                id: t.id, 
                title: t.name, 
                status, 
                duration,
                start_date: t.start_date,
                end_date: t.end_date,
                type: 'pass', 
                colorClass: 'bg-green-600 text-white', 
                icon: Ticket 
              }
          }
          return null
       }).filter((item): item is NonNullable<typeof item> => !!item)
       
       // Flights
       const flts: any[] = []
       flights.value.forEach(v => {
          if (v.layovers && Array.isArray(v.layovers) && v.layovers.length > 0) {
             v.layovers.forEach((escala: any, index) => {
                const dep = escala.departure_time ? toFloatingLocalDate(escala.departure_time) : null
                if (dep && isSameDay(startOfDay(dep), dayDate)) {
                   flts.push({
                     id: `flight-${v.id}-leg-${index}`,
                     title: escala.airline ? `${escala.airline}` : 'Vuelo',
                     type: 'flight',
                     icon: Plane
                   })
                }
             })
          } else {
            const dep = v.departure_time ? toFloatingLocalDate(v.departure_time) : null
            if (dep && isSameDay(startOfDay(dep), dayDate)) {
               flts.push({
                  id: `flight-${v.id}`,
                  title: v.airline || 'Vuelo',
                  type: 'flight',
                  icon: Plane
               })
            }
          }
       })
       
       // Destinations (Ciudades) - from Trip JSON
       const destinations = (currentTrip.value?.destinations || []) as any[]
       const dests = destinations.map((d: any) => {
         // Assuming JSON structure: { city: string, start_date: string, end_date: string }
         // Adapting to whatever field names used in JSON. Assuming snake_case.
         const dStartStr = d.start_date || d.fecha_inicio
         const dEndStr = d.end_date || d.fecha_fin
         const cityName = d.city || d.ciudad

         if (!dStartStr || !dEndStr) return null
         const startRaw = toFloatingLocalDate(dStartStr)
         const endRaw = toFloatingLocalDate(dEndStr)
         if (!startRaw || !endRaw) return null
         const start = startOfDay(startRaw)
         const end = startOfDay(endRaw)
         
         if (dayDate >= start && dayDate <= end) {
             let status = 'middle'
             const duration = differenceInDays(end, start)
             
             if (duration === 0) status = 'single'
             else if (isSameDay(dayDate, start)) status = 'start'
             else if (isSameDay(dayDate, end)) status = 'end'
             
             return { 
               id: `dest-${cityName}-${start.getTime()}`, 
               title: cityName, 
               status, 
               duration,
               type: 'destination', 
               colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 border', 
               icon: MapPin 
             }
         }
         return null
       }).filter((item): item is NonNullable<typeof item> => !!item)

       // Activities
      const acts = timelineItems.value.filter((item: TimelineItemNew) => {
         const isAct = item.type === 'activity'
         const match = isSameDay(startOfDay(item.date), dayDate)
         return isAct && match
      })
      .map((item: TimelineItemNew) => ({
            id: item.id,
            title: item.title,
            type: 'activity',
            colorClass: 'bg-purple-100 text-purple-700',
            icon: Ticket
        }))
       
       return {
         date: day,
         accommodations: accs,
         passes: passes,
         flights: flts,
         destinations: dests,
         activities: acts
       }
    })
  })

  // --- Detail View Logic ---

  const selectedDayDetails = computed(() => {
    const current = selectedDate.value
    const events: any[] = []

    // 1. Flights
    flights.value.forEach(v => {
      if (v.layovers && Array.isArray(v.layovers) && v.layovers.length > 0) {
        v.layovers.forEach((escala: any, index) => {
           if (escala.departure_time) {
              const start = toFloatingLocalDate(escala.departure_time)
              if (!start) return
              
              if (isSameDay(start, current)) {
                let timeStr = format(start, 'HH:mm')
                let dayDiff = 0
                
                if (escala.arrival_time) {
                  const end = toFloatingLocalDate(escala.arrival_time)
                  if (!end) return
                  timeStr += ` - ${format(end, 'HH:mm')}`
                  dayDiff = differenceInCalendarDays(end, start)
                }
                
                events.push({
                  id: `flight-${v.id}-leg-${index}`,
                  type: 'flight',
                  title: `${escala.departure_airport} ➝ ${escala.arrival_airport}` || 'Vuelo',
                  subtitle: escala.airline,
                  icon: Plane,
                  colorClass: 'bg-blue-100 text-blue-600',
                  time: timeStr,
                  dayDiff: dayDiff > 0 ? `+${dayDiff}` : null
                })
              }
           }
        })
      } else if (v.departure_time) {
        const start = toFloatingLocalDate(v.departure_time)
        if (!start) return
        
        if (isSameDay(start, current)) {
            let timeStr = format(start, 'HH:mm')
            let dayDiff = 0

            if (v.arrival_time) {
              const end = toFloatingLocalDate(v.arrival_time)
              if (!end) return
              timeStr += ` - ${format(end, 'HH:mm')}`
              dayDiff = differenceInCalendarDays(end, start)
            }

            events.push({
              id: `flight-${v.id}`,
              type: 'flight',
              title: v.airline || 'Vuelo',
              subtitle: `${v.departure_airport || '?'} ➝ ${v.arrival_airport || '?'}`, 
              icon: Plane,
              colorClass: 'bg-blue-100 text-blue-600',
              time: timeStr,
              dayDiff: dayDiff > 0 ? `+${dayDiff}` : null
            })
        }
      }
    })

    // 2. Accommodations
    accommodations.value.forEach(a => {
        if (a.check_in && a.check_out) {
          const checkIn = toFloatingLocalDate(a.check_in)
          const checkOut = toFloatingLocalDate(a.check_out)
          if (!checkIn || !checkOut) return
          
          const checkInDate = startOfDay(checkIn)
          const checkOutDate = startOfDay(checkOut)

          const isCheckInDay = isSameDay(checkInDate, current)
          const isCheckOutDay = isSameDay(checkOutDate, current)

          if (isCheckInDay) {
            events.push({
              id: `acc-in-${a.id}`,
              type: 'accommodation_checkin',
              date: checkIn,
              title: `Check-in: ${a.name}`,
              subtitle: 'Entrada al alojamiento',
              icon: BedDouble,
              colorClass: 'bg-indigo-100 text-indigo-700',
              time: format(checkIn, 'HH:mm'),
              isPriority: true
            })
          }

          if (isCheckOutDay) {
            events.push({
              id: `acc-out-${a.id}`,
              type: 'accommodation_checkout',
              date: checkOut,
              title: `Check-out: ${a.name}`,
              subtitle: 'Salida del alojamiento',
              icon: BedDouble,
              colorClass: 'bg-orange-100 text-orange-700',
              time: format(checkOut, 'HH:mm'),
              isPriority: true
            })
          }

        // Staying
        const nightCount = differenceInCalendarDays(checkOutDate, checkInDate)
            
        if (nightCount > 1) {
          const stayStart = addDays(checkInDate, 1)
          const stayEnd = addDays(checkOutDate, -1)
            
          if (stayStart <= stayEnd && isWithinInterval(current, { start: stayStart, end: stayEnd })) {
            events.unshift({
              id: `acc-stay-${a.id}`,
              type: 'accommodation_stay',
              date: startOfDay(current),
              title: `Noche en ${a.name}`,
              subtitle: a.city || 'Alojamiento',
              icon: Moon,
              colorClass: 'bg-slate-800 text-white',
              time: '',
              isSticky: true
            })
          }
        }
      }
    })

    // 3. Active Passes
    transports.value.filter(t => t.category === 'pass' || !!t.pass_id).forEach(t => {
      if (t.start_date && t.end_date) {
        const startRaw = toFloatingLocalDate(t.start_date)
        const endRaw = toFloatingLocalDate(t.end_date)
        if (!startRaw || !endRaw) return
        const start = startOfDay(startRaw)
        const end = startOfDay(endRaw)
        
        if (current >= start && current <= end) {
          events.unshift({
            id: `pass-active-${t.id}`,
            type: 'transport_pass_active',
            title: `Pase activo: ${t.name}`,
            subtitle: `Válido hasta ${format(end, 'dd MMM')}`,
            icon: Ticket,
            colorClass: 'bg-green-100 text-green-700',
            time: '',
            isSticky: true
          })
        }
      }
    })

    // 4. Other Timeline Items (Activities, Single Transports)
    timelineItems.value.forEach(item => {
      if (isSameDay(item.date, current)) {
        if (item.type === 'flight' || item.type === 'accommodation') return // handled separately

        let icon = Ticket
        let colorClass = 'bg-neutral-100 text-neutral-600'
         
        switch(item.type) {
          case 'transport':
            icon = Train
            colorClass = 'bg-green-100 text-green-600'
            break
          case 'activity':
            icon = Ticket
            colorClass = 'bg-purple-100 text-purple-600'
            break
        }
         
        events.push({
          ...item,
          icon,
          colorClass,
          time: format(item.date, 'HH:mm')
        })
      }
    })

    // 5. Tasks
    tasks.value.forEach(task => {
      const due = task.due_date ? toFloatingLocalDate(task.due_date) : null
      if (due && isSameDay(due, current)) {
        events.push({
          id: `task-${task.id}`,
          type: 'task',
          date: due,
          title: task.title,
          subtitle: 'Tarea',
          icon: CheckSquare,
          colorClass: 'bg-yellow-100 text-yellow-600',
          time: format(due, 'HH:mm')
        })
      }
    })

    // 6. Expenses
    expenses.value.forEach(ex => {
      // AppExpense uses 'timestamp' string (ISO)
      const ts = ex.timestamp ? toFloatingLocalDate(ex.timestamp) : null
      if (ts && isSameDay(ts, current)) {
        events.push({
          id: `expense-${ex.id}`,
          type: 'expense',
          date: ts,
          title: ex.placeName,
          subtitle: `${formatCurrency(ex.amount, 'JPY')} • ${ex.category}`,
          icon: Banknote,
          colorClass: 'bg-red-50 text-red-600',
          time: format(ts, 'HH:mm')
        })
      }
    })

    // Post-process
    const stayEvents = events.filter(e => e.type === 'accommodation_stay')
    const transitionEvents = events.filter(e => e.type === 'accommodation_checkin' || e.type === 'accommodation_checkout')
    const otherEvents = events.filter(e => !e.type.startsWith('accommodation_'))

    transitionEvents.sort((a, b) => {
      if (a.type === 'accommodation_checkout' && b.type === 'accommodation_checkin') return -1
      if (a.type === 'accommodation_checkin' && b.type === 'accommodation_checkout') return 1
      return 0
    })

    otherEvents.sort((a, b) => {
      const dateA = a.date ? a.date.getTime() : 0
      const dateB = b.date ? b.date.getTime() : 0
      return dateA - dateB
    })

    const finalEvents = []
    finalEvents.push(...stayEvents)

    if (transitionEvents.length > 0) {
      finalEvents.push({
        id: `acc-group-${current.getTime()}`,
        type: 'accommodation_transition_group',
        items: transitionEvents,
        date: transitionEvents[0].date,
        colorClass: 'bg-slate-100 text-slate-500',
        time: '',
        title: 'Alojamiento',
        subtitle: '',
        icon: BedDouble 
      })
    }

    finalEvents.push(...otherEvents)

    return finalEvents
  })

  return {
    selectedDate,
    initSelectedDate,
    tripDays,
    getDayLabel,
    getDayName,
    getMonthLabel,
    isSelected,
    selectDate,
    daysWithEvents,
    selectedDayDetails
  }
}
