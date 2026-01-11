import { Alert, Button, Card, CardBody, Grid, Modal, Stack, Tab, TabList, TabPanel, Tabs } from '@mythweavers/ui'
import type { Paragraph, ParagraphInventoryAction } from '@mythweavers/shared'
import { Component, For, Show, createMemo, createSignal } from 'solid-js'
import { calendarStore } from '../stores/calendarStore'
import { charactersStore } from '../stores/charactersStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { scriptDataStore } from '../stores/scriptDataStore'
import { Message } from '../types/core'
import { getCharacterDisplayName } from '../utils/character'
import { getMessagesInStoryOrder } from '../utils/nodeTraversal'
import { executeScript, executeScriptsUpToMessage } from '../utils/scriptEngine'
import { CharacterSelectByName } from './CharacterSelect'
import { CodeEditor, type CodeEditorCompletion } from './CodeEditor'
import * as styles from './ParagraphScriptModal.css'

interface ParagraphScriptModalProps {
  paragraph: Paragraph
  message: Message
  onClose: () => void
  onSave: (paragraphId: string, script: string | null, inventoryActions: ParagraphInventoryAction[] | null) => void
}

const DEFAULT_PARAGRAPH_SCRIPT = `(data, functions) => {
  // This script runs when this paragraph is processed.
  // It executes AFTER inventory actions, BEFORE the message script.
  // Use it for complex logic beyond simple add/remove.

  // === BUILT-IN INVENTORY HELPERS ===
  // functions.addItem(data, 'Luke', { name: 'lightsaber', amount: 1, description: 'Blue blade' })
  // functions.removeItem(data, 'Luke', 'credits', 500)
  // if (functions.hasItem(data, 'Luke', 'blaster')) { ... }

  // === DIRECT DATA MUTATION ===
  // data.characters['Luke'].mood = 'determined'
  // data.plotPoints.swordFound = true
}`

// Inventory Actions Editor Component
function InventoryActionsEditor(props: {
  actions: ParagraphInventoryAction[]
  onActionsChange: (actions: ParagraphInventoryAction[]) => void
  dataBeforeParagraph: any
  defaultCharacterName?: string
}) {
  const [newAction, setNewAction] = createSignal<Partial<ParagraphInventoryAction>>({
    type: 'add',
    character_name: props.defaultCharacterName || '',
    item_name: '',
    item_amount: 1,
  })

  // Get existing item names from the data state for autocomplete
  const existingItemNames = createMemo(() => {
    const data = props.dataBeforeParagraph
    if (!data?.characters) return []

    const items = new Set<string>()
    for (const charName of Object.keys(data.characters)) {
      const inventory = data.characters[charName]?.inventory as any[] | undefined
      if (inventory) {
        for (const item of inventory) {
          if (item.name) items.add(item.name)
        }
      }
    }
    return Array.from(items).sort()
  })

  const handleAddAction = () => {
    const action = newAction()
    if (!action.character_name || !action.item_name || !action.item_amount) return

    const newActions = [
      ...props.actions,
      {
        type: action.type!,
        character_name: action.character_name,
        item_name: action.item_name,
        item_amount: action.item_amount,
        item_description: action.item_description,
      } as ParagraphInventoryAction,
    ]
    props.onActionsChange(newActions)

    // Reset form
    setNewAction({
      type: 'add',
      character_name: props.defaultCharacterName || '',
      item_name: '',
      item_amount: 1,
    })
  }

  const handleRemoveAction = (index: number) => {
    const newActions = props.actions.filter((_, i) => i !== index)
    props.onActionsChange(newActions)
  }

  return (
    <Stack gap="md">
      <p class={styles.description}>
        Add or remove items from character inventories. These actions run <strong>before</strong> the script.
      </p>

      {/* Existing actions list */}
      <Show when={props.actions.length > 0}>
        <div class={styles.actionsList}>
          <For each={props.actions}>
            {(action, index) => (
              <div class={styles.actionRow}>
                <span class={action.type === 'add' ? styles.actionTypeAdd : styles.actionTypeRemove}>
                  {action.type === 'add' ? '+' : '-'}
                </span>
                <span class={styles.actionAmount}>{action.item_amount}x</span>
                <span class={styles.actionItem}>{action.item_name}</span>
                <span class={styles.actionArrow}>→</span>
                <span class={styles.actionCharacter}>{action.character_name}</span>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveAction(index())}>
                  ✕
                </Button>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Add new action form */}
      <div class={styles.addActionForm}>
        <h4 class={styles.formTitle}>Add Inventory Action</h4>

        <div class={styles.formRow}>
          <label class={styles.formLabel}>Type</label>
          <div class={styles.toggleContainer}>
            <button
              type="button"
              class={newAction().type === 'add' ? styles.toggleButtonSelected : styles.toggleButton}
              onClick={() => setNewAction((prev) => ({ ...prev, type: 'add' }))}
            >
              + Add
            </button>
            <button
              type="button"
              class={newAction().type === 'remove' ? styles.toggleButtonSelected : styles.toggleButton}
              onClick={() => setNewAction((prev) => ({ ...prev, type: 'remove' }))}
            >
              - Remove
            </button>
          </div>
        </div>

        <div class={styles.formRow}>
          <label class={styles.formLabel}>Character</label>
          <CharacterSelectByName
            value={newAction().character_name || ''}
            onChange={(name) => setNewAction((prev) => ({ ...prev, character_name: name }))}
            placeholder="Select character..."
            size="sm"
          />
        </div>

        <div class={styles.formRow}>
          <label class={styles.formLabel}>Item</label>
          <input
            type="text"
            list="item-names"
            class={styles.input}
            value={newAction().item_name || ''}
            onInput={(e) => setNewAction((prev) => ({ ...prev, item_name: e.currentTarget.value }))}
            placeholder="Item name..."
          />
          <datalist id="item-names">
            <For each={existingItemNames()}>{(name) => <option value={name} />}</For>
          </datalist>
        </div>

        <div class={styles.formRow}>
          <label class={styles.formLabel}>Amount</label>
          <input
            type="number"
            class={styles.inputSmall}
            value={newAction().item_amount || 1}
            min={1}
            onInput={(e) => setNewAction((prev) => ({ ...prev, item_amount: parseInt(e.currentTarget.value) || 1 }))}
          />
        </div>

        <Show when={newAction().type === 'add'}>
          <div class={styles.formRow}>
            <label class={styles.formLabel}>Description</label>
            <input
              type="text"
              class={styles.input}
              value={newAction().item_description || ''}
              onInput={(e) => setNewAction((prev) => ({ ...prev, item_description: e.currentTarget.value }))}
              placeholder="Optional description..."
            />
          </div>
        </Show>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddAction}
          disabled={!newAction().character_name || !newAction().item_name}
        >
          Add Action
        </Button>
      </div>
    </Stack>
  )
}

export const ParagraphScriptModal: Component<ParagraphScriptModalProps> = (props) => {
  const [scriptContent, setScriptContent] = createSignal(props.paragraph.script || DEFAULT_PARAGRAPH_SCRIPT)
  const [inventoryActions, setInventoryActions] = createSignal<ParagraphInventoryAction[]>(
    props.paragraph.inventoryActions || [],
  )
  const [error, setError] = createSignal<string | null>(null)
  const [previewData, setPreviewData] = createSignal<any>(null)
  const [showPreview, setShowPreview] = createSignal(false)
  const [activeTab, setActiveTab] = createSignal('inventory')
  const [scriptHelpTab, setScriptHelpTab] = createSignal('')

  // Get the current paragraph state from the store
  const currentParagraphState = createMemo(() => {
    return scriptDataStore.getDataStateForParagraph(props.paragraph.id)
  })

  // Get the default character name (viewpoint character if set, otherwise protagonist)
  const defaultCharacterName = createMemo(() => {
    // First check if the scene has a viewpoint character
    if (props.message.sceneId) {
      const sceneNode = nodeStore.nodesArray.find((n) => n.id === props.message.sceneId)
      if (sceneNode?.viewpointCharacterId) {
        const viewpointChar = charactersStore.characters.find((c) => c.id === sceneNode.viewpointCharacterId)
        if (viewpointChar) {
          return getCharacterDisplayName(viewpointChar)
        }
      }
    }
    // Fall back to protagonist
    const protagonist = charactersStore.characters.find((c) => c.isMainCharacter)
    return protagonist ? getCharacterDisplayName(protagonist) : ''
  })

  // Get available functions from global script (like ScriptHelpTabs)
  const availableFunctions = createMemo(() => {
    let functions: Record<string, Function> = {}

    if (currentStoryStore.globalScript) {
      try {
        const scriptFunction = eval(`(${currentStoryStore.globalScript})`)
        if (typeof scriptFunction === 'function') {
          const data = {}
          const result = scriptFunction(data, {})
          if (result && typeof result === 'object' && 'functions' in result) {
            functions = result.functions || {}
          }
        }
      } catch (error) {
        console.error('Error evaluating global script for functions:', error)
      }
    }

    return Object.entries(functions).map(([name, func]) => {
      const funcStr = func.toString()
      const match = funcStr.match(/^(?:function\s*)?(?:\w+\s*)?\(([^)]*)\)/)
      const params = match
        ? match[1]
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        : []

      return {
        name,
        params,
        signature: `${name}(${params.join(', ')})`,
      }
    })
  })

  // Compute data state before this paragraph (for autocomplete and preview)
  const dataBeforeParagraph = createMemo(() => {
    try {
      // Find previous message (if any)
      const allMessagesInOrder = getMessagesInStoryOrder(
        messagesStore.messages,
        nodeStore.nodesArray,
        props.message.id,
      )
      const currentIndex = allMessagesInOrder.findIndex((m) => m.id === props.message.id)
      const previousMessageId = currentIndex > 0 ? allMessagesInOrder[currentIndex - 1].id : null

      // Get state after previous messages (or just initialized state if first message)
      let dataBefore = executeScriptsUpToMessage(
        messagesStore.messages,
        previousMessageId,
        nodeStore.nodesArray,
        currentStoryStore.globalScript,
      )

      // Update time if we're entering a new scene
      if (currentIndex > 0 && props.message.sceneId) {
        const previousMessage = allMessagesInOrder[currentIndex - 1]
        if (previousMessage.sceneId !== props.message.sceneId) {
          const currentNode = nodeStore.nodesArray.find((n) => n.id === props.message.sceneId)
          if (currentNode?.storyTime != null) {
            dataBefore = {
              ...dataBefore,
              currentTime: currentNode.storyTime,
              currentDate: calendarStore.formatStoryTime(currentNode.storyTime) || '',
            }
          }
        }
      }

      // Execute preceding paragraphs in this message
      const paragraphs = props.message.paragraphs || []
      const sortedParagraphs = [...paragraphs].sort((a, b) => {
        const orderA = (a as any).sortOrder ?? 0
        const orderB = (b as any).sortOrder ?? 0
        return orderA - orderB
      })

      let functions = {}
      if (currentStoryStore.globalScript) {
        const globalResult = executeScript(currentStoryStore.globalScript, {}, {}, true)
        functions = globalResult.functions || {}
      }

      let currentData = JSON.parse(JSON.stringify(dataBefore))
      for (const para of sortedParagraphs) {
        if (para.id === props.paragraph.id) break
        if (para.script) {
          const result = executeScript(para.script, currentData, functions, false)
          currentData = result.data
        }
      }

      return currentData
    } catch {
      return {}
    }
  })

  // Build completions for the code editor (depends on dataBeforeParagraph)
  const editorCompletions = createMemo((): CodeEditorCompletion[] => {
    const completions: CodeEditorCompletion[] = [
      // Built-in inventory functions
      { label: 'functions.addItem', detail: "(data, 'Char', {name, amount?, desc?})", type: 'function' },
      { label: 'functions.removeItem', detail: "(data, 'Char', 'item', amt?)", type: 'function' },
      { label: 'functions.hasItem', detail: "(data, 'Char', 'item', minAmt?)", type: 'function' },
      { label: 'functions.getItem', detail: "(data, 'Char', 'itemName')", type: 'function' },
      { label: 'functions.listInventory', detail: "(data, 'Char')", type: 'function' },
      // Common data properties
      { label: 'data.characters', detail: 'Character data object', type: 'property' },
      { label: 'data.currentTime', detail: 'Current story time (minutes)', type: 'property' },
      { label: 'data.currentDate', detail: 'Formatted story date', type: 'property' },
      { label: 'data.plotPoints', detail: 'Plot points object', type: 'property' },
      { label: 'data.contextItems', detail: 'Context items object', type: 'property' },
    ]

    // Add character completions - combine store characters with data state
    const data = dataBeforeParagraph()
    const dataCharacters = (data?.characters as Record<string, unknown>) || {}

    // Start with all characters from the store
    for (const char of charactersStore.characters) {
      const charName = getCharacterDisplayName(char)
      const charPath = `data.characters['${charName}']`
      const charData = dataCharacters[charName]

      // Character accessor
      completions.push({
        label: charPath,
        detail: char.isMainCharacter ? 'Protagonist' : 'Character',
        type: 'variable',
      })

      // Add actual properties from the data state (if character has data)
      if (charData && typeof charData === 'object') {
        for (const [prop, value] of Object.entries(charData as Record<string, unknown>)) {
          let detail: string = typeof value
          if (Array.isArray(value)) {
            detail = `Array(${value.length})`
          } else if (typeof value === 'string') {
            detail = value.length > 20 ? `"${value.slice(0, 20)}..."` : `"${value}"`
          } else if (typeof value === 'number') {
            detail = String(value)
          }

          completions.push({
            label: `${charPath}.${prop}`,
            detail,
            type: 'property',
          })
        }
      }
    }

    // Add custom functions from global script
    for (const func of availableFunctions()) {
      completions.push({
        label: `functions.${func.name}`,
        detail: `(${func.params.join(', ')})`,
        type: 'function',
      })
    }

    return completions
  })

  const validateScript = (script: string): boolean => {
    if (!script.trim()) {
      setError(null)
      return true
    }

    try {
      const scriptFunction = eval(`(${script})`)
      if (typeof scriptFunction !== 'function') {
        setError('Script must be a function that takes (data, functions) parameters')
        return false
      }
      setError(null)
      return true
    } catch (e) {
      setError(`Invalid JavaScript: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return false
    }
  }

  const handlePreview = () => {
    if (showPreview()) {
      setShowPreview(false)
      return
    }

    if (!validateScript(scriptContent())) return

    try {
      const currentData = JSON.parse(JSON.stringify(dataBeforeParagraph()))

      let functions = {}
      if (currentStoryStore.globalScript) {
        const globalResult = executeScript(currentStoryStore.globalScript, {}, {}, true)
        functions = globalResult.functions || {}
      }

      // Apply inventory actions first
      // (We don't have applyInventoryActions exported, so simulate it)
      const dataAfterInventory = JSON.parse(JSON.stringify(currentData))
      // TODO: Apply inventory actions to dataAfterInventory

      // Then execute script
      const dataAfter = JSON.parse(JSON.stringify(dataAfterInventory))
      if (scriptContent().trim()) {
        const scriptResult = executeScript(scriptContent(), dataAfter, functions, false)
        setPreviewData({ before: currentData, after: scriptResult.data })
      } else {
        setPreviewData({ before: currentData, after: dataAfter })
      }

      setShowPreview(true)
    } catch (e) {
      setError(`Error executing script: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  const handleSave = () => {
    if (validateScript(scriptContent())) {
      // Treat the default placeholder as empty (no script)
      const content = scriptContent().trim()
      const script = content && content !== DEFAULT_PARAGRAPH_SCRIPT.trim() ? content : null
      const actions = inventoryActions().length > 0 ? inventoryActions() : null
      props.onSave(props.paragraph.id, script, actions)
      props.onClose()
    }
  }

  const handleClearScript = () => {
    setScriptContent('')
    setError(null)
    setShowPreview(false)
  }

  return (
    <Modal open={true} onClose={props.onClose} title="Paragraph Script & Inventory" size="lg">
      <div class={styles.modalContent}>
        <Tabs activeTab={activeTab()} onTabChange={setActiveTab}>
          <TabList>
            <Tab id="inventory">Inventory</Tab>
            <Tab id="script">Script</Tab>
          </TabList>

          <TabPanel id="inventory">
            <div class={styles.tabPanelContent}>
              <InventoryActionsEditor
                actions={inventoryActions()}
                onActionsChange={setInventoryActions}
                dataBeforeParagraph={dataBeforeParagraph()}
                defaultCharacterName={defaultCharacterName()}
              />
            </div>
          </TabPanel>

          <TabPanel id="script">
            <div class={styles.tabPanelContent}>
              <p class={styles.description}>
                For complex logic beyond simple add/remove. Runs <strong>after</strong> inventory actions.
              </p>

              <CodeEditor
                value={scriptContent()}
                onChange={(value) => {
                  setScriptContent(value)
                  validateScript(value)
                  setShowPreview(false)
                }}
                error={error()}
                height="200px"
                completions={editorCompletions()}
              />

              <Show when={error()}>
                <Alert variant="error" style={{ 'margin-top': '0.5rem' }}>
                  {error()}
                </Alert>
              </Show>

              {/* Functions help - toggleable tabs below editor */}
              <Tabs activeTab={scriptHelpTab()} onTabChange={setScriptHelpTab} toggleable variant="pills">
                <TabList>
                  <Tab id="builtin">Built-in Functions</Tab>
                  <Show when={availableFunctions().length > 0}>
                    <Tab id="custom">
                      Custom Functions ({availableFunctions().length})
                    </Tab>
                  </Show>
                </TabList>

                <TabPanel id="builtin">
                  <Card variant="outlined" class={styles.helpCard}>
                    <CardBody padding="sm">
                      <div class={styles.helpGrid}>
                        <code class={styles.helpCode}>functions.addItem(data, 'Char', {'{'}name, amount?, desc?{'}'})</code>
                        <span class={styles.helpDesc}>Add item to inventory</span>
                        <code class={styles.helpCode}>functions.removeItem(data, 'Char', 'item', amt?)</code>
                        <span class={styles.helpDesc}>Remove item from inventory</span>
                        <code class={styles.helpCode}>functions.hasItem(data, 'Char', 'item', minAmt?)</code>
                        <span class={styles.helpDesc}>Check if character has item</span>
                        <code class={styles.helpCode}>functions.getItem(data, 'Char', 'itemName')</code>
                        <span class={styles.helpDesc}>Get item object or null</span>
                        <code class={styles.helpCode}>functions.listInventory(data, 'Char')</code>
                        <span class={styles.helpDesc}>Get array of all items</span>
                      </div>
                    </CardBody>
                  </Card>
                </TabPanel>

                <TabPanel id="custom">
                  <Card variant="outlined" class={styles.helpCard}>
                    <CardBody padding="sm">
                      <div class={styles.helpGrid}>
                        <For each={availableFunctions()}>
                          {(func) => (
                            <>
                              <code class={styles.helpCode}>functions.{func.signature}</code>
                              <span class={styles.helpDesc}>From global script</span>
                            </>
                          )}
                        </For>
                      </div>
                    </CardBody>
                  </Card>
                </TabPanel>
              </Tabs>

              <Stack gap="md" style={{ 'margin-top': '1rem' }}>
                <div class={styles.buttonRow}>
                  <Button variant="secondary" onClick={handlePreview} disabled={!!error()}>
                    {showPreview() ? 'Hide Preview' : 'Preview Data State'}
                  </Button>
                  <Button variant="ghost" onClick={handleClearScript}>
                    Clear Script
                  </Button>
                </div>

                <Show when={showPreview() && previewData()}>
                  <Grid cols={2} gap="md" style={{ 'margin-top': '0.5rem' }}>
                    <Card variant="flat">
                      <CardBody>
                        <h4 class={styles.previewHeader}>Data Before</h4>
                        <pre class={styles.previewContent}>{JSON.stringify(previewData().before, null, 2)}</pre>
                      </CardBody>
                    </Card>
                    <Card variant="flat">
                      <CardBody>
                        <h4 class={styles.previewHeader}>Data After</h4>
                        <pre class={styles.previewContent}>{JSON.stringify(previewData().after, null, 2)}</pre>
                      </CardBody>
                    </Card>
                  </Grid>
                </Show>
              </Stack>
            </div>
          </TabPanel>
        </Tabs>

        <Show when={currentParagraphState()?.error}>
          <Alert variant="error" style={{ 'margin-top': '1rem' }}>
            <strong>Execution Error:</strong> {currentParagraphState()?.error}
          </Alert>
        </Show>
      </div>

      <div class={styles.footer}>
        <Button variant="ghost" onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  )
}
