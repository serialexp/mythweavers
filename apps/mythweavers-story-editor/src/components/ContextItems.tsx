import {
  Badge,
  Button,
  Input,
  ListDetailPanel,
  type ListDetailPanelRef,
  Stack,
  Tab,
  TabList,
  Tabs,
} from '@mythweavers/ui'
import { BsArrowLeft, BsCheck, BsPencil, BsPlus, BsX } from 'solid-icons/bs'
import { type Component, Show, batch, createMemo, createSignal } from 'solid-js'
import { contextItemsStore } from '../stores/contextItemsStore'
import type { ContextItem } from '../types/core'
import { generateMessageId } from '../utils/id'
import * as styles from './ContextItems.css'
import { EJSCodeEditor } from './EJSCodeEditor'
import { EJSRenderer } from './EJSRenderer'
import { ScriptHelpTabs } from './ScriptHelpTabs'
import { TemplateChangeRequest } from './TemplateChangeRequest'

export interface ContextItemsRef {
  addNew: () => void
}

interface ContextItemsProps {
  ref?: (ref: ContextItemsRef) => void
}

export const ContextItems: Component<ContextItemsProps> = (props) => {
  const [selectedTab, setSelectedTab] = createSignal<'all' | 'theme' | 'location' | 'plot'>('all')
  const [newItemName, setNewItemName] = createSignal('')
  const [newItemDescription, setNewItemDescription] = createSignal('')
  const [newItemType, setNewItemType] = createSignal<'theme' | 'location' | 'plot'>('theme')
  const [newItemIsGlobal, setNewItemIsGlobal] = createSignal(false)
  const [editingId, setEditingId] = createSignal('')
  const [editName, setEditName] = createSignal('')
  const [editDescription, setEditDescription] = createSignal('')
  const [editType, setEditType] = createSignal<'theme' | 'location' | 'plot'>('theme')
  const [editIsGlobal, setEditIsGlobal] = createSignal(false)

  let panelRef: ListDetailPanelRef | undefined

  // Expose addNew method via ref
  props.ref?.({
    addNew: () => {
      const tab = selectedTab()
      if (tab !== 'all') {
        setNewItemType(tab)
      }
      panelRef?.select('new')
    },
  })

  // Filter context items by selected tab
  const filteredContextItems = createMemo(() => {
    const tab = selectedTab()
    if (tab === 'all') return contextItemsStore.contextItems
    return contextItemsStore.contextItems.filter((item) => item.type === tab)
  })

  const addContextItem = () => {
    const name = newItemName().trim()
    const description = newItemDescription().trim()

    if (!name || !description) return

    const contextItem: ContextItem = {
      id: generateMessageId(),
      name,
      description,
      isGlobal: newItemIsGlobal(),
      type: newItemType(),
    }

    contextItemsStore.addContextItem(contextItem)
    setNewItemName('')
    setNewItemDescription('')
    setNewItemType('theme')
    setNewItemIsGlobal(false)
    panelRef?.select(contextItem.id)
  }

  const startEditing = (item: ContextItem) => {
    batch(() => {
      setEditName(item.name)
      setEditDescription(item.description)
      setEditType(item.type)
      setEditIsGlobal(item.isGlobal)
      setEditingId(item.id)
    })
  }

  const saveEdit = () => {
    const name = editName().trim()
    const description = editDescription().trim()

    if (!name || !description) return

    contextItemsStore.updateContextItem(editingId(), {
      name,
      description,
      type: editType(),
      isGlobal: editIsGlobal(),
    })
    setEditingId('')
    setEditName('')
    setEditDescription('')
    setEditType('theme')
    setEditIsGlobal(false)
  }

  const cancelEdit = () => {
    setEditingId('')
    setEditName('')
    setEditDescription('')
    setEditIsGlobal(false)
  }

  const handleKeyPress = (e: KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      action()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (editingId()) {
        cancelEdit()
      }
    }
  }

  const getTypeBadgeVariant = (type: string): 'info' | 'success' | 'warning' => {
    return type === 'theme' ? 'info' : type === 'location' ? 'success' : 'warning'
  }

  return (
    <Show when={contextItemsStore.showContextItems}>
      <ListDetailPanel
        ref={(r) => (panelRef = r)}
        items={filteredContextItems()}
        backIcon={<BsArrowLeft />}
        listHeader={
          <Tabs
            activeTab={selectedTab()}
            onTabChange={(val) => setSelectedTab(val as 'all' | 'theme' | 'location' | 'plot')}
          >
            <TabList>
              <Tab id="all">
                All
                <br />({contextItemsStore.contextItems.length})
              </Tab>
              <Tab id="theme">
                Themes
                <br />({contextItemsStore.contextItems.filter((i) => i.type === 'theme').length})
              </Tab>
              <Tab id="location">
                Locations
                <br />({contextItemsStore.contextItems.filter((i) => i.type === 'location').length})
              </Tab>
              <Tab id="plot">
                Storylines
                <br />({contextItemsStore.contextItems.filter((i) => i.type === 'plot').length})
              </Tab>
            </TabList>
          </Tabs>
        }
        renderListItem={(item) => (
          <Stack direction="horizontal" gap="sm" align="center" style={{ flex: '1', 'min-width': '0' }}>
            <div class={styles.listItemName}>
              <EJSRenderer template={item.name} mode="inline" />
            </div>
            <Badge variant={getTypeBadgeVariant(item.type)} size="sm">
              {item.type}
            </Badge>
          </Stack>
        )}
        detailTitle={(item) => (
          <Show when={!editingId()} fallback="Edit Context Item">
            <Stack direction="horizontal" gap="sm" align="center" style={{ flex: '1' }}>
              <span style={{ flex: '1' }}>
                <EJSRenderer template={item.name} mode="inline" />
              </span>
              <Button size="sm" onClick={() => startEditing(item)}>
                <BsPencil /> Edit
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm(`Delete "${item.name}"?`)) {
                    contextItemsStore.deleteContextItem(item.id)
                    panelRef?.clearSelection()
                  }
                }}
              >
                <BsX />
              </Button>
            </Stack>
          </Show>
        )}
        renderDetail={(item) => (
          <Show
            when={!editingId()}
            fallback={
              <div class={styles.form}>
                <Input
                  value={editName()}
                  onInput={(e) => setEditName(e.currentTarget.value)}
                  onKeyDown={(e) => handleKeyPress(e, saveEdit)}
                  placeholder="Context name"
                />
                <EJSCodeEditor
                  value={editDescription()}
                  onChange={setEditDescription}
                  placeholder="Context description (supports EJS templates)"
                  minHeight="120px"
                />
                <TemplateChangeRequest
                  currentTemplate={editDescription()}
                  onTemplateChange={setEditDescription}
                  placeholder="Describe how you want to change this description"
                />
                <EJSRenderer template={editDescription()} mode="preview-always" />
                <ScriptHelpTabs />
                <div class={styles.typeSelector}>
                  <label class={styles.typeLabel}>
                    <input
                      type="radio"
                      name={`edit-type-${item.id}`}
                      checked={editType() === 'theme'}
                      onChange={() => setEditType('theme')}
                    />
                    Theme
                  </label>
                  <label class={styles.typeLabel}>
                    <input
                      type="radio"
                      name={`edit-type-${item.id}`}
                      checked={editType() === 'location'}
                      onChange={() => setEditType('location')}
                    />
                    Location
                  </label>
                  <label class={styles.typeLabel}>
                    <input
                      type="radio"
                      name={`edit-type-${item.id}`}
                      checked={editType() === 'plot'}
                      onChange={() => setEditType('plot')}
                    />
                    Plot
                  </label>
                </div>
                <div class={styles.globalToggle}>
                  <label class={styles.typeLabel}>
                    <input
                      type="checkbox"
                      checked={editIsGlobal()}
                      onChange={(e) => setEditIsGlobal(e.target.checked)}
                    />
                    Global (active in all chapters)
                  </label>
                </div>
                <Stack
                  direction="horizontal"
                  gap="sm"
                  class={styles.actionRow}
                >
                  <Button
                    variant="primary"
                    onClick={saveEdit}
                    disabled={!editName().trim() || !editDescription().trim()}
                    style={{ flex: '1' }}
                  >
                    <BsCheck /> Save Changes
                  </Button>
                  <Button variant="secondary" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </Stack>
              </div>
            }
          >
            <div>
              <Stack direction="horizontal" gap="lg" class={styles.fieldGroup}>
                <div>
                  <label class={styles.fieldLabel}>Type</label>
                  <div class={styles.fieldValue}>
                    <Badge variant={getTypeBadgeVariant(item.type)} size="sm">
                      {item.type}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label class={styles.fieldLabel}>Global</label>
                  <div class={styles.fieldValue}>{item.isGlobal ? 'Yes' : 'No'}</div>
                </div>
              </Stack>
              <div>
                <label class={styles.fieldLabel}>Description</label>
                <div class={styles.fieldValue}>
                  <EJSRenderer template={item.description} mode="inline" />
                </div>
              </div>
            </div>
          </Show>
        )}
        newItemTitle="Add New Context Item"
        renderNewForm={() => (
          <div class={styles.form}>
            <Input
              value={newItemName()}
              onInput={(e) => setNewItemName(e.currentTarget.value)}
              onKeyDown={(e) => handleKeyPress(e, addContextItem)}
              placeholder="Context name"
            />
            <EJSCodeEditor
              value={newItemDescription()}
              onChange={setNewItemDescription}
              placeholder="Context description (supports EJS templates)"
              minHeight="120px"
            />
            <TemplateChangeRequest
              currentTemplate={newItemDescription()}
              onTemplateChange={setNewItemDescription}
              placeholder="Describe how you want to change this description"
            />
            <EJSRenderer template={newItemDescription()} mode="preview-always" />
            <ScriptHelpTabs />
            <div class={styles.typeSelector}>
              <label class={styles.typeLabel}>
                <input
                  type="radio"
                  name="new-item-type"
                  checked={newItemType() === 'theme'}
                  onChange={() => setNewItemType('theme')}
                />
                Theme
              </label>
              <label class={styles.typeLabel}>
                <input
                  type="radio"
                  name="new-item-type"
                  checked={newItemType() === 'location'}
                  onChange={() => setNewItemType('location')}
                />
                Location
              </label>
              <label class={styles.typeLabel}>
                <input
                  type="radio"
                  name="new-item-type"
                  checked={newItemType() === 'plot'}
                  onChange={() => setNewItemType('plot')}
                />
                Plot
              </label>
            </div>
            <div class={styles.globalToggle}>
              <label class={styles.typeLabel}>
                <input
                  type="checkbox"
                  checked={newItemIsGlobal()}
                  onChange={(e) => setNewItemIsGlobal(e.target.checked)}
                />
                Global (active in all chapters)
              </label>
            </div>
            <Stack
              direction="horizontal"
              gap="sm"
              class={styles.actionRow}
            >
              <Button
                variant="primary"
                onClick={addContextItem}
                disabled={!newItemName().trim() || !newItemDescription().trim()}
                style={{ flex: '1' }}
              >
                <BsPlus /> Add Context Item
              </Button>
              <Button variant="secondary" onClick={() => panelRef?.clearSelection()}>
                Cancel
              </Button>
            </Stack>
          </div>
        )}
      />
    </Show>
  )
}
