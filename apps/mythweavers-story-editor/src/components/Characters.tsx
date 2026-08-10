import { Button, ListDetailPanel, type ListDetailPanelRef, Stack } from '@mythweavers/ui'
import { type Component, Show, batch, createMemo, createSignal } from 'solid-js'
import {
  PhArrowLeftIcon,
  PhCalendarIcon,
  PhCheckIcon,
  PhPencilSimpleIcon,
  PhPlusIcon,
  PhStarIcon,
  PhXIcon,
} from 'solidjs-phosphor'
import { calendarStore } from '../stores/calendarStore'
import { charactersStore } from '../stores/charactersStore'
import type { Character } from '../types/core'
import { getCharacterDisplayName, parseCharacterName } from '../utils/character'
import { generateMessageId } from '../utils/id'
import { resolveStoryImageUrl } from '../utils/uploadStoryImage'
import * as styles from './Characters.css'
import { EJSCodeEditor } from './EJSCodeEditor'
import { EJSRenderer } from './EJSRenderer'
import { FilePicker } from './FilePicker'
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
  // New-character image state. We track file id + resolved URL together so the
  // saveService receives a real pictureFileId and the preview shows the same
  // image without a round-trip. The image picker uploads (and crops) before
  // handing us the file, so we never carry around base64 data here anymore.
  const [newPictureFileId, setNewPictureFileId] = createSignal<string | null>(null)
  const [newPictureUrl, setNewPictureUrl] = createSignal<string | null>(null)

  // Edit-character image state. `editPictureChanged` distinguishes "no change"
  // (don't touch the persisted picture) from "explicitly cleared" (send null).
  const [editPictureFileId, setEditPictureFileId] = createSignal<string | null>(null)
  const [editPictureUrl, setEditPictureUrl] = createSignal<string | null>(null)
  const [editPictureChanged, setEditPictureChanged] = createSignal(false)

  let panelRef: ListDetailPanelRef | undefined
  let newEditorRef: { insertAtCursor: (text: string) => void } | null = null
  let editEditorRef: { insertAtCursor: (text: string) => void } | null = null

  // Sort characters alphabetically by display name
  const sortedCharacters = createMemo(() =>
    [...charactersStore.characters].sort((a, b) =>
      getCharacterDisplayName(a).localeCompare(getCharacterDisplayName(b)),
    ),
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
      // The picker has already uploaded the file, so we just attach its id and
      // point profileImageData at the resolved URL for immediate display.
      pictureFileId: newPictureFileId() ?? undefined,
      profileImageData: newPictureUrl(),
    }

    charactersStore.addCharacter(character)
    setNewCharacterName('')
    setNewCharacterDescription('')
    setNewCharacterBirthdate(undefined)
    setNewPictureFileId(null)
    setNewPictureUrl(null)
    panelRef?.select(character.id)
  }

  const startEditing = (character: Character) => {
    batch(() => {
      setEditName(getCharacterDisplayName(character))
      setEditDescription(character.description ?? '')
      setEditBirthdate(character.birthdate ?? undefined)
      // Seed the picker with the character's existing file id (so the matching
      // tile is highlighted) and its current image URL for the preview. The
      // "changed" flag stays false until the user actually picks/clears.
      setEditPictureFileId(character.pictureFileId ?? null)
      setEditPictureUrl(character.profileImageData ?? null)
      setEditPictureChanged(false)
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

    // Only push the image fields when the user actually touched the picker —
    // otherwise an unchanged edit would clobber the persisted picture with the
    // currently-displayed URL string and lose the canonical file id linkage.
    if (editPictureChanged()) {
      updates.pictureFileId = editPictureFileId()
      updates.profileImageData = editPictureUrl()
    }

    charactersStore.updateCharacter(editingId(), updates)
    setEditingId('')
    setEditName('')
    setEditDescription('')
    setEditBirthdate(undefined)
    setEditPictureFileId(null)
    setEditPictureUrl(null)
    setEditPictureChanged(false)
  }

  const cancelEdit = () => {
    setEditingId('')
    setEditName('')
    setEditDescription('')
    setEditBirthdate(undefined)
    setEditPictureFileId(null)
    setEditPictureUrl(null)
    setEditPictureChanged(false)
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

  // Picker callbacks: a `file` arrives when the user selects an existing tile
  // or finishes uploading + cropping a new one. Either way we just record the
  // id and (resolved) URL.
  const handleNewPicked = (file: { id: string; path: string }) => {
    setNewPictureFileId(file.id)
    setNewPictureUrl(resolveStoryImageUrl(file.path))
  }

  const clearNewImage = () => {
    setNewPictureFileId(null)
    setNewPictureUrl(null)
  }

  const handleEditPicked = (file: { id: string; path: string }) => {
    setEditPictureFileId(file.id)
    setEditPictureUrl(resolveStoryImageUrl(file.path))
    setEditPictureChanged(true)
  }

  const clearEditImage = () => {
    setEditPictureFileId(null)
    setEditPictureUrl(null)
    setEditPictureChanged(true)
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
        backIcon={<PhArrowLeftIcon />}
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
              <PhStarIcon weight="fill" class={styles.protagonistIcon} />
            </Show>
          </>
        )}
        detailTitle={(char) => (
          <Stack direction="horizontal" gap="sm" align="center" style={{ flex: '1' }}>
            <span style={{ flex: '1' }}>
              <EJSRenderer template={getCharacterDisplayName(char)} mode="inline" />
            </span>
            <Show when={char.isMainCharacter}>
              <PhStarIcon weight="fill" class={styles.protagonistIcon} />
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
                    <Show when={editPictureUrl()}>
                      {(image) => <img src={image()} alt="Character preview" class={styles.imagePreviewImage} />}
                    </Show>
                    <Show when={!editPictureUrl()}>
                      <div class={styles.imagePlaceholder}>
                        {getAvatarInitial(editName() || getCharacterDisplayName(char))}
                      </div>
                    </Show>
                  </div>
                  <div class={styles.imageControls}>
                    <Show when={editPictureUrl()}>
                      <button
                        type="button"
                        class={styles.imageRemoveButton}
                        onClick={clearEditImage}
                        title="Remove profile image"
                      >
                        <PhXIcon /> Remove
                      </button>
                    </Show>
                  </div>
                </div>
                <FilePicker
                  selectedFileId={editPictureFileId()}
                  onSelect={handleEditPicked}
                  onUpload={handleEditPicked}
                  mimePrefix="image/"
                  cropConfig={{ aspectRatio: 1, circular: true, outputSize: 256 }}
                />
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
                  entityLabel="Character"
                />
                <EJSRenderer template={editDescription()} mode="preview-always" />
                <div class={styles.marginTop}>
                  <Show when={!showEditBirthdatePicker()}>
                    <button class={styles.birthdateButton} onClick={() => setShowEditBirthdatePicker(true)}>
                      <PhCalendarIcon />
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
                    <PhCheckIcon /> Save
                  </Button>
                  <Button variant="secondary" onClick={cancelEdit}>
                    <PhXIcon /> Cancel
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
                  <Show when={char.isMainCharacter} fallback={<PhStarIcon />}>
                    <PhStarIcon weight="fill" />
                  </Show>
                  {char.isMainCharacter ? 'Protagonist' : 'Mark as Protagonist'}
                </Button>
                <Button variant="secondary" onClick={() => startEditing(char)}>
                  <PhPencilSimpleIcon /> Edit
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
                  <PhXIcon /> Delete
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
                <Show when={newPictureUrl()}>
                  {(image) => <img src={image()} alt="New character preview" class={styles.imagePreviewImage} />}
                </Show>
                <Show when={!newPictureUrl()}>
                  <div class={styles.imagePlaceholder}>{getAvatarInitial(newCharacterName() || '?')}</div>
                </Show>
              </div>
              <div class={styles.imageControls}>
                <Show when={newPictureUrl()}>
                  <button
                    type="button"
                    class={styles.imageRemoveButton}
                    onClick={clearNewImage}
                    title="Remove profile image"
                  >
                    <PhXIcon /> Remove
                  </button>
                </Show>
              </div>
            </div>
            <FilePicker
              selectedFileId={newPictureFileId()}
              onSelect={handleNewPicked}
              onUpload={handleNewPicked}
              mimePrefix="image/"
              cropConfig={{ aspectRatio: 1, circular: true, outputSize: 256 }}
            />
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
              entityLabel="Character"
            />
            <EJSRenderer template={newCharacterDescription()} mode="preview-always" />
            <div class={styles.marginTop}>
              <Show when={!showNewBirthdatePicker()}>
                <button class={styles.birthdateButton} onClick={() => setShowNewBirthdatePicker(true)}>
                  <PhCalendarIcon />
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
              <PhPlusIcon /> Add Character
            </Button>
          </div>
        )}
      />
    </Show>
  )
}
