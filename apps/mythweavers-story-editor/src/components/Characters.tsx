import { Component, Show, For, createSignal, batch } from 'solid-js'
import { Character } from '../types/core'
import { charactersStore } from '../stores/charactersStore'
import { BsPlus, BsX, BsPencil, BsCheck, BsStar, BsStarFill, BsCalendar, BsArrowLeft } from 'solid-icons/bs'
import { generateMessageId } from '../utils/id'
import { EJSRenderer } from './EJSRenderer'
import { EJSCodeEditor } from './EJSCodeEditor'
import { EJSDocumentation } from './EJSDocumentation'
import { AvailableFunctions } from './AvailableFunctions'
import { TemplateChangeRequest } from './TemplateChangeRequest'
import { StoryTimePicker } from './StoryTimePicker'
import { calendarStore } from '../stores/calendarStore'
import { getCharacterDisplayName, parseCharacterName } from '../utils/character'
import styles from './Characters.module.css'

export const Characters: Component = () => {
  const [selectedCharacterId, setSelectedCharacterId] = createSignal<string | 'new'>('')
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

  let newEditorRef: { insertAtCursor: (text: string) => void } | null = null
  let editEditorRef: { insertAtCursor: (text: string) => void } | null = null

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
    setSelectedCharacterId(character.id)
  }

  const startEditing = (character: Character) => {
    batch(() => {
      setEditName(getCharacterDisplayName(character))
      setEditDescription(character.description ?? '')
      setEditBirthdate(character.birthdate)
      setEditProfileImagePreview(character.profileImageData ?? null)
      setEditProfileImageData(undefined)
      setEditingId(character.id) // Set this last to trigger the UI switch after data is ready
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
    if (file && file.type.startsWith('image/')) {
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
    if (file && file.type.startsWith('image/')) {
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

  const selectedCharacter = () => {
    const id = selectedCharacterId()
    if (!id || id === 'new') return null
    return charactersStore.characters.find(c => c.id === id)
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
      <div class={styles.container}>
        {/* Character List */}
        <div class={`${styles.listColumn} ${selectedCharacterId() ? styles.listColumnHidden : ''}`}>
          <div class={styles.listHeader}>
            <h3 class={styles.listTitle}>Characters</h3>
            <button
              class={styles.addButton}
              onClick={() => setSelectedCharacterId('new')}
              title="Add new character"
            >
              <BsPlus /> Add
            </button>
          </div>
          <div class={styles.characterList}>
            <For each={charactersStore.characters}>
              {(character) => (
                <button
                  class={`${styles.listItem} ${selectedCharacterId() === character.id ? styles.listItemSelected : ''}`}
                  onClick={() => {
                    // Cancel any active edit when switching characters
                    if (editingId()) {
                      cancelEdit()
                    }
                    setSelectedCharacterId(character.id)
                  }}
                >
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
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Detail Panel */}
        <div class={`${styles.detailColumn} ${selectedCharacterId() ? styles.detailColumnVisible : ''}`}>
          <Show when={selectedCharacterId() === 'new'}>
            <div class={styles.detailContent}>
              <div class={styles.detailHeader}>
                <button
                  class={styles.backButton}
                  onClick={() => setSelectedCharacterId('')}
                  title="Back to list"
                >
                  <BsArrowLeft />
                </button>
                <h3 class={styles.detailTitle}>Add New Character</h3>
              </div>
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
                      {(image) => (
                        <img
                          src={image()}
                          alt="New character preview"
                          class={styles.imagePreviewImage}
                        />
                      )}
                    </Show>
                    <Show when={!newCharacterImageData()}>
                      <div class={styles.imagePlaceholder}>
                        {getAvatarInitial(newCharacterName() || '?')}
                      </div>
                    </Show>
                  </div>
                  <div class={styles.imageControls}>
                    <label class={styles.imageUploadButton}>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleNewImageSelect}
                      />
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
                  ref={(methods) => newEditorRef = methods}
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
                />
                <EJSRenderer template={newCharacterDescription()} mode="preview-always" />
                <div style="margin-top: 0.5rem;">
                  <Show when={!showNewBirthdatePicker()}>
                    <button
                      class={styles.input}
                      style="width: 100%; text-align: left; display: flex; align-items: center; gap: 0.5rem;"
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
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <EJSDocumentation />
                  <AvailableFunctions />
                </div>
                <button
                  onClick={addCharacter}
                  disabled={!newCharacterName().trim() || !newCharacterDescription().trim()}
                  class={styles.saveButton}
                  title="Add character"
                >
                  <BsPlus /> Add Character
                </button>
              </div>
            </div>
          </Show>

          <Show when={selectedCharacter()} keyed>
            {(char) => (
              <div class={styles.detailContent}>
                <div class={styles.detailHeader}>
                  <button
                    class={styles.backButton}
                    onClick={() => setSelectedCharacterId('')}
                    title="Back to list"
                  >
                    <BsArrowLeft />
                  </button>
                  <h3 class={styles.detailTitle}>
                    <EJSRenderer template={getCharacterDisplayName(char)} mode="inline" />
                  </h3>
                  <Show when={char.isMainCharacter}>
                    <BsStarFill class={styles.protagonistBadge} title="Protagonist" />
                  </Show>
                </div>

              <Show when={editingId() === char.id} fallback={
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
                        <div class={styles.detailAvatarPlaceholder}>
                          {getAvatarInitial(getCharacterDisplayName(char))}
                        </div>
                      </Show>
                    </div>
                    <div class={styles.characterDescription}>
                      <EJSRenderer template={char.description ?? ''} mode="inline" />
                    </div>
                    <Show when={char.birthdate !== undefined}>
                      <div class={styles.characterBirthdate}>
                        Born: {calendarStore.formatStoryTime(char.birthdate!)}
                      </div>
                    </Show>
                    <div class={styles.detailActions}>
                      <button
                        class={`${styles.actionButton} ${char.isMainCharacter ? styles.protagonistButtonActive : ''}`}
                        onClick={() => charactersStore.updateCharacter(char.id, { isMainCharacter: !char.isMainCharacter })}
                        title={char.isMainCharacter ? "Remove protagonist status" : "Mark as protagonist"}
                      >
                        <Show when={char.isMainCharacter} fallback={<BsStar />}>
                          <BsStarFill />
                        </Show>
                        {char.isMainCharacter ? 'Protagonist' : 'Mark as Protagonist'}
                      </button>
                      <button
                        class={styles.actionButton}
                        onClick={() => startEditing(char)}
                        title="Edit character"
                      >
                        <BsPencil /> Edit
                      </button>
                      <button
                        class={`${styles.actionButton} ${styles.deleteButton}`}
                        onClick={() => {
                          charactersStore.deleteCharacter(char.id)
                          setSelectedCharacterId('')
                        }}
                        title="Delete character"
                      >
                        <BsX /> Delete
                      </button>
                    </div>
                  </div>
                }>
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
                          {(image) => (
                            <img
                              src={image()}
                              alt="Character preview"
                              class={styles.imagePreviewImage}
                            />
                          )}
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
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditImageSelect}
                          />
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
                      ref={(methods) => editEditorRef = methods}
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
                    />
                    <EJSRenderer template={editDescription()} mode="preview-always" />
                    <div style="margin-top: 0.5rem;">
                      <Show when={!showEditBirthdatePicker()}>
                        <button
                          class={styles.input}
                          style="width: 100%; text-align: left; display: flex; align-items: center; gap: 0.5rem;"
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
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <EJSDocumentation />
                      <AvailableFunctions />
                    </div>
                    <div class={styles.formActions}>
                      <button
                        class={styles.saveButton}
                        onClick={saveEdit}
                        title="Save changes"
                      >
                        <BsCheck /> Save
                      </button>
                      <button
                        class={styles.cancelButton}
                        onClick={cancelEdit}
                        title="Cancel editing"
                      >
                        <BsX /> Cancel
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
