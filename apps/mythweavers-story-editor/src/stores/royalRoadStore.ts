import { createStore, reconcile } from 'solid-js/store'
import {
  deleteMyRoyalRoadAccount,
  getMyRoyalRoadAccount,
  getMyRoyalRoadStoriesByStoryId,
  getMyRoyalRoadStoriesByStoryIdPublishingStatus,
  patchMyRoyalRoadStoriesByStoryId,
  postMyRoyalRoadAccount,
  postMyRoyalRoadStoriesByStoryIdChaptersByChapterIdRetry,
} from '../client/config'

/**
 * Royal Road publishing UI state.
 *
 * Scope is intentionally narrow — this store owns the panel's view of:
 *
 *   1. Account connection (email + lastLoginAt + lastError; password is never
 *      kept in the browser — it's POSTed to the backend once, where it lives
 *      encrypted at rest)
 *   2. Per-story settings (royalRoadId + publishingEnabled)
 *   3. Per-chapter publishing status rows (read-only table, refreshed on open)
 *
 * Mutations call the generated SDK directly — these are user-initiated modal
 * actions, not content edits, so they don't need saveService's dedup queue.
 * Success always re-reads from the server to avoid divergence.
 */

export type RoyalRoadAccount = {
  connected: boolean
  email: string | null
  lastLoginAt: string | null
  lastError: string | null
}

export type RoyalRoadStorySettings = {
  storyId: string
  royalRoadId: number | null
  publishingEnabled: boolean
}

export type RoyalRoadStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | null

export type RoyalRoadStatusRow = {
  chapterId: string
  chapterName: string
  chapterRoyalRoadId: number | null
  status: RoyalRoadStatus
  platformId: string | null
  publishedAt: string | null
  lastAttempt: string | null
  errorMessage: string | null
  attempts: number
  nextAttemptAt: string | null
}

type StoryState = {
  settings: RoyalRoadStorySettings | null
  statusRows: RoyalRoadStatusRow[]
  loading: boolean
  error: string | null
}

type RoyalRoadStateShape = {
  account: RoyalRoadAccount | null
  accountLoading: boolean
  accountError: string | null
  byStory: Record<string, StoryState>
}

const initialState: RoyalRoadStateShape = {
  account: null,
  accountLoading: false,
  accountError: null,
  byStory: {},
}

const [state, setState] = createStore<RoyalRoadStateShape>(initialState)

function emptyStoryState(): StoryState {
  return { settings: null, statusRows: [], loading: false, error: null }
}

function ensureStory(storyId: string): void {
  if (!state.byStory[storyId]) {
    setState('byStory', storyId, emptyStoryState())
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return 'Unknown error'
  }
}

// ---- Account ---------------------------------------------------------------

async function loadAccount(): Promise<void> {
  setState({ accountLoading: true, accountError: null })
  try {
    const { data, error } = await getMyRoyalRoadAccount()
    if (error || !data) throw new Error((error as { error?: string })?.error ?? 'Failed to load account')
    setState('account', data)
  } catch (e) {
    setState('accountError', errorMessage(e))
  } finally {
    setState('accountLoading', false)
  }
}

async function connectAccount(email: string, password: string): Promise<void> {
  setState({ accountLoading: true, accountError: null })
  try {
    const { data, error } = await postMyRoyalRoadAccount({ body: { email, password } })
    if (error || !data) throw new Error((error as { error?: string })?.error ?? 'Failed to connect account')
    // Server returns { success: true } — re-fetch to pick up connected/email/lastLoginAt.
    await loadAccount()
  } catch (e) {
    setState('accountError', errorMessage(e))
    throw e
  } finally {
    setState('accountLoading', false)
  }
}

async function disconnectAccount(): Promise<void> {
  setState({ accountLoading: true, accountError: null })
  try {
    const { error } = await deleteMyRoyalRoadAccount()
    if (error) throw new Error((error as { error?: string }).error ?? 'Failed to disconnect')
    setState('account', { connected: false, email: null, lastLoginAt: null, lastError: null })
  } catch (e) {
    setState('accountError', errorMessage(e))
    throw e
  } finally {
    setState('accountLoading', false)
  }
}

// ---- Per-story settings ----------------------------------------------------

async function loadStorySettings(storyId: string): Promise<void> {
  ensureStory(storyId)
  setState('byStory', storyId, 'loading', true)
  setState('byStory', storyId, 'error', null)
  try {
    const { data, error } = await getMyRoyalRoadStoriesByStoryId({ path: { storyId } })
    if (error || !data) throw new Error((error as { error?: string })?.error ?? 'Failed to load settings')
    setState('byStory', storyId, 'settings', data)
  } catch (e) {
    setState('byStory', storyId, 'error', errorMessage(e))
  } finally {
    setState('byStory', storyId, 'loading', false)
  }
}

async function updateStorySettings(
  storyId: string,
  patch: { royalRoadId?: number | null; publishingEnabled?: boolean },
): Promise<void> {
  ensureStory(storyId)
  setState('byStory', storyId, 'error', null)
  try {
    const { data, error } = await patchMyRoyalRoadStoriesByStoryId({
      path: { storyId },
      body: patch,
    })
    if (error || !data) throw new Error((error as { error?: string })?.error ?? 'Failed to update settings')
    setState('byStory', storyId, 'settings', data)
  } catch (e) {
    setState('byStory', storyId, 'error', errorMessage(e))
    throw e
  }
}

// ---- Per-chapter publishing status ----------------------------------------

async function loadPublishingStatus(storyId: string): Promise<void> {
  ensureStory(storyId)
  setState('byStory', storyId, 'loading', true)
  setState('byStory', storyId, 'error', null)
  try {
    const { data, error } = await getMyRoyalRoadStoriesByStoryIdPublishingStatus({
      path: { storyId },
    })
    if (error || !data) throw new Error((error as { error?: string })?.error ?? 'Failed to load status')
    setState('byStory', storyId, 'statusRows', reconcile(data.rows))
  } catch (e) {
    setState('byStory', storyId, 'error', errorMessage(e))
  } finally {
    setState('byStory', storyId, 'loading', false)
  }
}

async function retryChapter(storyId: string, chapterId: string): Promise<void> {
  ensureStory(storyId)
  setState('byStory', storyId, 'error', null)
  try {
    const { error } = await postMyRoyalRoadStoriesByStoryIdChaptersByChapterIdRetry({
      path: { storyId, chapterId },
    })
    if (error) throw new Error((error as { error?: string }).error ?? 'Retry failed')
    // Optimistic-ish: re-load to pick up the DRAFT state the backend just wrote.
    await loadPublishingStatus(storyId)
  } catch (e) {
    setState('byStory', storyId, 'error', errorMessage(e))
    throw e
  }
}

// ---- Exports ---------------------------------------------------------------

export const royalRoadStore = {
  // Account
  get account() {
    return state.account
  },
  get accountLoading() {
    return state.accountLoading
  },
  get accountError() {
    return state.accountError
  },
  loadAccount,
  connectAccount,
  disconnectAccount,

  // Per-story
  storySettings(storyId: string): RoyalRoadStorySettings | null {
    return state.byStory[storyId]?.settings ?? null
  },
  statusRows(storyId: string): RoyalRoadStatusRow[] {
    return state.byStory[storyId]?.statusRows ?? []
  },
  storyLoading(storyId: string): boolean {
    return state.byStory[storyId]?.loading ?? false
  },
  storyError(storyId: string): string | null {
    return state.byStory[storyId]?.error ?? null
  },
  loadStorySettings,
  updateStorySettings,
  loadPublishingStatus,
  retryChapter,
}
