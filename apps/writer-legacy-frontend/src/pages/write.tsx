import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { StoryNavigation } from '../components/StoryNavigation'
import { StoryPane } from '../components/StoryPane'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu'
import { storyState } from '../lib/stores/story'

const Home: Component = () => {
  return (
    <Show
      when={storyState.openPath}
      fallback={
        <div>
          <h1>No story open</h1>
          <a class="btn btn-primary" href="/open-story">
            Open story
          </a>
        </div>
      }
    >
      <div class="flex flex-col h-full">
        <WriteHeaderMenu />
        <div class="flex flex-1 overflow-hidden">
          <StoryNavigation />
          <StoryPane />
        </div>
      </div>
    </Show>
  )
}

export default Home
