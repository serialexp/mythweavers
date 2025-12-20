import { CalendarConfig, CalendarSubdivision } from '@mythweavers/shared'
import { Button, Card, CardBody, FormField, IconButton, Input, Select, Stack } from '@mythweavers/ui'
import { BsPlus, BsTrash } from 'solid-icons/bs'
import { Component, Index, Show, createSignal } from 'solid-js'
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

        {/* Days per Unit section */}
        <div class={styles.fieldFull}>
          <div class={styles.toggle}>
            <span class={styles.toggleLabel}>
              Days per Unit
            </span>
            <Select
              value={sub().daysPerUnit ? 'custom' : 'fixed'}
              onChange={(e) => {
                if (e.target.value === 'fixed') {
                  props.onUpdate(props.path, 'daysPerUnit', undefined)
                  if (!sub().daysPerUnitFixed) {
                    props.onUpdate(props.path, 'daysPerUnitFixed', 30)
                  }
                } else {
                  const count = sub().count
                  const fixedValue = sub().daysPerUnitFixed || 30
                  props.onUpdate(props.path, 'daysPerUnit', Array(count).fill(fixedValue))
                  props.onUpdate(props.path, 'daysPerUnitFixed', undefined)
                }
              }}
              options={[
                { value: 'fixed', label: 'Same for all' },
                { value: 'custom', label: 'Custom per unit' },
              ]}
            />
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

        {/* Unit Labels section */}
        <div class={styles.fieldFull}>
          <div class={styles.toggle}>
            <span class={styles.toggleLabel}>
              Unit Labels
            </span>
            <Select
              value={sub().useCustomLabels === false ? 'auto' : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'auto') {
                  props.onUpdate(props.path, 'useCustomLabels', false)
                  if (!sub().labelFormat) {
                    props.onUpdate(props.path, 'labelFormat', `${sub().name} {n}`)
                  }
                } else {
                  props.onUpdate(props.path, 'useCustomLabels', true)
                  if (!sub().labels) {
                    const count = sub().count
                    const defaults = Array(count).fill('')
                    props.onUpdate(props.path, 'labels', defaults)
                  }
                  if (!sub().labelFormat) {
                    props.onUpdate(props.path, 'labelFormat', `${sub().name} {n}`)
                  }
                }
              }}
              options={[
                { value: 'auto', label: 'Auto-numbered' },
                { value: 'custom', label: 'Custom names' },
              ]}
            />
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

        {/* Nested subdivisions */}
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

  // Use createStore for fine-grained reactivity
  const [subdivisions, setSubdivisions] = createStore<CalendarSubdivision[]>(
    props.initialConfig?.subdivisions ? JSON.parse(JSON.stringify(props.initialConfig.subdivisions)) : [],
  )

  const addSubdivision = () => {
    const newSub: CalendarSubdivision = {
      id: `subdivision_${Date.now()}`,
      name: '',
      pluralName: '',
      count: 1,
      daysPerUnitFixed: undefined,
    }
    setSubdivisions(subdivisions.length, newSub)
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

      // @ts-ignore - Dynamic path access for nested subdivision removal
      setSubdivisions(
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

    // Build proper store path to parent's subdivisions array
    const parentStorePath: any[] = [parentPath[0]]
    for (let i = 1; i < parentPath.length; i++) {
      parentStorePath.push('subdivisions', parentPath[i])
    }
    parentStorePath.push('subdivisions')

    // @ts-ignore - Dynamic path access for nested subdivision addition
    setSubdivisions(
      ...parentStorePath,
      produce((subs: CalendarSubdivision[] | undefined) => {
        const arr = subs || []
        arr.push(newSub)
        return arr
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

      // @ts-ignore - Dynamic path access for nested subdivision updates
      setSubdivisions(
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
        defaultFormat: props.initialConfig?.display.defaultFormat || 'Day {dayOfYear}, Year {year} {era}',
        shortFormat: props.initialConfig?.display.shortFormat || 'Day {dayOfYear}, Year {year}',
        includeTimeByDefault: props.initialConfig?.display.includeTimeByDefault ?? false,
        hourFormat: props.initialConfig?.display.hourFormat || '24',
      },
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
            <Stack
              direction="horizontal"
              gap="sm"
              style={{ 'justify-content': 'space-between', 'align-items': 'center' }}
            >
              <h4 class={styles.cardTitle}>
                Subdivisions (Optional)
              </h4>
              <Button variant="primary" size="sm" onClick={addSubdivision}>
                <BsPlus /> Add Subdivision
              </Button>
            </Stack>
            <div class={styles.hint}>
              Define how the year is divided (e.g., 4 quarters of 92 days each, 12 months, etc.)
            </div>

            <Stack gap="md">
              <Index each={subdivisions}>
                {(sub, index) => (
                  <SubdivisionEditor
                    subdivision={sub()}
                    path={[index]}
                    onUpdate={updateSubdivision}
                    onRemove={removeSubdivision}
                    onAddNested={addNestedSubdivision}
                  />
                )}
              </Index>
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
