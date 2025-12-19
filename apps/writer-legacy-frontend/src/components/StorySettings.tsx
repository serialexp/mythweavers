import { For, createSignal } from 'solid-js'
import { chaptersState } from '../lib/stores/chapters'
import { addNotification } from '../lib/stores/notifications'
import { scenesState, updateSceneData } from '../lib/stores/scenes'
import { settingsState } from '../lib/stores/settings'
import { setStoryProperty, setStorySetting, storyState } from '../lib/stores/story'
import { trpc } from '../lib/trpc'
import { CharacterSelect } from './CharacterSelect'
import { FileSelector } from './FileSelector'
import { FormField } from './styled/FormField'

export const StorySettings = () => {
  const [activeTab, setActiveTab] = createSignal('general')
  const [expandedPublishers, setExpandedPublishers] = createSignal<string[]>([])
  const [isSyncing, setIsSyncing] = createSignal(false)

  const updateAllScenePerspectives = () => {
    const defaultPerspective = storyState.story?.settings?.defaultPerspective
    const defaultProtagonistId = storyState.story?.settings?.defaultProtagonistId

    if (!defaultPerspective) return

    for (const scene of Object.values(scenesState.scenes ?? {})) {
      updateSceneData(scene.id, {
        perspective: defaultPerspective,
        protagonistId: defaultProtagonistId,
      })
    }

    addNotification({
      type: 'success',
      title: 'Perspective Updated',
      message: 'All scenes have been updated with the default perspective settings.',
    })
  }

  const updateAllProtagonists = () => {
    const defaultProtagonistId = storyState.story?.settings?.defaultProtagonistId

    console.log('udpating to ', defaultProtagonistId)
    for (const scene of Object.values(scenesState.scenes ?? {})) {
      updateSceneData(scene.id, {
        protagonistId: defaultProtagonistId,
      })
    }

    addNotification({
      type: 'success',
      title: 'Protagonist Updated',
      message: 'All scenes have been updated with the default protagonist.',
    })
  }

  const togglePublisher = (publisher: string) => {
    if (expandedPublishers().includes(publisher)) {
      setExpandedPublishers(expandedPublishers().filter((p) => p !== publisher))
    } else {
      setExpandedPublishers([...expandedPublishers(), publisher])
    }
  }

  const hasPublisherCredentials = (publisher: string) => {
    switch (publisher) {
      case 'royalroad':
        return !!settingsState.royalRoadEmail && !!settingsState.royalRoadPassword
      default:
        return false
    }
  }

  const syncRoyalRoadPublishing = async () => {
    if (!storyState.story?.id) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'No story is currently loaded.',
      })
      return
    }

    setIsSyncing(true)
    try {
      // Prepare chapter data for syncing
      const chapterData = Object.entries(chaptersState.chapters)
        .filter(([_id, chapter]) => {
          return chapter.royalRoadId && chapter.modifiedAt
        })
        .map(([id, chapter]) => ({
          id,
          royalRoadId: chapter.royalRoadId || 0,
          modifiedAt: new Date(chapter.modifiedAt || Date.now()).toISOString(),
        }))

      console.log('chapterData', chapterData)
      const result = await trpc.syncRoyalRoadPublishing.mutate({
        storyId: storyState.story.id,
        chapterData,
      })

      if (result.success) {
        addNotification({
          type: 'success',
          title: 'Sync Successful',
          message: `Synced ${result.syncedCount} chapters to Royal Road publishing.`,
        })
      } else {
        addNotification({
          type: 'error',
          title: 'Sync Failed',
          message: result.error || 'Unknown error occurred during sync.',
        })
      }
    } catch (error) {
      console.error('Error syncing Royal Road publishing:', error)
      addNotification({
        type: 'error',
        title: 'Sync Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred during sync.',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const publishers = [
    { id: 'reader', name: 'Reader', alwaysEnabled: true },
    { id: 'royalroad', name: 'Royal Road' },
    // Add more publishers here as they are supported
  ]

  return (
    <div class="flex flex-col p-4 w-full gap-4 overflow-y-auto h-full">
      {/* Tabs */}
      <div class="tabs tabs-boxed">
        <button
          type="button"
          class={`tab ${activeTab() === 'general' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          type="button"
          class={`tab ${activeTab() === 'defaults' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('defaults')}
        >
          Defaults
        </button>
        <button
          type="button"
          class={`tab ${activeTab() === 'ai' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI Settings
        </button>
        <button
          type="button"
          class={`tab ${activeTab() === 'publishing' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('publishing')}
        >
          Publishing
        </button>
      </div>

      {/* General Tab */}
      <div class={`flex flex-col gap-4 ${activeTab() === 'general' ? '' : 'hidden'}`}>
        <h2 class="text-xl font-bold">General Story Settings</h2>

        <FormField
          label="Story Name"
          helpText="This is the name of the story that will be displayed in the reader (if you upload it)."
        >
          <input
            class="input input-bordered"
            value={storyState.story?.name}
            onInput={(e) => setStoryProperty('name', e.currentTarget.value)}
          />
        </FormField>

        <FormField label="Header Image" helpText="This is the image that will be displayed at the top of the story.">
          <FileSelector
            value={storyState.story?.settings?.headerImage}
            showOnlyUploaded={true}
            onChange={(file) => setStorySetting('headerImage', file)}
          />
        </FormField>
      </div>

      {/* Defaults Tab */}
      <div class={`flex flex-col gap-4 ${activeTab() === 'defaults' ? '' : 'hidden'}`}>
        <h2 class="text-xl font-bold">Default Settings</h2>

        <FormField label="Default Perspective" helpText="This will be used as the default perspective for new scenes.">
          <select
            class="select select-bordered w-full"
            value={storyState.story?.settings?.defaultPerspective ?? 'third'}
            onChange={(e) => setStorySetting('defaultPerspective', e.currentTarget.value as 'first' | 'third')}
          >
            <option value="first">First Person</option>
            <option value="third">Third Person</option>
          </select>
        </FormField>

        <FormField
          label="Default Protagonist"
          helpText="This character will be used as the default protagonist for new scenes."
        >
          <CharacterSelect
            value={storyState.story?.settings?.defaultProtagonistId || ''}
            onChange={(value) => {
              console.log('default protagonist', value)
              setStorySetting('defaultProtagonistId', value || undefined)
            }}
            placeholder="Select default protagonist..."
          />
        </FormField>

        <div class="flex gap-2">
          <button type="button" class="btn btn-primary flex-1" onClick={updateAllScenePerspectives}>
            Update All Scenes to Default Perspective
          </button>
          <button type="button" class="btn btn-primary flex-1" onClick={updateAllProtagonists}>
            Update All Scenes to Default Protagonist
          </button>
        </div>
      </div>

      {/* AI Settings Tab */}
      <div class={`flex flex-col gap-4 ${activeTab() === 'ai' ? '' : 'hidden'}`}>
        <h2 class="text-xl font-bold">AI Settings</h2>

        <FormField
          label="Instructions to give AI"
          helpText="You can use this to give specific instructions to the AI for this story, beyond the instructions already given as part of every command. E.g. 'All writing should be in present tense.'"
        >
          <textarea
            rows={4}
            placeholder="Instructions"
            value={storyState.story?.settings?.aiInstructions ?? ''}
            onInput={(e) => setStorySetting('aiInstructions', e.currentTarget.value)}
            class="textarea textarea-bordered"
          />
        </FormField>
      </div>

      {/* Publishing Tab */}
      <div class={`flex flex-col gap-4 ${activeTab() === 'publishing' ? '' : 'hidden'}`}>
        <h2 class="text-xl font-bold">Publishing Settings</h2>

        <div class="text-sm mb-4">
          <p>
            Configure publishing settings for different platforms. Each platform requires credentials to be set in the
            Global Settings.
          </p>
          <p class="mt-2 text-info">Note: The Reader platform is always enabled and will receive published chapters.</p>
        </div>

        <div class="flex flex-col gap-2">
          <For each={publishers}>
            {(publisher) => (
              <div class="collapse collapse-arrow bg-base-200">
                <input
                  type="checkbox"
                  checked={expandedPublishers().includes(publisher.id)}
                  onChange={() => togglePublisher(publisher.id)}
                />
                <div class="collapse-title text-xl font-medium">
                  {publisher.name}
                  {publisher.alwaysEnabled ? ' (Always Enabled) ✓' : hasPublisherCredentials(publisher.id) ? ' ✓' : ''}
                </div>
                <div class="collapse-content">
                  {publisher.id === 'reader' && (
                    <div class="flex flex-col gap-4">
                      <div class="alert alert-info">
                        <span>
                          The Reader platform is always enabled. All published chapters will be available in the reader
                          application.
                        </span>
                      </div>
                    </div>
                  )}
                  {publisher.id === 'royalroad' && (
                    <div class="flex flex-col gap-4">
                      <FormField
                        label="Royal Road ID"
                        helpText="When this is set, and you are logged into the online service, you can use the 'Import' function to import a story from Royal Road."
                      >
                        <input
                          placeholder="Royal Road ID"
                          value={storyState.story?.settings?.royalRoadId ?? ''}
                          onInput={(e) => setStorySetting('royalRoadId', e.target.value)}
                          class="input input-bordered"
                        />
                      </FormField>

                      <FormField
                        label="Publish to Royal Road"
                        helpText="When enabled, chapters will be published to Royal Road when you use the publish function."
                      >
                        <input
                          type="checkbox"
                          class="toggle toggle-primary"
                          checked={storyState.story?.settings?.publishToRoyalRoad ?? false}
                          onChange={(e) => setStorySetting('publishToRoyalRoad', e.currentTarget.checked)}
                        />
                      </FormField>

                      <div class="mt-4">
                        <button
                          type="button"
                          class="btn btn-primary w-full"
                          onClick={syncRoyalRoadPublishing}
                          disabled={isSyncing() || !hasPublisherCredentials('royalroad')}
                        >
                          {isSyncing() ? (
                            <>
                              <span class="loading loading-spinner loading-xs mr-2" />
                              Syncing...
                            </>
                          ) : (
                            'Sync Royal Road Publishing'
                          )}
                        </button>
                        <p class="text-sm text-gray-500 mt-2">
                          This sets your current Royal Road sync status. The current state of the chapter will be
                          considered the canonical state. Any changes made to chapters after this sync will be
                          synchronized to Royal Road in the next 'Publish' action.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
