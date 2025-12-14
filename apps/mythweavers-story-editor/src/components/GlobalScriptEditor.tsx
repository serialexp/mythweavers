import { createSignal, Show } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { CodeEditor } from './CodeEditor'
import styles from './GlobalScriptEditor.module.css'

const DEFAULT_GLOBAL_SCRIPT = `(data) => {
  // Initialize story-wide variables here
  // This script runs before every message script
  // Data is immutable - you can write normal mutation code but the original is never changed!
  
  // Example: Set up time tracking
  // data.storyStartDate = new Date('2023-01-01');
  // data.currentDate = new Date('2023-01-01');
  // data.daysPassed = 0;
  
  // Example: Character ages
  // data.characterAges = {
  //   'Luke': 19,
  //   'Leia': 19
  // };
  
  // Define reusable functions for message scripts
  // IMPORTANT: Make sure to return the modified data object!
  return {
    data: data,  // This should be the data object with your initializations
    functions: {
      // Time progression helper - just mutate directly!
      advanceTime: (data, days) => {
        data.currentDate = new Date(data.currentDate);
        data.currentDate.setDate(data.currentDate.getDate() + days);
        data.daysPassed += days;
        // No need to return data - Immer handles it!
      },
      
      // Update all character ages based on time passed
      updateAges: (data) => {
        if (data.characterAges && data.daysPassed) {
          Object.keys(data.characterAges).forEach(char => {
            data.characterAges[char] = 19 + Math.floor(data.daysPassed / 365);
          });
        }
      },
      
      // Add a story event
      addEvent: (data, eventName, details = {}) => {
        if (!data.events) data.events = [];
        data.events.push({
          name: eventName,
          date: new Date(data.currentDate),
          turn: data.turnNumber || 0,
          ...details
        });
      },
      
      // Utility: Calculate days since start (doesn't modify data)
      getDaysSinceStart: (data) => {
        if (!data.storyStartDate || !data.currentDate) return 0;
        const start = new Date(data.storyStartDate);
        const current = new Date(data.currentDate);
        return Math.floor((current - start) / (1000 * 60 * 60 * 24));
      },
      
      // Utility: Check if character exists
      hasCharacter: (data, name) => {
        return data.characterAges && name in data.characterAges;
      }
    }
  };
  
  // For backward compatibility, you can still return just data
}`;

interface GlobalScriptEditorProps {
  compact?: boolean;
}

export function GlobalScriptEditor(props: GlobalScriptEditorProps) {
  const [isEditing, setIsEditing] = createSignal(false)
  const [scriptContent, setScriptContent] = createSignal(currentStoryStore.globalScript || '')
  const [error, setError] = createSignal<string | null>(null)

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
        <button onClick={handleStartEditing} class={styles.compactEditButton}>
          {currentStoryStore.globalScript ? 'Edit' : 'Add'} Script
        </button>
      </Show>
      
      <Show when={!props.compact}>
        <div class={styles.container}>
          <Show when={!isEditing()}>
        <div class={styles.header}>
          <h3>Global Script</h3>
          <button onClick={handleStartEditing} class={styles.editButton}>
            {currentStoryStore.globalScript ? 'Edit' : 'Add'} Script
          </button>
        </div>
        <Show when={currentStoryStore.globalScript}>
          <div class={styles.scriptPreview}>
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
            <div class={styles.editor}>
              <h3>Edit Global Script</h3>
              <p class={styles.help}>
                This script runs before every message script. It should be a function that takes a data object and returns it.
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
                <div class={styles.error}>{error()}</div>
              </Show>
              <div class={styles.actions}>
                <button onClick={handleSave} class={styles.saveButton}>Save</button>
                <button onClick={handleCancel} class={styles.cancelButton}>Cancel</button>
              </div>
            </div>
          </Show>
        </div>
      </Show>
      
      {/* Modal for compact mode */}
      <Show when={props.compact && isEditing()}>
        <div class="modal-overlay" onClick={handleCancel}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Edit Global Script</h3>
              <button class="modal-close" onClick={handleCancel}>×</button>
            </div>
            <div class="modal-body">
              <p class={styles.help}>
                This script runs before every message script. It should be a function that takes a data object and returns it.
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
                <div class={styles.error}>{error()}</div>
              </Show>
              <div class={styles.actions}>
                <button onClick={handleSave} class={styles.saveButton}>Save</button>
                <button onClick={handleCancel} class={styles.cancelButton}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}