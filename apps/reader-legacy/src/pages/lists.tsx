import { SavedType } from '@writer/server'
import { useState } from 'react'
import { Helmet } from 'react-helmet'
import StoryCard from '../components/storycard'
import { useSignIn } from '../hooks/use-sign-in'
import { trpc } from '../utils/trpc'

export const ListsPage = () => {
  const { user } = useSignIn()
  const [selectedTab, setSelectedTab] = useState<SavedType>('FAVORITE')
  const { data: bookshelfStories, isLoading, error } = trpc.getBookshelfStories.useQuery()

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>
  }

  // Categorize bookshelfStories by kind
  const categorizedStories: Record<SavedType, any[]> = {
    FAVORITE: [],
    FOLLOW: [],
    READ_LATER: [],
  }

  for (const story of bookshelfStories ?? []) {
    categorizedStories[story.kind].push(story)
  }

  return (
    <div className="container mx-auto p-4">
      <Helmet>
        <title>My Library - Reader</title>
      </Helmet>
      <h1 className="text-3xl font-bold mb-6">My library</h1>

      <div role="tablist" className="tabs tabs-boxed">
        <button
          type="button"
          role="tab"
          className={`tab ${selectedTab === 'FAVORITE' ? 'tab-active' : ''}`}
          onClick={() => setSelectedTab('FAVORITE')}
        >
          Favorites
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${selectedTab === 'FOLLOW' ? 'tab-active' : ''}`}
          onClick={() => setSelectedTab('FOLLOW')}
        >
          Followed
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${selectedTab === 'READ_LATER' ? 'tab-active' : ''}`}
          onClick={() => setSelectedTab('READ_LATER')}
        >
          Read Later
        </button>
      </div>

      {Object.entries(categorizedStories).map(
        ([kind, stories]) =>
          selectedTab === kind && (
            <div key={kind} className="mt-8">
              <div className="flex flex-wrap gap-6">
                {stories.map((story) => (
                  <StoryCard
                    key={story.id}
                    id={story.id}
                    coverArtAsset={story.coverArtAsset}
                    name={story.name}
                    ownerName={story.ownerName ?? ''}
                    pages={story.pages ?? 0}
                    summary={story.summary ?? ''}
                    color={story.color ?? ''}
                    textColor={story.coverTextColor ?? ''}
                    royalRoadId={story.royalRoadId ?? undefined}
                    canAddToLibrary={!!user}
                  />
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  )
}
