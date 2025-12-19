import { Button, Card, CardBody } from '@mythweavers/ui'
import { Meta, Title } from '@solidjs/meta'
import { createAsync, query } from '@solidjs/router'
import { For, Show } from 'solid-js'
import { Layout } from '~/components/Layout'
import StoryCard from '~/components/StoryCard'
import { type PublicStory, storiesApi } from '~/lib/api'
import { getUserSessionQuery } from '~/lib/session'
import * as pageStyles from '~/styles/pages.css'

// Define the query function outside the component
const getStoriesQuery = query(async () => {
  try {
    const result = await storiesApi.list({
      pageSize: 10,
      sortBy: 'recent',
    })
    return { stories: result.stories }
  } catch (error) {
    console.error('Error fetching stories:', error)
    return { stories: [] }
  }
}, 'randomStories')

// Export the route object with a preload function
export const route = {
  preload: () => {
    getStoriesQuery()
    getUserSessionQuery()
  },
}

const features = [
  {
    icon: '🤖',
    title: 'AI Collaboration',
    description: 'Work with Claude, GPT-4, and local Ollama models to generate and refine your story content.',
  },
  {
    icon: '📚',
    title: 'Chapter Management',
    description: 'Organize your story into chapters with summaries and status tracking.',
  },
  {
    icon: '👥',
    title: 'Character Development',
    description: 'Create detailed character profiles that the AI references for consistency.',
  },
  {
    icon: '🗺️',
    title: 'World Building',
    description: "Design interactive maps with landmarks and visualize your story's geography.",
  },
  {
    icon: '💾',
    title: 'Auto-Save & Sync',
    description: 'Your work is automatically saved with real-time synchronization.',
  },
  {
    icon: '🌐',
    title: 'Offline Mode',
    description: 'Work without an internet connection with optional server sync.',
  },
]

export default function Home() {
  const stories = createAsync(() => getStoriesQuery())
  const user = createAsync(() => getUserSessionQuery())

  // Get the editor URL from environment or default to relative path
  const editorUrl = import.meta.env.VITE_EDITOR_URL || '/editor'

  return (
    <Layout user={user}>
      <Title>MythWeavers - AI-Powered Collaborative Storytelling</Title>
      <Meta name="description" content="Create and read stories with AI assistance on MythWeavers" />

      <div class={pageStyles.pageContainer}>
        <Card size="lg">
          <CardBody padding="lg" gap="lg">
            {/* Hero Section */}
            <section class={pageStyles.heroSection}>
              <h1 class={pageStyles.heroTitle}>MythWeavers</h1>
              <p class={pageStyles.heroSubtitle}>AI-Powered Collaborative Storytelling</p>
              <p class={pageStyles.heroDescription}>
                MythWeavers is an advanced writing assistant that helps authors craft compelling narratives through AI
                collaboration. Whether you're writing fiction, developing characters, or exploring plot ideas,
                MythWeavers provides intelligent assistance while maintaining your creative control.
              </p>
            </section>

            {/* CTA Buttons */}
            <section class={pageStyles.ctaSection}>
              <a href={editorUrl}>
                <Button size="lg">Start Writing</Button>
              </a>
              <a href="/stories">
                <Button size="lg" variant="secondary">
                  Browse Stories
                </Button>
              </a>
            </section>

            {/* Features Grid */}
            <section>
              <h2 class={pageStyles.sectionTitle}>Key Features</h2>
              <div class={pageStyles.featureGrid}>
                <For each={features}>
                  {(feature) => (
                    <Card variant="outlined">
                      <CardBody padding="md">
                        <h3 class={pageStyles.featureTitle}>
                          {feature.icon} {feature.title}
                        </h3>
                        <p class={pageStyles.featureDescription}>{feature.description}</p>
                      </CardBody>
                    </Card>
                  )}
                </For>
              </div>
            </section>

            {/* Recent Stories */}
            <section>
              <h2 class={pageStyles.sectionTitle}>Recent Stories</h2>
              <div class={pageStyles.storyGrid}>
                <Show when={stories()} fallback={<div>Loading stories...</div>}>
                  <Show when={stories()?.stories?.length} fallback={<div class={pageStyles.textMuted}>No stories published yet. Be the first to share your story!</div>}>
                    <For each={stories()?.stories}>
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
            </section>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
