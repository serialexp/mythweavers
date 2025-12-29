import { CalendarConfig, CalendarEngine, CalendarSubdivision, HolidayRule, HolidayStep, getSubdivisionPresets } from '@mythweavers/shared'
import { Button, ButtonGroup, Card, CardBody, Dropdown, DropdownItem, FormField, IconButton, Input, Select, Stack, ToggleButton } from '@mythweavers/ui'
import { BsChevronDown, BsPlus, BsTrash } from 'solid-icons/bs'
import { Component, For, Index, Show, createMemo, createSignal } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import * as styles from './CalendarEditor.css'

// Helper component to render subdivisions recursively
interface SubdivisionEditorProps {
  subdivision: CalendarSubdivision
  path: number[]
  onUpdate: (path: number[], field: keyof CalendarSubdivision, value: any) => void
  onRemove: (path: number[]) => void
  onAddNested: (path: number[]) => void
}

const SubdivisionEditor: Component<SubdivisionEditorProps> = (props) => {
  const sub = () => props.subdivision

  return (
    <div class={styles.subdivisionItem}>
      <div class={styles.subdivisionFields}>
        {/* ID, Name, Plural, Count fields */}
        <FormField label="ID">
          <Input
            type="text"
            value={sub().id}
            onInput={(e) => props.onUpdate(props.path, 'id', e.target.value)}
            placeholder="quarter"
          />
        </FormField>
        <FormField label="Name">
          <Input
            type="text"
            value={sub().name}
            onInput={(e) => props.onUpdate(props.path, 'name', e.target.value)}
            placeholder="Quarter"
          />
        </FormField>
        <FormField label="Plural">
          <Input
            type="text"
            value={sub().pluralName}
            onInput={(e) => props.onUpdate(props.path, 'pluralName', e.target.value)}
            placeholder="Quarters"
          />
        </FormField>
        <FormField label="Count">
          <Input
            type="number"
            value={sub().count}
            onInput={(e) => props.onUpdate(props.path, 'count', Number.parseInt(e.target.value) || 1)}
            min={1}
            placeholder="4"
          />
        </FormField>

        {/* Cycle Mode toggle - only for top-level subdivisions (cycles are always global) */}
        <Show when={props.path.length === 1}>
          <div class={styles.fieldFull}>
            <div class={styles.toggle}>
              <span class={styles.toggleLabel}>
                Mode
              </span>
              <ButtonGroup>
                <ToggleButton
                  size="sm"
                  active={!sub().isCycle}
                  onClick={() => {
                    props.onUpdate(props.path, 'isCycle', undefined)
                    props.onUpdate(props.path, 'epochStartsOnUnit', undefined)
                  }}
                >
                  Hierarchical
                </ToggleButton>
                <ToggleButton
                  size="sm"
                  active={!!sub().isCycle}
                  onClick={() => {
                    props.onUpdate(props.path, 'isCycle', true)
                    props.onUpdate(props.path, 'epochStartsOnUnit', 0)
                    // Cycles don't use days per unit, clear those
                    props.onUpdate(props.path, 'daysPerUnit', undefined)
                    props.onUpdate(props.path, 'daysPerUnitFixed', undefined)
                  }}
                >
                  Cycle
                </ToggleButton>
              </ButtonGroup>
            </div>
            <div class={styles.hint}>
              {sub().isCycle
                ? 'Cycle mode: Repeats independently of other subdivisions (e.g., 7-day week cycle).'
                : 'Hierarchical: Divides the year or parent subdivision into parts.'}
            </div>

            <Show when={sub().isCycle && sub().labels && sub().labels!.length > 0}>
              <FormField label="Epoch Starts On" hint="Which unit is day 1 of year 0?">
                <Select
                  value={(sub().epochStartsOnUnit ?? 0).toString()}
                  onChange={(e) => props.onUpdate(props.path, 'epochStartsOnUnit', Number.parseInt(e.target.value))}
                  options={sub().labels!.map((label, i) => ({ value: i.toString(), label: label || `Unit ${i + 1}` }))}
                />
              </FormField>
            </Show>
          </div>
        </Show>

        {/* Days per Unit section - only for hierarchical subdivisions */}
        <Show when={!sub().isCycle}>
        <div class={styles.fieldFull}>
          <div class={styles.toggle}>
            <span class={styles.toggleLabel}>
              Days per Unit
            </span>
            <ButtonGroup>
              <ToggleButton
                size="sm"
                active={!sub().daysPerUnit}
                onClick={() => {
                  props.onUpdate(props.path, 'daysPerUnit', undefined)
                  if (!sub().daysPerUnitFixed) {
                    props.onUpdate(props.path, 'daysPerUnitFixed', 30)
                  }
                }}
              >
                Same for all
              </ToggleButton>
              <ToggleButton
                size="sm"
                active={!!sub().daysPerUnit}
                onClick={() => {
                  const count = sub().count
                  const fixedValue = sub().daysPerUnitFixed || 30
                  props.onUpdate(props.path, 'daysPerUnit', Array(count).fill(fixedValue))
                  props.onUpdate(props.path, 'daysPerUnitFixed', undefined)
                }}
              >
                Custom per unit
              </ToggleButton>
            </ButtonGroup>
          </div>

          {sub().daysPerUnit ? (
            <div class={styles.customGrid}>
              <Index each={sub().daysPerUnit}>
                {(days, daysIndex) => (
                  <div class={styles.customField}>
                    <label class={styles.customLabel}>{daysIndex + 1}</label>
                    <Input
                      type="number"
                      value={days()}
                      onInput={(e) => {
                        const newDays = [...(sub().daysPerUnit || [])]
                        newDays[daysIndex] = Number.parseInt(e.target.value) || 1
                        props.onUpdate(props.path, 'daysPerUnit', newDays)
                      }}
                      min={1}
                      placeholder="30"
                    />
                  </div>
                )}
              </Index>
            </div>
          ) : (
            <Input
              type="number"
              value={sub().daysPerUnitFixed || ''}
              onInput={(e) => {
                const val = Number.parseInt(e.target.value) || undefined
                props.onUpdate(props.path, 'daysPerUnitFixed', val || undefined)
              }}
              min={1}
              placeholder="92"
            />
          )}
        </div>
        </Show>

        {/* Unit Labels section */}
        <div class={styles.fieldFull}>
          <div class={styles.toggle}>
            <span class={styles.toggleLabel}>
              Unit Labels
            </span>
            <ButtonGroup>
              <ToggleButton
                size="sm"
                active={sub().useCustomLabels === false}
                onClick={() => {
                  props.onUpdate(props.path, 'useCustomLabels', false)
                  if (!sub().labelFormat) {
                    props.onUpdate(props.path, 'labelFormat', `${sub().name} {n}`)
                  }
                }}
              >
                Auto-numbered
              </ToggleButton>
              <ToggleButton
                size="sm"
                active={sub().useCustomLabels !== false}
                onClick={() => {
                  props.onUpdate(props.path, 'useCustomLabels', true)
                  if (!sub().labels) {
                    const count = sub().count
                    const defaults = Array(count).fill('')
                    props.onUpdate(props.path, 'labels', defaults)
                  }
                  if (!sub().labelFormat) {
                    props.onUpdate(props.path, 'labelFormat', `${sub().name} {n}`)
                  }
                }}
              >
                Custom names
              </ToggleButton>
            </ButtonGroup>
          </div>

          <FormField label="Label Format" hint={'Template for auto-numbering. Use {n} for the number.'}>
            <Input
              type="text"
              value={sub().labelFormat || ''}
              onInput={(e) => props.onUpdate(props.path, 'labelFormat', e.target.value || undefined)}
              placeholder={`${sub().name} {n}`}
            />
          </FormField>

          {sub().useCustomLabels !== false && (
            <>
              {sub().labels && (
                <div class={styles.customGridWide}>
                  <Index each={sub().labels}>
                    {(label, labelIndex) => {
                      const autoLabel = () => {
                        const format = sub().labelFormat || `${sub().name} {n}`
                        return format.replace('{n}', (labelIndex + 1).toString())
                      }

                      return (
                        <div class={styles.customField}>
                          <label class={styles.customLabel}>{labelIndex + 1}</label>
                          <Input
                            type="text"
                            value={label()}
                            onInput={(e) => {
                              const newLabels = [...(sub().labels || [])]
                              newLabels[labelIndex] = e.target.value
                              props.onUpdate(props.path, 'labels', newLabels)
                            }}
                            placeholder={autoLabel()}
                          />
                        </div>
                      )
                    }}
                  </Index>
                </div>
              )}
              <div class={styles.hint}>
                Custom names for each unit. Leave empty to use the label format above.
              </div>
            </>
          )}
          {sub().useCustomLabels === false && (
            <div class={styles.hint}>All units will use the label format.</div>
          )}
        </div>

        {/* Nested subdivisions - only for hierarchical subdivisions (not cycles) */}
        <Show when={!sub().isCycle}>
          <Show when={sub().subdivisions && sub().subdivisions!.length > 0}>
            <div class={styles.fieldFull}>
              <Stack
                direction="horizontal"
                gap="sm"
                style={{ 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '0.5rem' }}
              >
                <span class={styles.toggleLabel}>
                  Nested Subdivisions
                </span>
                <Button variant="primary" size="sm" onClick={() => props.onAddNested(props.path)}>
                  <BsPlus /> Add Nested
                </Button>
              </Stack>
              <div class={styles.nestedList}>
                <Index each={sub().subdivisions!}>
                  {(nestedSub, nestedIndex) => (
                    <SubdivisionEditor
                      subdivision={nestedSub()}
                      path={[...props.path, nestedIndex]}
                      onUpdate={props.onUpdate}
                      onRemove={props.onRemove}
                      onAddNested={props.onAddNested}
                    />
                  )}
                </Index>
              </div>
            </div>
          </Show>

          <Show when={!sub().subdivisions || sub().subdivisions!.length === 0}>
            <div class={styles.fieldFull}>
              <Button variant="primary" size="sm" onClick={() => props.onAddNested(props.path)}>
                <BsPlus /> Add Nested Subdivision
              </Button>
            </div>
          </Show>
        </Show>
      </div>

      <IconButton variant="danger" onClick={() => props.onRemove(props.path)} aria-label="Remove subdivision">
        <BsTrash />
      </IconButton>
    </div>
  )
}

interface CalendarEditorProps {
  initialConfig?: CalendarConfig
  onSave: (config: CalendarConfig) => void
  onCancel: () => void
}

export const CalendarEditor: Component<CalendarEditorProps> = (props) => {
  const [id, setId] = createSignal(props.initialConfig?.id || '')
  const [name, setName] = createSignal(props.initialConfig?.name || '')
  const [description, setDescription] = createSignal(props.initialConfig?.description || '')
  const [daysPerYear, setDaysPerYear] = createSignal(props.initialConfig?.daysPerYear || 365)
  const [hoursPerDay, setHoursPerDay] = createSignal(props.initialConfig?.hoursPerDay || 24)
  const [minutesPerHour, setMinutesPerHour] = createSignal(props.initialConfig?.minutesPerHour || 60)
  const [positiveEra, setPositiveEra] = createSignal(props.initialConfig?.eras.positive || '')
  const [negativeEra, setNegativeEra] = createSignal(props.initialConfig?.eras.negative || '')

  // Display format options (EJS syntax)
  const [defaultFormat, setDefaultFormat] = createSignal(
    props.initialConfig?.display?.defaultFormat || 'Day <%= dayOfYear %>, Year <%= year %> <%= era %> at <%= hour %>:<%= minute %>',
  )
  const [shortFormat, setShortFormat] = createSignal(
    props.initialConfig?.display?.shortFormat || 'Day <%= dayOfYear %>, Year <%= year %> <%= era %>',
  )
  const [includeTimeByDefault, setIncludeTimeByDefault] = createSignal(
    props.initialConfig?.display?.includeTimeByDefault ?? true,
  )
  const [hourFormat, setHourFormat] = createSignal<'12' | '24'>(
    props.initialConfig?.display?.hourFormat || '24',
  )

  // Holidays
  const [holidays, setHolidays] = createStore<HolidayRule[]>(
    props.initialConfig?.holidays ? JSON.parse(JSON.stringify(props.initialConfig.holidays)) : [],
  )

  // Use createStore for fine-grained reactivity
  const [subdivisions, setSubdivisions] = createStore<CalendarSubdivision[]>(
    props.initialConfig?.subdivisions ? JSON.parse(JSON.stringify(props.initialConfig.subdivisions)) : [],
  )

  // Get available subdivisions for holiday rules (hierarchical subdivisions only)
  const availableSubdivisions = createMemo(() => {
    const result: { id: string; name: string }[] = []
    const collectSubdivisions = (subs: CalendarSubdivision[]) => {
      for (const sub of subs) {
        if (sub.id && sub.name && !sub.isCycle) {
          result.push({ id: sub.id, name: sub.name })
        }
        if (sub.subdivisions) {
          collectSubdivisions(sub.subdivisions)
        }
      }
    }
    collectSubdivisions(subdivisions)
    return result
  })

  // Get available cycles for cycle-based holiday rules
  const availableCycles = createMemo(() => {
    const result: { id: string; name: string; labels: string[] }[] = []
    const collectCycles = (subs: CalendarSubdivision[]) => {
      for (const sub of subs) {
        if (sub.id && sub.name && sub.isCycle && sub.labels) {
          result.push({ id: sub.id, name: sub.name, labels: sub.labels })
        }
        if (sub.subdivisions) {
          collectCycles(sub.subdivisions)
        }
      }
    }
    collectCycles(subdivisions)
    return result
  })

  const subdivisionPresets = getSubdivisionPresets()

  // Create a preview of the formatted date using current settings
  const formatPreview = (includeTime: boolean) => {
    try {
      const minutesPerDay = minutesPerHour() * hoursPerDay()
      const previewConfig: CalendarConfig = {
        id: 'preview',
        name: 'Preview',
        description: '',
        daysPerYear: daysPerYear(),
        hoursPerDay: hoursPerDay(),
        minutesPerHour: minutesPerHour(),
        minutesPerDay,
        minutesPerYear: minutesPerDay * daysPerYear(),
        subdivisions: subdivisions.filter((s) => s.id && s.name),
        eras: {
          positive: positiveEra() || 'CE',
          negative: negativeEra() || 'BCE',
          zeroLabel: null,
        },
        display: {
          defaultFormat: defaultFormat(),
          shortFormat: shortFormat(),
          includeTimeByDefault: includeTimeByDefault(),
          hourFormat: hourFormat(),
        },
        holidays: holidays.length > 0 ? [...holidays] : undefined,
      }
      const engine = new CalendarEngine(previewConfig)
      // Sample time: Day 183, Year 1, at 14:30
      const sampleTime = previewConfig.minutesPerYear + 182 * minutesPerDay + 14 * minutesPerHour() + 30
      return engine.formatStoryTime(sampleTime, includeTime)
    } catch (e) {
      return `(invalid format: ${e instanceof Error ? e.message : 'unknown error'})`
    }
  }

  const addSubdivision = () => {
    const newSub: CalendarSubdivision = {
      id: `subdivision_${Date.now()}`,
      name: '',
      pluralName: '',
      count: 1,
      daysPerUnitFixed: undefined,
    }
    setSubdivisions(produce((subs) => subs.push(newSub)))
  }

  const addPresetSubdivision = (presetId: string) => {
    const preset = subdivisionPresets.find((p) => p.id === presetId)
    if (!preset) return

    // Check if a subdivision with this ID already exists
    const existingIndex = subdivisions.findIndex((s) => s.id === preset.subdivision.id)
    if (existingIndex !== -1) {
      alert(`A subdivision with ID "${preset.subdivision.id}" already exists. Remove it first to add this preset.`)
      return
    }

    // Deep clone the preset subdivision to avoid mutating the original
    // Use structured clone for better compatibility with SolidJS stores
    const source = preset.subdivision
    const newSub: CalendarSubdivision = {
      id: source.id,
      name: source.name,
      pluralName: source.pluralName,
      count: source.count,
      daysPerUnit: source.daysPerUnit ? [...source.daysPerUnit] : undefined,
      daysPerUnitFixed: source.daysPerUnitFixed,
      labels: source.labels ? [...source.labels] : undefined,
      labelFormat: source.labelFormat,
      useCustomLabels: source.useCustomLabels,
      subdivisions: source.subdivisions
        ? source.subdivisions.map((s) => JSON.parse(JSON.stringify(s)))
        : undefined,
      isCycle: source.isCycle,
      epochStartsOnUnit: source.epochStartsOnUnit,
    }
    setSubdivisions(produce((subs) => subs.push(newSub)))
  }

  const removeSubdivision = (path: number[]) => {
    if (path.length === 1) {
      // Top-level subdivision
      setSubdivisions(produce((subs) => subs.splice(path[0], 1)))
    } else {
      // Nested subdivision - build proper store path to parent's subdivisions array
      const parentStorePath: any[] = [path[0]]
      for (let i = 1; i < path.length - 1; i++) {
        parentStorePath.push('subdivisions', path[i])
      }
      parentStorePath.push('subdivisions')

      // Dynamic path access for nested subdivision removal
      setSubdivisions(
        // @ts-expect-error - Dynamic path access requires spreading array as tuple
        ...parentStorePath,
        produce((subs: CalendarSubdivision[]) => {
          subs.splice(path[path.length - 1], 1)
        }),
      )
    }
  }

  const addNestedSubdivision = (parentPath: number[]) => {
    const newSub: CalendarSubdivision = {
      id: `subdivision_${Date.now()}`,
      name: '',
      pluralName: '',
      count: 1,
      daysPerUnitFixed: undefined,
    }

    // For nested subdivisions, we need to update the parent to add the new subdivision
    // Use produce on the entire store to safely handle the nested update
    setSubdivisions(
      produce((subs) => {
        // Navigate to the parent subdivision
        let parent: CalendarSubdivision = subs[parentPath[0]]
        for (let i = 1; i < parentPath.length; i++) {
          if (!parent.subdivisions) parent.subdivisions = []
          parent = parent.subdivisions[parentPath[i]]
        }
        // Initialize subdivisions array if needed and add the new subdivision
        if (!parent.subdivisions) parent.subdivisions = []
        parent.subdivisions.push(newSub)
      }),
    )
  }

  const updateSubdivision = (path: number[], field: keyof CalendarSubdivision, value: any) => {
    // Build the correct SolidJS store path with 'subdivisions' keys
    const buildStorePath = (p: number[]): any[] => {
      const result: any[] = [p[0]]
      for (let i = 1; i < p.length; i++) {
        result.push('subdivisions', p[i])
      }
      return result
    }

    // Get the subdivision at this path for validation
    const getSubdivision = (p: number[]): CalendarSubdivision | undefined => {
      if (p.length === 1) return subdivisions[p[0]]
      let sub = subdivisions[p[0]]
      for (let i = 1; i < p.length; i++) {
        if (!sub.subdivisions) return undefined
        sub = sub.subdivisions[p[i]]
      }
      return sub
    }

    const sub = getSubdivision(path)
    if (!sub) return

    const storePath = buildStorePath(path)

    // If updating count, also resize arrays that depend on count
    if (field === 'count') {
      const newCount = value as number

      // Dynamic path access for nested subdivision updates
      setSubdivisions(
        // @ts-expect-error - Dynamic path access requires spreading array as tuple
        ...storePath,
        produce((s: CalendarSubdivision) => {
          s.count = newCount

          // Resize daysPerUnit array if it exists
          if (s.daysPerUnit) {
            const currentLength = s.daysPerUnit.length
            if (newCount > currentLength) {
              const defaultValue = s.daysPerUnitFixed || 30
              s.daysPerUnit = [...s.daysPerUnit, ...Array(newCount - currentLength).fill(defaultValue)]
            } else if (newCount < currentLength) {
              s.daysPerUnit = s.daysPerUnit.slice(0, newCount)
            }
          }

          // Resize labels array if it exists
          if (s.labels) {
            const currentLength = s.labels.length
            if (newCount > currentLength) {
              const newLabels = Array(newCount - currentLength).fill('')
              s.labels = [...s.labels, ...newLabels]
            } else if (newCount < currentLength) {
              s.labels = s.labels.slice(0, newCount)
            }
          }
        }),
      )
    } else {
      // Simple field update
      // @ts-ignore - Dynamic path access for nested subdivision updates
      setSubdivisions(...storePath, field, value)
    }
  }

  // Holiday management functions
  const addHoliday = (type: HolidayRule['type']) => {
    const baseRule = {
      name: '',
      subdivisionId: availableSubdivisions()[0]?.id || '',
      unit: 1,
    }
    const defaultCycle = availableCycles()[0]

    let newHoliday: HolidayRule
    switch (type) {
      case 'fixed':
        newHoliday = { type: 'fixed', ...baseRule, day: 1 }
        break
      case 'nthCycleDay':
        newHoliday = { type: 'nthCycleDay', ...baseRule, n: 1, cycleId: defaultCycle?.id || '', dayInCycle: 0 }
        break
      case 'lastCycleDay':
        newHoliday = { type: 'lastCycleDay', ...baseRule, cycleId: defaultCycle?.id || '', dayInCycle: 0 }
        break
      case 'lastDay':
        newHoliday = { type: 'lastDay', ...baseRule }
        break
      case 'computed':
        newHoliday = {
          type: 'computed',
          name: '',
          steps: [{ type: 'startOfYear' }],
        }
        break
      case 'offsetFromHoliday':
        newHoliday = {
          type: 'offsetFromHoliday',
          name: '',
          baseHoliday: '',
          offsetDays: 0,
        }
        break
      default:
        return
    }

    setHolidays(produce((h) => h.push(newHoliday)))
  }

  const removeHoliday = (index: number) => {
    setHolidays(produce((h) => h.splice(index, 1)))
  }

  const updateHoliday = (index: number, field: string, value: any) => {
    // @ts-expect-error - dynamic field access
    setHolidays(index, field, value)
  }

  // Get the display text for a holiday rule
  const getHolidayRuleDescription = (rule: HolidayRule): string => {
    switch (rule.type) {
      case 'fixed': {
        const sub = availableSubdivisions().find((s) => s.id === rule.subdivisionId)
        const subName = sub?.name || rule.subdivisionId
        return `Day ${rule.day} of ${subName} ${rule.unit}`
      }
      case 'nthCycleDay': {
        const sub = availableSubdivisions().find((s) => s.id === rule.subdivisionId)
        const subName = sub?.name || rule.subdivisionId
        const nth = ['1st', '2nd', '3rd', '4th', '5th'][rule.n - 1] || `${rule.n}th`
        const cycle = availableCycles().find((c) => c.id === rule.cycleId)
        const cycleDayName = cycle?.labels?.[rule.dayInCycle] || `Day ${rule.dayInCycle}`
        return `${nth} ${cycleDayName} of ${subName} ${rule.unit}`
      }
      case 'lastCycleDay': {
        const sub = availableSubdivisions().find((s) => s.id === rule.subdivisionId)
        const subName = sub?.name || rule.subdivisionId
        const cycle = availableCycles().find((c) => c.id === rule.cycleId)
        const cycleDayName = cycle?.labels?.[rule.dayInCycle] || `Day ${rule.dayInCycle}`
        return `Last ${cycleDayName} of ${subName} ${rule.unit}`
      }
      case 'lastDay': {
        const sub = availableSubdivisions().find((s) => s.id === rule.subdivisionId)
        const subName = sub?.name || rule.subdivisionId
        return `Last day of ${subName} ${rule.unit}`
      }
      case 'computed': {
        if (rule.steps.length === 0) return 'Computed: (no steps)'
        const stepDescriptions = rule.steps.map((step) => getStepDescription(step))
        return `Computed: ${stepDescriptions.join(' → ')}`
      }
      case 'offsetFromHoliday': {
        const sign = rule.offsetDays >= 0 ? '+' : ''
        return `${rule.baseHoliday || '?'} ${sign}${rule.offsetDays} days`
      }
    }
  }

  // Get a human-readable description of a holiday step
  const getStepDescription = (step: HolidayStep): string => {
    switch (step.type) {
      case 'startOfYear':
        return 'Jan 1'
      case 'fixed': {
        const sub = availableSubdivisions().find((s) => s.id === step.subdivisionId)
        const subName = sub?.name || step.subdivisionId
        return `${subName} ${step.unit}, day ${step.day}`
      }
      case 'offset':
        return step.days >= 0 ? `+${step.days}d` : `${step.days}d`
      case 'findInCycle': {
        const cycle = availableCycles().find((c) => c.id === step.cycleId)
        const dayName = cycle?.labels?.[step.dayInCycle] || `day ${step.dayInCycle}`
        return step.direction === 'onOrAfter' ? `next ${dayName}` : `prev ${dayName}`
      }
    }
  }

  // Add a step to a computed holiday
  const addStep = (holidayIndex: number, stepType: HolidayStep['type']) => {
    const defaultCycle = availableCycles()[0]
    let newStep: HolidayStep

    switch (stepType) {
      case 'startOfYear':
        newStep = { type: 'startOfYear' }
        break
      case 'fixed':
        newStep = {
          type: 'fixed',
          subdivisionId: availableSubdivisions()[0]?.id || '',
          unit: 1,
          day: 1,
        }
        break
      case 'offset':
        newStep = { type: 'offset', days: 1 }
        break
      case 'findInCycle':
        newStep = {
          type: 'findInCycle',
          cycleId: defaultCycle?.id || '',
          dayInCycle: 0,
          direction: 'onOrAfter',
        }
        break
      default:
        return
    }

    setHolidays(
      produce((h) => {
        const holiday = h[holidayIndex]
        if (holiday.type === 'computed') {
          holiday.steps.push(newStep)
        }
      }),
    )
  }

  // Remove a step from a computed holiday
  const removeStep = (holidayIndex: number, stepIndex: number) => {
    setHolidays(
      produce((h) => {
        const holiday = h[holidayIndex]
        if (holiday.type === 'computed') {
          holiday.steps.splice(stepIndex, 1)
        }
      }),
    )
  }

  // Update a step in a computed holiday
  const updateStep = (holidayIndex: number, stepIndex: number, field: string, value: any) => {
    setHolidays(
      produce((h) => {
        const holiday = h[holidayIndex]
        if (holiday.type === 'computed') {
          // @ts-expect-error - dynamic field access
          holiday.steps[stepIndex][field] = value
        }
      }),
    )
  }

  // Get holidays that appear before a given index (for offsetFromHoliday dropdown)
  const getEarlierHolidays = (currentIndex: number) => {
    return holidays.slice(0, currentIndex).filter((h) => h.name.trim())
  }

  const handleSave = () => {
    // Validate required fields
    if (!id().trim()) {
      alert('Calendar ID is required')
      return
    }
    if (!name().trim()) {
      alert('Calendar name is required')
      return
    }

    // Validate subdivisions
    for (let i = 0; i < subdivisions.length; i++) {
      const sub = subdivisions[i]
      if (sub.id && !sub.name) {
        alert(`Subdivision ${i + 1} has an ID but is missing a name`)
        return
      }
      if (sub.name && !sub.id) {
        alert(`Subdivision ${i + 1} has a name but is missing an ID`)
        return
      }
      if ((sub.id || sub.name) && sub.count < 1) {
        alert(`Subdivision ${i + 1} must have a count of at least 1`)
        return
      }
    }

    const minutesPerDay = minutesPerHour() * hoursPerDay()
    const minutesPerYear = minutesPerDay * daysPerYear()

    // Only include subdivisions that have both id and name
    const validSubdivisions = subdivisions.filter((s) => s.id && s.name)

    // Only include holidays that have names
    const validHolidays = holidays.filter((h) => h.name.trim())

    const config: CalendarConfig = {
      id: id().trim(),
      name: name().trim(),
      description: description().trim(),
      daysPerYear: daysPerYear(),
      hoursPerDay: hoursPerDay(),
      minutesPerHour: minutesPerHour(),
      minutesPerDay,
      minutesPerYear,
      subdivisions: validSubdivisions,
      eras: {
        positive: positiveEra().trim() || 'CE',
        negative: negativeEra().trim() || 'BCE',
        zeroLabel: null,
      },
      display: {
        defaultFormat: defaultFormat(),
        shortFormat: shortFormat(),
        includeTimeByDefault: includeTimeByDefault(),
        hourFormat: hourFormat(),
      },
      holidays: validHolidays.length > 0 ? validHolidays : undefined,
    }

    props.onSave(config)
  }

  return (
    <Stack gap="lg">
      <h3 class={styles.sectionTitle}>
        Calendar Configuration
      </h3>

      <Card>
        <CardBody>
          <Stack gap="md">
            <h4 class={styles.cardTitle}>
              Basic Information
            </h4>

            <FormField
              label={
                <>
                  Calendar ID <span class={styles.requiredMark}>*</span>
                </>
              }
              hint="Unique identifier (lowercase, hyphens, no spaces)"
            >
              <Input type="text" value={id()} onInput={(e) => setId(e.target.value)} placeholder="my-calendar" />
            </FormField>

            <FormField
              label={
                <>
                  Name <span class={styles.requiredMark}>*</span>
                </>
              }
            >
              <Input
                type="text"
                value={name()}
                onInput={(e) => setName(e.target.value)}
                placeholder="My Calendar System"
              />
            </FormField>

            <FormField label="Description">
              <Input
                type="text"
                value={description()}
                onInput={(e) => setDescription(e.target.value)}
                placeholder="A brief description of this calendar system..."
              />
            </FormField>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Stack gap="md">
            <h4 class={styles.cardTitle}>
              Time Units
            </h4>

            <Stack direction="horizontal" gap="md" style={{ 'flex-wrap': 'wrap' }}>
              <FormField label="Days per Year" style={{ flex: '1', 'min-width': '150px' }}>
                <Input
                  type="number"
                  value={daysPerYear()}
                  onInput={(e) => setDaysPerYear(Number.parseInt(e.target.value) || 365)}
                  min={1}
                />
              </FormField>

              <FormField label="Hours per Day" style={{ flex: '1', 'min-width': '150px' }}>
                <Input
                  type="number"
                  value={hoursPerDay()}
                  onInput={(e) => setHoursPerDay(Number.parseInt(e.target.value) || 24)}
                  min={1}
                />
              </FormField>

              <FormField label="Minutes per Hour" style={{ flex: '1', 'min-width': '150px' }}>
                <Input
                  type="number"
                  value={minutesPerHour()}
                  onInput={(e) => setMinutesPerHour(Number.parseInt(e.target.value) || 60)}
                  min={1}
                />
              </FormField>
            </Stack>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Stack gap="md">
            <h4 class={styles.cardTitle}>
              Era Labels
            </h4>

            <Stack direction="horizontal" gap="md" style={{ 'flex-wrap': 'wrap' }}>
              <FormField label="Positive Era Label" style={{ flex: '1', 'min-width': '150px' }}>
                <Input
                  type="text"
                  value={positiveEra()}
                  onInput={(e) => setPositiveEra(e.target.value)}
                  placeholder="CE, AD, ABY, etc."
                />
              </FormField>

              <FormField label="Negative Era Label" style={{ flex: '1', 'min-width': '150px' }}>
                <Input
                  type="text"
                  value={negativeEra()}
                  onInput={(e) => setNegativeEra(e.target.value)}
                  placeholder="BCE, BC, BBY, etc."
                />
              </FormField>
            </Stack>
            <div class={styles.hint}>
              Used for years before/after year 0 (e.g., "22 BBY")
            </div>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Stack gap="md">
            <h4 class={styles.cardTitle}>
              Display Format
            </h4>

            <FormField
              label="Default Format (with time)"
              hint="EJS template. Available: year, era, dayOfYear, hour, minute, weekday, holiday, plus subdivision IDs like month, monthNumber, dayOfMonth"
            >
              <Input
                type="text"
                value={defaultFormat()}
                onInput={(e) => setDefaultFormat(e.target.value)}
                placeholder="<%= month %> <%= dayOfMonth %>, <%= year %> <%= era %> at <%= hour %>:<%= minute %>"
              />
              <div class={styles.formatPreview}>
                Preview: <strong>{formatPreview(true)}</strong>
              </div>
            </FormField>

            <FormField
              label="Short Format (without time)"
              hint="EJS template for compact display. Use <% if (holiday) { %> for conditionals."
            >
              <Input
                type="text"
                value={shortFormat()}
                onInput={(e) => setShortFormat(e.target.value)}
                placeholder="<%= month %> <%= dayOfMonth %>, <%= year %> <%= era %>"
              />
              <div class={styles.formatPreview}>
                Preview: <strong>{formatPreview(false)}</strong>
              </div>
            </FormField>

            <Stack direction="horizontal" gap="lg" style={{ 'flex-wrap': 'wrap' }}>
              <Stack gap="xs">
                <span class={styles.toggleLabel}>Hour Format</span>
                <ButtonGroup>
                  <ToggleButton size="sm" active={hourFormat() === '24'} onClick={() => setHourFormat('24')}>
                    24-hour
                  </ToggleButton>
                  <ToggleButton size="sm" active={hourFormat() === '12'} onClick={() => setHourFormat('12')}>
                    12-hour
                  </ToggleButton>
                </ButtonGroup>
              </Stack>

              <Stack gap="xs">
                <span class={styles.toggleLabel}>Use Long Format by Default</span>
                <ButtonGroup>
                  <ToggleButton size="sm" active={includeTimeByDefault()} onClick={() => setIncludeTimeByDefault(true)}>
                    Yes (with time)
                  </ToggleButton>
                  <ToggleButton size="sm" active={!includeTimeByDefault()} onClick={() => setIncludeTimeByDefault(false)}>
                    No (short)
                  </ToggleButton>
                </ButtonGroup>
              </Stack>
            </Stack>
          </Stack>
        </CardBody>
      </Card>

      {/* Holidays (Optional) */}
      <Card>
        <CardBody>
          <Stack gap="md">
            <Stack
              direction="horizontal"
              gap="sm"
              style={{ 'justify-content': 'space-between', 'align-items': 'center' }}
            >
              <h4 class={styles.cardTitle}>
                Holidays (Optional)
              </h4>
              <Show when={availableSubdivisions().length > 0}>
                <Dropdown
                  portal
                  trigger={
                    <Button variant="primary" size="sm">
                      <BsPlus /> Add Holiday <BsChevronDown />
                    </Button>
                  }
                >
                  <DropdownItem onClick={() => addHoliday('fixed')}>
                    <strong>Fixed Date</strong>
                    <br />
                    <small style={{ opacity: 0.7 }}>E.g., December 25 (Christmas)</small>
                  </DropdownItem>
                  <Show when={availableCycles().length > 0}>
                    <DropdownItem onClick={() => addHoliday('nthCycleDay')}>
                      <strong>Nth Cycle Day</strong>
                      <br />
                      <small style={{ opacity: 0.7 }}>E.g., 1st/4th Thursday of November</small>
                    </DropdownItem>
                    <DropdownItem onClick={() => addHoliday('lastCycleDay')}>
                      <strong>Last Cycle Day</strong>
                      <br />
                      <small style={{ opacity: 0.7 }}>E.g., Last Monday of May</small>
                    </DropdownItem>
                  </Show>
                  <DropdownItem onClick={() => addHoliday('lastDay')}>
                    <strong>Last Day</strong>
                    <br />
                    <small style={{ opacity: 0.7 }}>E.g., Last day of each quarter</small>
                  </DropdownItem>
                  <DropdownItem onClick={() => addHoliday('computed')}>
                    <strong>Computed (Pipeline)</strong>
                    <br />
                    <small style={{ opacity: 0.7 }}>E.g., Easter (multi-step calculation)</small>
                  </DropdownItem>
                  <DropdownItem onClick={() => addHoliday('offsetFromHoliday')}>
                    <strong>Offset from Holiday</strong>
                    <br />
                    <small style={{ opacity: 0.7 }}>E.g., Pentecost (Easter + 49 days)</small>
                  </DropdownItem>
                </Dropdown>
              </Show>
            </Stack>
            <div class={styles.hint}>
              Define recurring holidays that appear in formatted dates. Use the "holiday" variable in format templates.
            </div>

            <Show when={availableSubdivisions().length === 0}>
              <div class={styles.hint} style={{ 'font-style': 'italic' }}>
                Add subdivisions first to define holidays.
              </div>
            </Show>

            <Stack gap="sm">
              <Index each={holidays}>
                {(holiday, index) => (
                  <div class={styles.holidayForm}>
                    <FormField label="Holiday Name" style={{ 'grid-column': '1 / -1' }}>
                      <Input
                        type="text"
                        value={holiday().name}
                        onInput={(e) => updateHoliday(index, 'name', e.target.value)}
                        placeholder="Holiday name..."
                      />
                    </FormField>

                    <FormField label="Description (optional)" style={{ 'grid-column': '1 / -1' }}>
                      <Input
                        type="text"
                        value={holiday().description || ''}
                        onInput={(e) => updateHoliday(index, 'description', e.target.value || undefined)}
                        placeholder="Hover text description..."
                      />
                    </FormField>

                    {/* Subdivision and Unit fields - only for types that have them */}
                    <Show when={holiday().type !== 'computed' && holiday().type !== 'offsetFromHoliday'}>
                      <FormField label="Subdivision">
                        <Select
                          value={(holiday() as Extract<HolidayRule, { type: 'fixed' }>).subdivisionId}
                          onChange={(e) => updateHoliday(index, 'subdivisionId', e.target.value)}
                          options={availableSubdivisions().map((s) => ({ value: s.id, label: s.name }))}
                        />
                      </FormField>

                      <FormField label="Unit #">
                        <Input
                          type="number"
                          value={(holiday() as Extract<HolidayRule, { type: 'fixed' }>).unit}
                          onInput={(e) => updateHoliday(index, 'unit', Number.parseInt(e.target.value) || 1)}
                          min={1}
                        />
                      </FormField>
                    </Show>

                    {/* Fixed holiday fields */}
                    <Show when={holiday().type === 'fixed'}>
                      <FormField label="Day">
                        <Input
                          type="number"
                          value={(holiday() as Extract<HolidayRule, { type: 'fixed' }>).day}
                          onInput={(e) => updateHoliday(index, 'day', Number.parseInt(e.target.value) || 1)}
                          min={1}
                        />
                      </FormField>
                    </Show>

                    {/* Nth cycle day fields */}
                    <Show when={holiday().type === 'nthCycleDay'}>
                      <FormField label="Occurrence">
                        <Select
                          value={(holiday() as Extract<HolidayRule, { type: 'nthCycleDay' }>).n.toString()}
                          onChange={(e) => updateHoliday(index, 'n', Number.parseInt(e.target.value))}
                          options={[
                            { value: '1', label: '1st' },
                            { value: '2', label: '2nd' },
                            { value: '3', label: '3rd' },
                            { value: '4', label: '4th' },
                            { value: '5', label: '5th' },
                          ]}
                        />
                      </FormField>
                      <FormField label="Cycle">
                        <Select
                          value={(holiday() as Extract<HolidayRule, { type: 'nthCycleDay' }>).cycleId}
                          onChange={(e) => updateHoliday(index, 'cycleId', e.target.value)}
                          options={availableCycles().map((c) => ({ value: c.id, label: c.name }))}
                        />
                      </FormField>
                      <FormField label="Day in Cycle">
                        <Select
                          value={(holiday() as Extract<HolidayRule, { type: 'nthCycleDay' }>).dayInCycle.toString()}
                          onChange={(e) => updateHoliday(index, 'dayInCycle', Number.parseInt(e.target.value))}
                          options={(() => {
                            const h = holiday() as Extract<HolidayRule, { type: 'nthCycleDay' }>
                            const cycle = availableCycles().find((c) => c.id === h.cycleId)
                            return cycle?.labels?.map((label, i) => ({ value: i.toString(), label: label || `Day ${i}` })) || []
                          })()}
                        />
                      </FormField>
                    </Show>

                    {/* Last cycle day fields */}
                    <Show when={holiday().type === 'lastCycleDay'}>
                      <FormField label="Cycle">
                        <Select
                          value={(holiday() as Extract<HolidayRule, { type: 'lastCycleDay' }>).cycleId}
                          onChange={(e) => updateHoliday(index, 'cycleId', e.target.value)}
                          options={availableCycles().map((c) => ({ value: c.id, label: c.name }))}
                        />
                      </FormField>
                      <FormField label="Day in Cycle">
                        <Select
                          value={(holiday() as Extract<HolidayRule, { type: 'lastCycleDay' }>).dayInCycle.toString()}
                          onChange={(e) => updateHoliday(index, 'dayInCycle', Number.parseInt(e.target.value))}
                          options={(() => {
                            const h = holiday() as Extract<HolidayRule, { type: 'lastCycleDay' }>
                            const cycle = availableCycles().find((c) => c.id === h.cycleId)
                            return cycle?.labels?.map((label, i) => ({ value: i.toString(), label: label || `Day ${i}` })) || []
                          })()}
                        />
                      </FormField>
                    </Show>

                    {/* Computed holiday fields */}
                    <Show when={holiday().type === 'computed'}>
                      <div style={{ 'grid-column': '1 / -1' }}>
                        <Stack gap="sm">
                          <Stack direction="horizontal" gap="sm" style={{ 'justify-content': 'space-between', 'align-items': 'center' }}>
                            <span style={{ 'font-weight': 'bold', 'font-size': '0.9rem' }}>Steps</span>
                            <Dropdown
                              portal
                              trigger={
                                <Button variant="secondary" size="sm">
                                  <BsPlus /> Add Step <BsChevronDown />
                                </Button>
                              }
                            >
                              <DropdownItem onClick={() => addStep(index, 'startOfYear')}>
                                <strong>Start of Year</strong>
                                <br />
                                <small style={{ opacity: 0.7 }}>Reset to day 1</small>
                              </DropdownItem>
                              <Show when={availableSubdivisions().length > 0}>
                                <DropdownItem onClick={() => addStep(index, 'fixed')}>
                                  <strong>Fixed Date</strong>
                                  <br />
                                  <small style={{ opacity: 0.7 }}>E.g., March 21</small>
                                </DropdownItem>
                              </Show>
                              <DropdownItem onClick={() => addStep(index, 'offset')}>
                                <strong>Offset (days)</strong>
                                <br />
                                <small style={{ opacity: 0.7 }}>Add or subtract days</small>
                              </DropdownItem>
                              <Show when={availableCycles().length > 0}>
                                <DropdownItem onClick={() => addStep(index, 'findInCycle')}>
                                  <strong>Find in Cycle</strong>
                                  <br />
                                  <small style={{ opacity: 0.7 }}>E.g., next Sunday</small>
                                </DropdownItem>
                              </Show>
                            </Dropdown>
                          </Stack>

                          {/* Render each step */}
                          <Index each={(holiday() as Extract<HolidayRule, { type: 'computed' }>).steps}>
                            {(step, stepIndex) => (
                              <div class={styles.stepItem}>
                                <span class={styles.stepNumber}>{stepIndex + 1}.</span>

                                {/* startOfYear step */}
                                <Show when={step().type === 'startOfYear'}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Start of Year (Day 1)</span>
                                </Show>

                                {/* fixed step */}
                                <Show when={step().type === 'fixed'}>
                                  <Select
                                    value={(step() as Extract<HolidayStep, { type: 'fixed' }>).subdivisionId}
                                    onChange={(e) => updateStep(index, stepIndex, 'subdivisionId', e.target.value)}
                                    options={availableSubdivisions().map((s) => ({ value: s.id, label: s.name }))}
                                  />
                                  <Input
                                    type="number"
                                    value={(step() as Extract<HolidayStep, { type: 'fixed' }>).unit}
                                    onInput={(e) => updateStep(index, stepIndex, 'unit', Number.parseInt(e.target.value) || 1)}
                                    min={1}
                                    style={{ width: '60px' }}
                                  />
                                  <span>day</span>
                                  <Input
                                    type="number"
                                    value={(step() as Extract<HolidayStep, { type: 'fixed' }>).day}
                                    onInput={(e) => updateStep(index, stepIndex, 'day', Number.parseInt(e.target.value) || 1)}
                                    min={1}
                                    style={{ width: '60px' }}
                                  />
                                </Show>

                                {/* offset step */}
                                <Show when={step().type === 'offset'}>
                                  <span>Offset</span>
                                  <Input
                                    type="number"
                                    value={(step() as Extract<HolidayStep, { type: 'offset' }>).days}
                                    onInput={(e) => updateStep(index, stepIndex, 'days', Number.parseInt(e.target.value) || 0)}
                                    style={{ width: '80px' }}
                                  />
                                  <span>days</span>
                                </Show>

                                {/* findInCycle step */}
                                <Show when={step().type === 'findInCycle'}>
                                  <Select
                                    value={(step() as Extract<HolidayStep, { type: 'findInCycle' }>).direction}
                                    onChange={(e) => updateStep(index, stepIndex, 'direction', e.target.value)}
                                    options={[
                                      { value: 'onOrAfter', label: 'Next' },
                                      { value: 'onOrBefore', label: 'Previous' },
                                    ]}
                                  />
                                  <Select
                                    value={(step() as Extract<HolidayStep, { type: 'findInCycle' }>).cycleId}
                                    onChange={(e) => updateStep(index, stepIndex, 'cycleId', e.target.value)}
                                    options={availableCycles().map((c) => ({ value: c.id, label: c.name }))}
                                  />
                                  <Select
                                    value={(step() as Extract<HolidayStep, { type: 'findInCycle' }>).dayInCycle.toString()}
                                    onChange={(e) => updateStep(index, stepIndex, 'dayInCycle', Number.parseInt(e.target.value))}
                                    options={(() => {
                                      const s = step() as Extract<HolidayStep, { type: 'findInCycle' }>
                                      const cycle = availableCycles().find((c) => c.id === s.cycleId)
                                      return cycle?.labels?.map((label, i) => ({ value: i.toString(), label: label || `Day ${i}` })) || []
                                    })()}
                                  />
                                </Show>

                                <IconButton variant="danger" size="sm" onClick={() => removeStep(index, stepIndex)} aria-label="Remove step">
                                  <BsTrash />
                                </IconButton>
                              </div>
                            )}
                          </Index>
                        </Stack>
                      </div>
                    </Show>

                    {/* Offset from holiday fields */}
                    <Show when={holiday().type === 'offsetFromHoliday'}>
                      <FormField label="Base Holiday">
                        <Select
                          value={(holiday() as Extract<HolidayRule, { type: 'offsetFromHoliday' }>).baseHoliday}
                          onChange={(e) => updateHoliday(index, 'baseHoliday', e.target.value)}
                          options={[
                            { value: '', label: '(Select a holiday)' },
                            ...getEarlierHolidays(index).map((h) => ({ value: h.name, label: h.name })),
                          ]}
                        />
                      </FormField>
                      <FormField label="Offset (days)">
                        <Input
                          type="number"
                          value={(holiday() as Extract<HolidayRule, { type: 'offsetFromHoliday' }>).offsetDays}
                          onInput={(e) => updateHoliday(index, 'offsetDays', Number.parseInt(e.target.value) || 0)}
                        />
                      </FormField>
                      <Show when={getEarlierHolidays(index).length === 0}>
                        <div style={{ 'grid-column': '1 / -1', 'font-style': 'italic', color: 'var(--text-muted)' }}>
                          No earlier holidays to reference. Add a computed or fixed holiday above this one first.
                        </div>
                      </Show>
                    </Show>

                    {/* Rule description and delete button */}
                    <Stack
                      direction="horizontal"
                      gap="sm"
                      style={{ 'grid-column': '1 / -1', 'justify-content': 'space-between', 'align-items': 'center' }}
                    >
                      <span class={styles.holidayRule}>{getHolidayRuleDescription(holiday())}</span>
                      <IconButton variant="danger" onClick={() => removeHoliday(index)} aria-label="Remove holiday">
                        <BsTrash />
                      </IconButton>
                    </Stack>
                  </div>
                )}
              </Index>
            </Stack>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Stack gap="md">
            <Stack
              direction="horizontal"
              gap="sm"
              style={{ 'justify-content': 'space-between', 'align-items': 'center' }}
            >
              <h4 class={styles.cardTitle}>
                Subdivisions (Optional)
              </h4>
              <Stack direction="horizontal" gap="sm">
                <Dropdown
                  portal
                  trigger={
                    <Button variant="secondary" size="sm">
                      <BsPlus /> Add Preset <BsChevronDown />
                    </Button>
                  }
                >
                  <For each={subdivisionPresets}>
                    {(preset) => (
                      <DropdownItem onClick={() => addPresetSubdivision(preset.id)}>
                        <strong>{preset.name}</strong>
                        <br />
                        <small style={{ opacity: 0.7 }}>{preset.description}</small>
                      </DropdownItem>
                    )}
                  </For>
                </Dropdown>
                <Button variant="primary" size="sm" onClick={addSubdivision}>
                  <BsPlus /> Add Custom
                </Button>
              </Stack>
            </Stack>
            <div class={styles.hint}>
              Define how the year is divided (e.g., 4 quarters of 92 days each, 12 months, etc.)
            </div>

            <Stack gap="md">
              <For each={subdivisions}>
                {(sub, index) => (
                  <SubdivisionEditor
                    subdivision={sub}
                    path={[index()]}
                    onUpdate={updateSubdivision}
                    onRemove={removeSubdivision}
                    onAddNested={addNestedSubdivision}
                  />
                )}
              </For>
            </Stack>
          </Stack>
        </CardBody>
      </Card>

      <Stack
        direction="horizontal"
        gap="md"
        class={styles.actionRow}
      >
        <Button variant="secondary" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Calendar
        </Button>
      </Stack>
    </Stack>
  )
}
