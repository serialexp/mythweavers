import { Helmet } from 'react-helmet'
import StoryCard from '../components/storycard'
import { useSignIn } from '../hooks/use-sign-in'
import { trpc } from '../utils/trpc'

export const MyFictionPage = () => {
  const { user } = useSignIn()
  const { data: myFictionData, isLoading, error } = trpc.myFiction.useQuery()

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>
  }

  return (
    <div className="container mx-auto p-4">
      <Helmet>
        <title>My Fiction - Reader</title>
      </Helmet>
      <h1 className="text-3xl font-bold mb-6">My Fiction</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myFictionData?.map((story) => (
          <StoryCard
            key={story.id}
            id={story.id}
            coverArtAsset={story.coverArtAsset}
            name={story.name}
            ownerName={story.owner.name ?? ''}
            pages={story.pages ?? 0}
            summary={story.summary ?? ''}
            color={story.coverColor ?? ''}
            textColor={story.coverTextColor ?? ''}
            fontFamily={story.coverFontFamily ?? ''}
            royalRoadId={story.royalRoadId ?? undefined}
            canAddToLibrary={!!user}
            status={story.status}
            lastChapterReleasedAt={story.lastChapterReleasedAt}
            wordsPerWeek={story.wordsPerWeek}
          />
        ))}
      </div>
    </div>
  )
}
