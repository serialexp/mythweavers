import { useNavigate } from '@solidjs/router'
import { open } from '@tauri-apps/plugin-dialog'
import { createSignal } from 'solid-js'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu'
import { newStory } from '../lib/stores/story'

const Home = () => {
  const [storyName, setStoryName] = createSignal('')
  const nav = useNavigate()

  return (
    <div class="flex flex-col h-full bg-base-200">
      <WriteHeaderMenu />
      <div class="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        <h1 class="text-2xl font-bold text-center mb-4">New Story</h1>
        <div class="w-96 flex flex-col m-auto mt-8 gap-4">
          <h2 class="text-lg font-semibold">Create new story</h2>
          <p>After entering a name, you can select a location on disk to save the story.</p>
          <input
            type="text"
            class="input input-bordered w-full mt-2"
            value={storyName()}
            onChange={(e) => {
              setStoryName(e.currentTarget.value)
            }}
          />
          <button
            type="button"
            class="btn btn-primary mt-2 w-full"
            disabled={storyName().length === 0}
            onClick={async () => {
              const projectPath = await open({
                multiple: false,
                directory: true,
              })
              if (projectPath === null) {
                return
              }
              newStory({
                name: storyName(),
                projectPath: projectPath,
              })
              nav('/write')
            }}
          >
            Create
          </button>
          <a href="/open-story" class="mt-12">
            <button type="button" class="btn btn-accent w-full">
              Open an existing story
            </button>
          </a>
        </div>
      </div>
    </div>
  )
}

export default Home
