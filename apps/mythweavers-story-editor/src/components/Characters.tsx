import { Button, ListDetailPanel, type ListDetailPanelRef, Stack } from '@mythweavers/ui'
import { BsArrowLeft, BsCalendar, BsCheck, BsPencil, BsPlus, BsStar, BsStarFill, BsX } from 'solid-icons/bs'
import { type Component, type JSX, Show, batch, createSignal } from 'solid-js'
import { calendarStore } from '../stores/calendarStore'
import { charactersStore } from '../stores/charactersStore'
import type { Character } from '../types/core'
import { getCharacterDisplayName, parseCharacterName } from '../utils/character'
import { generateMessageId } from '../utils/id'
import { EJSCodeEditor } from './EJSCodeEditor'
import { ScriptHelpTabs } from './ScriptHelpTabs'
import { EJSRenderer } from './EJSRenderer'
import { StoryTimePicker } from './StoryTimePicker'
import { TemplateChangeRequest } from './TemplateChangeRequest'

// Styles
const styles = {
  listItemContent: {
    display: 'flex',
    'align-items': 'center',
    gap: '0.75rem',
    flex: '1',
    'min-width': '0',
  } as JSX.CSSProperties,

  listItemAvatar: {
    width: '32px',
    height: '32px',
    'border-radius': '50%',
    overflow: 'hidden',
    'flex-shrink': '0',
  } as JSX.CSSProperties,

  listItemAvatarImage: {
    width: '100%',
    height: '100%',
    'object-fit': 'cover',
  } as JSX.CSSProperties,

  listItemAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    'font-weight': '500',
    'font-size': '0.85rem',
  } as JSX.CSSProperties,

  listItemName: {
    flex: '1',
    'min-width': '0',
    'white-space': 'nowrap',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'font-size': '0.95rem',
  } as JSX.CSSProperties,

  protagonistIcon: {
    color: 'var(--warning-color)',
    'font-size': '0.9rem',
  } as JSX.CSSProperties,

  form: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '0.75rem',
  } as JSX.CSSProperties,

  input: {
    padding: '0.625rem 0.875rem',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    'border-radius': '6px',
    color: 'var(--text-primary)',
    'font-size': '0.95rem',
    transition: 'border-color 0.2s ease',
  } as JSX.CSSProperties,

  imageSection: {
    display: 'flex',
    gap: '1rem',
    'align-items': 'flex-start',
  } as JSX.CSSProperties,

  imagePreview: {
    width: '80px',
    height: '80px',
    'border-radius': '50%',
    overflow: 'hidden',
    'flex-shrink': '0',
    border: '2px solid var(--border-color)',
  } as JSX.CSSProperties,

  imagePreviewImage: {
    width: '100%',
    height: '100%',
    'object-fit': 'cover',
  } as JSX.CSSProperties,

  imagePlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    'font-size': '2rem',
    'font-weight': '500',
  } as JSX.CSSProperties,

  imageControls: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '0.5rem',
  } as JSX.CSSProperties,

  imageUploadButton: {
    display: 'inline-flex',
    'align-items': 'center',
    gap: '0.25rem',
    padding: '0.5rem 0.75rem',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    'border-radius': '6px',
    cursor: 'pointer',
    'font-size': '0.85rem',
    color: 'var(--text-primary)',
    transition: 'all 0.2s ease',
  } as JSX.CSSProperties,

  imageRemoveButton: {
    display: 'inline-flex',
    'align-items': 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.625rem',
    background: 'transparent',
    border: 'none',
    'border-radius': '4px',
    cursor: 'pointer',
    'font-size': '0.8rem',
    color: 'var(--error-color)',
  } as JSX.CSSProperties,

  quickInsertButtons: {
    display: 'flex',
    'align-items': 'center',
    gap: '0.5rem',
    'flex-wrap': 'wrap',
  } as JSX.CSSProperties,

  quickInsertLabel: {
    'font-size': '0.8rem',
    color: 'var(--text-secondary)',
  } as JSX.CSSProperties,

  quickInsertButton: {
    padding: '0.25rem 0.5rem',
    'font-size': '0.75rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    'border-radius': '4px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    transition: 'all 0.2s ease',
  } as JSX.CSSProperties,

  detailView: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '1rem',
  } as JSX.CSSProperties,

  detailAvatar: {
    width: '100px',
    height: '100px',
    'border-radius': '50%',
    overflow: 'hidden',
    'flex-shrink': '0',
    border: '3px solid var(--border-color)',
    'align-self': 'center',
  } as JSX.CSSProperties,

  detailAvatarImage: {
    width: '100%',
    height: '100%',
    'object-fit': 'cover',
  } as JSX.CSSProperties,

  detailAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    'font-size': '2.5rem',
    'font-weight': '500',
  } as JSX.CSSProperties,

  characterDescription: {
    'line-height': '1.6',
    color: 'var(--text-primary)',
  } as JSX.CSSProperties,

  characterBirthdate: {
    'font-size': '0.9rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    'align-items': 'center',
    gap: '0.5rem',
  } as JSX.CSSProperties,

  detailActions: {
    display: 'flex',
    gap: '0.5rem',
    'flex-wrap': 'wrap',
    'margin-top': '0.5rem',
    'padding-top': '1rem',
    'border-top': '1px solid var(--border-color)',
  } as JSX.CSSProperties,
}

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
        items={charactersStore.characters}
        backIcon={<BsArrowLeft />}
        renderListItem={(character) => (
          <>
            <div style={styles.listItemContent}>
              <div style={styles.listItemAvatar}>
                <Show when={character.profileImageData}>
                  {(image) => (
                    <img
                      src={image()}
                      alt={`${getCharacterDisplayName(character)} avatar`}
                      style={styles.listItemAvatarImage}
                    />
                  )}
                </Show>
                <Show when={!character.profileImageData}>
                  <div style={styles.listItemAvatarPlaceholder}>
                    {getAvatarInitial(getCharacterDisplayName(character))}
                  </div>
                </Show>
              </div>
              <div style={styles.listItemName}>
                <EJSRenderer template={getCharacterDisplayName(character)} mode="inline" />
              </div>
            </div>
            <Show when={character.isMainCharacter}>
              <BsStarFill style={styles.protagonistIcon} />
            </Show>
          </>
        )}
        detailTitle={(char) => (
          <Stack direction="horizontal" gap="sm" align="center" style={{ flex: '1' }}>
            <span style={{ flex: '1' }}>
              <EJSRenderer template={getCharacterDisplayName(char)} mode="inline" />
            </span>
            <Show when={char.isMainCharacter}>
              <BsStarFill style={{ color: 'var(--warning-color)' }} />
            </Show>
          </Stack>
        )}
        renderDetail={(char) => (
          <Show
            when={editingId() !== char.id}
            fallback={
              <div style={styles.form}>
                <input
                  type="text"
                  value={editName()}
                  onInput={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, saveEdit)}
                  placeholder="Character name"
                  style={styles.input}
                />
                <div style={styles.imageSection}>
                  <div style={styles.imagePreview}>
                    <Show when={editProfileImagePreview()}>
                      {(image) => <img src={image()} alt="Character preview" style={styles.imagePreviewImage} />}
                    </Show>
                    <Show when={!editProfileImagePreview()}>
                      <div style={styles.imagePlaceholder}>
                        {getAvatarInitial(editName() || getCharacterDisplayName(char))}
                      </div>
                    </Show>
                  </div>
                  <div style={styles.imageControls}>
                    <label style={styles.imageUploadButton}>
                      Upload Image
                      <input type="file" accept="image/*" onChange={handleEditImageSelect} style={{ display: 'none' }} />
                    </label>
                    <Show when={editProfileImagePreview()}>
                      <button
                        type="button"
                        style={styles.imageRemoveButton}
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
                <div style={styles.quickInsertButtons}>
                  <span style={styles.quickInsertLabel}>Quick Insert:</span>
                  <button
                    style={styles.quickInsertButton}
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
                />
                <EJSRenderer template={editDescription()} mode="preview-always" />
                <div style={{ 'margin-top': '0.5rem' }}>
                  <Show when={!showEditBirthdatePicker()}>
                    <button
                      style={{
                        ...styles.input,
                        width: '100%',
                        'text-align': 'left',
                        display: 'flex',
                        'align-items': 'center',
                        gap: '0.5rem',
                      }}
                      onClick={() => setShowEditBirthdatePicker(true)}
                    >
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
                <Stack direction="horizontal" gap="sm" style={{ 'margin-top': '0.5rem' }}>
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
            <div style={styles.detailView}>
              <div style={styles.detailAvatar}>
                <Show when={char.profileImageData}>
                  {(image) => (
                    <img
                      src={image()}
                      alt={`${getCharacterDisplayName(char)} portrait`}
                      style={styles.detailAvatarImage}
                    />
                  )}
                </Show>
                <Show when={!char.profileImageData}>
                  <div style={styles.detailAvatarPlaceholder}>{getAvatarInitial(getCharacterDisplayName(char))}</div>
                </Show>
              </div>
              <div style={styles.characterDescription}>
                <EJSRenderer template={char.description ?? ''} mode="inline" />
              </div>
              <Show when={char.birthdate !== undefined}>
                <div style={styles.characterBirthdate}>Born: {calendarStore.formatStoryTime(char.birthdate!)}</div>
              </Show>
              <div style={styles.detailActions}>
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
          <div style={styles.form}>
            <input
              type="text"
              value={newCharacterName()}
              onInput={(e) => setNewCharacterName(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, addCharacter)}
              placeholder="Character name"
              style={styles.input}
            />
            <div style={styles.imageSection}>
              <div style={styles.imagePreview}>
                <Show when={newCharacterImageData()}>
                  {(image) => <img src={image()} alt="New character preview" style={styles.imagePreviewImage} />}
                </Show>
                <Show when={!newCharacterImageData()}>
                  <div style={styles.imagePlaceholder}>{getAvatarInitial(newCharacterName() || '?')}</div>
                </Show>
              </div>
              <div style={styles.imageControls}>
                <label style={styles.imageUploadButton}>
                  Upload Image
                  <input type="file" accept="image/*" onChange={handleNewImageSelect} style={{ display: 'none' }} />
                </label>
                <Show when={newCharacterImageData()}>
                  <button
                    type="button"
                    style={styles.imageRemoveButton}
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
            <div style={styles.quickInsertButtons}>
              <span style={styles.quickInsertLabel}>Quick Insert:</span>
              <button
                style={styles.quickInsertButton}
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
            />
            <EJSRenderer template={newCharacterDescription()} mode="preview-always" />
            <div style={{ 'margin-top': '0.5rem' }}>
              <Show when={!showNewBirthdatePicker()}>
                <button
                  style={{
                    ...styles.input,
                    width: '100%',
                    'text-align': 'left',
                    display: 'flex',
                    'align-items': 'center',
                    gap: '0.5rem',
                  }}
                  onClick={() => setShowNewBirthdatePicker(true)}
                >
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
              style={{ 'margin-top': '0.5rem' }}
            >
              <BsPlus /> Add Character
            </Button>
          </div>
        )}
      />
    </Show>
  )
}
