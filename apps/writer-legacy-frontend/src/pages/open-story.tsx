import { useNavigate } from '@solidjs/router'
import { open } from '@tauri-apps/plugin-dialog'
import { For, Show, createEffect, createSignal } from 'solid-js'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu'
import { openStory } from '../lib/persistence/open-story'
import { settingsState } from '../lib/stores/settings'
import { userState } from '../lib/stores/user'
import { trpc } from '../lib/trpc'

// Define a type for the story returned by the myFiction procedure
interface UserStory {
  id: string
  name: string
  summary: string | null
  coverArtAsset: string | null
  coverColor: string | null
  coverTextColor: string | null
  coverFontFamily: string | null
  firstChapterReleasedAt: Date | null
  spellingLevel: number | null
  lastChapterReleasedAt: Date | null
  royalRoadId: string | null
  sortOrder: number | null
  wordsPerWeek: number | null
  pages: number | null
  status: string
  ownerId: number
  owner: {
    name: string | null
  }
}

const Home = () => {
  const nav = useNavigate()
  const [userStories, setUserStories] = createSignal<UserStory[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  // Fetch user stories when the component mounts and the user is signed in
  createEffect(async () => {
    if (userState.signedInUser) {
      try {
        setIsLoading(true)
        setError(null)
        // The procedure is exported as 'myFiction' in the router
        const stories = await trpc.myFiction.query()
        setUserStories(stories as UserStory[])
      } catch (err) {
        console.error('Error fetching user stories:', err)
        setError('Failed to load your stories. Please try again later.')
      } finally {
        setIsLoading(false)
      }
    }
  })

  // Helper function to check if a story is already in recent stories
  const _isInRecentStories = (_storyId: string) => {
    // Since recent stories don't have IDs, we can't directly compare
    // We'll assume if a story is in recent stories, it's already been opened locally
    return false
  }

  return (
    <div class="flex flex-col h-full bg-base-200">
      <WriteHeaderMenu />
      <div class="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        <h1 class="text-2xl font-bold text-center mb-4">Open Story</h1>
        <div class="w-96 flex flex-col m-auto mt-8 gap-4">
          <h2 class="text-xl font-semibold mt-6">Recent stories</h2>
          <div class="space-y-2">
            <For each={settingsState.recentStories}>
              {(story) => (
                <button
                  type="button"
                  class="btn btn-outline btn-primary w-full"
                  onClick={async () => {
                    openStory(story.path)
                    nav('/write')
                  }}
                >
                  {story.name}
                </button>
              )}
            </For>
          </div>

          <Show when={userState.signedInUser}>
            <h2 class="text-xl font-semibold mt-6">Your stories</h2>
            <Show when={isLoading()}>
              <div class="flex justify-center">
                <span class="loading loading-spinner loading-md" />
              </div>
            </Show>
            <Show when={error()}>
              <div class="alert alert-error">
                <span>{error()}</span>
              </div>
            </Show>
            <Show when={!isLoading() && !error() && userStories().length === 0}>
              <p class="text-center text-base-content/70">You don't have any stories yet.</p>
            </Show>
            <div class="space-y-2">
              <For each={userStories()}>
                {(story) => (
                  <button
                    type="button"
                    class="btn btn-outline btn-secondary w-full"
                    onClick={async () => {
                      // Here we would need to implement a way to open a story from the server
                      // For now, we'll just show a message
                      alert('Opening stories from the server is not yet implemented.')
                    }}
                  >
                    {story.name || 'Untitled Story'}
                  </button>
                )}
              </For>
            </div>
          </Show>

          <button
            type="button"
            class="btn btn-primary"
            onClick={async () => {
              const projectPath = await open({
                multiple: false,
                directory: true,
              })
              if (projectPath) {
                const result = await openStory(projectPath)
                if (result) {
                  nav('/write')
                }
              }
            }}
          >
            Select a location from disk
          </button>
          <a href="/new-story" class="mt-12">
            <button type="button" class="btn btn-accent w-full">
              Create a new story
            </button>
          </a>
        </div>
      </div>
    </div>
  )
}

export default Home
