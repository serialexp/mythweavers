import { Button } from '@mythweavers/ui'
import { For, createSignal } from 'solid-js'
import { storiesApi, type PublicStory } from '../lib/api'
import StoryCard from './StoryCard'
import * as pageStyles from '../styles/pages.css'

interface RandomStoriesProps {
  initialStories: PublicStory[]
  canAddToLibrary: boolean
}

export default function RandomStories(props: RandomStoriesProps) {
  const [stories, setStories] = createSignal<PublicStory[]>(props.initialStories)
  const [loading, setLoading] = createSignal(false)

  const refreshStories = async () => {
    setLoading(true)
    try {
      const result = await storiesApi.list({ pageSize: 8, sortBy: 'random' })
      setStories(result.stories)
    } catch (error) {
      console.error('Error fetching random stories:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div class={pageStyles.storyGrid}>
        <For each={stories()}>
          {(story) => (
            <StoryCard
              id={story.id}
              name={story.name || 'Untitled'}
              summary={story.summary || 'No summary available'}
              pages={story.pages || 0}
              status={story.status}
              wordsPerWeek={story.wordsPerWeek}
              color={story.coverColor}
              textColor={story.coverTextColor}
              fontFamily={story.coverFontFamily}
              canAddToLibrary={props.canAddToLibrary}
            />
          )}
        </For>
      </div>

      <div style={{ 'margin-top': '1.5rem', 'text-align': 'center' }}>
        <Button
          variant="primary"
          onClick={refreshStories}
          disabled={loading()}
        >
          {loading() ? 'Loading...' : 'Show me more stories!'}
        </Button>
      </div>
    </div>
  )
}
