import { createSignal, onCleanup } from 'solid-js'
import { authStore } from '../stores/authStore'
import {
  getMyAdventuresById,
  postMyAdventures,
  putMyAdventuresById,
} from '../client/config'

// --- Types ---

export interface AdventureTurn {
  playerAction: string | null
  narrative: string
  worldTrajectory: string
  directorNotes?: string
  dead?: boolean
}

export interface AdventureCompaction {
  summary: string
  generatedAt: string
}

export type AdventurePhase = 'setup' | 'playing'

export interface PersistedState {
  phase: AdventurePhase
  settingInput: string
  protagonistInput: string
  settingDescription: string
  turns: AdventureTurn[]
  compactions?: Record<string, AdventureCompaction>
  directive?: string
  pendingAction?: string | null
  worldMomentumEnabled?: boolean
}

// --- localStorage helpers (offline / crash recovery) ---

const STORAGE_KEY = 'adventure-state'

function localLoad(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

function localSave(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage full — silently ignore
  }
}

function localClear() {
  localStorage.removeItem(STORAGE_KEY)
}

/** Save pendingAction to localStorage for crash recovery (backend mode only). */
function savePendingAction(adventureId: string, action: string | null) {
  const key = `adventure-pending-${adventureId}`
  if (action) {
    try {
      localStorage.setItem(key, action)
    } catch { /* ignore */ }
  } else {
    localStorage.removeItem(key)
  }
}

function loadPendingAction(adventureId: string): string | null {
  try {
    return localStorage.getItem(`adventure-pending-${adventureId}`)
  } catch {
    return null
  }
}

function clearPendingAction(adventureId: string) {
  localStorage.removeItem(`adventure-pending-${adventureId}`)
}

// --- Name derivation ---

function deriveNameFromSetting(settingDescription: string): string {
  // Strip PROTAGONIST section if present
  const cleaned = settingDescription.replace(/\n\nPROTAGONIST:[\s\S]*$/, '').trim()
  const firstLine = cleaned.split('\n')[0].trim()
  if (!firstLine) return 'Untitled Adventure'
  if (firstLine.length <= 60) return firstLine
  return `${firstLine.slice(0, 57)}...`
}

// --- Hook ---

export interface AdventurePersistence {
  /** True while loading from backend */
  isLoading: () => boolean
  /** Non-null if loading failed (e.g. 404) */
  loadError: () => string | null
  /** The backend adventure ID (null for offline/new) */
  adventureId: () => string | null
  /** The loaded state (null before load completes, or if new adventure) */
  initialState: () => PersistedState | null
  /** Debounced save (500ms) */
  persistSoon: (state: PersistedState) => void
  /** Immediate save */
  persistNow: (state: PersistedState) => void
  /** Create a new adventure on the backend, returns the new ID */
  createAdventure: (state: PersistedState, name?: string) => Promise<string>
  /** Clear/delete the current adventure state */
  clearState: () => void
  /** Whether we're using backend persistence */
  isBackendMode: boolean
}

export function useAdventurePersistence(routeId: string): AdventurePersistence {
  const isNew = routeId === 'new'
  const isLocal = routeId === 'local'
  // If we have a real adventure ID (not 'new' or 'local'), always attempt backend load
  // regardless of auth state — the API call will fail if not authenticated, which is fine.
  const hasRealId = !isNew && !isLocal
  const isBackendMode = hasRealId || (authStore.isAuthenticated && !authStore.isOfflineMode && !isLocal)

  const [isLoading, setIsLoading] = createSignal(hasRealId || (isBackendMode && !isNew))
  const [loadError, setLoadError] = createSignal<string | null>(null)
  const [adventureId, setAdventureId] = createSignal<string | null>(
    hasRealId ? routeId : null,
  )
  const [initialState, setInitialState] = createSignal<PersistedState | null>(null)

  // Debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  // In-flight PUT tracking
  let saveInFlight = false
  let queuedState: PersistedState | null = null
  // Track the last name we sent to avoid redundant updates
  let lastSentName: string | null = null

  onCleanup(() => {
    clearTimeout(debounceTimer)
  })

  // --- Initial load ---

  if (hasRealId) {
    // Load from backend — always attempt when we have a real ID in the URL
    ;(async () => {
      try {
        const { data, error } = await getMyAdventuresById({ path: { id: routeId } })
        if (error || !data) {
          setLoadError('Adventure not found')
          setIsLoading(false)
          return
        }
        const adventure = data.adventure
        const adventureData = adventure.data as unknown as PersistedState

        // Check for a crashed pendingAction in localStorage
        const pendingAction = loadPendingAction(adventure.id)
        if (pendingAction) {
          adventureData.pendingAction = pendingAction
          clearPendingAction(adventure.id)
        }

        setInitialState(adventureData)
        setIsLoading(false)
      } catch {
        setLoadError('Failed to load adventure')
        setIsLoading(false)
      }
    })()
  } else if (isLocal) {
    // Offline mode: load from localStorage
    setInitialState(localLoad())
  }
  // isNew: initialState stays null (fresh adventure)

  // --- Save logic ---

  /** Strip pendingAction for backend saves (it goes to localStorage instead). */
  function stripPendingAction(state: PersistedState): Omit<PersistedState, 'pendingAction'> {
    const { pendingAction: _, ...rest } = state
    return rest
  }

  async function doBackendSave(state: PersistedState) {
    const id = adventureId()
    if (!id) {
      // Adventure not yet created — queue the save
      queuedState = state
      return
    }

    if (saveInFlight) {
      queuedState = state
      return
    }

    saveInFlight = true

    // Handle pendingAction separately
    savePendingAction(id, state.pendingAction ?? null)

    const cleanState = stripPendingAction(state)

    // Derive name from setting if it changed
    const name = deriveNameFromSetting(state.settingDescription)
    const nameUpdate = name !== lastSentName ? name : undefined
    if (nameUpdate) lastSentName = name

    try {
      await putMyAdventuresById({
        path: { id },
        body: {
          data: cleanState as any,
          ...(nameUpdate ? { name: nameUpdate } : {}),
        },
      })
    } catch (err) {
      console.warn('[adventure-persistence] Save failed:', err)
    } finally {
      saveInFlight = false
      // Flush queued save if there is one
      if (queuedState) {
        const next = queuedState
        queuedState = null
        doBackendSave(next)
      }
    }
  }

  function persistSoon(state: PersistedState) {
    clearTimeout(debounceTimer)
    if (isBackendMode) {
      debounceTimer = setTimeout(() => doBackendSave(state), 500)
    } else {
      debounceTimer = setTimeout(() => localSave(state), 500)
    }
  }

  function persistNow(state: PersistedState) {
    clearTimeout(debounceTimer)
    if (isBackendMode) {
      doBackendSave(state)
    } else {
      localSave(state)
    }
  }

  async function createAdventure(state: PersistedState, name?: string): Promise<string> {
    const adventureName = name || deriveNameFromSetting(state.settingDescription)
    lastSentName = adventureName
    const cleanState = stripPendingAction(state)

    const { data, error } = await postMyAdventures({
      body: {
        name: adventureName,
        data: cleanState as any,
      },
    })

    if (error || !data) {
      throw new Error('Failed to create adventure')
    }

    const newId = data.adventure.id
    setAdventureId(newId)

    // Flush any queued saves now that we have an ID
    if (queuedState) {
      const next = queuedState
      queuedState = null
      doBackendSave(next)
    }

    return newId
  }

  function clearState() {
    if (isBackendMode) {
      const id = adventureId()
      if (id) {
        clearPendingAction(id)
      }
      // Don't delete the adventure from the backend on reset —
      // the user is starting a new one, not destroying the old one
    } else {
      localClear()
    }
  }

  return {
    isLoading,
    loadError,
    adventureId,
    initialState,
    persistSoon,
    persistNow,
    createAdventure,
    clearState,
    isBackendMode,
  }
}
