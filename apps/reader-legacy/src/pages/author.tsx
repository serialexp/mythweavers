import { Helmet } from 'react-helmet'
import { useParams } from 'wouter'
import StoryCard from '../components/storycard' // Import the StoryCard component
import { trpc } from '../utils/trpc'

export const AuthorPage = () => {
  const { authorId } = useParams()
  const { data: user, isLoading, error } = trpc.userById.useQuery({ id: Number(authorId) })

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error.message}</div>
  }

  if (!user) {
    return <div>User not found</div>
  }

  return (
    <div className="container mx-auto p-4">
      <Helmet>
        <title>{user.name} - Reader</title>
      </Helmet>
      <h1 className="text-3xl font-bold mb-4">{user.name}</h1>
      <h2 className="text-2xl font-semibold mb-2">Published Stories</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {user.ownedStories.map((story) => (
          <StoryCard
            key={story.id}
            id={story.id}
            coverArtAsset={story.coverArtAsset} // Assuming this field exists
            name={story.name}
            ownerName={user.name ?? ''}
            pages={story.pages ?? 0}
            summary={story.summary ?? ''}
            color={story.coverColor ?? ''}
            textColor={story.coverTextColor ?? ''}
            status={story.status}
            lastChapterReleasedAt={story.lastChapterReleasedAt}
            wordsPerWeek={story.wordsPerWeek}
            fontFamily={story.coverFontFamily}
            royalRoadId={story.royalRoadId ?? undefined}
            canAddToLibrary={!!user}
          />
        ))}
      </div>
    </div>
  )
}
