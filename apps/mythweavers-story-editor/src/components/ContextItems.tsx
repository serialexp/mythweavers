import { Component, Show, For, createSignal, createMemo, batch } from 'solid-js'
import { ContextItem } from '../types/core'
import { contextItemsStore } from '../stores/contextItemsStore'
import { BsPlus, BsX, BsPencil, BsCheck, BsArrowLeft } from 'solid-icons/bs'
import { generateMessageId } from '../utils/id'
import { EJSRenderer } from './EJSRenderer'
import { EJSCodeEditor } from './EJSCodeEditor'
import { EJSDocumentation } from './EJSDocumentation'
import { AvailableFunctions } from './AvailableFunctions'
import { TemplateChangeRequest } from './TemplateChangeRequest'
import styles from './ContextItems.module.css'

export const ContextItems: Component = () => {
  const [selectedTab, setSelectedTab] = createSignal<'all' | 'theme' | 'location' | 'plot'>('all')
  const [selectedItemId, setSelectedItemId] = createSignal<string | 'new'>('')
  const [newItemName, setNewItemName] = createSignal('')
  const [newItemDescription, setNewItemDescription] = createSignal('')
  const [newItemType, setNewItemType] = createSignal<'theme' | 'location' | 'plot'>('theme')
  const [newItemIsGlobal, setNewItemIsGlobal] = createSignal(false)
  const [editingId, setEditingId] = createSignal('')
  const [editName, setEditName] = createSignal('')
  const [editDescription, setEditDescription] = createSignal('')
  const [editType, setEditType] = createSignal<'theme' | 'location' | 'plot'>('theme')
  const [editIsGlobal, setEditIsGlobal] = createSignal(false)

  // Filter context items by selected tab
  const filteredContextItems = createMemo(() => {
    const tab = selectedTab()
    if (tab === 'all') return contextItemsStore.contextItems
    return contextItemsStore.contextItems.filter(item => item.type === tab)
  })

  const selectedItem = () => {
    const id = selectedItemId()
    if (!id || id === 'new') return null
    return contextItemsStore.contextItems.find(i => i.id === id)
  }

  const addContextItem = () => {
    const name = newItemName().trim()
    const description = newItemDescription().trim()

    if (!name || !description) return

    const contextItem: ContextItem = {
      id: generateMessageId(),
      name,
      description,
      isGlobal: newItemIsGlobal(),
      type: newItemType()
    }

    contextItemsStore.addContextItem(contextItem)
    setNewItemName('')
    setNewItemDescription('')
    setNewItemType('theme')
    setNewItemIsGlobal(false)
    setSelectedItemId(contextItem.id)
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
      isGlobal: editIsGlobal()
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

  const getTypeBadgeClass = (type: string) => {
    return type === 'theme' ? styles.typeTheme :
           type === 'location' ? styles.typeLocation :
           styles.typePlot
  }

  return (
    <Show when={contextItemsStore.showContextItems}>
      <div class={styles.container}>
        {/* List Column */}
        <div class={`${styles.listColumn} ${selectedItemId() ? styles.listColumnHidden : ''}`}>
          <div class={styles.listHeader}>
            <h3 class={styles.listTitle}>Context Items</h3>
            <button
              class={styles.addButton}
              onClick={() => {
                const tab = selectedTab()
                if (tab !== 'all') {
                  setNewItemType(tab)
                }
                setSelectedItemId('new')
              }}
              title="Add new context item"
            >
              <BsPlus /> Add
            </button>
          </div>

          {/* Tabs */}
          <div class={styles.tabs}>
            <button
              class={`${styles.tab} ${selectedTab() === 'all' ? styles.tabActive : ''}`}
              onClick={() => setSelectedTab('all')}
            >
              All ({contextItemsStore.contextItems.length})
            </button>
            <button
              class={`${styles.tab} ${selectedTab() === 'theme' ? styles.tabActive : ''}`}
              onClick={() => setSelectedTab('theme')}
            >
              Themes ({contextItemsStore.contextItems.filter(i => i.type === 'theme').length})
            </button>
            <button
              class={`${styles.tab} ${selectedTab() === 'location' ? styles.tabActive : ''}`}
              onClick={() => setSelectedTab('location')}
            >
              Locations ({contextItemsStore.contextItems.filter(i => i.type === 'location').length})
            </button>
            <button
              class={`${styles.tab} ${selectedTab() === 'plot' ? styles.tabActive : ''}`}
              onClick={() => setSelectedTab('plot')}
            >
              Storylines ({contextItemsStore.contextItems.filter(i => i.type === 'plot').length})
            </button>
          </div>

          {/* Item List */}
          <div class={styles.itemList}>
            <For each={filteredContextItems()}>
              {(item) => (
                <button
                  class={`${styles.listItem} ${selectedItemId() === item.id ? styles.listItemSelected : ''}`}
                  onClick={() => {
                    if (editingId()) {
                      cancelEdit()
                    }
                    setSelectedItemId(item.id)
                  }}
                >
                  <div class={styles.listItemContent}>
                    <div class={styles.listItemName}>
                      <EJSRenderer template={item.name} mode="inline" />
                    </div>
                    <span class={`${styles.itemType} ${getTypeBadgeClass(item.type)}`}>
                      {item.type}
                    </span>
                  </div>
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Detail Column */}
        <div class={`${styles.detailColumn} ${selectedItemId() ? styles.detailColumnVisible : ''}`}>
          {/* Add New Item */}
          <Show when={selectedItemId() === 'new'}>
            <div class={styles.detailContent}>
              <div class={styles.detailHeader}>
                <button
                  class={styles.backButton}
                  onClick={() => setSelectedItemId('')}
                  title="Back to list"
                >
                  <BsArrowLeft />
                </button>
                <h3 class={styles.detailTitle}>Add New Context Item</h3>
              </div>
              <div class={styles.form}>
                <input
                  type="text"
                  value={newItemName()}
                  onInput={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, addContextItem)}
                  placeholder="Context name"
                  class={styles.input}
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
                <div class={styles.helperButtons}>
                  <EJSDocumentation />
                  <AvailableFunctions />
                </div>
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
                  <label>
                    <input
                      type="checkbox"
                      checked={newItemIsGlobal()}
                      onChange={(e) => setNewItemIsGlobal(e.target.checked)}
                    />
                    Global (active in all chapters)
                  </label>
                </div>
                <div class={styles.formActions}>
                  <button
                    class={styles.saveButton}
                    onClick={addContextItem}
                    disabled={!newItemName().trim() || !newItemDescription().trim()}
                  >
                    <BsPlus /> Add Context Item
                  </button>
                  <button
                    class={styles.cancelButton}
                    onClick={() => setSelectedItemId('')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </Show>

          {/* View/Edit Selected Item */}
          <Show when={selectedItem()}>
            {(item) => (
              <div class={styles.detailContent}>
                <div class={styles.detailHeader}>
                  <button
                    class={styles.backButton}
                    onClick={() => setSelectedItemId('')}
                    title="Back to list"
                  >
                    <BsArrowLeft />
                  </button>
                  <h3 class={styles.detailTitle}>
                    <Show when={!editingId()} fallback="Edit Context Item">
                      Context Item Details
                    </Show>
                  </h3>
                  <Show when={!editingId()}>
                    <button
                      class={styles.editButton}
                      onClick={() => startEditing(item())}
                      title="Edit context item"
                    >
                      <BsPencil /> Edit
                    </button>
                  </Show>
                </div>

                {/* View Mode */}
                <Show when={!editingId()}>
                  <div class={styles.viewMode}>
                    <div class={styles.field}>
                      <label class={styles.fieldLabel}>Name</label>
                      <div class={styles.fieldValue}>
                        <EJSRenderer template={item().name} mode="inline" />
                      </div>
                    </div>
                    <div class={styles.field}>
                      <label class={styles.fieldLabel}>Type</label>
                      <div class={styles.fieldValue}>
                        <span class={`${styles.itemType} ${getTypeBadgeClass(item().type)}`}>
                          {item().type}
                        </span>
                      </div>
                    </div>
                    <div class={styles.field}>
                      <label class={styles.fieldLabel}>Global</label>
                      <div class={styles.fieldValue}>
                        {item().isGlobal ? 'Yes (active in all chapters)' : 'No'}
                      </div>
                    </div>
                    <div class={styles.field}>
                      <label class={styles.fieldLabel}>Description</label>
                      <div class={styles.fieldValue}>
                        <EJSRenderer template={item().description} mode="preview-always" />
                      </div>
                    </div>
                    <div class={styles.dangerZone}>
                      <button
                        class={styles.deleteButton}
                        onClick={() => {
                          if (confirm(`Delete "${item().name}"?`)) {
                            contextItemsStore.deleteContextItem(item().id)
                            setSelectedItemId('')
                          }
                        }}
                      >
                        <BsX /> Delete Context Item
                      </button>
                    </div>
                  </div>
                </Show>

                {/* Edit Mode */}
                <Show when={editingId()}>
                  <div class={styles.form}>
                    <input
                      type="text"
                      value={editName()}
                      onInput={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, saveEdit)}
                      placeholder="Context name"
                      class={styles.input}
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
                    <div class={styles.helperButtons}>
                      <EJSDocumentation />
                      <AvailableFunctions />
                    </div>
                    <div class={styles.typeSelector}>
                      <label class={styles.typeLabel}>
                        <input
                          type="radio"
                          name={`edit-type-${item().id}`}
                          checked={editType() === 'theme'}
                          onChange={() => setEditType('theme')}
                        />
                        Theme
                      </label>
                      <label class={styles.typeLabel}>
                        <input
                          type="radio"
                          name={`edit-type-${item().id}`}
                          checked={editType() === 'location'}
                          onChange={() => setEditType('location')}
                        />
                        Location
                      </label>
                      <label class={styles.typeLabel}>
                        <input
                          type="radio"
                          name={`edit-type-${item().id}`}
                          checked={editType() === 'plot'}
                          onChange={() => setEditType('plot')}
                        />
                        Plot
                      </label>
                    </div>
                    <div class={styles.globalToggle}>
                      <label>
                        <input
                          type="checkbox"
                          checked={editIsGlobal()}
                          onChange={(e) => setEditIsGlobal(e.target.checked)}
                        />
                        Global (active in all chapters)
                      </label>
                    </div>
                    <div class={styles.formActions}>
                      <button
                        class={styles.saveButton}
                        onClick={saveEdit}
                        disabled={!editName().trim() || !editDescription().trim()}
                      >
                        <BsCheck /> Save Changes
                      </button>
                      <button
                        class={styles.cancelButton}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </div>
    </Show>
  )
}
