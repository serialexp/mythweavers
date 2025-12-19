import { Meta, Title } from '@solidjs/meta'
import { useSearchParams } from '@solidjs/router'
import { For, Show, createResource } from 'solid-js'
import { Layout } from '~/components/Layout'
import StoryCard from '~/components/StoryCard'
import { type PublicStory, storiesApi } from '~/lib/api'
import * as pageStyles from '~/styles/pages.css'

export default function Stories() {
  const [searchParams] = useSearchParams()

  // Get genre as string (take first if array)
  const getGenre = () => {
    const g = searchParams.genre
    return Array.isArray(g) ? g[0] : g
  }

  // Get status filter
  const getStatus = () => {
    const s = searchParams.status
    const status = Array.isArray(s) ? s[0] : s
    if (status === 'COMPLETED' || status === 'ONGOING' || status === 'HIATUS') {
      return status
    }
    return undefined
  }

  // We'll use createResource to fetch data with SSR support
  const [storiesData] = createResource(async () => {
    try {
      const result = await storiesApi.list({
        status: getStatus(),
        sortBy: 'recent',
      })
      return result?.stories || []
    } catch (error) {
      console.error('Error fetching stories:', error)
      return []
    }
  })

  return (
    <Layout>
      <Title>Reader - Stories</Title>
      <Meta name="description" content={`${getGenre() || 'All'} stories on Reader`} />

      <h1 class={pageStyles.pageTitle}>
        {getGenre() ? `${getGenre()!.charAt(0).toUpperCase() + getGenre()!.slice(1)} Stories` : 'All Stories'}
      </h1>

      <div class={pageStyles.storyGrid}>
        <Show when={!storiesData.loading} fallback={<div>Loading stories...</div>}>
          <Show when={storiesData()?.length} fallback={<div>No stories found</div>}>
            <For each={storiesData()}>
              {(story: PublicStory) => (
                <StoryCard
                  id={story.id}
                  name={story.name || 'Untitled'}
                  summary={story.summary || 'No summary available'}
                  coverArtAsset={undefined}
                  pages={story.pages || 0}
                  status={story.status}
                  canAddToLibrary={true}
                />
              )}
            </For>
          </Show>
        </Show>
      </div>
    </Layout>
  )
}
