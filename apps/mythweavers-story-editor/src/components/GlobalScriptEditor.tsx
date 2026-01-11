import { Alert, Button, Card, CardBody, Modal, Stack, Tab, TabList, TabPanel, Tabs } from '@mythweavers/ui'
import { For, Show, createSignal } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { plotPointsStore } from '../stores/plotPointsStore'
import type { PlotPointDefinition } from '../types/core'
import { CodeEditor } from './CodeEditor'
import * as styles from './GlobalScriptEditor.css'

const DEFAULT_GLOBAL_SCRIPT = `(data) => {
  // Initialize story-wide variables here
  // This script runs before every message script
  // Data is immutable - you can write normal mutation code but the original is never changed!

  // Example: Initialize a custom variable
  // data.myVariable = 'initial value';

  // Return the data object (or { data, functions } if you want helper functions)
  return data;
}`

// Plot Points Editor Component
function PlotPointsEditor() {
  const [newKey, setNewKey] = createSignal('')
  const [newType, setNewType] = createSignal<'string' | 'number' | 'enum' | 'boolean'>('string')
  const [newDefault, setNewDefault] = createSignal('')
  const [newBoolDefault, setNewBoolDefault] = createSignal(false)
  const [newOptions, setNewOptions] = createSignal<string[]>([])
  const [newOptionInput, setNewOptionInput] = createSignal('')
  const [editingKey, setEditingKey] = createSignal<string | null>(null)
  const [editValue, setEditValue] = createSignal('')

  const handleAddOption = () => {
    const option = newOptionInput().trim()
    if (!option) return
    if (newOptions().includes(option)) {
      alert('This option already exists')
      return
    }
    setNewOptions([...newOptions(), option])
    setNewOptionInput('')
  }

  const handleRemoveOption = (option: string) => {
    setNewOptions(newOptions().filter((o) => o !== option))
    // If the removed option was the default, clear default
    if (newDefault() === option) {
      setNewDefault(newOptions()[0] || '')
    }
  }

  const handleAdd = () => {
    const key = newKey().trim()
    if (!key) return

    // Validate key format (JavaScript variable name)
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
      alert('Key must be a valid JavaScript variable name')
      return
    }

    // Check for duplicate
    if (plotPointsStore.definitions.some((d) => d.key === key)) {
      alert('A plot point with this key already exists')
      return
    }

    // Validate enum has options
    if (newType() === 'enum' && newOptions().length === 0) {
      alert('Enum type requires at least one option')
      return
    }

    let defaultValue: string | number | boolean
    if (newType() === 'number') {
      defaultValue = Number(newDefault()) || 0
    } else if (newType() === 'enum') {
      // Default to first option if not set or invalid
      defaultValue = newOptions().includes(newDefault()) ? newDefault() : newOptions()[0] || ''
    } else if (newType() === 'boolean') {
      defaultValue = newBoolDefault()
    } else {
      defaultValue = newDefault()
    }

    plotPointsStore.addDefinition({
      key,
      type: newType(),
      default: defaultValue,
      options: newType() === 'enum' ? newOptions() : undefined,
    })

    // Reset form
    setNewKey('')
    setNewType('string')
    setNewDefault('')
    setNewBoolDefault(false)
    setNewOptions([])
    setNewOptionInput('')
  }

  const handleRemove = (key: string) => {
    if (confirm(`Remove plot point "${key}"? This will also remove all message-level overrides.`)) {
      plotPointsStore.removeDefinition(key)
    }
  }

  const startEdit = (def: PlotPointDefinition) => {
    setEditingKey(def.key)
    setEditValue(String(def.default))
  }

  const saveEdit = (key: string, type: 'string' | 'number' | 'enum' | 'boolean') => {
    let value: string | number | boolean
    if (type === 'number') {
      value = Number(editValue()) || 0
    } else if (type === 'boolean') {
      value = editValue() === 'true'
    } else {
      value = editValue()
    }
    plotPointsStore.updateDefinition(key, { default: value })
    setEditingKey(null)
  }

  const cancelEdit = () => {
    setEditingKey(null)
  }

  return (
    <Stack gap="md">
      <p class={styles.plotPointsDescription}>
        Define plot point variables that can be accessed in scripts as <code>data.plotPoints.keyName</code>. Override
        values at specific messages to track story state changes.
      </p>

      {/* Existing plot points */}
      <Show when={plotPointsStore.definitions.length > 0}>
        <div class={styles.plotPointsList}>
          <For each={plotPointsStore.definitions}>
            {(def) => (
              <div class={styles.plotPointRow} style={{ 'flex-wrap': 'wrap' }}>
                <code class={styles.plotPointKey}>{def.key}</code>
                <span class={styles.plotPointType}>{def.type}</span>
                <Show
                  when={editingKey() === def.key}
                  fallback={
                    <>
                      <span class={styles.plotPointValue}>= {JSON.stringify(def.default)}</span>
                      <Button variant="ghost" size="sm" onClick={() => startEdit(def)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(def.key)}>
                        Remove
                      </Button>
                    </>
                  }
                >
                  <Show when={def.type === 'enum' && def.options}>
                    <select
                      value={editValue()}
                      onChange={(e) => setEditValue(e.currentTarget.value)}
                      class={styles.select}
                      style={{ flex: 1 }}
                    >
                      <For each={def.options}>{(option) => <option value={option}>{option}</option>}</For>
                    </select>
                  </Show>
                  <Show when={def.type === 'boolean'}>
                    <select
                      value={editValue()}
                      onChange={(e) => setEditValue(e.currentTarget.value)}
                      class={styles.select}
                      style={{ flex: 1 }}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </Show>
                  <Show when={def.type !== 'enum' && def.type !== 'boolean'}>
                    <input
                      type={def.type === 'number' ? 'number' : 'text'}
                      value={editValue()}
                      onInput={(e) => setEditValue(e.currentTarget.value)}
                      class={styles.input}
                      style={{ flex: 1 }}
                    />
                  </Show>
                  <Button variant="primary" size="sm" onClick={() => saveEdit(def.key, def.type)}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </Show>
                {/* Show options for enum types */}
                <Show when={def.type === 'enum' && def.options && def.options.length > 0}>
                  <div class={styles.plotPointOptions} style={{ width: '100%' }}>
                    <For each={def.options}>
                      {(option) => (
                        <span class={styles.enumOptionTag}>
                          {option}
                          {option === def.default && ' ✓'}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Add new plot point */}
      <div class={styles.addPlotPointContainer} style={{ 'flex-wrap': 'wrap' }}>
        <div class={styles.formField}>
          <label class={styles.formLabel}>Key (variable name)</label>
          <input
            type="text"
            placeholder="e.g., ahsokaFeeling"
            value={newKey()}
            onInput={(e) => setNewKey(e.currentTarget.value)}
            class={styles.input}
          />
        </div>
        <div class={styles.formFieldSmall}>
          <label class={styles.formLabel}>Type</label>
          <select
            value={newType()}
            onChange={(e) => {
              const type = e.currentTarget.value as 'string' | 'number' | 'enum' | 'boolean'
              setNewType(type)
              // Reset options when changing away from enum
              if (type !== 'enum') {
                setNewOptions([])
                setNewOptionInput('')
              }
            }}
            class={styles.select}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="enum">Enum</option>
          </select>
        </div>

        {/* Show options input for enum type */}
        <Show when={newType() === 'enum'}>
          <div class={styles.enumOptionsContainer} style={{ width: '100%', 'margin-top': '0.5rem' }}>
            <label class={styles.formLabel}>Options (add at least one)</label>
            <Show when={newOptions().length > 0}>
              <div class={styles.enumOptionsList}>
                <For each={newOptions()}>
                  {(option) => (
                    <span class={styles.enumOptionTag}>
                      {option}
                      <span class={styles.enumOptionRemove} onClick={() => handleRemoveOption(option)}>
                        ×
                      </span>
                    </span>
                  )}
                </For>
              </div>
            </Show>
            <div class={styles.enumOptionsRow}>
              <input
                type="text"
                placeholder="e.g., happy"
                value={newOptionInput()}
                onInput={(e) => setNewOptionInput(e.currentTarget.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                class={styles.input}
              />
              <Button variant="secondary" size="sm" onClick={handleAddOption} disabled={!newOptionInput().trim()}>
                Add Option
              </Button>
            </div>
          </div>
        </Show>

        <Show when={newType() === 'string' || newType() === 'number'}>
          <div class={styles.formField}>
            <label class={styles.formLabel}>Default value</label>
            <input
              type={newType() === 'number' ? 'number' : 'text'}
              placeholder={newType() === 'number' ? '0' : 'neutral'}
              value={newDefault()}
              onInput={(e) => setNewDefault(e.currentTarget.value)}
              class={styles.input}
            />
          </div>
        </Show>

        <Show when={newType() === 'boolean'}>
          <div class={styles.formFieldSmall}>
            <label class={styles.formLabel}>Default</label>
            <select
              value={newBoolDefault() ? 'true' : 'false'}
              onChange={(e) => setNewBoolDefault(e.currentTarget.value === 'true')}
              class={styles.select}
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>
        </Show>

        <Show when={newType() === 'enum' && newOptions().length > 0}>
          <div class={styles.formFieldSmall}>
            <label class={styles.formLabel}>Default</label>
            <select value={newDefault()} onChange={(e) => setNewDefault(e.currentTarget.value)} class={styles.select}>
              <For each={newOptions()}>{(option) => <option value={option}>{option}</option>}</For>
            </select>
          </div>
        </Show>

        <Button
          variant="primary"
          size="sm"
          onClick={handleAdd}
          disabled={!newKey().trim() || (newType() === 'enum' && newOptions().length === 0)}
        >
          Add
        </Button>
      </div>
    </Stack>
  )
}

interface GlobalScriptEditorProps {
  compact?: boolean
}

export function GlobalScriptEditor(props: GlobalScriptEditorProps) {
  const [isEditing, setIsEditing] = createSignal(false)
  const [scriptContent, setScriptContent] = createSignal(currentStoryStore.globalScript || '')
  const [error, setError] = createSignal<string | null>(null)
  const [activeTab, setActiveTab] = createSignal('script')

  const validateScript = (script: string): boolean => {
    if (!script.trim()) {
      setError(null)
      return true
    }

    try {
      // Try to evaluate the script as a function
      const scriptFunction = eval(`(${script})`)
      if (typeof scriptFunction !== 'function') {
        setError('Script must be a function that takes data and returns data')
        return false
      }
      setError(null)
      return true
    } catch (e) {
      setError(`Invalid JavaScript: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return false
    }
  }

  const handleSave = () => {
    if (validateScript(scriptContent())) {
      currentStoryStore.setGlobalScript(scriptContent().trim() || undefined)
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setScriptContent(currentStoryStore.globalScript || '')
    setError(null)
    setIsEditing(false)
  }

  const handleStartEditing = () => {
    // If no script exists, populate with the default
    if (!currentStoryStore.globalScript) {
      setScriptContent(DEFAULT_GLOBAL_SCRIPT)
    }
    setIsEditing(true)
  }

  return (
    <>
      <Show when={props.compact}>
        <Button variant="secondary" size="sm" onClick={handleStartEditing}>
          {currentStoryStore.globalScript ? 'Edit' : 'Add'} Script
        </Button>
      </Show>

      <Show when={!props.compact}>
        <Card style={{ margin: '1rem 0' }}>
          <CardBody>
            <Show when={!isEditing()}>
              <div class={styles.headerRow}>
                <h3 class={styles.sectionTitle}>Global Script</h3>
                <Button variant="primary" size="sm" onClick={handleStartEditing}>
                  {currentStoryStore.globalScript ? 'Edit' : 'Add'} Script
                </Button>
              </div>
              <Show when={currentStoryStore.globalScript}>
                <div class={styles.codePreviewContainer}>
                  <CodeEditor
                    value={currentStoryStore.globalScript || ''}
                    onChange={() => {}}
                    readOnly={true}
                    height="200px"
                  />
                </div>
              </Show>
            </Show>

            <Show when={isEditing()}>
              <Stack gap="md">
                <h3 class={styles.sectionTitle}>Edit Global Script</h3>
                <p class={styles.description}>
                  This script runs before every message script. It should be a function that takes a data object and
                  returns it.
                </p>
                <CodeEditor
                  value={scriptContent()}
                  onChange={(value) => {
                    setScriptContent(value)
                    validateScript(value)
                  }}
                  error={error()}
                  height="300px"
                />
                <Show when={error()}>
                  <Alert variant="error">{error()}</Alert>
                </Show>
                <div class={styles.buttonRow}>
                  <Button variant="primary" onClick={handleSave}>
                    Save
                  </Button>
                  <Button variant="secondary" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </Stack>
            </Show>
          </CardBody>
        </Card>
      </Show>

      {/* Modal for compact mode */}
      <Modal open={!!props.compact && isEditing()} onClose={handleCancel} title="Global Script & Plot Points" size="xl">
        <div class={styles.modalPadding}>
          <Tabs activeTab={activeTab()} onTabChange={setActiveTab}>
            <TabList>
              <Tab id="script">Script</Tab>
              <Tab id="plot-points">Plot Points</Tab>
            </TabList>

            <TabPanel id="script">
              <Stack gap="md" class={styles.tabPanelContent}>
                <p class={styles.description}>
                  This script runs before every message script. It should be a function that takes a data object and
                  returns it.
                </p>
                <CodeEditor
                  value={scriptContent()}
                  onChange={(value) => {
                    setScriptContent(value)
                    validateScript(value)
                  }}
                  error={error()}
                />
                <Show when={error()}>
                  <Alert variant="error">{error()}</Alert>
                </Show>
                <div class={styles.buttonRowEnd}>
                  <Button variant="ghost" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleSave}>
                    Save
                  </Button>
                </div>
              </Stack>
            </TabPanel>

            <TabPanel id="plot-points">
              <div class={styles.tabPanelContent}>
                <PlotPointsEditor />
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </Modal>
    </>
  )
}
