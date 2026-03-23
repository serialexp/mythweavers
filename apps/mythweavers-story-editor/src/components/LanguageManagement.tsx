import { Badge, Button, Card, CardBody, Input, Stack } from '@mythweavers/ui'
import { BsCheck, BsPencil, BsPlus, BsStar, BsStarFill, BsTrash } from 'solid-icons/bs'
import { Component, For, Show, createSignal } from 'solid-js'
import {
  deleteMyLanguagesById,
  postMyStoriesByStoryIdLanguages,
  putMyLanguagesById,
  putMyStoriesByStoryIdDefaultLanguage,
} from '../client/config'
import { languageStore, type StoryLanguage } from '../stores/languageStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import * as styles from './LanguageManagement.css'

export const LanguageManagement: Component = () => {
  const [showAddForm, setShowAddForm] = createSignal(false)
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [newName, setNewName] = createSignal('')
  const [newLabel, setNewLabel] = createSignal('')
  const [editName, setEditName] = createSignal('')
  const [editLabel, setEditLabel] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)

  const handleAdd = async () => {
    if (!currentStoryStore.id || !newName().trim() || !newLabel().trim()) return

    setIsLoading(true)
    try {
      const isFirst = languageStore.languages.length === 0
      const response = await postMyStoriesByStoryIdLanguages({
        path: { storyId: currentStoryStore.id },
        body: {
          name: newName().trim(),
          label: newLabel().trim(),
          setAsDefault: isFirst,
        },
      })

      if (response.data?.language) {
        languageStore.addLanguage({
          id: response.data.language.id,
          name: response.data.language.name,
          label: response.data.language.label,
          isDefault: isFirst,
        })
        if (isFirst) {
          languageStore.setDefaultLanguageId(response.data.language.id)
        }
      }

      setNewName('')
      setNewLabel('')
      setShowAddForm(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName().trim() || !editLabel().trim()) return

    setIsLoading(true)
    try {
      await putMyLanguagesById({
        path: { id },
        body: {
          name: editName().trim(),
          label: editLabel().trim(),
        },
      })

      languageStore.updateLanguage(id, {
        name: editName().trim(),
        label: editLabel().trim(),
      })
      setEditingId(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsLoading(true)
    try {
      await deleteMyLanguagesById({ path: { id } })
      if (languageStore.defaultLanguageId === id) {
        languageStore.setDefaultLanguageId(null)
      }
      languageStore.removeLanguage(id)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetPrimary = async (id: string) => {
    if (!currentStoryStore.id) return

    setIsLoading(true)
    try {
      await putMyStoriesByStoryIdDefaultLanguage({
        path: { storyId: currentStoryStore.id },
        body: { languageId: id },
      })
      languageStore.setDefaultLanguageId(id)
    } finally {
      setIsLoading(false)
    }
  }

  const startEditing = (lang: StoryLanguage) => {
    setEditingId(lang.id)
    setEditName(lang.name)
    setEditLabel(lang.label)
  }

  return (
    <div class={styles.container}>
      <Stack direction="horizontal" class={styles.headerRow}>
        <h3 class={styles.sectionTitle}>Languages</h3>
        <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm()}>
          <BsPlus /> Add Language
        </Button>
      </Stack>

      <Show when={showAddForm()}>
        <Card class={styles.cardMargin}>
          <CardBody>
            <Stack direction="vertical" gap="sm">
              <div class={styles.formRow}>
                <div class={styles.formField}>
                  <label class={styles.fieldLabel}>Name (for LLM)</label>
                  <Input
                    type="text"
                    value={newName()}
                    onInput={(e) => setNewName(e.currentTarget.value)}
                    placeholder="e.g. Scottish Gaelic"
                  />
                </div>
                <div class={styles.formField}>
                  <label class={styles.fieldLabel}>Label (for UI)</label>
                  <Input
                    type="text"
                    value={newLabel()}
                    onInput={(e) => setNewLabel(e.currentTarget.value)}
                    placeholder="e.g. Gaelic"
                  />
                </div>
              </div>
              <Stack direction="horizontal" gap="sm">
                <Button variant="primary" size="sm" onClick={handleAdd} disabled={isLoading() || !newName().trim() || !newLabel().trim()}>
                  <BsCheck /> Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false)
                    setNewName('')
                    setNewLabel('')
                  }}
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </CardBody>
        </Card>
      </Show>

      <Show
        when={languageStore.languages.length > 0}
        fallback={
          <div class={styles.emptyState}>
            No languages configured. Add languages to enable inline translation.
          </div>
        }
      >
        <For each={languageStore.languages}>
          {(lang) => (
            <Card class={styles.cardMargin}>
              <CardBody>
                <Show
                  when={editingId() !== lang.id}
                  fallback={
                    <Stack direction="vertical" gap="sm">
                      <div class={styles.formRow}>
                        <div class={styles.formField}>
                          <label class={styles.fieldLabel}>Name (for LLM)</label>
                          <Input
                            type="text"
                            value={editName()}
                            onInput={(e) => setEditName(e.currentTarget.value)}
                          />
                        </div>
                        <div class={styles.formField}>
                          <label class={styles.fieldLabel}>Label (for UI)</label>
                          <Input
                            type="text"
                            value={editLabel()}
                            onInput={(e) => setEditLabel(e.currentTarget.value)}
                          />
                        </div>
                      </div>
                      <Stack direction="horizontal" gap="sm">
                        <Button variant="primary" size="sm" onClick={() => handleUpdate(lang.id)} disabled={isLoading()}>
                          <BsCheck /> Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </Stack>
                    </Stack>
                  }
                >
                  <Stack direction="horizontal" gap="sm" align="center">
                    <div class={styles.languageInfo}>
                      <div class={styles.languageName}>
                        {lang.name}
                        <Show when={lang.isDefault}>
                          <Badge variant="primary">Primary</Badge>
                        </Show>
                      </div>
                      <div class={styles.languageLabel}>Display: {lang.label}</div>
                    </div>
                    <Button
                      variant={lang.isDefault ? 'primary' : 'ghost'}
                      size="sm"
                      iconOnly
                      onClick={() => handleSetPrimary(lang.id)}
                      disabled={isLoading() || lang.isDefault}
                      title={lang.isDefault ? 'Primary language' : 'Set as primary language'}
                    >
                      {lang.isDefault ? <BsStarFill /> : <BsStar />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      onClick={() => startEditing(lang)}
                      disabled={isLoading()}
                      title="Edit language"
                    >
                      <BsPencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      onClick={() => handleDelete(lang.id)}
                      disabled={isLoading()}
                      title="Delete language"
                      >
                        <BsTrash />
                      </Button>
                  </Stack>
                </Show>
              </CardBody>
            </Card>
          )}
        </For>
      </Show>
    </div>
  )
}
