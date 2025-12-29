import { Button, ListDetailPanel, type ListDetailPanelRef, Stack } from '@mythweavers/ui'
import { BsArrowLeft, BsCalendar, BsCheck, BsPencil, BsPlus, BsStar, BsStarFill, BsX } from 'solid-icons/bs'
import { type Component, Show, batch, createMemo, createSignal } from 'solid-js'
import { calendarStore } from '../stores/calendarStore'
import { charactersStore } from '../stores/charactersStore'
import type { Character } from '../types/core'
import { getCharacterDisplayName, parseCharacterName } from '../utils/character'
import { generateMessageId } from '../utils/id'
import * as styles from './Characters.css'
import { EJSCodeEditor } from './EJSCodeEditor'
import { EJSRenderer } from './EJSRenderer'
import { ScriptHelpTabs } from './ScriptHelpTabs'
import { StoryTimePicker } from './StoryTimePicker'
import { TemplateChangeRequest } from './TemplateChangeRequest'

export interface CharactersRef {
  addNew: () => void
}

interface CharactersProps {
  ref?: (ref: CharactersRef) => void
}

export const Characters: Component<CharactersProps> = (props) => {
  const [newCharacterName, setNewCharacterName] = createSignal('')
  const [newCharacterDescription, setNewCharacterDescription] = createSignal('')
  const [newCharacterBirthdate, setNewCharacterBirthdate] = createSignal<number | undefined>(undefined)
  const [showNewBirthdatePicker, setShowNewBirthdatePicker] = createSignal(false)
  const [editingId, setEditingId] = createSignal('')
  const [editName, setEditName] = createSignal('')
  const [editDescription, setEditDescription] = createSignal('')
  const [editBirthdate, setEditBirthdate] = createSignal<number | undefined>(undefined)
  const [showEditBirthdatePicker, setShowEditBirthdatePicker] = createSignal(false)
  const [newCharacterImageData, setNewCharacterImageData] = createSignal<string | null>(null)
  const [editProfileImageData, setEditProfileImageData] = createSignal<string | null | undefined>(undefined)
  const [editProfileImagePreview, setEditProfileImagePreview] = createSignal<string | null>(null)

  let panelRef: ListDetailPanelRef | undefined
  let newEditorRef: { insertAtCursor: (text: string) => void } | null = null
  let editEditorRef: { insertAtCursor: (text: string) => void } | null = null

  // Sort characters alphabetically by display name
  const sortedCharacters = createMemo(() =>
    [...charactersStore.characters].sort((a, b) =>
      getCharacterDisplayName(a).localeCompare(getCharacterDisplayName(b))
    )
  )

  // Expose addNew method via ref
  props.ref?.({ addNew: () => panelRef?.select('new') })

  const addCharacter = () => {
    const nameInput = newCharacterName().trim()
    const description = newCharacterDescription().trim()

    if (!nameInput || !description) return

    const { firstName, lastName } = parseCharacterName(nameInput)

    const character: Character = {
      id: generateMessageId(),
      firstName,
      lastName,
      description,
      birthdate: newCharacterBirthdate(),
      isMainCharacter: false,
      profileImageData: newCharacterImageData(),
    }

    charactersStore.addCharacter(character)
    setNewCharacterName('')
    setNewCharacterDescription('')
    setNewCharacterBirthdate(undefined)
    setNewCharacterImageData(null)
    panelRef?.select(character.id)
  }

  const startEditing = (character: Character) => {
    batch(() => {
      setEditName(getCharacterDisplayName(character))
      setEditDescription(character.description ?? '')
      setEditBirthdate(character.birthdate ?? undefined)
      setEditProfileImagePreview(character.profileImageData ?? null)
      setEditProfileImageData(undefined)
      setEditingId(character.id)
    })
  }

  const saveEdit = () => {
    const nameInput = editName().trim()
    const description = editDescription().trim()

    if (!nameInput || !description) return

    const { firstName, lastName } = parseCharacterName(nameInput)

    const updates: Partial<Character> = {
      firstName,
      lastName,
      description,
      birthdate: editBirthdate(),
    }

    if (editProfileImageData() !== undefined) {
      updates.profileImageData = editProfileImageData()
      if (editProfileImageData() === null) {
        updates.pictureFileId = null
      }
    }

    charactersStore.updateCharacter(editingId(), updates)
    setEditingId('')
    setEditName('')
    setEditDescription('')
    setEditBirthdate(undefined)
    setEditProfileImagePreview(null)
    setEditProfileImageData(undefined)
  }

  const cancelEdit = () => {
    setEditingId('')
    setEditName('')
    setEditDescription('')
    setEditBirthdate(undefined)
    setEditProfileImagePreview(null)
    setEditProfileImageData(undefined)
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

  const handleNewImageSelect = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setNewCharacterImageData(reader.result)
        }
      }
      reader.readAsDataURL(file)
    }
    input.value = ''
  }

  const handleEditImageSelect = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setEditProfileImagePreview(reader.result)
          setEditProfileImageData(reader.result)
        }
      }
      reader.readAsDataURL(file)
    }
    input.value = ''
  }

  const clearNewImage = () => {
    setNewCharacterImageData(null)
  }

  const clearEditImage = () => {
    setEditProfileImagePreview(null)
    setEditProfileImageData(null)
  }

  const getAvatarInitial = (name: string) => {
    const trimmed = name.trim()
    return trimmed ? trimmed.charAt(0).toUpperCase() : '?'
  }

  const insertAgeScript = (characterName: string, editorRef: { insertAtCursor: (text: string) => void } | null) => {
    if (editorRef) {
      const script = `<%= formatAge(characters['${characterName}'].birthdate, currentTime) %>`
      editorRef.insertAtCursor(script)
    }
  }

  return (
    <Show when={charactersStore.showCharacters}>
      <ListDetailPanel
        ref={(r) => (panelRef = r)}
        items={sortedCharacters()}
        backIcon={<BsArrowLeft />}
        renderListItem={(character) => (
          <>
            <div class={styles.listItemContent}>
              <div class={styles.listItemAvatar}>
                <Show when={character.profileImageData}>
                  {(image) => (
                    <img
                      src={image()}
                      alt={`${getCharacterDisplayName(character)} avatar`}
                      class={styles.listItemAvatarImage}
                    />
                  )}
                </Show>
                <Show when={!character.profileImageData}>
                  <div class={styles.listItemAvatarPlaceholder}>
                    {getAvatarInitial(getCharacterDisplayName(character))}
                  </div>
                </Show>
              </div>
              <div class={styles.listItemName}>
                <EJSRenderer template={getCharacterDisplayName(character)} mode="inline" />
              </div>
            </div>
            <Show when={character.isMainCharacter}>
              <BsStarFill class={styles.protagonistIcon} />
            </Show>
          </>
        )}
        detailTitle={(char) => (
          <Stack direction="horizontal" gap="sm" align="center" style={{ flex: '1' }}>
            <span style={{ flex: '1' }}>
              <EJSRenderer template={getCharacterDisplayName(char)} mode="inline" />
            </span>
            <Show when={char.isMainCharacter}>
              <BsStarFill class={styles.protagonistIcon} />
            </Show>
          </Stack>
        )}
        renderDetail={(char) => (
          <Show
            when={editingId() !== char.id}
            fallback={
              <div class={styles.form}>
                <input
                  type="text"
                  value={editName()}
                  onInput={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, saveEdit)}
                  placeholder="Character name"
                  class={styles.input}
                />
                <div class={styles.imageSection}>
                  <div class={styles.imagePreview}>
                    <Show when={editProfileImagePreview()}>
                      {(image) => <img src={image()} alt="Character preview" class={styles.imagePreviewImage} />}
                    </Show>
                    <Show when={!editProfileImagePreview()}>
                      <div class={styles.imagePlaceholder}>
                        {getAvatarInitial(editName() || getCharacterDisplayName(char))}
                      </div>
                    </Show>
                  </div>
                  <div class={styles.imageControls}>
                    <label class={styles.imageUploadButton}>
                      Upload Image
                      <input type="file" accept="image/*" onChange={handleEditImageSelect} style={{ display: 'none' }} />
                    </label>
                    <Show when={editProfileImagePreview()}>
                      <button
                        type="button"
                        class={styles.imageRemoveButton}
                        onClick={clearEditImage}
                        title="Remove profile image"
                      >
                        <BsX /> Remove
                      </button>
                    </Show>
                  </div>
                </div>
                <EJSCodeEditor
                  value={editDescription()}
                  onChange={setEditDescription}
                  placeholder="Character description (supports EJS templates)"
                  minHeight="80px"
                  ref={(methods) => (editEditorRef = methods)}
                />
                <div class={styles.quickInsertButtons}>
                  <span class={styles.quickInsertLabel}>Quick Insert:</span>
                  <button
                    class={styles.quickInsertButton}
                    onClick={() => insertAgeScript(editName(), editEditorRef)}
                    title="Insert age script"
                    type="button"
                  >
                    Age
                  </button>
                </div>
                <TemplateChangeRequest
                  currentTemplate={editDescription()}
                  onTemplateChange={setEditDescription}
                  placeholder="Describe how you want to change this character's description"
                  includeStoryContent={true}
                />
                <EJSRenderer template={editDescription()} mode="preview-always" />
                <div class={styles.marginTop}>
                  <Show when={!showEditBirthdatePicker()}>
                    <button class={styles.birthdateButton} onClick={() => setShowEditBirthdatePicker(true)}>
                      <BsCalendar />
                      {editBirthdate() !== undefined
                        ? `Birthdate: ${calendarStore.formatStoryTime(editBirthdate()!)}`
                        : 'Set Birthdate (Optional)'}
                    </button>
                  </Show>
                  <Show when={showEditBirthdatePicker()}>
                    <StoryTimePicker
                      currentTime={editBirthdate() ?? null}
                      onSave={(time) => {
                        setEditBirthdate(time ?? undefined)
                        setShowEditBirthdatePicker(false)
                      }}
                      onCancel={() => setShowEditBirthdatePicker(false)}
                    />
                  </Show>
                </div>
                <ScriptHelpTabs />
                <Stack direction="horizontal" gap="sm" class={styles.marginTop}>
                  <Button variant="primary" onClick={saveEdit}>
                    <BsCheck /> Save
                  </Button>
                  <Button variant="secondary" onClick={cancelEdit}>
                    <BsX /> Cancel
                  </Button>
                </Stack>
              </div>
            }
          >
            <div class={styles.detailView}>
              <div class={styles.detailAvatar}>
                <Show when={char.profileImageData}>
                  {(image) => (
                    <img
                      src={image()}
                      alt={`${getCharacterDisplayName(char)} portrait`}
                      class={styles.detailAvatarImage}
                    />
                  )}
                </Show>
                <Show when={!char.profileImageData}>
                  <div class={styles.detailAvatarPlaceholder}>{getAvatarInitial(getCharacterDisplayName(char))}</div>
                </Show>
              </div>
              <div class={styles.characterDescription}>
                <EJSRenderer template={char.description ?? ''} mode="inline" />
              </div>
              <Show when={char.birthdate !== undefined}>
                <div class={styles.characterBirthdate}>Born: {calendarStore.formatStoryTime(char.birthdate!)}</div>
              </Show>
              <div class={styles.detailActions}>
                <Button
                  variant={char.isMainCharacter ? 'primary' : 'secondary'}
                  onClick={() => charactersStore.updateCharacter(char.id, { isMainCharacter: !char.isMainCharacter })}
                >
                  <Show when={char.isMainCharacter} fallback={<BsStar />}>
                    <BsStarFill />
                  </Show>
                  {char.isMainCharacter ? 'Protagonist' : 'Mark as Protagonist'}
                </Button>
                <Button variant="secondary" onClick={() => startEditing(char)}>
                  <BsPencil /> Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm(`Delete "${getCharacterDisplayName(char)}"?`)) {
                      charactersStore.deleteCharacter(char.id)
                      panelRef?.clearSelection()
                    }
                  }}
                >
                  <BsX /> Delete
                </Button>
              </div>
            </div>
          </Show>
        )}
        newItemTitle="Add New Character"
        renderNewForm={() => (
          <div class={styles.form}>
            <input
              type="text"
              value={newCharacterName()}
              onInput={(e) => setNewCharacterName(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, addCharacter)}
              placeholder="Character name"
              class={styles.input}
            />
            <div class={styles.imageSection}>
              <div class={styles.imagePreview}>
                <Show when={newCharacterImageData()}>
                  {(image) => <img src={image()} alt="New character preview" class={styles.imagePreviewImage} />}
                </Show>
                <Show when={!newCharacterImageData()}>
                  <div class={styles.imagePlaceholder}>{getAvatarInitial(newCharacterName() || '?')}</div>
                </Show>
              </div>
              <div class={styles.imageControls}>
                <label class={styles.imageUploadButton}>
                  Upload Image
                  <input type="file" accept="image/*" onChange={handleNewImageSelect} style={{ display: 'none' }} />
                </label>
                <Show when={newCharacterImageData()}>
                  <button
                    type="button"
                    class={styles.imageRemoveButton}
                    onClick={clearNewImage}
                    title="Remove profile image"
                  >
                    <BsX /> Remove
                  </button>
                </Show>
              </div>
            </div>
            <EJSCodeEditor
              value={newCharacterDescription()}
              onChange={setNewCharacterDescription}
              placeholder="Character description (supports EJS templates)"
              minHeight="80px"
              ref={(methods) => (newEditorRef = methods)}
            />
            <div class={styles.quickInsertButtons}>
              <span class={styles.quickInsertLabel}>Quick Insert:</span>
              <button
                class={styles.quickInsertButton}
                onClick={() => insertAgeScript(newCharacterName(), newEditorRef)}
                title="Insert age script"
                type="button"
              >
                Age
              </button>
            </div>
            <TemplateChangeRequest
              currentTemplate={newCharacterDescription()}
              onTemplateChange={setNewCharacterDescription}
              placeholder="Describe how you want to change this character's description"
              includeStoryContent={true}
            />
            <EJSRenderer template={newCharacterDescription()} mode="preview-always" />
            <div class={styles.marginTop}>
              <Show when={!showNewBirthdatePicker()}>
                <button class={styles.birthdateButton} onClick={() => setShowNewBirthdatePicker(true)}>
                  <BsCalendar />
                  {newCharacterBirthdate() !== undefined
                    ? `Birthdate: ${calendarStore.formatStoryTime(newCharacterBirthdate()!)}`
                    : 'Set Birthdate (Optional)'}
                </button>
              </Show>
              <Show when={showNewBirthdatePicker()}>
                <StoryTimePicker
                  currentTime={newCharacterBirthdate() ?? null}
                  onSave={(time) => {
                    setNewCharacterBirthdate(time ?? undefined)
                    setShowNewBirthdatePicker(false)
                  }}
                  onCancel={() => setShowNewBirthdatePicker(false)}
                />
              </Show>
            </div>
            <ScriptHelpTabs />
            <Button
              variant="primary"
              onClick={addCharacter}
              disabled={!newCharacterName().trim() || !newCharacterDescription().trim()}
              class={styles.marginTop}
            >
              <BsPlus /> Add Character
            </Button>
          </div>
        )}
      />
    </Show>
  )
}
