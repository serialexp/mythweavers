import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'

interface DateTimePickerProps {
  value?: string
  onChange: (date: Date) => void
  label?: string
  helpText?: string
  class?: string
  id?: string
}

export const DateTimePicker = (props: DateTimePickerProps) => {
  const [dateValue, setDateValue] = createSignal('')
  const [timeValue, setTimeValue] = createSignal('')
  const [showCalendar, setShowCalendar] = createSignal(false)
  const [selectedDate, setSelectedDate] = createSignal<Date | null>(null)
  const [currentMonth, setCurrentMonth] = createSignal(new Date())
  const [timezone, setTimezone] = createSignal('')
  const dateId = props.id ? `${props.id}-date` : 'date-picker'
  const timeId = props.id ? `${props.id}-time` : 'time-picker'
  const calendarId = props.id ? `${props.id}-calendar` : 'calendar-dropdown'
  let dateInputRef: HTMLInputElement | undefined
  let calendarRef: HTMLDivElement | undefined

  // Initialize the component with the provided value
  createEffect(() => {
    if (props.value) {
      try {
        const date = new Date(props.value)
        if (!Number.isNaN(date.getTime())) {
          // Format date as YYYY-MM-DD
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          setDateValue(`${year}-${month}-${day}`)
          setSelectedDate(date)
          setCurrentMonth(date)

          // Format time as HH:MM
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          setTimeValue(`${hours}:${minutes}`)
        }
      } catch (e) {
        console.error('Error parsing date:', e)
      }
    }
  })

  // Get the user's timezone
  onMount(() => {
    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(userTimezone)
    } catch (e) {
      console.error('Error getting timezone:', e)
    }
  })

  // Update the parent component when date or time changes
  const updateDate = () => {
    if (dateValue() && timeValue()) {
      try {
        const [hours, minutes] = timeValue().split(':')
        const date = new Date(dateValue())
        date.setHours(Number.parseInt(hours, 10))
        date.setMinutes(Number.parseInt(minutes, 10))
        props.onChange(date)
      } catch (e) {
        console.error('Error creating date:', e)
      }
    }
  }

  // Handle date selection from calendar
  const handleDateSelect = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    setDateValue(`${year}-${month}-${day}`)
    setSelectedDate(date)
    updateDate()
    setShowCalendar(false)
  }

  // Navigate to previous month
  const prevMonth = () => {
    const newDate = new Date(currentMonth())
    newDate.setMonth(newDate.getMonth() - 1)
    setCurrentMonth(newDate)
  }

  // Navigate to next month
  const nextMonth = () => {
    const newDate = new Date(currentMonth())
    newDate.setMonth(newDate.getMonth() + 1)
    setCurrentMonth(newDate)
  }

  // Navigate to today
  const goToToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    handleDateSelect(today)
  }

  // Get the days in the current month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = new Date(year, month, 1).getDay()

    // Create an array of days for the current month
    const days = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  // Check if a date is today
  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // Check if a date is selected
  const isSelected = (date: Date) => {
    const selected = selectedDate()
    if (!selected) return false
    return (
      date.getDate() === selected.getDate() &&
      date.getMonth() === selected.getMonth() &&
      date.getFullYear() === selected.getFullYear()
    )
  }

  // Get years for the year selector (current year ± 10 years)
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let i = currentYear - 10; i <= currentYear + 10; i++) {
      years.push(i)
    }
    return years
  }

  // Get months for the month selector
  const getMonthOptions = () => {
    const months = []
    for (let i = 0; i < 12; i++) {
      const date = new Date(2000, i, 1)
      months.push({
        value: i,
        name: date.toLocaleString('default', { month: 'long' }),
      })
    }
    return months
  }

  // Handle year change
  const handleYearChange = (e: Event) => {
    const select = e.target as HTMLSelectElement
    const newDate = new Date(currentMonth())
    newDate.setFullYear(Number.parseInt(select.value, 10))
    setCurrentMonth(newDate)
  }

  // Handle month change
  const handleMonthChange = (e: Event) => {
    const select = e.target as HTMLSelectElement
    const newDate = new Date(currentMonth())
    newDate.setMonth(Number.parseInt(select.value, 10))
    setCurrentMonth(newDate)
  }

  // Handle click outside to close calendar
  const handleClickOutside = (event: MouseEvent) => {
    if (
      calendarRef &&
      !calendarRef.contains(event.target as Node) &&
      dateInputRef &&
      !dateInputRef.contains(event.target as Node)
    ) {
      setShowCalendar(false)
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside)
  })

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })

  const daysInMonth = () => getDaysInMonth(currentMonth())
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div class={`flex flex-col gap-2 ${props.class || ''}`}>
      {props.label && (
        <label class="label" for={dateId}>
          {props.label}
        </label>
      )}
      <div class="flex gap-2">
        <div class="flex-1 relative">
          <input
            id={dateId}
            ref={dateInputRef}
            type="text"
            class="input input-bordered w-full"
            value={dateValue()}
            onFocus={() => setShowCalendar(true)}
            onInput={(e) => {
              setDateValue(e.currentTarget.value)
              updateDate()
            }}
            placeholder="YYYY-MM-DD"
          />
          <Show when={showCalendar()}>
            <div
              id={calendarId}
              ref={calendarRef}
              class="absolute z-10 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg p-2 w-full"
            >
              {/* Calendar header with month/year navigation */}
              <div class="flex justify-between items-center mb-2">
                <div class="flex gap-2">
                  <select
                    class="select select-bordered select-sm"
                    value={currentMonth().getMonth()}
                    onChange={handleMonthChange}
                  >
                    <For each={getMonthOptions()}>{(month) => <option value={month.value}>{month.name}</option>}</For>
                  </select>
                  <select
                    class="select select-bordered select-sm"
                    value={currentMonth().getFullYear()}
                    onChange={handleYearChange}
                  >
                    <For each={getYearOptions()}>{(year) => <option value={year}>{year}</option>}</For>
                  </select>
                </div>
                <div class="flex gap-1">
                  <button type="button" class="btn btn-sm btn-ghost" onClick={prevMonth}>
                    &lt;
                  </button>
                  <button type="button" class="btn btn-sm btn-ghost" onClick={nextMonth}>
                    &gt;
                  </button>
                  <button type="button" class="btn btn-sm btn-ghost" onClick={goToToday}>
                    Today
                  </button>
                </div>
              </div>

              {/* Calendar grid */}
              <div class="grid grid-cols-7 gap-1 text-center">
                <For each={weekDays}>{(day) => <div class="text-sm font-semibold p-1">{day}</div>}</For>
                <For each={daysInMonth()}>
                  {(day) => (
                    <div class="p-1">
                      {day ? (
                        <button
                          type="button"
                          class={`w-full h-8 rounded-full flex items-center justify-center text-sm
                                                    ${isToday(day) ? 'bg-primary text-primary-content' : ''}
                                                    ${isSelected(day) ? 'bg-secondary text-secondary-content' : ''}
                                                    ${!isSelected(day) && !isToday(day) ? 'hover:bg-base-200' : ''}`}
                          onClick={() => handleDateSelect(day)}
                        >
                          {day.getDate()}
                        </button>
                      ) : (
                        <div class="w-full h-8" />
                      )}
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
        <div class="flex-1">
          <input
            id={timeId}
            type="time"
            class="input input-bordered w-full"
            value={timeValue()}
            onInput={(e) => {
              setTimeValue(e.currentTarget.value)
              updateDate()
            }}
          />
        </div>
      </div>
      {props.helpText && (
        <p class="text-sm text-gray-500">
          {props.helpText}
          {timezone() && (
            <span class="block mt-1">
              Time is in your local timezone: <span class="font-medium">{timezone()}</span>
            </span>
          )}
        </p>
      )}
    </div>
  )
}
