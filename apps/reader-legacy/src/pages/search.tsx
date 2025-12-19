import { StoryStatus, StoryType } from '@prisma/client'
import { useState } from 'react'
import { Helmet } from 'react-helmet'
import StoryCard from '../components/storycard'
import { useSearchParams } from '../hooks/use-search-params'
import { useSignIn } from '../hooks/use-sign-in'
import { trpc } from '../utils/trpc'

export const SearchPage = () => {
  const searchParams = useSearchParams()
  const { user } = useSignIn()
  const query = searchParams.get('q') ?? ''

  // Advanced filter states
  const [status, setStatus] = useState<StoryStatus | undefined>(
    (searchParams.get('status') as StoryStatus) || undefined,
  )
  const [type, setType] = useState<StoryType | undefined>((searchParams.get('type') as StoryType) || undefined)
  const [minWords, setMinWords] = useState(searchParams.get('minWords') || '')
  const [maxWords, setMaxWords] = useState(searchParams.get('maxWords') || '')

  const {
    data: searchResults,
    isLoading,
    error,
  } = trpc.searchStories.useQuery({
    query: query,
    status: status,
    type: type,
    minWordsPerWeek: minWords ? Number.parseInt(minWords) : undefined,
    maxWordsPerWeek: maxWords ? Number.parseInt(maxWords) : undefined,
    limit: 50,
  })

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>
  }

  return (
    <>
      <Helmet>
        <title>Search Results - Reader</title>
      </Helmet>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">{query ? `Search Results for "${query}"` : 'Search Stories'}</h1>

        {/* Advanced Search Options */}
        <div className="bg-base-200 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Advanced Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Status</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={status || ''}
                onChange={(e) => setStatus((e.target.value as StoryStatus) || undefined)}
              >
                <option value="">Any Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="ONGOING">Ongoing</option>
                <option value="HIATUS">Hiatus</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Type</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={type || ''}
                onChange={(e) => setType((e.target.value as StoryType) || undefined)}
              >
                <option value="">Any Type</option>
                <option value="ORIGINAL">Original</option>
                <option value="FANFICTION">Fanfiction</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Min Words/Week</span>
              </label>
              <input
                type="number"
                className="input input-bordered w-full"
                value={minWords}
                onChange={(e) => setMinWords(e.target.value)}
                placeholder="Min words/week"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Max Words/Week</span>
              </label>
              <input
                type="number"
                className="input input-bordered w-full"
                value={maxWords}
                onChange={(e) => setMaxWords(e.target.value)}
                placeholder="Max words/week"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="flex flex-wrap justify-between gap-6">
        {searchResults?.stories.map((story) => (
          <StoryCard
            key={story.id}
            id={story.id}
            summary={story.summary ?? ''}
            coverArtAsset={story.coverArtAsset}
            name={story.name}
            ownerName={story.owner.name ?? ''}
            spellingLevel={story.spellingLevel ?? 0}
            wordsPerWeek={story.wordsPerWeek ?? 0}
            fontFamily={story.coverFontFamily}
            lastChapterReleasedAt={story.lastChapterReleasedAt}
            pages={story.pages ?? 0}
            color={story.coverColor}
            textColor={story.coverTextColor}
            royalRoadId={story.royalRoadId ?? undefined}
            status={story.status}
            canAddToLibrary={!!user}
          />
        ))}
      </div>

      {searchResults?.stories.length === 0 && (
        <div className="text-center py-8">
          <p className="text-lg">No stories found matching your search criteria.</p>
        </div>
      )}
    </>
  )
}
