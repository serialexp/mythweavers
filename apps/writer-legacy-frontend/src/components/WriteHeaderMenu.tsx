import { A, useNavigate } from '@solidjs/router'
import { FiDatabase, FiInfo, FiMenu, FiSettings } from 'solid-icons/fi'
import { Show, createMemo, createSignal } from 'solid-js'
import { importRoyalRoad } from '../lib/persistence/import-royal-road'
import { loadStoryFromServer } from '../lib/persistence/load-story-from-server'
import { saveStory } from '../lib/persistence/save-story'
import { unloadState } from '../lib/persistence/unload-state'
import { uploadStory } from '../lib/persistence/upload-story'
import { addNotification } from '../lib/stores/notifications'
import { storyState } from '../lib/stores/story'
import { setAiPopupOpen, setShowAiLogPopup, setShowSyncStatusDialog, uiState } from '../lib/stores/ui'
import { userState } from '../lib/stores/user'
import { AiLogPopup } from './AiLogPopup'
import { NotificationManager } from './NotificationManager'

// Define Sync Status types
type SyncStatus = 'unknown' | 'in-sync' | 'local-changes' | 'server-changes' | 'conflict'

export const WriteHeaderMenu = () => {
  const navigate = useNavigate()
  const [isMainOpen, setIsMainOpen] = createSignal(false)
  const isMinimal = createMemo(() => !storyState.storyLoaded)

  // --- Sync State Logic ---
  const syncStatus = createMemo((): SyncStatus => {
    const state = uiState.syncState
    let baseStatus: SyncStatus = 'unknown' // Determine status from server check first

    if (state && storyState.storyLoaded) {
      const hasLocalServerDiff = state.localNew.length > 0 || state.modifiedLocal.length > 0
      const hasServerDiff = state.serverNew.length > 0 || state.modifiedServer.length > 0

      if (hasLocalServerDiff && hasServerDiff) baseStatus = 'conflict'
      else if (hasLocalServerDiff) baseStatus = 'local-changes'
      else if (hasServerDiff) baseStatus = 'server-changes'
      else baseStatus = 'in-sync' // Assumes inSync array check is covered or implies no diffs
    } else if (!storyState.storyLoaded) {
      baseStatus = 'unknown' // Explicitly unknown if no story loaded
    }

    // Now, adjust status based on the local timestamp comparison
    if (
      uiState.lastKnownServerUpdate !== null &&
      storyState.story?.modifiedTime && // Ensure current modifiedTime exists
      storyState.story.modifiedTime > uiState.lastKnownServerUpdate
    ) {
      if (baseStatus === 'in-sync') {
        return 'local-changes' // Was in sync, but local modifiedTime is newer
      }
      if (baseStatus === 'server-changes') {
        return 'conflict' // Server had changes, and local modifiedTime is also newer
      }
      // If baseStatus was already local-changes or conflict, the newer local time confirms it
      // If baseStatus was unknown, keep it unknown
    }

    return baseStatus // Return the (potentially adjusted) status
  })

  const _canPublish = createMemo(() => syncStatus() === 'local-changes' || syncStatus() === 'in-sync')
  const _canLoad = createMemo(() => syncStatus() === 'server-changes' || syncStatus() === 'in-sync')
  const hasConflict = createMemo(() => syncStatus() === 'conflict')
  const hasChanges = createMemo(
    () => syncStatus() === 'local-changes' || syncStatus() === 'server-changes' || syncStatus() === 'conflict',
  )

  const isPublishDisabled = createMemo(
    () => !userState.signedInUser?.name || uiState.uploading || syncStatus() === 'unknown',
  )
  const isLoadDisabled = createMemo(
    () =>
      !storyState.storyLoaded ||
      !userState.signedInUser?.name ||
      uiState.loadingFromServer ||
      syncStatus() === 'in-sync' ||
      syncStatus() === 'unknown',
  )

  const publishTooltip = createMemo(() => {
    if (uiState.uploading) return 'Publishing in progress...'
    if (!userState.signedInUser?.name) return 'Sign in to publish'
    switch (syncStatus()) {
      case 'in-sync':
        return 'Publish (Local & Server In Sync)'
      case 'local-changes':
        return 'Publish Local Changes to Server'
      case 'server-changes':
        return 'Force Publish (Server has newer changes, local will overwrite)'
      case 'conflict':
        return 'Force Publish (Conflict detected, local will overwrite server)'
      default:
        return 'Publish status unknown. Checking...'
    }
  })
  const loadTooltip = createMemo(() => {
    if (uiState.loadingFromServer) return 'Loading in progress...'
    if (!storyState.storyLoaded) return 'No local story loaded'
    if (!userState.signedInUser?.name) return 'Sign in to load'
    switch (syncStatus()) {
      case 'in-sync':
        return 'Load (Local & Server In Sync)'
      case 'server-changes':
        return 'Load Newer Changes from Server'
      case 'local-changes':
        return 'Cannot load: You have local changes not on the server. Please publish first.'
      case 'conflict':
        return 'Cannot load automatically: Conflict detected. Use Load button to see options (overwrite local).' // Dialog handles actual action
      default:
        return 'Load status unknown. Checking...'
    }
  })

  return (
    <>
      <NotificationManager />
      <AiLogPopup />
      <div class="bg-white flex justify-between shadow-lg z-20">
        <div class="px-2 py-1 flex items-center gap-1">
          <div
            class="dropdown"
            classList={{
              'dropdown-open': isMainOpen(),
            }}
          >
            <button
              type="button"
              class="btn btn-ghost"
              onClick={() => {
                setIsMainOpen(!isMainOpen())
              }}
            >
              <FiMenu />
            </button>
            <ul class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
              <li>
                <A
                  href="/new-story"
                  onClick={() => {
                    unloadState()
                  }}
                >
                  New Story
                </A>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    unloadState()
                    navigate('/open-story')
                  }}
                >
                  Open Story
                </button>
              </li>
              <Show when={!isMinimal()}>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      saveStory(true).catch((error) => {
                        addNotification({
                          type: 'error',
                          title: 'Save failed',
                          message: error.message,
                        })
                      })
                    }}
                  >
                    {uiState.saving ? <span class="loading loading-spinner" /> : null}
                    Save Story
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      saveStory(false, true).catch((error) => {
                        addNotification({
                          type: 'error',
                          title: 'Force save failed',
                          message: error.message,
                        })
                      })
                    }}
                  >
                    {uiState.saving ? <span class="loading loading-spinner" /> : null}
                    Force Save (Overwrite All)
                  </button>
                </li>
              </Show>
            </ul>
          </div>
          <Show when={!isMinimal()}>
            <A href={'/write'}>
              <button class="btn btn-ghost px-2" type="button">
                Story
              </button>
            </A>
            <A href={'/snowflake'}>
              <button class="btn btn-ghost px-2" type="button">
                Snowflake
              </button>
            </A>
            <A href={'/characters'}>
              <button class="btn btn-ghost px-2" type="button">
                Characters
              </button>
            </A>
            <A href={'/files'}>
              <button class="btn btn-ghost px-2" type="button">
                Files
              </button>
            </A>
            <A href={'/search'}>
              <button class="btn btn-ghost px-2" type="button">
                Search
              </button>
            </A>
            <A href={'/locations'}>
              <button class="btn btn-ghost px-2" type="button">
                Locations
              </button>
            </A>
            <A href={'/plot-points'}>
              <button class="btn btn-ghost px-2" type="button">
                Plot Points
              </button>
            </A>
            <A href={'/settings'}>
              <button class="btn btn-ghost px-2" type="button">
                Story Settings
              </button>
            </A>
            <A href={'/preview'}>
              <button class="btn btn-secondary px-4" disabled={!uiState.currentId} type="button">
                Preview
              </button>
            </A>
          </Show>
        </div>
        <div class="px-2 py-1 flex gap-2 justify-end items-center">
          <Show when={!isMinimal() && uiState.saving}>
            <div class="loading loading-spinner" />
          </Show>
          <Show when={!isMinimal()}>
            <button
              class="btn btn-ghost"
              type="button"
              onClick={() => {
                setAiPopupOpen(true)
              }}
            >
              AI Question
            </button>

            <button
              class="btn btn-ghost"
              type="button"
              title="View AI Call History"
              onClick={() => {
                setShowAiLogPopup(true)
              }}
            >
              <FiDatabase />
            </button>

            <button
              class="btn btn-ghost"
              type="button"
              disabled={
                !storyState.story?.settings?.royalRoadId ||
                !userState.signedInUser?.name ||
                uiState.importDialog.running
              }
              onClick={() => {
                if (storyState.story?.settings?.royalRoadId) {
                  importRoyalRoad(storyState.story?.settings?.royalRoadId)
                    .then(() => {
                      addNotification({
                        type: 'success',
                        title: 'Imported Royal Road',
                        message: 'Royal Road imported successfully',
                      })
                    })
                    .catch((error) => {
                      addNotification({
                        type: 'error',
                        title: 'Import failed',
                        message: error.message,
                      })
                    })
                }
              }}
            >
              {uiState.importDialog.running ? <span class="loading loading-spinner" /> : null}
              {uiState.importDialog.running ? 'Importing...' : 'Import'}
            </button>

            <Show when={hasChanges()}>
              <div class="tooltip tooltip-bottom" data-tip="View Sync Status Details">
                <button
                  class="btn btn-ghost btn-sm btn-circle"
                  classList={{
                    'btn-warning text-warning-content': hasConflict(),
                    'btn-info text-info-content': !hasConflict() && hasChanges(),
                  }}
                  type="button"
                  onClick={() => {
                    setShowSyncStatusDialog(true)
                  }}
                >
                  <FiInfo />
                </button>
              </div>
            </Show>

            <div class="tooltip tooltip-bottom" data-tip={loadTooltip()}>
              <button
                class="btn"
                classList={{
                  'btn-error': syncStatus() === 'local-changes' || syncStatus() === 'conflict',
                  'btn-ghost': !(syncStatus() === 'local-changes' || syncStatus() === 'conflict'),
                }}
                type="button"
                onClick={() => {
                  loadStoryFromServer()
                }}
                disabled={isLoadDisabled()}
              >
                {uiState.loadingFromServer ? <span class="loading loading-spinner" /> : null}
                {uiState.loadingFromServer ? 'Loading...' : 'Load'}
              </button>
            </div>

            <div class="tooltip tooltip-bottom" data-tip={publishTooltip()}>
              <button
                class="btn"
                classList={{
                  'btn-error': syncStatus() === 'server-changes' || syncStatus() === 'conflict',
                  'btn-ghost': !(syncStatus() === 'server-changes' || syncStatus() === 'conflict'),
                }}
                type="button"
                onClick={() => {
                  uploadStory()
                }}
                disabled={isPublishDisabled()}
              >
                {uiState.uploading ? <span class="loading loading-spinner" /> : null}
                {uiState.uploading ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </Show>
          <div class="tooltip tooltip-bottom" data-tip="Global Settings">
            <button class="btn btn-circle" type="button" onClick={() => navigate('/global-settings')}>
              <FiSettings />
            </button>
          </div>
          <button class="avatar online" type="button" onClick={() => navigate('/profile')}>
            <div class="w-10 rounded-full ring-primary ring-1 ring-offset-base-200 rounded-full ring ring-offset-1">
              {userState.signedInUser?.avatarUrl ? (
                <img src={userState.signedInUser.avatarUrl} alt={userState.signedInUser.name ?? 'Avatar'} />
              ) : (
                <img src="/disappointed2.png" alt="Avatar" />
              )}
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
